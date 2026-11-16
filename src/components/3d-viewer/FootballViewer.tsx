"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
  type PointerEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useViewerSlot } from "@/features/3d-football/active-viewer";
import type { Anchor, Recolor, RotationState } from "./FootballScene";

// Three.js is only downloaded when a viewer is actually shown.
const FootballScene = dynamic(() => import("./FootballScene"), { ssr: false });

class SceneBoundary extends Component<{ onError: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[3D viewer] could not start:", error);
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

let webglSupport: boolean | null = null;

/** Checked once, and the test context is released straight away: browsers allow only a limited number of live WebGL contexts. */
function supportsWebGL() {
  if (webglSupport === true) return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    webglSupport = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport === true;
}

export type FootballViewerProps = {
  modelUrl: string;
  /** Still render of the same model: shown while loading and when 3D is unavailable. */
  poster: string;
  name: string;
  /**
   * Primary viewers (hero, product page, studio) load straight away and stay loaded.
   * All others go live while they are on screen and release their 3D slot when they leave.
   */
  eager?: boolean;
  /** "contact" renders a real contact shadow in 3D; "soft" keeps a lightweight CSS shadow. */
  shadow?: "contact" | "soft" | "none";
  autoRotate?: boolean;
  /** Indicative colour preview for the customization studio. */
  recolor?: Recolor | null;
  /** 0 to 1, read every frame: opens the ball into its layers. */
  explode?: RefObject<number>;
  /** Screen positions of the ball's layers while it is open, for labels. */
  anchors?: RefObject<Anchor[]>;
  /**
   * Makes the canvas this many times larger than the ball's area (the ball keeps its size),
   * leaving room for the open ball to spread without being cropped to a box.
   */
  frame?: number;
  /** Tone of the surface behind the viewer, for the status text. */
  tone?: "dark" | "light";
  posterSizes?: string;
  posterPriority?: boolean;
  className?: string;
};

const DRAG_SENSITIVITY = 0.008;
const KEY_STEP = 0.35;

export function FootballViewer({
  modelUrl,
  poster,
  name,
  eager = false,
  shadow = "contact",
  autoRotate = true,
  recolor,
  explode,
  anchors,
  frame = 1,
  tone = "dark",
  posterSizes = "(min-width: 1024px) 50vw, 100vw",
  posterPriority = false,
  className = "",
}: FootballViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const rotation = useRef<RotationState>({ yaw: 0, pitch: 0, velocity: 0, dragging: false });
  const pointer = useRef({ x: 0, y: 0, time: 0 });
  const reducedMotion = useReducedMotion();

  const [nearViewport, setNearViewport] = useState(eager);
  const [onScreen, setOnScreen] = useState(eager);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    setLowPower(window.matchMedia("(max-width: 767px), (pointer: coarse)").matches);
    // Start loading a little before the viewer scrolls in; pause rendering once it leaves.
    const preload = new IntersectionObserver(([entry]) => entry.isIntersecting && setNearViewport(true), {
      rootMargin: "300px",
    });
    const visible = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    preload.observe(node);
    visible.observe(node);
    return () => {
      preload.disconnect();
      visible.disconnect();
    };
  }, []);

  // Wait until a football has settled on screen before taking a slot, so fast scrolling
  // past a grid does not start loading every model on the way.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!onScreen) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), 200);
    return () => clearTimeout(timer);
  }, [onScreen]);

  const viewerId = useId();
  const hasSlot = useViewerSlot(viewerId, !eager && settled);
  const shouldMount = (eager ? nearViewport : hasSlot) && status !== "unavailable";

  // Back to the still render once the live viewer is released.
  useEffect(() => {
    if (!shouldMount) setStatus((current) => (current === "unavailable" ? current : "idle"));
  }, [shouldMount]);

  useEffect(() => {
    if (!shouldMount || status !== "idle") return;
    setStatus(supportsWebGL() ? "loading" : "unavailable");
  }, [shouldMount, status]);

  // A different model in the same viewer starts a fresh load.
  useEffect(() => {
    setStatus((current) => (current === "ready" ? "loading" : current));
  }, [modelUrl]);

  const handleReady = useCallback(() => setStatus("ready"), []);
  // A failed or lost 3D context is retried a couple of times before falling back to the still image for good.
  const [attempt, setAttempt] = useState(0);
  const reason = useRef("");
  const handleError = useCallback((why?: string) => {
    if (why) reason.current = why;
    setAttempt((current) => {
      if (current < 2) {
        setTimeout(() => setStatus("loading"), 0);
        return current + 1;
      }
      setTimeout(() => setStatus("unavailable"), 0);
      return current;
    });
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (status !== "ready") return;
    rotation.current.dragging = true;
    rotation.current.velocity = 0;
    pointer.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = rotation.current;
    if (!state.dragging) return;
    const dx = event.clientX - pointer.current.x;
    const dy = event.clientY - pointer.current.y;
    const dt = Math.max(1, event.timeStamp - pointer.current.time) / 1000;
    state.yaw += dx * DRAG_SENSITIVITY;
    state.velocity = (dx * DRAG_SENSITIVITY) / dt;
    // Touch keeps vertical movement for page scrolling; a mouse can also tilt the ball.
    if (event.pointerType !== "touch") {
      state.pitch = Math.max(-0.7, Math.min(0.7, state.pitch + dy * DRAG_SENSITIVITY));
    }
    pointer.current = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  };

  const endDrag = () => {
    const state = rotation.current;
    state.dragging = false;
    state.velocity = Math.max(-6, Math.min(6, state.velocity));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const state = rotation.current;
    if (event.key === "ArrowLeft") state.yaw -= KEY_STEP;
    else if (event.key === "ArrowRight") state.yaw += KEY_STEP;
    else if (event.key === "ArrowUp") state.pitch = Math.max(-0.7, state.pitch - KEY_STEP / 2);
    else if (event.key === "ArrowDown") state.pitch = Math.min(0.7, state.pitch + KEY_STEP / 2);
    else return;
    event.preventDefault();
  };

  const ready = status === "ready";
  const statusColor = tone === "dark" ? "text-white/60" : "text-slate";

  // With frame > 1 the canvas is larger than the ball's own area, so panels can fly well
  // outside it without being cropped. Only the ball's own area takes pointer input.
  const inset = frame > 1 ? `${((1 - 1 / frame) / 2) * 100}%` : "0%";

  return (
    <div
      ref={container}
      className={`relative aspect-square w-full select-none ${frame > 1 ? "pointer-events-none" : ""} ${className}`}
    >
      {shouldMount && status !== "idle" && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <SceneBoundary key={attempt} onError={handleError}>
            <Suspense fallback={null}>
              <FootballScene
                modelUrl={eager ? modelUrl : modelUrl.replace("/footballs/", "/footballs/lite/")}
                recolor={recolor}
                explode={explode}
                anchors={anchors}
                frame={frame}
                rotation={rotation}
                autoRotateSpeed={autoRotate && !reducedMotion ? 0.5 : 0}
                active={onScreen}
                shadow={shadow === "contact"}
                lowPower={lowPower || attempt > 0}
                onReady={handleReady}
                onContextLost={() => handleError("The browser removed the 3D context")}
                fallbackLighting={attempt > 0}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}

      <div
        role="group"
        aria-label={`3D model of the ${name} football. Drag or use the arrow keys to rotate.`}
        tabIndex={ready ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={`pointer-events-auto absolute ${ready ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ inset, touchAction: "pan-y" }}
      >
        {shadow !== "none" && (
          <div
            aria-hidden
            className={`pointer-events-none absolute bottom-[4.5%] left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] blur-md transition-opacity duration-700 ${
              tone === "dark" ? "bg-black/70" : "bg-navy-deep/30"
            } ${ready && shadow === "contact" ? "opacity-0" : "opacity-100"}`}
          />
        )}

        {/* Poster sits in the same frame as the 3D ball, so the hand-over is a cross-fade. */}
        <Image
          src={poster}
          alt={`${name} football`}
          fill
          sizes={posterSizes}
          priority={posterPriority}
          draggable={false}
          className={`pointer-events-none object-contain p-[10.5%] transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
        />

        <p
          aria-live="polite"
          data-reason={status === "unavailable" ? reason.current : undefined}
          className={`pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs ${statusColor} transition-opacity duration-500 ${
            status === "loading" || (status === "unavailable" && eager) ? "opacity-100" : "opacity-0"
          }`}
        >
          {status === "loading" && "Loading 3D model"}
          {status === "unavailable" && eager && "3D view is not available on this device. Showing a still image."}
        </p>
      </div>
    </div>
  );}
