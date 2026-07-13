// Shared guided-navigation state so the overlay buttons (rendered outside the
// R3F Canvas) can tell WalkControls (inside it) to glide the camera to the
// next / previous viewing station down the corridor. Follows the same
// module-level-state pattern as movement-keys.ts.
export const guidedNav = {
  stops: [] as number[], // z positions, ordered entrance -> end
  index: 0, // which stop the viewer is currently at / nearest to
  targetZ: null as number | null, // active glide target, or null when idle
};

export function setStops(stops: number[]) {
  guidedNav.stops = stops;
  if (guidedNav.index > stops.length - 1) {
    guidedNav.index = Math.max(0, stops.length - 1);
  }
}

export function nearestIndex(z: number): number {
  let best = 0;
  let bestDist = Infinity;
  guidedNav.stops.forEach((s, i) => {
    const d = Math.abs(s - z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export function stepForward() {
  if (!guidedNav.stops.length) return;
  guidedNav.index = Math.min(guidedNav.index + 1, guidedNav.stops.length - 1);
  guidedNav.targetZ = guidedNav.stops[guidedNav.index];
}

export function stepBackward() {
  if (!guidedNav.stops.length) return;
  guidedNav.index = Math.max(guidedNav.index - 1, 0);
  guidedNav.targetZ = guidedNav.stops[guidedNav.index];
}

export function cancelGuidedNav() {
  guidedNav.targetZ = null;
}
