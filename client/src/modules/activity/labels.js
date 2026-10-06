// How the activity log's stored values read on screen.

// `module` on an entry → the name of that area of the app.
export const AREA_LABELS = {
  account: "Sign-in & account",
  people: "Staff, roles & sharing",
  "learning-hubs": "Learning Hubs",
  curriculum: "Curriculum",
  courses: "Courses",
  assessments: "Assessments",
  learners: "Learners",
  teachers: "Educators",
  classes: "Classes",
  attendance: "Attendance",
  timetable: "Timetable",
  "home-learning": "Home Learning",
  competitions: "Competitions",
  bootcamps: "Bootcamps",
  reports: "Reports",
  billing: "Billing",
  "hub-visits": "Hub visits",
  enquiries: "Enquiries",
  settings: "Settings",
  website: "Website",
};
export const areaLabel = (key) => AREA_LABELS[key] || (key ? key[0].toUpperCase() + key.slice(1).replace(/-/g, " ") : "Other");

// The Activity page's tabs: one per kind of thing that happened (the server's audit-log.model.js
// decides what falls under each). `narrow` is the optional second choice inside a tab; each one
// is sent as an `action` or `outcome` filter.
export const VIEWS = [
  { key: "", label: "All activity", empty: "No activity recorded yet" },
  {
    key: "signins", label: "Sign-ins", empty: "No sign-ins in this period",
    narrow: [
      { label: "Signed in", action: "login" },
      { label: "Failed attempts", action: "login_failed" },
      { label: "Signed out", action: "logout,session_expired" },
      { label: "Password & profile changes", action: "password_changed,password_reset,update" },
    ],
  },
  { key: "added", label: "Added", empty: "Nothing was added in this period" },
  { key: "edited", label: "Edited", empty: "Nothing was edited in this period" },
  { key: "deleted", label: "Deleted", empty: "Nothing was deleted in this period" },
  {
    key: "problems", label: "Refused & failed", empty: "Nothing was refused or failed in this period",
    narrow: [
      { label: "Refused (not allowed)", outcome: "refused" },
      { label: "Failed (went wrong)", outcome: "failed" },
    ],
  },
];

// The "When" choice. Each gives the first day to show; the last is always today.
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const PERIODS = [
  { key: "", label: "Any time", from: () => "" },
  { key: "today", label: "Today", from: () => daysAgo(0) },
  { key: "7", label: "Last 7 days", from: () => daysAgo(6) },
  { key: "30", label: "Last 30 days", from: () => daysAgo(29) },
  { key: "custom", label: "Choose dates…" },
];

// The colour an entry's dot and tag take.
export function tone(entry) {
  if (entry.outcome === "refused") return { color: "#B45309", background: "#FEF3C7", label: "Refused" };
  if (entry.outcome === "failed") return { color: "#B91C1C", background: "#FEE2E2", label: "Failed" };
  if (entry.action === "delete" || entry.action === "unlink") return { color: "#B91C1C", background: "#FEE2E2", label: null };
  if (entry.action === "create" || entry.action === "link") return { color: "#047857", background: "#D1FAE5", label: null };
  if (entry.module === "account") return { color: "#6B7280", background: "#F3F4F6", label: null };
  return { color: "#1D4ED8", background: "#DBEAFE", label: null };
}

const ACCOUNT_LABELS = { admin: "Owner", collaborator: "Staff", teacher: "Educator", school: "Hub", learner: "Learner / parent", curriculumAdmin: "Curriculum admin", visitor: "Website visitor" };
// "Staff · Finance", "Educator", "Owner"
export const accountLabel = (entry) => [ACCOUNT_LABELS[entry.actorRole] || entry.actorRole, entry.actorAccessRole].filter(Boolean).join(" · ");

export const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
export const dayOf = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

// "3 minutes ago", "yesterday", "12 Sep 2026"
export function ago(iso) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// A browser's long identification string, down to what a person recognises.
export function browserOf(userAgent) {
  if (!userAgent) return "";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /OPR\//.test(userAgent) ? "Opera" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "";
  const system = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Mac OS X/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return [browser, system].filter(Boolean).join(" on ") || userAgent.slice(0, 40);
}
