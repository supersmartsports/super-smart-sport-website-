"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import {
  Box3,
  Color,
  NeutralToneMapping,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
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

export type FootballSceneProps = {
  modelUrl: string;
  recolor?: Recolor | null;
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
};

const textureSlots = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "clearcoatNormalMap",
] as const;

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

function Football({
  modelUrl,
  recolor,
  rotation,
  autoRotateSpeed,
  onReady,
}: Pick<FootballSceneProps, "modelUrl" | "recolor" | "rotation" | "autoRotateSpeed" | "onReady">) {
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
          .replace("void main() {", `${RECOLOR_UNIFORMS}
void main() {`)
          .replace("#include <map_fragment>", `#include <map_fragment>
${RECOLOR_GLSL}`);
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
      useGLTF.clear(modelUrl);
    };
  }, [scene, modelUrl]);

  useFrame((_, delta) => {
    const state = rotation.current;
    const node = group.current;
    if (!state || !node) return;
    const dt = Math.min(delta, 0.05);
    if (!state.dragging) {
      state.yaw += (autoRotateSpeed ?? 0) * dt + state.velocity * dt;
      state.velocity *= Math.pow(0.04, dt); // drag inertia fades in about a second
    }
    node.rotation.y = state.yaw;
    node.rotation.x += (state.pitch - node.rotation.x) * Math.min(1, dt * 10);
  });

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
  rotation,
  autoRotateSpeed = 0.35,
  active = true,
  shadow = true,
  lowPower = false,
  preserveDrawingBuffer = false,
  onReady,
}: FootballSceneProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, lowPower ? 1.5 : 2]}
      camera={{ fov: 26, position: [0, 0.12, 5.6], near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: "pan-y" }}
    >
      <ResumeLoop active={active} />
      <StudioLighting />
      <Football modelUrl={modelUrl} recolor={recolor} rotation={rotation} autoRotateSpeed={autoRotateSpeed} onReady={onReady} />
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
