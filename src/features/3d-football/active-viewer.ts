"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Every football on the site rotates in live 3D while it is on screen.
 *
 * Browsers allow only a limited number of WebGL canvases at once and each model is
 * a few megabytes, so live viewers are handed out from a small pool: a viewer asks
 * for a slot when it scrolls into view and gives it back when it leaves. If more
 * footballs are visible than there are slots, the extra ones show their still render
 * and go live as soon as a slot frees up.
 */
const DESKTOP_SLOTS = 9;
const MOBILE_SLOTS = 4;

/** Viewers currently asking for a slot, oldest first. */
let queue: string[] = [];
const listeners = new Set<() => void>();

function maxSlots() {
  if (typeof window === "undefined") return DESKTOP_SLOTS;
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ? MOBILE_SLOTS : DESKTOP_SLOTS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function request(id: string) {
  if (queue.includes(id)) return;
  queue = [...queue, id];
  notify();
}

function release(id: string) {
  if (!queue.includes(id)) return;
  queue = queue.filter((item) => item !== id);
  notify();
}

/** Returns true while this viewer holds one of the live 3D slots. */
export function useViewerSlot(id: string, wanted: boolean) {
  useEffect(() => {
    if (!wanted) return;
    request(id);
    return () => release(id);
  }, [id, wanted]);

  return useSyncExternalStore(
    subscribe,
    () => {
      const position = queue.indexOf(id);
      return position !== -1 && position < maxSlots();
    },
    () => false,
  );
}
