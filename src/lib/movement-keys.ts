// Shared pressed-key set so both real keyboard input and on-screen
// mobile buttons can drive the same walk-controls logic.
export const pressedKeys = new Set<string>();

const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

export function initKeyboardMovement() {
  if (typeof window === "undefined") return () => {};

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (MOVE_KEYS.has(key)) pressedKeys.add(key);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    pressedKeys.delete(key);
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
