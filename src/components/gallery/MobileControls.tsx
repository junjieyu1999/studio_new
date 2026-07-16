"use client";

import { useSyncExternalStore } from "react";
import { pressedKeys } from "@/lib/movement-keys";

const TOUCH_QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(TOUCH_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// `false` on the server so the markup matches on hydration.
function useIsTouch() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false
  );
}

function Btn({ label, keyName }: { label: string; keyName: string }) {
  const release = () => pressedKeys.delete(keyName);
  return (
    <button
      className="flex h-12 w-12 touch-none select-none items-center justify-center rounded-full border border-white/25 bg-black/45 text-lg text-white/90 backdrop-blur-sm active:bg-white/25"
      onPointerDown={(e) => {
        e.preventDefault();
        pressedKeys.add(keyName);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`Move ${keyName}`}
    >
      {label}
    </button>
  );
}

/**
 * On-screen walk pad for touch devices. Shown based on pointer capability
 * rather than screen width — a tablet is wide but still has no keyboard.
 * Sits bottom-left, clear of the centre nav buttons and the contact widget.
 */
export function MobileControls() {
  const isTouch = useIsTouch();
  if (!isTouch) return null;

  return (
    <div className="pointer-events-none absolute bottom-6 left-3 z-20 grid grid-cols-3 gap-1.5">
      <div />
      <div className="pointer-events-auto">
        <Btn label="↑" keyName="w" />
      </div>
      <div />
      <div className="pointer-events-auto">
        <Btn label="←" keyName="a" />
      </div>
      <div className="pointer-events-auto">
        <Btn label="↓" keyName="s" />
      </div>
      <div className="pointer-events-auto">
        <Btn label="→" keyName="d" />
      </div>
    </div>
  );
}
