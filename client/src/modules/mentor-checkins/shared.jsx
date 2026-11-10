import { useLocation } from "react-router-dom";

// Parent–mentor check-ins — labels, looks and where its pages live. The building blocks (buttons,
// cards, modal, tabs, pills) are hub check-ins' own, so the two look alike. Keys match
// server/src/modules/mentor-checkins/mentor-checkin.rules.js.
export {
  T, font, card, input, label, hint, chip, btn, primaryBtn, ghostBtn, toolbar, toolbarSelect,
  CheckinStyles, Tabs, Segmented, Pill, Modal, Empty, formatDate, formatDateTime, safeMeetingLink, reportHtml,
} from "../checkins/shared";

// Where the pages live: the admin app (/mentor-checkins), the teacher portal, the parent portal,
// the hub portal and the supervisor portal.
export function mentorBaseFor(pathname) {
  for (const base of ["/teacher-portal/mentor-checkins", "/parent/mentor-checkins", "/school-portal/mentor-checkins", "/supervisor-portal/mentor-checkins"]) {
    if (pathname.startsWith(base.replace("/mentor-checkins", ""))) return base;
  }
  return "/mentor-checkins";
}
export const useMentorBase = () => mentorBaseFor(useLocation().pathname);

// Where a check-in stands (server: meetingState).
export const STATE = {
  upcoming: { label: "Upcoming", bg: "#EFF6FF", color: "#1D4ED8" },
  today: { label: "Today", bg: "#DCFCE7", color: "#166534" },
  report_due: { label: "Report due", bg: "#FFFBEB", color: "#B45309" },
  awaiting_approval: { label: "Waiting for the parent", bg: "#F5F3FF", color: "#6D28D9" },
  approved: { label: "Approved", bg: "#ECFDF5", color: "#047857" },
  missed: { label: "Missed", bg: "#FEF2F2", color: "#B91C1C" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#6B7280" },
};
// A parent reads "awaiting approval" as theirs to do.
export const stateFor = (state, viewer) => (viewer === "parent" && state === "awaiting_approval" ? { ...STATE.awaiting_approval, label: "Approve the report" } : STATE[state] || STATE.upcoming);

export const FORMAT_LABEL = { online: "Online", in_person: "In person" };
export const WEEKDAYS = [
  { key: "monday", short: "Mon" }, { key: "tuesday", short: "Tue" }, { key: "wednesday", short: "Wed" },
  { key: "thursday", short: "Thu" }, { key: "friday", short: "Fri" }, { key: "saturday", short: "Sat" }, { key: "sunday", short: "Sun" },
];

// The report's two written parts.
export const REPORT_PARTS = [
  { key: "summary", label: "How the child is doing", help: "Their progress, strengths and what they find hard — what you talked through." },
  { key: "actions", label: "What was agreed", help: "What you, the parent and the child will each do next, and by when." },
];

export const kenyaToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
export const shortDay = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const whenText = (m) => `${shortDay(m.date)} · ${m.startTime}–${m.endTime}`;
export const joinNames = (list) => {
  const items = (list || []).filter(Boolean);
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};
export const childNames = (m) => joinNames((m.learners || []).map((l) => l.firstName || l.name));
// Who a viewer sees as the "other side" of a check-in.
export const titleFor = (m, viewer) => (viewer === "parent"
  ? `About ${childNames(m) || "your child"}`
  : `${m.parentName} · ${childNames(m)}`);
