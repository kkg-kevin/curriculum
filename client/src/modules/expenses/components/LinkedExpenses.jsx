import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FiCreditCard } from "react-icons/fi";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";
import { STATUS, expensesApi, formatDay, formatMoney } from "../services/expensesApi";
import { StatusPill } from "./ui";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";

// "Expenses" on a record's page (a Home Learning family, a class, a bootcamp, a QA visit…): every
// expense the team claimed for it — who, what, how much, and where the claim stands — with the
// totals claimed, approved and paid. Shown only to people who see the team's expenses (admins,
// staff with Expenses → View); for anyone else the server says no and this draws nothing. Nothing
// shows either while nothing has been claimed for the record.
//   <LinkedExpenses type="household" id={household.id} />

export default function LinkedExpenses({ type, id, title = "Expenses", style }) {
  const { user } = useAuth();
  // Only the admin app's people ask (other portals share some of these pages).
  const mayView = (user?.role === "admin" || user?.role === "collaborator") && can(user, "expenses", "view");
  const { data, isError } = useQuery({
    queryKey: ["expenses", "linked", type, id],
    queryFn: () => expensesApi.linked(type, id),
    enabled: mayView && !!type && !!id,
    retry: false,
    staleTime: 60 * 1000,
  });
  if (isError || !data || !data.lines.length) return null;
  const { lines, totals, currency } = data;
  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 12, gridTemplateColumns: "100%", fontFamily: FONT, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={cardHeading}><FiCreditCard size={13} /> {title}</h3>
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>{totals.claims} {totals.claims === 1 ? "claim" : "claims"} · {totals.people} {totals.people === 1 ? "person" : "people"}</span>
      </div>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))" }}>
        {[["Claimed", totals.claimed], ["Approved", totals.approved], ["Paid back", totals.paid]].map(([k, v]) => (
          <div key={k} style={{ padding: "10px 12px", borderRadius: 10, background: BRAND.greyTint }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: BRAND.ink }}>{formatMoney(v, currency)}</div>
          </div>
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
        {lines.map((l) => (
          <li key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderTop: `1px solid ${BRAND.line}`, opacity: l.rejected ? 0.6 : 1 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink, overflowWrap: "anywhere", textDecoration: l.rejected ? "line-through" : "none" }}>{l.description}</div>
              <div style={{ fontSize: 12, color: BRAND.muted, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span>{formatDay(l.spentOn)}</span><span>·</span><span>{l.categoryLabel}</span><span>·</span><span>{l.claimantName}</span><span>·</span>
                <Link to={`/expenses?tab=all&claim=${l.claimId}`} style={{ color: BRAND.mid, fontWeight: 700 }}>{l.number || l.title}</Link>
              </div>
            </div>
            <div style={{ display: "grid", justifyItems: "end", gap: 4 }}>
              <strong style={{ fontSize: 13.5, color: BRAND.ink, whiteSpace: "nowrap" }}>{formatMoney(l.amount, l.currency)}</strong>
              {l.rejected ? <span style={{ fontSize: 11.5, color: BRAND.danger, fontWeight: 700 }}>Turned down</span> : STATUS[l.status] && <StatusPill status={l.status} />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
