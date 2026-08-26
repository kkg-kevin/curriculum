import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";

export const TYPE_LABELS = {
  hub_subscription: "Hub subscription",
  learner_term: "Learner per term",
  course_module: "Course / module",
  bootcamp: "One-time bootcamp",
};

export const TYPE_HELP = {
  hub_subscription: "Platform fees billed directly to the learning hub.",
  learner_term: "Recurring learner fees for an academic term. The guardian account is notified.",
  course_module: "Charge a learner for a specific course or module.",
  bootcamp: "A single payment for a special programme or bootcamp.",
};

export const STATUS_LABELS = { draft: "Draft", issued: "Issued", partially_paid: "Partially paid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled", void: "Void" };

export const STATUS_COLORS = {
  draft: { bg: "#F3F4F6", color: "#4B5563" },
  issued: { bg: "#EFF6FF", color: "#1D4ED8" },
  partially_paid: { bg: "#FFF7ED", color: "#C2410C" },
  paid: { bg: "#ECFDF5", color: "#047857" },
  overdue: { bg: "#FEF2F2", color: "#B91C1C" },
  cancelled: { bg: "#F9FAFB", color: "#6B7280" },
  void: { bg: "#F9FAFB", color: "#6B7280" },
};

export default function StatusPill({ status, size = "medium" }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const compact = size === "small";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: compact ? "4px 8px" : "6px 10px", borderRadius: 999, background: style.bg, color: style.color, fontSize: compact ? 10.5 : 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      {status === "paid" && <CheckCircleIcon sx={{ fontSize: compact ? 12 : 14 }} />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}
