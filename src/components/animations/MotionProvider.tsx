"use client";

import type { ReactNode } from "react";
import { LazyMotion } from "motion/react";

const loadFeatures = () => import("./motion-features").then((module) => module.default);

/** Animation code is loaded in a separate small file instead of inside every page's main bundle. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
