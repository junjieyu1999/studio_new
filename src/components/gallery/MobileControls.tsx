"use client";

import { pressedKeys } from "@/lib/movement-keys";

function Btn({ label, keyName }: { label: string; keyName: string }) {
  return (
    <button
      className="flex h-11 w-11 select-none items-center justify-center rounded-full border border-white/25 bg-black/40 text-base text-white/90 backdrop-blur-sm active:bg-white/20"
      onPointerDown={(e) => {
        e.preventDefault();
        pressedKeys.add(keyName);
      }}
      onPointerUp={() => pressedKeys.delete(keyName)}
      onPointerLeave={() => pressedKeys.delete(keyName)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

// Mobile-only free-roam D-pad (strafe / back up). Sits in the bottom-right so
// it stays clear of the centered Forward / Back guided-tour buttons. Desktop
// users get the same movement from WASD / arrow keys.
export function MobileControls() {
  return (
    <div className="pointer-events-none absolute bottom-24 right-3 z-10 grid grid-cols-3 gap-1.5 sm:hidden">
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
