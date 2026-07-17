export type TimeMode = "day" | "golden" | "night";

// 07:00–18:00 blue skies · 18:00–19:30 golden hour · otherwise night.
const DAY_START = 7;
const GOLDEN_START = 18;
const GOLDEN_END = 19.5;

export function modeForTime(hours: number, minutes = 0): TimeMode {
  const t = hours + minutes / 60;
  if (t >= DAY_START && t < GOLDEN_START) return "day";
  if (t >= GOLDEN_START && t < GOLDEN_END) return "golden";
  return "night";
}

export const MODE_ORDER: TimeMode[] = ["day", "golden", "night"];

// Re-check every minute so an open tab rolls into golden hour / night on its own.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getSnapshot(): TimeMode {
  const now = new Date();
  return modeForTime(now.getHours(), now.getMinutes());
}

// "day" on the server so markup matches on hydration; the client corrects itself.
function getServerSnapshot(): TimeMode {
  return "day";
}

export const timeOfDayStore = { subscribe, getSnapshot, getServerSnapshot };
