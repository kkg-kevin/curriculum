import { NavLink } from "react-router-dom";
import ClaimsPage from "./ClaimsPage";
import InvoicesPage from "./InvoicesPage";
import { T } from "../../claims/shared";

const TABS = [
  { key: "claims", label: "Claims", to: "/teacher-portal/claims" },
  { key: "invoices", label: "Invoices", to: "/teacher-portal/invoices" },
];

// Payments — the educator's claims and the invoices sent with them, as two tabs of one page (one
// "Payments" item in the menu). Each tab keeps its own address, so links to either still land.
export default function PaymentsPage({ tab = "claims" }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>Payments</h1>
      <nav aria-label="Payments" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, margin: "12px 0 18px" }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <NavLink
              key={t.key}
              to={t.to}
              aria-current={active ? "page" : undefined}
              style={{ padding: "10px 16px", fontSize: 14, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", color: active ? T.accent : T.inkMuted, borderBottom: `3px solid ${active ? "#feb139" : "transparent"}`, marginBottom: -1 }}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>
      {tab === "invoices" ? <InvoicesPage embedded /> : <ClaimsPage embedded />}
    </div>
  );
}
