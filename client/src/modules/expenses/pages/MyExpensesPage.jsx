import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiPlus } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card } from "../../../theme/brand";
import { Segmented } from "../../../components/ui/TabBar";
import { expensesApi, formatMoney } from "../services/expensesApi";
import ClaimList from "../components/ClaimList";
import ClaimForm from "../components/ClaimForm";
import ClaimView from "../components/ClaimView";
import { btn, primary } from "../components/ui";

// My expenses — the signed-in person's own claims, in whichever app they're in: admins and staff
// at /my-expenses, educators under Payments → Expenses, supervisors under Expenses → My expenses.
// `embedded`: inside another page (no header of its own).

const FILTERS = [
  { key: "open", label: "In progress" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
];
const OPEN = new Set(["draft", "returned", "pending_supervisor", "pending_admin", "approved"]);

export default function MyExpensesPage({ embedded = false }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const openId = params.get("claim");
  const [filter, setFilter] = useState("open");
  const [editing, setEditing] = useState(null); // null | "new" | claim
  const { data: claims = [], isLoading } = useQuery({ queryKey: ["expenses", "mine"], queryFn: expensesApi.mine });
  const { data: options } = useQuery({ queryKey: ["expenses", "options"], queryFn: expensesApi.options });

  const setOpen = (id) => setParams((p) => { const next = new URLSearchParams(p); if (id) next.set("claim", id); else next.delete("claim"); return next; }, { replace: true });
  const shown = claims.filter((c) => (filter === "all" ? true : filter === "paid" ? c.status === "paid" : OPEN.has(c.status)));
  const waiting = claims.filter((c) => c.status === "pending_supervisor" || c.status === "pending_admin");
  const toBePaid = claims.filter((c) => c.status === "approved");
  const year = String(new Date().getFullYear());
  const paidThisYear = claims.filter((c) => c.status === "paid" && String(c.paidAt || "").startsWith(year)).reduce((s, c) => s + Number(c.approvedAmount || 0), 0);
  const needYou = claims.filter((c) => c.status === "returned").length;

  const newButton = <button type="button" style={embedded ? primary : { ...btn, padding: "11px 18px", fontSize: 14, background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }} disabled={!options} onClick={() => setEditing("new")}><FiPlus size={15} /> New claim</button>;
  const stats = [
    ["Waiting for review", `${waiting.length} · ${formatMoney(waiting.reduce((s, c) => s + Number(c.totalAmount), 0))}`],
    ["Approved, to be paid", formatMoney(toBePaid.reduce((s, c) => s + Number(c.approvedAmount || 0), 0))],
    [`Paid back in ${year}`, formatMoney(paidThisYear)],
  ];

  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      {embedded ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted, maxWidth: 620, lineHeight: 1.5 }}>Spent your own money on work — transport, fuel, materials, a meeting? Claim it back here with a receipt or M-Pesa message as proof.</p>
          {newButton}
        </div>
      ) : (
        <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff" }}>My expenses</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>Spent your own money on work — transport, fuel, materials, a meeting? Claim it back here with a receipt or M-Pesa message as proof.</p>
          </div>
          {newButton}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ ...card, padding: "12px 16px", flex: "1 1 180px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: BRAND.ink, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
      {needYou > 0 && <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 13, fontWeight: 600 }}>{needYou === 1 ? "A claim was" : `${needYou} claims were`} sent back to you to change.</p>}

      <div><Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS} /></div>
      {isLoading ? <p style={{ color: BRAND.muted, fontSize: 13 }}>Loading…</p> : (
        <ClaimList claims={shown} onOpen={setOpen} empty={filter === "open" ? "Nothing in progress. Use New claim to claim something back." : "No claims here yet."} />
      )}

      {openId && !editing && <ClaimView id={openId} onClose={() => setOpen(null)} onEdit={(claim) => setEditing(claim)} />}
      {editing && options && (
        <ClaimForm
          claim={editing === "new" ? null : editing}
          options={options}
          onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["expenses"] }); }}
          onSaved={(saved) => { setEditing(null); qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(saved.id); }}
        />
      )}
    </div>
  );
}
