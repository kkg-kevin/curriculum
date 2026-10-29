import { useLocation } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { T } from "../checkins/shared";

// Quality assurance — labels, looks and the small pieces every QA screen shares. Buttons, cards,
// inputs, tabs and dialogs are the check-ins ones (../checkins/shared), so both read the same.
// Keys match server/src/modules/qa/qa.constants.js.
export {
  T, font, card, control, input, label, hint, chip, btn, toolbar, toolbarSelect, CheckinStyles as QaStyles,
  Tabs, Segmented, Pill, Modal, Empty, Pager, formatDate, formatDateTime,
} from "../checkins/shared";

// Where the QA pages live in each app.
//   /qa                        the admin app (admins, and staff with "Quality assurance")
//   /supervisor-portal/qa      a supervisor
//   /teacher-portal/qa         the educator — their own visits and reports
//   /school-portal/qa          the hub — its educators' announced visits and report summaries
export function qaBaseFor(pathname) {
  for (const base of ["/supervisor-portal/qa", "/teacher-portal/qa", "/school-portal/qa"]) {
    if (pathname.startsWith(base.replace(/\/qa$/, ""))) return base;
  }
  return "/qa";
}
export const useQaBase = () => qaBaseFor(useLocation().pathname);

// A visit's own page: reviewers have /visits/:id; the educator and the hub open it straight off their list.
export const visitPath = (base, id) => (base === "/qa" || base === "/supervisor-portal/qa" ? `${base}/visits/${id}` : `${base}/${id}`);

export const FREQUENCY_OPTIONS = ["weekly", "monthly", "quarterly", "semi_annually", "annually"];
export const FREQUENCY_LABEL = { weekly: "Weekly", monthly: "Monthly", quarterly: "Every term (3 months)", semi_annually: "Every 6 months", annually: "Yearly" };

export const VISIT_TYPE = {
  announced: { label: "Announced", bg: "#EFF6FF", color: "#1D4ED8", icon: FiEye, help: "The educator and their hub see it coming, and the educator is told a week before." },
  surprise: { label: "Surprise", bg: "#F5F3FF", color: "#6D28D9", icon: FiEyeOff, help: "Nobody but the reviewers sees it until the report is sent." },
};

// Where a visit stands (server: qa.rules.js's visitState).
export const STATE = {
  upcoming: { label: "Upcoming", bg: "#EFF6FF", color: "#1D4ED8" },
  due: { label: "Review due", bg: "#FFFBEB", color: "#B45309" },
  submitted: { label: "Report sent", bg: "#ECFDF5", color: "#047857" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", color: "#6B7280" },
};

// The state as the viewer reads it: to the educator and the hub a visit whose day has come is
// waiting for its report, not "due".
export const REVIEWER_ROLES = ["admin", "collaborator", "supervisor"];
export const stateLook = (state, role) => (state === "due" && !REVIEWER_ROLES.includes(role) ? { ...STATE.due, label: "Report to come" } : STATE[state]);

export const KIND_LABEL = { yes_no: "Yes / No", rubric: "Rubric", comment: "Comment" };

// The summary of a report: strengths and areas to improve go to the hub too; the overall remarks
// stay with the educator, the reviewers and the admins.
export const SUMMARY_PARTS = [
  { key: "strengths", label: "Strengths", help: "What's going well — what the educator should keep doing.", required: true },
  { key: "improvements", label: "Areas to improve", help: "What to work on, and how — specific and doable.", required: true },
  { key: "remarks", label: "Overall remarks", help: "Anything else. Not shown to the hub.", required: false },
];

// A score's colour: green from 75%, amber from 50%, red below.
export function scoreLook(score) {
  if (score == null) return { bg: "#F3F4F6", color: T.inkMuted };
  if (score >= 75) return { bg: "#ECFDF5", color: "#047857" };
  if (score >= 50) return { bg: "#FFFBEB", color: "#B45309" };
  return { bg: "#FEF2F2", color: "#B91C1C" };
}

export function ScoreBadge({ score, size = "md" }) {
  const look = scoreLook(score);
  const big = size === "lg";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2, padding: big ? "8px 14px" : "3px 10px", borderRadius: big ? 14 : 999, background: look.bg, color: look.color, fontWeight: 900, fontSize: big ? 28 : 12, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      {score == null ? "—" : `${Number(score)}%`}
    </span>
  );
}

export function VisitTypePill({ type }) {
  const look = VISIT_TYPE[type] || VISIT_TYPE.announced;
  const Icon = look.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: look.bg, color: look.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
      <Icon size={11} /> {look.label}
    </span>
  );
}

// Today in Kenya, as the server counts it ("YYYY-MM-DD").
export const todayKe = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
