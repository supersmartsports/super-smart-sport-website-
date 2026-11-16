"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  NeutralToneMapping,
  Object3D,
  Vector3,
  type Texture,
} from "three";

/** Rotation state shared between the DOM pointer handlers and the render loop. */
export type RotationState = {
  yaw: number;
  pitch: number;
  velocity: number;
  dragging: boolean;
};

/** Indicative colour preview: swaps the navy and red of the original artwork. */
export type Recolor = { primary: string; secondary: string };

/** A point on the canvas as a fraction of its width and height (0 to 1, from the top left). */
export type Anchor = { x: number; y: number };

export type FootballSceneProps = {
  modelUrl: string;
  recolor?: Recolor | null;
  /**
   * 0 to 1, read every frame. Above 0 the ball comes apart: every panel flies outward
   * and the layers inside (foam cushion, lining, bladder) are revealed.
   */
  explode?: RefObject<number>;
  /**
   * Filled every frame while the ball is open with the screen position of one point on
   * each layer, in order: outer shell, foam cushion, lining, bladder. Used for labels.
   */
  anchors?: RefObject<Anchor[]>;
  /** Canvas size relative to the ball's area; the camera backs away by this factor. */
  frame?: number;
  rotation: RefObject<RotationState>;
  /** Radians per second. 0 disables idle rotation (reduced motion). */
  autoRotateSpeed?: number;
  /** Stops the render loop while the canvas is off screen. */
  active?: boolean;
  shadow?: boolean;
  /** Lower pixel density and lighter shadows for phones. */
  lowPower?: boolean;
  /** Keeps the frame readable for image export. Off in normal use. */
  preserveDrawingBuffer?: boolean;
  onReady?: () => void;
  /** Light the ball with plain lights instead of the studio environment, for graphics hardware that cannot build it. */
  fallbackLighting?: boolean;
  /** Called if the browser takes the 3D context away (for example too many canvases are open). */
  onContextLost?: () => void;
};

const textureSlots = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "clearcoatNormalMap"] as const;

const RECOLOR_UNIFORMS = "uniform vec3 uPrimary; uniform vec3 uSecondary; uniform float uRecolor;";
const RECOLOR_GLSL = /* glsl */ `
  if (uRecolor > 0.5) {
    vec3 c = diffuseColor.rgb;
    float redMask = smoothstep(0.06, 0.22, c.r - max(c.g, c.b));
    float blueMask = smoothstep(0.012, 0.05, c.b - max(c.r, c.g)) * (1.0 - redMask);
    c = mix(c, uSecondary * clamp(c.r / 0.82, 0.0, 1.15), redMask);
    c = mix(c, uPrimary * clamp(c.b / 0.14, 0.0, 1.3), blueMask);
    diffuseColor.rgb = c;
  }
`;

function forEachMaterial(root: Object3D, visit: (material: Material) => void) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(visit);
  });
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (from: number, to: number, value: number) => {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};

/** Splits a mesh into its separate connected pieces. In these models, every panel is one piece. */
function splitGeometry(source: BufferGeometry): BufferGeometry[] {
  const index = source.index;
  const count = source.getAttribute("position").count;
  if (!index) return [source.clone()];
  const triangles = index.array;

  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let i = 0; i < triangles.length; i += 3) {
    const root = find(triangles[i]);
    for (let k = 1; k < 3; k += 1) {
      const other = find(triangles[i + k]);
      if (other !== root) parent[other] = root;
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < triangles.length; i += 3) {
    const key = find(triangles[i]);
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  }

  const names = Object.keys(source.attributes);
  const remap = new Int32Array(count);
  const pieces: BufferGeometry[] = [];
  for (const starts of groups.values()) {
    remap.fill(-1);
    const order: number[] = [];
    const newIndex: number[] = [];
    for (const start of starts) {
      for (let k = 0; k < 3; k += 1) {
        const vertex = triangles[start + k];
        if (remap[vertex] < 0) {
          remap[vertex] = order.length;
          order.push(vertex);
        }
        newIndex.push(remap[vertex]);
      }
    }
    const geometry = new BufferGeometry();
    for (const name of names) {
      const attribute = source.getAttribute(name);
      const size = attribute.itemSize;
      const data = new Float32Array(order.length * size);
      for (let j = 0; j < order.length; j += 1) {
        const v = order[j];
        data[j * size] = attribute.getX(v);
        if (size > 1) data[j * size + 1] = attribute.getY(v);
        if (size > 2) data[j * size + 2] = attribute.getZ(v);
        if (size > 3) data[j * size + 3] = attribute.getW(v);
      }
      geometry.setAttribute(name, new BufferAttribute(data, size));
    }
    geometry.setIndex(newIndex);
    pieces.push(geometry);
  }
  return pieces;
}

type Piece = { mesh: Mesh; direction: Vector3; reach: number };

/**
 * Rebuilds the football as one mesh per panel, in the same place and with the same
 * materials, so it looks identical closed and each panel can fly away when opened.
 */
function buildPanels(scene: Object3D, centre: Vector3) {
  scene.updateMatrixWorld(true);
  const root = new Group();
  const pieces: Piece[] = [];
  const materials = new Map<Material, Material>();
  const geometries: BufferGeometry[] = [];

  scene.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const original = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    let material = materials.get(original);
    if (!material) {
      material = original.clone();
      // Panels are thin shells: their inside shows once they fly apart.
      material.side = DoubleSide;
      materials.set(original, material);
    }
    for (const geometry of splitGeometry(mesh.geometry)) {
      geometry.applyMatrix4(mesh.matrixWorld);
      geometries.push(geometry);
      const positions = geometry.getAttribute("position");
      const centroid = new Vector3();
      for (let i = 0; i < positions.count; i += 1) {
        centroid.x += positions.getX(i);
        centroid.y += positions.getY(i);
        centroid.z += positions.getZ(i);
      }
      centroid.divideScalar(positions.count);

      const piece = new Mesh(geometry, material);
      piece.userData.centroid = centroid;
      root.add(piece);
      const direction = centroid.clone().add(centre);
      pieces.push({ mesh: piece, direction, reach: 0 });
    }
  });

  pieces.forEach((piece, index) => {
    // Panels slide out sideways, mostly in the plane the camera sees, so the ones on the
    // near side do not hide the layers inside.
    const d = piece.direction.normalize();
    const flat = new Vector3(d.x, d.y, d.z * 0.45);
    if (Math.hypot(flat.x, flat.y) < 0.4) {
      const angle = index * 2.399963;
      flat.set(Math.cos(angle) * 0.9, Math.sin(angle) * 0.9, d.z * 0.45);
    }
    const lateral = Math.min(1, Math.hypot(flat.x, flat.y));
    piece.direction = flat.normalize();
    // Panels near the middle of the view travel furthest, so they clear the layers behind them.
    piece.reach = 0.95 + 0.6 * (1 - lateral) + 0.3 * ((index * 0.6180339) % 1);
  });

  // The panel the first label points at: the upper right one.
  let outer = pieces[0];
  let best = -Infinity;
  for (const piece of pieces) {
    const score = piece.direction.x * 0.6 + piece.direction.y * 0.5;
    if (score > best) {
      best = score;
      outer = piece;
    }
  }
  const outerAnchor = new Object3D();
  outerAnchor.position.copy(outer.mesh.userData.centroid as Vector3);
  outer.mesh.add(outerAnchor);

  return { root, pieces, outerAnchor, materials: [...materials.values()], geometries };
}

/** Models that were shown and then released, newest last. Only a few are kept parsed, to bound memory on phones. */
const recentModels: string[] = [];
const RECENT_MODELS = 3;

function Football({
  modelUrl,
  recolor,
  explode,
  anchors,
  rotation,
  autoRotateSpeed,
  onReady,
}: Pick<FootballSceneProps, "modelUrl" | "recolor" | "explode" | "anchors" | "rotation" | "autoRotateSpeed" | "onReady">) {
  // Draco off, Meshopt on: the web-ready models are Meshopt-compressed.
  const { scene } = useGLTF(modelUrl, false, true);
  const group = useRef<Group>(null);
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());

  // Normalise every model to a ball of radius 1 centred on the origin,
  // so all footballs frame identically whatever their export scale.
  const { scale, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const s = 2 / Math.max(size.x, size.y, size.z);
    return { scale: s, offset: center.multiplyScalar(-1) };
  }, [scene]);

  useEffect(() => {
    forEachMaterial(scene, (material) => {
      for (const slot of textureSlots) {
        const texture = (material as unknown as Record<string, Texture | null>)[slot];
        if (texture) texture.anisotropy = Math.min(8, maxAnisotropy);
      }
    });
    onReady?.();
  }, [scene, maxAnisotropy, onReady]);

  // Colour preview. The artwork is baked into one texture, so the shader finds its navy and red
  // areas and repaints them, keeping the original shading. Only patched when a preview is requested.
  const recolorUniforms = useMemo(
    () => ({ uPrimary: { value: new Color() }, uSecondary: { value: new Color() }, uRecolor: { value: 0 } }),
    [],
  );
  const wantsRecolor = recolor != null;

  useEffect(() => {
    if (!wantsRecolor) return;
    forEachMaterial(scene, (material) => {
      if (material.userData.recolorPatched) return;
      material.userData.recolorPatched = true;
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, recolorUniforms);
        shader.fragmentShader = shader.fragmentShader
          .replace("void main() {", `${RECOLOR_UNIFORMS}\nvoid main() {`)
          .replace("#include <map_fragment>", `#include <map_fragment>\n${RECOLOR_GLSL}`);
      };
      material.customProgramCacheKey = () => "sss-recolor";
      material.needsUpdate = true;
    });
  }, [scene, wantsRecolor, recolorUniforms]);

  useEffect(() => {
    recolorUniforms.uRecolor.value = recolor ? 1 : 0;
    if (recolor) {
      recolorUniforms.uPrimary.value.set(recolor.primary);
      recolorUniforms.uSecondary.value.set(recolor.secondary);
    }
  }, [recolor, recolorUniforms]);

  // Exploded view: only built for viewers that ask for it.
  const canExplode = explode != null;
  const rig = useMemo(() => (canExplode ? buildPanels(scene, offset) : null), [canExplode, scene, offset]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      rig.geometries.forEach((geometry) => geometry.dispose());
      rig.materials.forEach((material) => material.dispose());
    };
  }, [rig]);

  const foamTop = useRef<Mesh>(null);
  const foamBottom = useRef<Mesh>(null);
  const liningTop = useRef<Mesh>(null);
  const liningBottom = useRef<Mesh>(null);
  const core = useRef<Group>(null);
  const anchorObjects = useRef<(Object3D | null)[]>([null, null, null, null]);
  const opened = useRef(0);
  const probe = useMemo(() => new Vector3(), []);

  // Release GPU memory when the viewer goes away. The file itself stays in the
  // browser's HTTP cache, so showing the model again is fast.
  useEffect(() => {
    return () => {
      scene.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
      forEachMaterial(scene, (material) => {
        for (const slot of textureSlots) {
          (material as unknown as Record<string, Texture | null>)[slot]?.dispose();
        }
        material.dispose();
      });
      // GPU memory is released above, but the parsed model stays in memory for the last few
      // footballs viewed, so coming back to one is instant (no download, no decoding).
      const at = recentModels.indexOf(modelUrl);
      if (at >= 0) recentModels.splice(at, 1);
      recentModels.push(modelUrl);
      while (recentModels.length > RECENT_MODELS) useGLTF.clear(recentModels.shift()!);
    };
  }, [scene, modelUrl]);

  useFrame((state, delta) => {
    const spin = rotation.current;
    const node = group.current;
    if (!spin || !node) return;
    const dt = Math.min(delta, 0.05);
    if (!spin.dragging) {
      spin.yaw += (autoRotateSpeed ?? 0) * dt + spin.velocity * dt;
      spin.velocity *= Math.pow(0.04, dt); // drag inertia fades in about a second
    }

    // Ease towards the requested opening so scroll jumps never snap the pieces.
    const target = rig ? clamp01(explode?.current ?? 0) : 0;
    opened.current += (target - opened.current) * Math.min(1, dt * 7);
    const e = opened.current < 0.001 ? 0 : opened.current;

    // The open ball faces the camera, so the layers inside can be read.
    // Scrolling the page turns every football, on top of its own slow spin and any drag.
    const total = spin.yaw + window.scrollY * 0.0045;
    const wrapped = ((((total + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    node.rotation.y = wrapped * (1 - e);
    node.rotation.x += (spin.pitch * (1 - e) - node.rotation.x) * Math.min(1, dt * 10);
    if (!rig) return;

    // Narrow screens get a tighter spread so the open ball stays on screen.
    const spread = Math.min(1, Math.max(0.5, window.innerWidth / 1000));
    const panelsOut = smooth(0, 0.55, e);
    const layersOut = smooth(0.55, 1, e);
    node.scale.setScalar(1 - 0.1 * e);

    for (const piece of rig.pieces) {
      piece.mesh.position.copy(piece.direction).multiplyScalar((piece.reach * panelsOut * spread) / scale);
    }
    // The inside only appears once the panels have cleared it, so nothing pokes through.
    if (core.current) core.current.visible = panelsOut > 0.22;
    if (foamTop.current) foamTop.current.position.y = 0.6 * layersOut;
    if (foamBottom.current) foamBottom.current.position.y = -0.6 * layersOut;
    if (liningTop.current) liningTop.current.position.y = 0.3 * layersOut;
    if (liningBottom.current) liningBottom.current.position.y = -0.3 * layersOut;

    const list = anchors?.current;
    if (list && e > 0.02) {
      node.updateMatrixWorld(true);
      anchorObjects.current[0] = rig.outerAnchor;
      anchorObjects.current.forEach((object, index) => {
        if (!object || !list[index]) return;
        object.getWorldPosition(probe);
        probe.project(state.camera);
        list[index].x = (probe.x + 1) / 2;
        list[index].y = (1 - probe.y) / 2;
      });
    }
  });

  if (rig) {
    return (
      <group ref={group}>
        <group scale={scale}>
          <primitive object={rig.root} position={offset} />
        </group>
        <group ref={core} visible={false}>
          {/* foam cushion */}
          <mesh ref={foamTop}>
            <sphereGeometry args={[0.88, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#efe7d2" roughness={0.92} side={DoubleSide} />
            <object3D ref={(object) => void (anchorObjects.current[1] = object)} position={[0.76, 0.42, 0.1]} />
          </mesh>
          <mesh ref={foamBottom}>
            <sphereGeometry args={[0.88, 56, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#efe7d2" roughness={0.92} side={DoubleSide} />
          </mesh>
          {/* lining */}
          <mesh ref={liningTop}>
            <sphereGeometry args={[0.78, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#6f83bd" roughness={0.8} side={DoubleSide} />
            <object3D ref={(object) => void (anchorObjects.current[2] = object)} position={[0.68, 0.36, 0.1]} />
          </mesh>
          <mesh ref={liningBottom}>
            <sphereGeometry args={[0.78, 56, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color="#6f83bd" roughness={0.8} side={DoubleSide} />
          </mesh>
          {/* bladder */}
          <mesh>
            <sphereGeometry args={[0.64, 64, 40]} />
            <meshPhysicalMaterial color="#09090d" roughness={0.18} clearcoat={1} clearcoatRoughness={0.1} />
            <object3D ref={(object) => void (anchorObjects.current[3] = object)} position={[0.56, 0.06, 0.2]} />
          </mesh>
          <mesh position={[0.18, 0.61, 0.12]}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshBasicMaterial color="#4f7dff" toneMapped={false} />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group ref={group}>
      <group scale={scale}>
        <primitive object={scene} position={offset} />
      </group>
    </group>
  );
}

/** The render loop sleeps while the canvas is off screen; this wakes it when the canvas returns. */
function ResumeLoop({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  return null;
}

/** Simple lighting that needs no special graphics features. Less refined than the studio set, but it always works. */
function PlainLighting() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#8f93b8", 1.4]} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.9} />
    </>
  );
}

/** Soft-box studio lighting built in code, so no HDR file has to be downloaded. */
function StudioLighting() {
  return (
    <>
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#1a1c2a"]} />
        {/* key: large overhead soft box */}
        <Lightformer form="rect" intensity={3.2} position={[0, 5, 2]} rotation-x={-Math.PI / 2.4} scale={[9, 6, 1]} />
        {/* front fill */}
        <Lightformer form="rect" intensity={1.1} position={[0, 0.5, 6]} scale={[8, 5, 1]} />
        {/* side strips give the panels an edge highlight */}
        <Lightformer form="rect" intensity={2.2} position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[5, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[5, 3, 1]} />
        {/* floor bounce */}
        <Lightformer form="rect" intensity={0.5} position={[0, -5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      </Environment>
      <directionalLight position={[3, 5, 4]} intensity={0.6} />
    </>
  );
}

export default function FootballScene({
  modelUrl,
  recolor = null,
  explode,
  anchors,
  frame = 1,
  rotation,
  autoRotateSpeed = 0.5,
  active = true,
  shadow = true,
  lowPower = false,
  preserveDrawingBuffer = false,
  fallbackLighting = false,
  onReady,
  onContextLost,
}: FootballSceneProps) {
  // A very large canvas on a high-density screen can exceed what a modest graphics card allows,
  // so keep the drawing buffer to roughly 1500 pixels across however large the canvas is.
  const maxDpr = frame > 1 && typeof window !== "undefined" ? Math.min(1.5, Math.max(0.75, 1500 / (frame * 0.7 * window.innerHeight))) : lowPower ? 1.5 : 2;
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[Math.min(1, maxDpr), maxDpr]}
      camera={{ fov: 26, position: [0, 0, 5.6 * frame], near: 0.1, far: 30 * frame }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost?.();
        });
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: "pan-y" }}
    >
      <ResumeLoop active={active} />
      {fallbackLighting ? <PlainLighting /> : <StudioLighting />}
      <Football
        modelUrl={modelUrl}
        recolor={recolor}
        explode={explode}
        anchors={anchors}
        rotation={rotation}
        autoRotateSpeed={autoRotateSpeed}
        onReady={onReady}
      />
      {shadow && (
        // A sphere's contact shadow never changes as it spins, so render it once.
        <ContactShadows
          frames={1}
          position={[0, -1.03, 0]}
          opacity={0.55}
          scale={5}
          blur={2.6}
          far={2}
          resolution={lowPower ? 256 : 512}
          color="#02030f"
        />
      )}
    </Canvas>
  );
}
