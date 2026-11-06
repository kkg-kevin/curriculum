import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiCopy, FiDownload, FiGift, FiLink, FiShare2 } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { affiliatesApi, errorOf, formatDay, formatKsh, METHOD_LABEL } from "../services/affiliatesApi";

// "Refer & earn" (/parent/refer, /teacher-portal/refer): a parent's or educator's own place in the
// referral programme (server: modules/affiliates/, GET /api/affiliates/me). Join (an admin may
// approve first); then their link, QR and code to share, what they've earned (waiting → available
// → paid), the families they referred (first names only), and asking for a payout.

const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const STATE = { waiting: ["Waiting", "neutral"], available: ["Available", "good"], requested: ["Payout asked", "waiting"], paid: ["Paid", "strong"], cancelled: ["Cancelled", "danger"] };
const REF_STATUS = { signed_up: ["Signed up — not paid yet", "waiting"], paid: ["Paying", "good"], cancelled: ["Not counted", "neutral"] };

function Stat({ label, value, note }) {
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: BRAND.ink, marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function Share({ affiliate }) {
  const qrRef = useRef(null);
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast.success(what)).catch(() => toast.error("Couldn't copy"));
  const message = `I use Digifunzi for my children's digital skills — have a look: ${affiliate.link}  (or use my code ${affiliate.code} when you sign up)`;
  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `referral-${affiliate.code}.png`;
    a.click();
  };
  return (
    <section style={{ ...card, padding: 18, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
      {affiliate.link && <div ref={qrRef} style={{ flexShrink: 0 }}><QRCodeCanvas value={affiliate.link} size={112} includeMargin={false} /></div>}
      <div style={{ flex: "1 1 260px", minWidth: 0, display: "grid", gap: 10 }}>
        <h2 style={cardHeading}><FiLink size={13} /> Your link and code</h2>
        {affiliate.link && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <code style={{ fontSize: 13.5, color: BRAND.navy, background: BRAND.skyTint, padding: "7px 10px", borderRadius: 8, overflowWrap: "anywhere", flex: "1 1 220px" }}>{affiliate.link}</code>
            <button type="button" style={btn} onClick={() => copy(affiliate.link, "Link copied")}><FiCopy size={14} /> Copy link</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: BRAND.muted }}>Code</span>
          <strong style={{ fontSize: 18, letterSpacing: "0.06em", color: BRAND.ink }}>{affiliate.code}</strong>
          <button type="button" style={btn} onClick={() => copy(affiliate.code, "Code copied")}><FiCopy size={14} /> Copy</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" style={{ ...btn, textDecoration: "none" }}><FiShare2 size={14} /> Share on WhatsApp</a>
          {affiliate.link && <button type="button" style={btn} onClick={downloadQr}><FiDownload size={14} /> QR picture</button>}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A family who opens your link, or types your code when signing up, is credited to you.</p>
      </div>
    </section>
  );
}

function PayoutCard({ data }) {
  const qc = useQueryClient();
  const { affiliate, totals, programme, kind } = data;
  const [method, setMethod] = useState(affiliate.payoutMethod);
  const [phone, setPhone] = useState(affiliate.payoutPhone || "");
  const save = useMutation({
    mutationFn: () => affiliatesApi.updateMine({ payoutMethod: method, payoutPhone: phone || null }),
    onSuccess: (d) => { qc.setQueryData(["affiliates", "me"], d); toast.success("Saved"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const ask = useMutation({
    mutationFn: affiliatesApi.requestPayout,
    onSuccess: (d) => { qc.setQueryData(["affiliates", "me"], d); toast.success("Payout asked for — our team will pay it"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const changed = method !== affiliate.payoutMethod || (phone || "") !== (affiliate.payoutPhone || "");
  const canAsk = totals.available >= programme.minimumPayout && totals.available > 0 && totals.requested === 0;
  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
      <h2 style={cardHeading}><FiGift size={13} /> Getting paid</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>How
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {kind === "parent" && <option value="credit">Taken off my invoices</option>}
            <option value="mpesa">M-Pesa</option>
          </select>
        </label>
        {method === "mpesa" && (
          <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>M-Pesa number
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" />
          </label>
        )}
        {changed && <button type="button" style={btn} onClick={() => save.mutate()} disabled={save.isPending}>Save</button>}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={{ ...primary, opacity: canAsk ? 1 : 0.55, cursor: canAsk ? "pointer" : "not-allowed" }} disabled={!canAsk || ask.isPending} onClick={() => ask.mutate()}>
          {ask.isPending ? "Asking…" : `Ask for ${formatKsh(totals.available)}`}
        </button>
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>
          {totals.requested > 0 ? `${formatKsh(totals.requested)} is being paid by ${METHOD_LABEL[affiliate.payoutMethod] || "our team"}.`
            : totals.available < programme.minimumPayout ? `Payouts start from ${formatKsh(programme.minimumPayout)}.`
              : "Everything available goes in one payout."}
          {programme.holdDays > 0 ? ` Each amount waits ${programme.holdDays} days after the family pays.` : ""}
        </span>
      </div>
    </section>
  );
}

export default function ReferEarnPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["affiliates", "me"], queryFn: affiliatesApi.mine });
  const join = useMutation({
    mutationFn: () => affiliatesApi.join(),
    onSuccess: (d) => { qc.setQueryData(["affiliates", "me"], d); toast.success(d.affiliate?.status === "pending" ? "Thanks — our team will approve you shortly" : "You're in!"); },
    onError: (err) => toast.error(errorOf(err)),
  });

  if (isLoading) return <p style={{ fontFamily: FONT, color: BRAND.muted }}>Loading…</p>;
  if (error) return <p style={{ fontFamily: FONT, color: BRAND.danger }}>{errorOf(error)}</p>;
  const { affiliate, programme } = data;

  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: 16, maxWidth: 980 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "26px 30px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff" }}>Refer &amp; earn</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", maxWidth: 640, lineHeight: 1.55 }}>
          {programme.offer ? `Earn ${programme.offer}.` : "Invite other families to Digifunzi."}
          {programme.programmes?.length ? ` Counts for: ${programme.programmes.join(", ")}.` : ""}
        </p>
      </div>

      {!affiliate && (
        <section style={{ ...card, padding: 22, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink }}>How it works</h2>
          <ol style={{ margin: 0, paddingLeft: 20, color: BRAND.inkSoft, fontSize: 14, lineHeight: 1.7 }}>
            <li>Join and get your own link and code.</li>
            <li>Share them with families — on WhatsApp, at school, anywhere.</li>
            <li>When a family signs up through you and pays, you earn. {programme.holdDays ? `Each amount can be paid out ${programme.holdDays} days later.` : ""}</li>
          </ol>
          {programme.enabled && programme.selfJoin ? (
            <div><button type="button" style={primary} onClick={() => join.mutate()} disabled={join.isPending}>{join.isPending ? "Joining…" : "Join the referral programme"}</button></div>
          ) : (
            <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>Joining is by invitation for now — ask our team to add you.</p>
          )}
        </section>
      )}

      {affiliate?.status === "pending" && (
        <section style={{ ...card, padding: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={pill("waiting")}>Waiting for approval</span>
          <span style={{ fontSize: 13.5, color: BRAND.inkSoft }}>Our team will approve you shortly — your link and code ({affiliate.code}) work from then.</span>
        </section>
      )}
      {affiliate?.status === "suspended" && (
        <section style={{ ...card, padding: 18, fontSize: 13.5, color: BRAND.inkSoft }}>Your referral link is paused. Talk to our team if you think this is a mistake.</section>
      )}

      {affiliate?.status === "active" && <Share affiliate={affiliate} />}

      {affiliate && data.totals && (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Stat label="Earned" value={formatKsh(data.totals.earned)} note={`${data.referrals.filter((r) => r.status === "paid").length} paying ${data.referrals.filter((r) => r.status === "paid").length === 1 ? "family" : "families"}`} />
            <Stat label="Available" value={formatKsh(data.totals.available)} note={data.totals.waiting > 0 ? `+ ${formatKsh(data.totals.waiting)} waiting` : null} />
            <Stat label="Paid to you" value={formatKsh(data.totals.paid)} />
            <Stat label="Families referred" value={data.referrals.length} />
          </div>
          {affiliate.status === "active" && <PayoutCard data={data} />}

          <section style={{ ...card, padding: 18, display: "grid", gap: 10 }}>
            <h2 style={cardHeading}><FiCheckCircle size={13} /> Families you referred</h2>
            {data.referrals.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>No one yet — share your link to get started.</p> : (
              <div style={{ display: "grid", gap: 8 }}>
                {data.referrals.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: 10, border: `1px solid ${BRAND.line}` }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: BRAND.ink }}>{r.firstName}</strong>
                      <div style={{ fontSize: 12.5, color: BRAND.muted }}>{r.programme} · {formatDay(r.createdAt)} · {r.via === "code" ? "used your code" : "came by your link"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {r.earned > 0 && <strong style={{ color: BRAND.navy }}>{formatKsh(r.earned)}</strong>}
                      <span style={pill(REF_STATUS[r.status]?.[1] || "neutral")}>{REF_STATUS[r.status]?.[0] || r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(data.commissions.length > 0 || data.payouts.length > 0) && (
            <section style={{ ...card, padding: 18, display: "grid", gap: 10 }}>
              <h2 style={cardHeading}>What you've earned</h2>
              {data.commissions.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, paddingBottom: 8 }}>
                  <span>{c.firstName} · {c.programme}{c.periodNumber > 1 ? ` · payment ${c.periodNumber}` : ""} · {formatDay(c.createdAt)}</span>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <strong style={{ color: BRAND.ink }}>{formatKsh(c.amount)}</strong>
                    <span style={pill(STATE[c.state][1])}>{c.state === "waiting" ? `From ${formatDay(c.availableAt)}` : STATE[c.state][0]}</span>
                  </span>
                </div>
              ))}
              {data.payouts.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: BRAND.inkSoft }}>
                  <span>Payout · {METHOD_LABEL[p.method]} · {formatDay(p.createdAt)}{p.reference ? ` · ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
                  <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <strong style={{ color: BRAND.ink }}>{formatKsh(p.amount)}</strong>
                    <span style={pill(p.status === "paid" ? "strong" : p.status === "rejected" ? "danger" : "waiting")}>{p.status === "paid" ? "Paid" : p.status === "rejected" ? "Not paid" : "Being paid"}</span>
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
