import { useEffect, useState } from "react";
import { BRAND } from "../../../../theme/brand";

// The Timetable Planner's small shared pieces. System colours only (theme/brand.js).

export const WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const DAY_SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
export const DAY_LONG = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

export const STATUS = {
  not_set: { label: "Not set", tone: "neutral" },
  needs_educator: { label: "Needs educator", tone: "waiting" },
  needs_dates: { label: "Needs dates", tone: "waiting" },
  ready: { label: "Ready", tone: "good" },
};

export const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
export function fmtTime(t) {
  const n = toMin(t);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}
export const fmtRange = (a, b) => `${fmtTime(a)} – ${fmtTime(b)}`;
export const fmtDate = (d, opts = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" }) : "");
export const addDaysTo = (date, n) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// One look per hub, so an educator's day across hubs reads at a glance. Blues and greys only: gold
// is kept for "this needs attention".
const HUB_LOOKS = [
  { bg: BRAND.navyTint, border: BRAND.navyBorder, text: BRAND.navy },
  { bg: BRAND.skyTint, border: BRAND.skyBorder, text: BRAND.skyText },
  { bg: "#E8F1F8", border: "#9CC4E4", text: "#1F5F8B" },
  { bg: BRAND.greyTint, border: "#CBD2DB", text: BRAND.greyText },
  { bg: "#DDEBF5", border: "#8FB8D6", text: "#1A4F75" },
  { bg: "#EEF3F8", border: "#B7C6D6", text: "#34506B" },
];
export function hubLook(id = "") {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return HUB_LOOKS[hash % HUB_LOOKS.length];
}

export function useNarrow(width = 820) {
  const query = `(max-width: ${width}px)`;
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const on = (e) => setNarrow(e.matches);
    setNarrow(list.matches);
    list.addEventListener("change", on);
    return () => list.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

// An educator's lessons on one day at different physical hubs with under 30 minutes between them.
export function travelFlags(lessons, onlineHubIds = new Set()) {
  const flagged = new Set();
  const inPerson = lessons.filter((l) => !onlineHubIds.has(l.hubId));
  for (const a of inPerson) {
    for (const b of inPerson) {
      if (a === b || a.dayOfWeek !== b.dayOfWeek || a.hubId === b.hubId) continue;
      const gap = toMin(b.startTime) - toMin(a.endTime);
      if (gap >= 0 && gap < 30) { flagged.add(a.id); flagged.add(b.id); }
    }
  }
  return flagged;
}
