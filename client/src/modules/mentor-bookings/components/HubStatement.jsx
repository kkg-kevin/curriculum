import { useState } from "react";
import { Modal, QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { useHubStatement, useSettleHub } from "../hooks/useMentorBookings";
import { dayLabel, ksh, lengthLabel } from "../shared";
import { BRAND, FONT, card, cardHeading, pill } from "../../../theme/brand";

// A partner hub's desk-fee statement (option C): the workspace collects the space fee with each
// mentor session, and owes the hub its share (less the % kept for collecting) once the session
// has happened. Staff settle it — paid out, or credited on the hub's own unpaid invoices; the hub's
// own login reads the same statement (read only).

const box = { ...card, padding: "16px 18px", fontFamily: FONT };
const METHODS = [["mpesa", "M-Pesa"], ["bank", "Bank transfer"], ["cash", "Cash"], ["offset", "Credit on their invoice"]];

function SettleDialog({ statement, onClose }) {
  const settle = useSettleHub();
  const [method, setMethod] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState(statement.openInvoices?.[0]?.id || "");
  const [note, setNote] = useState("");
  const amount = statement.owed.total;
  const blocked = (method === "offset" && !invoiceId) || ((method === "mpesa" || method === "bank") && !reference.trim());
  return (
    <Modal title={`Settle ${ksh(amount)} with ${statement.hub.name}`} onClose={onClose} footer={(
      <>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={blocked || settle.isPending} onClick={() => settle.mutate({ hubId: statement.hub.id, method, reference, offsetInvoiceId: method === "offset" ? invoiceId : null, note }, { onSuccess: onClose })} style={btn("primary", { disabled: blocked || settle.isPending })}>{settle.isPending ? "Saving…" : "Record settlement"}</button>
      </>
    )}>
      <CheckinStyles />
      <p style={{ margin: "0 0 12px", fontSize: 13.5, color: BRAND.inkSoft }}>{statement.owed.bookings.length} session{statement.owed.bookings.length === 1 ? "" : "s"} held at {statement.hub.name}.</p>
      <span style={label}>How</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {METHODS.map(([key, text]) => (
          <button key={key} type="button" onClick={() => setMethod(key)} disabled={key === "offset" && !statement.openInvoices?.length} style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${method === key ? BRAND.navy : BRAND.border}`, background: method === key ? BRAND.navy : "#fff", color: method === key ? "#fff" : BRAND.inkSoft, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: FONT, opacity: key === "offset" && !statement.openInvoices?.length ? 0.5 : 1 }}>{text}</button>
        ))}
      </div>
      {method === "offset" ? (
        <>
          <label htmlFor="st-inv" style={label}>Their invoice</label>
          <select id="st-inv" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} style={input}>
            {(statement.openInvoices || []).map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber}{i.periodLabel ? ` · ${i.periodLabel}` : ""} — {ksh(i.due)} due</option>)}
          </select>
        </>
      ) : method !== "cash" && (
        <>
          <label htmlFor="st-ref" style={label}>{method === "mpesa" ? "M-Pesa code" : "Bank reference"}</label>
          <input id="st-ref" value={reference} onChange={(e) => setReference(e.target.value)} style={input} />
        </>
      )}
      <label htmlFor="st-note" style={{ ...label, marginTop: 12 }}>Note (optional)</label>
      <input id="st-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} style={input} />
    </Modal>
  );
}

function Lines({ rows }) {
  if (!rows.length) return <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>None.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 460 }}>
        <thead>
          <tr style={{ textAlign: "left", color: BRAND.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {["Session", "Learner", "Space", "Space fee", "Owed to the hub"].map((x) => <th key={x} style={{ padding: "6px 8px", borderBottom: `1px solid ${BRAND.line}`, fontWeight: 800 }}>{x}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: `1px solid ${BRAND.line}`, whiteSpace: "nowrap" }}>{dayLabel(r.date)} {r.startTime} · {lengthLabel(r.minutes)}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${BRAND.line}` }}>{r.learnerName || "—"}{r.status === "no_show" ? " (didn't join)" : ""}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${BRAND.line}` }}>{r.spaceName || "—"}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${BRAND.line}` }}>{ksh(r.deskFee)}</td>
              <td style={{ padding: 8, borderBottom: `1px solid ${BRAND.line}`, fontWeight: 800 }}>{ksh(r.hubShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HubStatement({ hubId, canSettle = false }) {
  const { data: s, isLoading } = useHubStatement(hubId);
  const [settling, setSettling] = useState(false);
  if (isLoading) return <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p>;
  if (!s) return null;
  const tiles = [["Owed now", s.owed.total, "Sessions held, not yet settled"], ["Coming", s.upcoming.total, "Paid sessions still to happen"], ["Settled so far", s.settled.total, `${s.settlements.length} settlement${s.settlements.length === 1 ? "" : "s"}`]];
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: BRAND.ink }}>{s.hub.name}</h2>
        {s.hub.deskFeeOwner === "hub" ? <span style={pill("info")}>Partner · we keep {s.hub.deskCollectionPercent}%</span> : <span style={pill("neutral")}>Our own hub — nothing owed</span>}
        {canSettle && s.owed.total > 0 && <button type="button" className="ci-btn" onClick={() => setSettling(true)} style={{ ...btn("primary"), marginLeft: "auto" }}>Settle {ksh(s.owed.total)}</button>}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {tiles.map(([t, v, sub]) => (
          <div key={t} style={{ ...box, flex: "1 1 180px" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: BRAND.muted }}>{t}</p>
            <p style={{ margin: "3px 0 0", fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{ksh(v)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: BRAND.faint }}>{sub}</p>
          </div>
        ))}
      </div>
      <section style={box}><h3 style={{ ...cardHeading, marginBottom: 10 }}>Owed now</h3><Lines rows={s.owed.bookings} /></section>
      {s.upcoming.bookings.length > 0 && <section style={box}><h3 style={{ ...cardHeading, marginBottom: 10 }}>Coming</h3><Lines rows={s.upcoming.bookings} /></section>}
      {s.settlements.length > 0 && (
        <section style={box}>
          <h3 style={{ ...cardHeading, marginBottom: 10 }}>Settlements</h3>
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
            {s.settlements.map((x) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, padding: "8px 10px", borderRadius: 9, background: BRAND.canvas }}>
                <span>{new Date(x.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} · {METHODS.find(([k]) => k === x.method)?.[1] || x.method}{x.reference ? ` · ${x.reference}` : ""} · {x.bookingCount} session{x.bookingCount === 1 ? "" : "s"}</span>
                <strong>{ksh(x.amount)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {settling && <SettleDialog statement={s} onClose={() => setSettling(false)} />}
    </div>
  );
}
