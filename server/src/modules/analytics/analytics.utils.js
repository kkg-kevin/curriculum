// Small shared pieces for the analytics module: Kenyan calendar dates, medians, level words.

const KENYA_OFFSET_MS = 3 * 3600 * 1000; // East Africa Time, UTC+3, no daylight saving

// "YYYY-MM-DD" of a moment on the Kenyan calendar.
function kenyaDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + KENYA_OFFSET_MS).toISOString().slice(0, 10);
}
// Weekday (0 = Sunday) and hour of a moment in Kenya.
function kenyaDowHour(value) {
  const d = new Date(new Date(value).getTime() + KENYA_OFFSET_MS);
  return { dow: d.getUTCDay(), hour: d.getUTCHours() };
}
const startOfKenyaDay = (day) => new Date(`${day}T00:00:00.000+03:00`);
const endOfKenyaDay = (day) => new Date(`${day}T23:59:59.999+03:00`);
const addDays = (day, n) => kenyaDay(new Date(startOfKenyaDay(day).getTime() + n * 86400000 + 12 * 3600000));
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(startOfKenyaDay(s).getTime());

// The report's period, and the one just before it of the same length (for "vs previous").
function periodFrom(query) {
  const today = kenyaDay(new Date());
  let to = isDay(query.to) ? query.to : today;
  let from = isDay(query.from) ? query.from : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  const days = Math.round((startOfKenyaDay(to) - startOfKenyaDay(from)) / 86400000) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return {
    from, to, days, prevFrom, prevTo,
    start: startOfKenyaDay(from), end: endOfKenyaDay(to),
    prevStart: startOfKenyaDay(prevFrom), prevEnd: endOfKenyaDay(prevTo),
  };
}

// Every day of the period, oldest first.
function daysOf(period) {
  const out = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) out.push(d);
  return out;
}

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function mean(values) {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
const round = (n, dp = 0) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** dp) / 10 ** dp);
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const hoursBetween = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 3600000 : null);

// The four level words used on learners' reports (client reports/utils/reportView.js).
const LEVELS = [
  { key: "early", label: "Early days", min: 0 },
  { key: "starting", label: "Getting started", min: 40 },
  { key: "track", label: "On track", min: 60 },
  { key: "strong", label: "Strong start", min: 80 },
];
const levelKey = (percent) => [...LEVELS].reverse().find((l) => percent >= l.min)?.key || "early";
const emptyLevels = () => Object.fromEntries(LEVELS.map((l) => [l.key, 0]));

// Time buckets for "how long did it take".
const DURATION_BUCKETS = [
  { key: "lt1h", label: "Under 1 hour", max: 1 },
  { key: "lt1d", label: "1–24 hours", max: 24 },
  { key: "lt3d", label: "1–3 days", max: 72 },
  { key: "lt7d", label: "3–7 days", max: 168 },
  { key: "gt7d", label: "Over 7 days", max: Infinity },
];
function bucketDurations(hours) {
  const counts = DURATION_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0 }));
  for (const h of hours) {
    if (!Number.isFinite(h) || h < 0) continue;
    counts[DURATION_BUCKETS.findIndex((b) => h < b.max)].count += 1;
  }
  return counts;
}

const json = (v) => {
  if (v == null) return v;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || p?.name || "—";
const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// whereIn in slices, so a large id list never makes one enormous query.
async function inChunks(ids, fn, size = 800) {
  const list = [...new Set(ids)].filter(Boolean);
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(...(await fn(list.slice(i, i + size))));
  return out;
}

module.exports = {
  kenyaDay, kenyaDowHour, startOfKenyaDay, endOfKenyaDay, addDays, periodFrom, daysOf,
  median, mean, round, pct, hoursBetween, LEVELS, levelKey, emptyLevels, DURATION_BUCKETS, bucketDurations,
  json, fullName, stripHtml, inChunks,
};
