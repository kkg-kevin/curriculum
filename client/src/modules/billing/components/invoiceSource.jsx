import { Link } from "react-router-dom";

// Where an invoice came from. Most are made by other parts of the system — a hub visit, a Home
// Learning household's month, a bootcamp place — so the server works out `invoice.source`
// ({ kind, from, hubName, automatic, ref }) from what the invoice's lines record, and these turn
// it into a tab, a line of plain words, and a link back to the thing that made it.

export const SOURCES = [
  { key: "hub_subscription", label: "Subscriptions", types: ["hub_subscription"] },
  { key: "hub_usage", label: "Hub usage", types: ["hub_usage"] },
  { key: "home_learning", label: "Home Learning", types: ["home_learning"] },
  { key: "tech_club", label: "Tech Clubs", types: ["tech_club"] },
  { key: "bootcamp", label: "Bootcamps", types: ["bootcamp"] },
  { key: "learner", label: "Learner fees", types: ["learner_term", "course_module"] },
];

export const sourceKey = (invoice) => SOURCES.find((s) => s.types.includes(invoice.invoiceType))?.key || "other";

// The page for the thing an invoice came from, in the viewer's own portal — null when that
// portal has no such page.
export function sourcePath(ref, role) {
  if (!ref?.id) return null;
  if (role === "admin" || role === "collaborator") {
    return {
      bootcamp: `/events/bootcamps/${ref.id}/view`,
      household: `/home-learning?household=${ref.id}`,
      club_membership: `/tech-clubs?membership=${ref.id}`,
      hub: `/learning-hubs/${ref.id}/view`,
      customer: `/billing/customers/${ref.id}`,
      learner: `/learners/${ref.id}/view`,
    }[ref.type] || null;
  }
  if (role === "school" && ref.type === "learner") return `/school-portal/learners/${ref.id}/view`;
  return null;
}

// "From: Workplace Bootcamp · Derrick Maina ↗" — the link goes to the bootcamp (or household,
// hub, learner…). Clicking it doesn't open the invoice row it sits in.
export function InvoiceSourceLine({ invoice, role, style }) {
  const source = invoice.source;
  if (!source?.from) return null;
  const to = sourcePath(source.ref, role);
  const text = (
    <>
      <span style={{ color: "#9CA3AF", fontWeight: 600 }}>From </span>
      {source.from}
      {source.automatic && <span style={{ color: "#9CA3AF" }}> · made automatically</span>}
    </>
  );
  return (
    <div style={{ fontSize: 12, color: "#374151", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}>
      {to ? (
        <Link to={to} onClick={(e) => e.stopPropagation()} style={{ color: "#1F5F8B", textDecoration: "none", fontWeight: 600 }} title="Open where this invoice came from">
          {text} ↗
        </Link>
      ) : text}
    </div>
  );
}
