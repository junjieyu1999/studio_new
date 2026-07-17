export type TimeMode = "day" | "night";

const DAY_START = 7; // 07:00
const DAY_END = 18; // 18:00

export function modeForHour(hour: number): TimeMode {
  return hour >= DAY_START && hour < DAY_END ? "day" : "night";
}

// Re-check every minute so an open tab rolls over at dawn/dusk on its own.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function getSnapshot(): TimeMode {
  return modeForHour(new Date().getHours());
}

// "day" on the server so the markup matches on hydration; the client corrects
// itself immediately after.
function getServerSnapshot(): TimeMode {
  return "day";
}

export const timeOfDayStore = { subscribe, getSnapshot, getServerSnapshot };
