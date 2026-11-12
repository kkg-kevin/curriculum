import { roleTagOf } from "../labels";

// A person's role beside their name in "Who did what" and the Activity log: Admin, a staff
// member's own role name (e.g. "CEO"), Supervisor, Educator, Parent, Learning hub… (labels.js's
// roleTagOf). Colours from the system's palette (theme/brand.js).
const TONES = {
  admin: { background: "#25476a", color: "#fff", border: "#25476a" },
  staff: { background: "#FFF5E1", color: "#7A4F00", border: "#FDD89A" },
  supervisor: { background: "#E6ECF3", color: "#25476a", border: "#A9BCD2" },
  educator: { background: "#EAF6FD", color: "#1F6F9E", border: "#BFE3F7" },
  hub: { background: "#2e7db5", color: "#fff", border: "#2e7db5" },
  family: { background: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
};

export default function RoleTag({ person, style = null }) {
  const tag = roleTagOf(person);
  if (!tag) return null;
  const t = TONES[tag.tone] || TONES.family;
  return (
    <span
      title={tag.tone === "staff" ? `Staff — ${tag.label}` : tag.label}
      style={{ display: "inline-flex", alignItems: "center", padding: "1px 8px", borderRadius: 999, border: `1px solid ${t.border}`, background: t.background, color: t.color, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", lineHeight: 1.5, whiteSpace: "nowrap", verticalAlign: "middle", ...(style || {}) }}
    >
      {tag.label}
    </span>
  );
}
