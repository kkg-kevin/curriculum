// A mentor's availability on the client: times, ranges and the planner's arithmetic. The server's
// copy of the rules is mentor-bookings/availability.rules.js; this one only keeps the screen right
// between an edit and its save.

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const DAY_SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
export const DAY_LONG = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

export const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
export const toTime = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export function fmtTime(t) {
  const n = typeof t === "number" ? t : toMin(t);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}
export const fmtRange = (r) => `${fmtTime(r.startTime)} – ${fmtTime(r.endTime)}`;

export function hoursLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h && !m) return "0 hrs";
  return `${h ? `${h} hr${h === 1 ? "" : "s"}` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
}

// Every half hour of the day, for the time pickers.
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => toTime(i * 30));

export function mergeRanges(list = []) {
  const sorted = list.map((r) => [toMin(r.startTime), toMin(r.endTime)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out.map(([a, b]) => ({ startTime: toTime(a), endTime: toTime(b) }));
}

export function subtract(r, busy = []) {
  let cursor = toMin(r.startTime);
  const end = toMin(r.endTime);
  const out = [];
  for (const b of mergeRanges(busy)) {
    const s = toMin(b.startTime);
    const e = toMin(b.endTime);
    if (e <= cursor) continue;
    if (s >= end) break;
    if (s > cursor) out.push({ startTime: toTime(cursor), endTime: toTime(s) });
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) out.push({ startTime: toTime(cursor), endTime: toTime(end) });
  return out;
}

export function intersect(r, busy = []) {
  const start = toMin(r.startTime);
  const end = toMin(r.endTime);
  return mergeRanges(busy)
    .map((b) => [Math.max(start, toMin(b.startTime)), Math.min(end, toMin(b.endTime))])
    .filter(([a, b]) => b > a)
    .map(([a, b]) => ({ startTime: toTime(a), endTime: toTime(b) }));
}

// Windows tidied per day (joined when they overlap or touch), in day order.
export const tidy = (windows = []) => DAYS.flatMap((dayOfWeek) => mergeRanges(windows.filter((w) => w.dayOfWeek === dayOfWeek)).map((r) => ({ dayOfWeek, ...r })));

// A day of the server's week with the hours being edited laid over it, until the save comes back.
export function planLocally(day, windows) {
  const offered = mergeRanges(windows.filter((w) => w.dayOfWeek === day.dayOfWeek));
  const classes = day.items.filter((i) => i.kind === "class");
  const open = day.isPast ? [] : offered.flatMap((w) => subtract(w, day.items)).filter((r) => toMin(r.endTime) - toMin(r.startTime) >= 30);
  return { ...day, offered, open, byClass: mergeRanges(offered.flatMap((w) => intersect(w, classes))) };
}

export function addDaysTo(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const dateLabel = (date, opts = { day: "numeric", month: "short" }) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

export const PRESETS = [
  { key: "evenings", label: "Weekday evenings", note: "Mon–Fri, 4–7 PM", windows: ["monday", "tuesday", "wednesday", "thursday", "friday"].map((dayOfWeek) => ({ dayOfWeek, startTime: "16:00", endTime: "19:00" })) },
  { key: "saturday", label: "Saturday mornings", note: "Sat, 9 AM – 1 PM", windows: [{ dayOfWeek: "saturday", startTime: "09:00", endTime: "13:00" }] },
  { key: "weekends", label: "Weekends", note: "Sat and Sun, 9 AM – 1 PM", windows: ["saturday", "sunday"].map((dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "13:00" })) },
];
