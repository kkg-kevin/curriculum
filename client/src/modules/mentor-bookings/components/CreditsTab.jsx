import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiSearch } from "react-icons/fi";
import { errorText, useAdjustWallet, useCreditWallet, useCreditWallets } from "../hooks/useMentorBookings";
import { EmptyNote } from "../shared";
import { BRAND, FONT, card, cardHeading } from "../../../theme/brand";

// Mentor bookings → Credits (admin app, 27 Nov 2026 — server modules/family-credits/): every
// family's credit wallet — the parent, their children, balance, bought and used — and one wallet's
// whole history (?wallet=<id>), with "Add or take off credits" (a reason is required; the parent is
// told). Credits are bought by parents on their own Mentor credits page.

const credit = (n) => Number(n || 0).toLocaleString("en-KE");
const when = (d) => (d ? new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const KIND = { purchase: "Bought", spend: "Mentor session", refund: "Back from a cancelled session", adjust: "Adjusted by staff" };
const control = { padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, background: "#fff", minWidth: 0, boxSizing: "border-box" };

function AdjustForm({ wallet }) {
  const adjust = useAdjustWallet();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const n = Number(amount);
  return (
    <section style={{ ...card, padding: 16, display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
      <h3 style={cardHeading}>Add or take off credits</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input aria-label="Credits (a minus number takes them off)" type="number" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -200" style={{ ...control, width: 160 }} />
        <input aria-label="Why" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Why — the parent sees this" style={{ ...control, flex: "1 1 240px" }} />
        <button type="button" disabled={adjust.isPending || !n || !note.trim()}
          onClick={() => { setError(null); adjust.mutate({ id: wallet.id, amount: n, note: note.trim() }, { onSuccess: () => { setAmount(""); setNote(""); }, onError: (e) => setError(errorText(e)) }); }}
          style={{ ...control, background: BRAND.navy, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
          {adjust.isPending ? "Saving…" : n < 0 ? `Take off ${credit(-n)}` : `Add ${credit(n || 0)}`}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>{error}</p>}
    </section>
  );
}

function WalletView({ id, canManage, onBack }) {
  const { data: w, isLoading } = useCreditWallet(id);
  if (isLoading || !w) return <p style={{ color: BRAND.faint, fontSize: 13 }}>Loading…</p>;
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <button type="button" onClick={onBack} style={{ justifySelf: "start", border: "none", background: "none", color: BRAND.mid, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT, padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}><FiArrowLeft /> Every wallet</button>
      <section style={{ ...card, padding: 18, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink }}>{w.parent?.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: BRAND.muted }}>{[w.parent?.email, w.parent?.phone].filter(Boolean).join(" · ")}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: BRAND.inkSoft }}>Children: {w.children?.map((c) => c.name).join(", ") || "—"}</p>
        </div>
        {[["Balance", w.balance], ["Bought", w.totalBought], ["Used", w.totalSpent]].map(([k, v]) => (
          <div key={k} style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{k}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: k === "Balance" ? BRAND.navy : BRAND.ink }}>{credit(v)}</p>
          </div>
        ))}
      </section>
      {canManage && <AdjustForm wallet={w} />}
      <section style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ textAlign: "left", color: BRAND.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {["When", "What", "Who", "Credits", "Balance"].map((h, i) => <th key={h} style={{ padding: "12px 14px", textAlign: i >= 3 ? "right" : "left" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {w.entries.map((e) => (
              <tr key={e.id} style={{ borderTop: `1px solid ${BRAND.line}` }}>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: BRAND.muted }}>{when(e.createdAt)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 700, color: BRAND.ink }}>{KIND[e.kind] || e.kind}{e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""}</div>
                  {e.note && <div style={{ fontSize: 12, color: BRAND.muted }}>{e.note}</div>}
                </td>
                <td style={{ padding: "10px 14px", color: BRAND.inkSoft }}>{[e.learnerName, e.byRole === "child" ? "(booked it)" : null, e.byRole === "staff" ? e.byName : null].filter(Boolean).join(" ") || "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: e.amount > 0 ? BRAND.navy : BRAND.ink }}>{e.amount > 0 ? "+" : "−"}{credit(Math.abs(e.amount))}</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>{credit(e.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!w.entries.length && <p style={{ margin: 0, padding: 16, fontSize: 13, color: BRAND.muted }}>Nothing yet.</p>}
      </section>
    </div>
  );
}

export default function CreditsTab({ canManage }) {
  const [params, setParams] = useSearchParams();
  const { data = [], isLoading } = useCreditWallets();
  const [q, setQ] = useState("");
  const walletId = params.get("wallet");
  const choose = (id) => { const next = new URLSearchParams(params); if (id) next.set("wallet", id); else next.delete("wallet"); setParams(next, { replace: true }); };
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.filter((w) => !term || [w.parent?.name, w.parent?.email, w.parent?.phone, ...w.children.map((c) => c.name)].filter(Boolean).some((x) => x.toLowerCase().includes(term)));
  }, [data, q]);
  if (walletId) return <WalletView id={walletId} canManage={canManage} onBack={() => choose(null)} />;
  const total = data.reduce((n, w) => n + w.balance, 0);
  const bought = data.reduce((n, w) => n + w.totalBought, 0);
  const used = data.reduce((n, w) => n + w.totalSpent, 0);
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, lineHeight: 1.55 }}>Parents buy credits (1 credit = KSh 1) from their Mentor credits page; any of their children can then book a mentor with them. Unused credits are money families have paid in advance.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[["Families", data.length], ["Credits held", credit(total)], ["Bought", credit(bought)], ["Used", credit(used)]].map(([t, v]) => (
          <div key={t} style={{ ...card, flex: "1 1 150px", padding: "13px 16px" }}><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{t}</p><p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{v}</p></div>
        ))}
      </div>
      <label style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiSearch color={BRAND.faint} />
        <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Parent, email, phone or child…" style={{ border: "none", outline: "none", width: "100%", fontSize: 13.5, fontFamily: FONT }} />
      </label>
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint }}>Loading…</p> : !shown.length ? <EmptyNote title={data.length ? "Nothing matches" : "No credit wallets yet"} line={data.length ? "Try another search." : "A wallet opens when a parent first buys credits."} /> : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" }}>
          {shown.map((w) => (
            <button key={w.id} type="button" onClick={() => choose(w.id)} className="mb-row" style={{ ...card, textAlign: "left", padding: "14px 16px", cursor: "pointer", fontFamily: FONT, border: "none" }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{w.parent?.name}</p>
              <p style={{ margin: "2px 0 8px", fontSize: 12, color: BRAND.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.children.map((c) => c.name).join(", ") || w.parent?.email}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: w.balance ? BRAND.navy : BRAND.faint }}>{credit(w.balance)} <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.muted }}>credits</span></p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: BRAND.faint }}>Bought {credit(w.totalBought)} · used {credit(w.totalSpent)} · {when(w.lastActivityAt)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
