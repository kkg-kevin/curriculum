import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiArrowDownLeft, FiArrowUpRight, FiCreditCard, FiPlus, FiRotateCcw, FiSliders, FiUsers } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { errorText, useBuyCredits, useMyCredits, useSetChildCredits } from "../hooks/useMentorBookings";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading } from "../../../theme/brand";

// The parent portal's Credits (/parent/credits, 27 Nov 2026 — server modules/family-credits/).
// 1 credit = KSh 1. A parent buys credits (an invoice, paid like any other); once paid they're in
// the family's wallet and ANY of their children can book a mentor with them from their own login,
// without waiting for the parent. Per child: on/off and an optional monthly limit. The history
// lists every purchase, booking, refund and adjustment. One wallet per learning centre (usually one).

const credit = (n) => Number(n || 0).toLocaleString("en-KE");
const when = (d) => new Date(d).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const KIND = {
  purchase: { label: "Bought", Icon: FiPlus },
  spend: { label: "Mentor session", Icon: FiArrowUpRight },
  refund: { label: "Back from a cancelled session", Icon: FiRotateCcw },
  adjust: { label: "From our team", Icon: FiSliders },
};
const btnStyle = (tone = "navy") => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 16px", minHeight: 42, borderRadius: 11, border: "none",
  background: tone === "gold" ? BRAND.gold : tone === "ghost" ? "#fff" : BRAND.navy, color: tone === "gold" ? BRAND.navy : tone === "ghost" ? BRAND.inkSoft : "#fff",
  fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: FONT, boxShadow: tone === "ghost" ? `inset 0 0 0 1.5px ${BRAND.border}` : "none",
});
const control = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${BRAND.border}`, fontSize: 16, fontFamily: FONT, color: BRAND.ink, background: "#fff" };

function BuyCredits({ wallet }) {
  const navigate = useNavigate();
  const buy = useBuyCredits();
  const [amount, setAmount] = useState(wallet.presets[1] || wallet.presets[0] || wallet.minimumPurchase);
  const [error, setError] = useState(null);
  const n = Math.round(Number(amount) || 0);
  const tooFew = n < wallet.minimumPurchase;
  return (
    <section style={{ ...card, padding: 20, display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
      <h2 style={cardHeading}><FiPlus size={13} /> Buy credits</h2>
      <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted, lineHeight: 1.5 }}>1 credit = KSh 1. You pay an invoice as usual (M-Pesa and the other ways your learning centre takes); once it's paid the credits are here, and your children can use them.</p>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 110px), 1fr))" }}>
        {wallet.presets.map((p) => (
          <button key={p} type="button" aria-pressed={n === p} onClick={() => setAmount(p)}
            style={{ padding: "12px 8px", minHeight: 48, borderRadius: 12, border: `2px solid ${n === p ? BRAND.navy : BRAND.border}`, background: n === p ? BRAND.skyTint : "#fff", color: BRAND.ink, fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: FONT }}>
            {credit(p)}
          </button>
        ))}
      </div>
      <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft, maxWidth: 260 }}>Or another amount
        <input type="number" inputMode="numeric" min={wallet.minimumPurchase} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={control} />
      </label>
      {tooFew && <p style={{ margin: 0, fontSize: 13, color: BRAND.goldText }}>The least you can buy is {credit(wallet.minimumPurchase)} credits.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: BRAND.danger }}>{error}</p>}
      <div>
        <button type="button" style={btnStyle("gold")} disabled={buy.isPending || tooFew}
          onClick={() => { setError(null); buy.mutate({ amount: n, ownerAdminId: wallet.ownerAdminId }, { onSuccess: (r) => navigate(`/parent/invoices/${r.invoiceId}`), onError: (e) => setError(errorText(e)) }); }}>
          <FiCreditCard size={15} /> {buy.isPending ? "Making the invoice…" : `Buy ${credit(n)} credits · KSh ${credit(n)}`}
        </button>
      </div>
    </section>
  );
}

function ChildRow({ child, wallet }) {
  const save = useSetChildCredits();
  const [limit, setLimit] = useState(child.monthlyLimit == null ? "" : String(child.monthlyLimit));
  const send = (patch) => save.mutate({ learnerId: child.id, ownerAdminId: wallet.ownerAdminId, allowed: child.allowed, monthlyLimit: limit === "" ? null : Number(limit), ...patch });
  return (
    <li style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 0", borderTop: `1px solid ${BRAND.line}` }}>
      <Avatar firstName={child.firstName} lastName={child.lastName} photo={child.photo} size={40} />
      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{child.firstName}</div>
        <div style={{ fontSize: 12.5, color: BRAND.muted }}>
          {child.allowed ? "Can book a mentor with credits" : "Can't book with credits"} · spent {credit(child.spentThisMonth)} this month{child.monthlyLimit != null ? ` of ${credit(child.monthlyLimit)}` : ""}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: BRAND.inkSoft, cursor: "pointer" }}>
        <input type="checkbox" checked={child.allowed} onChange={(e) => send({ allowed: e.target.checked })} style={{ width: 20, height: 20 }} disabled={!wallet.childBooking} /> Can book
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>
        Monthly limit
        <input type="number" inputMode="numeric" min="0" step="1" value={limit} placeholder="None" onChange={(e) => setLimit(e.target.value)}
          onBlur={() => { if (String(child.monthlyLimit ?? "") !== limit) send({}); }} style={{ ...control, width: 110, padding: "8px 10px" }} aria-label={`Monthly limit for ${child.firstName}`} />
      </label>
    </li>
  );
}

function Wallet({ wallet, single }) {
  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      {!single && <h2 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 900, color: BRAND.ink }}>{wallet.name}</h2>}
      <div className="cr-cols" style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
          <section style={{ ...card, padding: 20, display: "grid", gap: 6, background: BRAND.skyTint, borderColor: BRAND.skyBorder }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your family's credits</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: BRAND.navy, lineHeight: 1.1 }}>{credit(wallet.balance)}</span>
            <span style={{ fontSize: 13, color: BRAND.inkSoft }}>Bought {credit(wallet.totalBought)} · used {credit(wallet.totalSpent)}</span>
          </section>
          {wallet.pending.length > 0 && (
            <section style={{ ...card, padding: 16, background: BRAND.goldTint, borderColor: BRAND.goldBorder, display: "grid", gap: 8 }}>
              <strong style={{ fontSize: 14, color: BRAND.goldText }}>Waiting for payment</strong>
              {wallet.pending.map((p) => (
                <Link key={p.id} to={`/parent/invoices/${p.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>
                  <span>{credit(p.amount)} credits · {p.invoiceNumber}</span><span style={{ color: BRAND.mid }}>Pay</span>
                </Link>
              ))}
            </section>
          )}
          {wallet.enabled ? <BuyCredits wallet={wallet} /> : <section style={{ ...card, padding: 18, fontSize: 14, color: BRAND.muted }}>Credits aren&apos;t on at this learning centre yet.</section>}
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
          <section style={{ ...card, padding: 20 }}>
            <h2 style={cardHeading}><FiUsers size={13} /> Your children</h2>
            <p style={{ margin: "6px 0 4px", fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>
              {wallet.childBooking ? "Each child can book a mentor themselves from their own login, using these credits. You're told every time. Switch a child off, or give them a monthly limit." : "Your learning centre hasn't switched on children booking for themselves yet. You can still book with credits."}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>{wallet.children.map((c) => <ChildRow key={c.id} child={c} wallet={wallet} />)}</ul>
          </section>
          <section style={{ ...card, padding: 20 }}>
            <h2 style={cardHeading}>History</h2>
            {wallet.entries.length === 0 ? <p style={{ margin: "8px 0 0", fontSize: 13.5, color: BRAND.muted }}>Nothing yet.</p> : (
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
                {wallet.entries.map((e) => {
                  const k = KIND[e.kind] || KIND.adjust;
                  const plus = e.amount > 0;
                  return (
                    <li key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderTop: `1px solid ${BRAND.line}` }}>
                      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: plus ? BRAND.skyTint : BRAND.greyTint, color: plus ? BRAND.navy : BRAND.inkSoft }}>{plus ? <FiArrowDownLeft size={15} /> : <k.Icon size={15} />}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{k.label}{e.learnerName ? ` · ${e.learnerName}${e.byRole === "child" ? " booked it" : ""}` : ""}</span>
                        <span style={{ display: "block", fontSize: 12, color: BRAND.muted, overflowWrap: "anywhere" }}>{[when(e.createdAt), e.note].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 900, color: plus ? BRAND.navy : BRAND.ink }}>{plus ? "+" : "−"}{credit(Math.abs(e.amount))}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: BRAND.faint }}>{credit(e.balanceAfter)} left</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ParentCreditsPage() {
  const { data: wallets = [], isLoading } = useMyCredits();
  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <style>{`@media (max-width: 900px) { .cr-cols { grid-template-columns: 100% !important; } }`}</style>
      <header style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Mentor credits</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.85)", maxWidth: 640, lineHeight: 1.6 }}>
            Buy credits once, and your children can book a mentor themselves whenever they&apos;re stuck, without waiting for you. 1 credit = KSh 1. You can use them to book too.
          </p>
        </div>
        <Link to="/parent/bookings/new" style={{ ...btnStyle("gold"), textDecoration: "none" }}>Book a mentor</Link>
      </header>
      {isLoading ? <p style={{ color: BRAND.faint, fontSize: 14 }}>Loading…</p>
        : wallets.length === 0 ? <section style={{ ...card, padding: 20, fontSize: 14, color: BRAND.muted }}>Credits appear here once your children are at a learning centre.</section>
          : wallets.map((w) => <Wallet key={w.ownerAdminId} wallet={w} single={wallets.length === 1} />)}
    </div>
  );
}
