"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { BallSlot, useBallJourney } from "@/components/3d-viewer/BallJourney";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const ramp = (value: number, from: number, to: number) => {
  const x = clamp01((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};

/** Top to bottom, matching the layers of the open ball. */
const layers = ["Outer shell", "Foam cushion", "Lining", "Bladder"];

/**
 * Pinned section: scrolling through it breaks the ball apart panel by panel to show the
 * layers inside, each marked with a leader line, then closes it again and moves on.
 * The only words are the layer names.
 */
export function InsideFootball() {
  const journey = useBallJourney();
  const reducedMotion = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const lines = useRef<(SVGPolylineElement | null)[]>([]);
  const ends = useRef<(SVGCircleElement | null)[]>([]);
  const explode = journey?.explode;
  const anchors = journey?.anchors;
  const ballRef = journey?.ball;

  useEffect(() => {
    const node = section.current;
    if (!node || !explode || !anchors || reducedMotion) return;
    let frame = 0;
    let visible = false;

    const tick = () => {
      frame = 0;
      if (!visible) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = clamp01(-rect.top / Math.max(1, rect.height - viewport));
      const opening = ramp(progress, 0.08, 0.42);
      const closing = ramp(progress, 0.82, 0.97);
      const open = opening * (1 - closing);
      explode.current = open;

      // Leader lines run from a point on each layer to its label.
      const view = overlay.current?.getBoundingClientRect();
      const ball = ballRef?.current?.getBoundingClientRect();
      const show = ramp(open, 0.78, 1);
      layers.forEach((_, index) => {
        const line = lines.current[index];
        const end = ends.current[index];
        const dot = dots.current[index]?.getBoundingClientRect();
        const item = items.current[index];
        if (item) item.style.opacity = String(show);
        if (!line || !end || !view || !ball || !dot) return;
        const anchor = anchors.current[index];
        const ax = ball.left + anchor.x * ball.width - view.left;
        const ay = ball.top + anchor.y * ball.height - view.top;
        const dx = dot.left + dot.width / 2 - view.left;
        const dy = dot.top + dot.height / 2 - view.top;
        const elbow = Math.max(ax + 12, dx - 26);
        line.setAttribute("points", `${ax},${ay} ${elbow},${dy} ${dx},${dy}`);
        end.setAttribute("cx", String(ax));
        end.setAttribute("cy", String(ay));
        line.style.opacity = String(show);
        end.style.opacity = String(show);
      });
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
      if (!visible) explode.current = 0;
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      explode.current = 0;
    };
  }, [explode, anchors, ballRef, reducedMotion]);

  if (!journey) return null;

  return (
    <section ref={section} className="relative h-[330vh] bg-navy-deep text-white" aria-labelledby="inside-heading">
      <h2 id="inside-heading" className="sr-only">
        Inside the {journey.product.name}
      </h2>
      <div className="sticky top-0 flex h-screen items-center overflow-visible">
        {/* The ball sits in the centre of the screen; the layer names stand on its right. */}
        <div className="shell relative w-full">
          <div ref={slot} className="mx-auto w-full max-w-[min(100%,74vh)]">
            <BallSlot order={2} fallback />
          </div>
          <ol className="absolute top-1/2 right-[clamp(1.25rem,4vw,4rem)] z-40 grid w-[34%] -translate-y-1/2 gap-[clamp(1.1rem,6vh,3.25rem)] sm:w-[22%]">
            {layers.map((label, index) => (
              <li
                key={label}
                ref={(element) => void (items.current[index] = element)}
                className="flex items-center gap-2 opacity-0 sm:gap-3"
              >
                <span ref={(element) => void (dots.current[index] = element)} aria-hidden className="size-1.5 shrink-0 rounded-full bg-red sm:size-2" />
                <span>
                  <span className="block text-[0.6875rem] font-semibold tracking-[0.08em] text-red tabular-nums [font-stretch:80%]">
                    L{index + 1}
                  </span>
                  <span className="type-h3 block text-[clamp(1.0625rem,3.6vw,1.75rem)] leading-none">{label}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <svg ref={overlay} aria-hidden className="pointer-events-none absolute inset-0 z-[35] size-full overflow-visible">
          {layers.map((label, index) => (
            <g key={label}>
              <polyline
                ref={(element) => void (lines.current[index] = element)}
                fill="none"
                stroke="var(--color-red)"
                strokeWidth="1.25"
                opacity="0"
              />
              <circle ref={(element) => void (ends.current[index] = element)} r="3" fill="var(--color-red)" opacity="0" />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
