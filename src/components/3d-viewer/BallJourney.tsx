"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import type { Product } from "@/types/product";
import type { Anchor } from "./FootballScene";
import { FootballViewer } from "./FootballViewer";

/**
 * One football that travels down the page with the scroll.
 *
 * Sections mark where the ball should rest with <BallSlot order={n} />. A single live
 * 3D viewer is then moved and scaled from slot to slot as the visitor scrolls, so the
 * same ball appears to roll from the hero into each following section.
 *
 * With reduced motion there is no travelling ball: slots that ask for a fallback
 * simply show their own viewer in place.
 */
type Journey = {
  product: Product;
  /** null until the browser has been checked, then whether the ball travels. */
  travel: boolean | null;
  register: (order: number, node: HTMLElement | null) => void;
  /** 0 to 1: how far the ball is opened into its layers. Written by the layers section. */
  explode: RefObject<number>;
  /** Screen positions of the open ball's layers, written by the 3D scene. */
  anchors: RefObject<Anchor[]>;
  /** The element holding the travelling canvas, for mapping anchors to the screen. */
  ball: RefObject<HTMLDivElement | null>;
};

/** How much larger the travelling canvas is than the ball, so the open ball is never boxed in. */
const FRAME = 2.5;

const JourneyContext = createContext<Journey | null>(null);

export function useBallJourney() {
  return useContext(JourneyContext);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export function BallJourney({ product, children }: { product: Product; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<number, HTMLElement>());
  const frame = useRef(0);
  const explode = useRef(0);
  const anchors = useRef<Anchor[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  const [travel, setTravel] = useState<boolean | null>(null);
  const [base, setBase] = useState(0);

  useEffect(() => {
    setTravel(!reducedMotion);
  }, [reducedMotion]);

  const register = useCallback((order: number, node: HTMLElement | null) => {
    if (node) slots.current.set(order, node);
    else slots.current.delete(order);
  }, []);

  useEffect(() => {
    if (!travel) return;
    const rootNode = root.current;
    if (!rootNode) return;

    const update = () => {
      frame.current = 0;
      const node = ball.current;
      const origin = rootNode.getBoundingClientRect();
      // Slot boxes in page coordinates relative to the journey root, top to bottom.
      const stops = [...slots.current.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, element]) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0)
        .map((rect) => ({
          x: rect.left - origin.left + rect.width / 2,
          y: rect.top - origin.top + rect.height / 2,
          size: Math.min(rect.width, rect.height),
        }));
      if (stops.length === 0) return;

      // The canvas keeps one resolution (the largest slot) and is scaled with CSS,
      // so travelling never forces the 3D canvas to resize.
      const largest = Math.round(Math.max(...stops.map((stop) => stop.size)));
      setBase((current) => (Math.abs(current - largest) > 1 ? largest : current));
      if (!node) return;

      const vh = window.innerHeight;
      const scrolled = -origin.top;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh) - (origin.top + window.scrollY);
      const limit = (value: number) => Math.min(Math.max(0, value), Math.max(0, maxScroll));
      // The ball settles on a slot once the slot is well on screen, stays with it while it is
      // in view, and only leaves for the next slot once the slot has passed the upper part of
      // the screen. So whenever a slot is being looked at, the ball is exactly in its centre.
      const arrive = stops.map((stop) => limit(stop.y - vh * 0.82));
      const depart = stops.map((stop) => limit(stop.y - vh * 0.18));
      for (let index = 0; index < stops.length; index += 1) {
        if (depart[index] < arrive[index]) depart[index] = arrive[index];
        if (index > 0 && arrive[index] <= depart[index - 1]) arrive[index] = depart[index - 1] + 1;
        if (depart[index] < arrive[index]) depart[index] = arrive[index];
      }

      let from = stops[stops.length - 1];
      let to = from;
      let t = 0;
      for (let index = 0; index < stops.length; index += 1) {
        if (scrolled < depart[index] || index === stops.length - 1) {
          from = stops[index];
          to = from;
          break;
        }
        if (scrolled < arrive[index + 1]) {
          from = stops[index];
          to = stops[index + 1];
          t = clamp01((scrolled - depart[index]) / (arrive[index + 1] - depart[index]));
          break;
        }
      }
      const eased = t * t * (3 - 2 * t);
      const x = lerp(from.x, to.x, eased);
      const y = lerp(from.y, to.y, eased);
      const scale = lerp(from.size, to.size, eased) / largest;
      node.style.transform = `translate3d(${x - (largest * FRAME) / 2}px, ${y - (largest * FRAME) / 2}px, 0) scale(${scale})`;
      node.style.opacity = "1";
    };

    const schedule = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Layout above a slot can change after load (fonts, images), so keep the path current.
    const observer = new ResizeObserver(schedule);
    observer.observe(rootNode);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [travel, base]);

  return (
    <JourneyContext.Provider value={{ product, travel, register, explode, anchors, ball }}>
      <div ref={root} className="relative overflow-x-clip">
        {children}
        {travel && base > 0 && (
          <div
            ref={ball}
            className="pointer-events-none absolute top-0 left-0 z-30 opacity-0 will-change-transform"
            style={{ width: base * FRAME, height: base * FRAME }}
          >
            <FootballViewer
              modelUrl={product.model}
              poster={product.poster}
              name={product.name}
              eager
              explode={explode}
              anchors={anchors}
              frame={FRAME}
              posterPriority
              posterSizes="(min-width: 1024px) 56vw, 100vw"
            />
          </div>
        )}
      </div>
    </JourneyContext.Provider>
  );
}

type SlotProps = {
  /** Position of this stop along the page, starting at 0. */
  order: number;
  /** Show a viewer of its own here when the ball does not travel (phones, reduced motion). */
  fallback?: boolean;
  className?: string;
};

/** A resting place for the travelling ball. */
export function BallSlot({ order, fallback = false, className = "" }: SlotProps) {
  const journey = useContext(JourneyContext);
  const register = journey?.register;
  const ref = useCallback((node: HTMLDivElement | null) => register?.(order, node), [register, order]);
  if (!journey) return null;
  const { product, travel, explode, anchors } = journey;

  return (
    <div ref={ref} className={`relative aspect-square w-full ${className}`}>
      {/* Before the browser is known, the still render holds the space. */}
      {fallback && travel === null && (
        <Image
          src={product.poster}
          alt={`${product.name} football`}
          fill
          priority={order === 0}
          sizes="(min-width: 1024px) 56vw, 100vw"
          className="object-contain p-[10.5%]"
        />
      )}
      {fallback && travel === false && (
        <FootballViewer
          modelUrl={product.model}
          poster={product.poster}
          name={product.name}
          eager={order === 0}
          explode={explode}
          anchors={anchors}
          posterPriority={order === 0}
          posterSizes="(min-width: 1024px) 56vw, 100vw"
        />
      )}
    </div>
  );
}
