import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiCopy, FiDownload, FiGift, FiLink, FiShare2, FiUsers } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import { affiliatesApi, errorOf, formatDay, formatKsh, METHOD_LABEL } from "../services/affiliatesApi";

// "Refer & earn" (/parent/refer, /teacher-portal/refer, and /affiliate-portal for someone signed in
// as Affiliate): an affiliate's own place in the referral programme (server: modules/affiliates/,
// GET /api/affiliates/me). A parent or educator joins here (an admin may approve first); then their
// link, QR and code to share, what they've earned (waiting → available → paid), the families they
// referred (first names only), how they're paid and asking for a payout.

const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };
const primary = { ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const STATE = { waiting: ["Waiting", "neutral"], available: ["Available", "good"], requested: ["Payout asked", "waiting"], paid: ["Paid", "strong"], cancelled: ["Cancelled", "danger"] };
const REF_STATUS = { signed_up: ["Signed up — not paid yet", "waiting"], paid: ["Paying", "good"], cancelled: ["Not counted", "neutral"] };

// The page fits whatever device it's opened on: class-based rules (global.css's phone rules only
// rewrite inline grid styles) — figures two across on a phone, the share actions as equal,
// thumb-sized buttons, 16px fields on phones so iPhones don't zoom in when one is tapped.
const PAGE_CSS = `
  .re-page { font-family: ${FONT}; display: grid; gap: 16px; width: 100%; min-width: 0; }
  .re-page button, .re-page a { overflow-wrap: normal; }
  .re-hero { background: ${HERO_GRADIENT}; border-radius: 20px; padding: 26px 30px; }
  .re-hero h1 { margin: 0 0 6px; font-size: 24px; font-weight: 900; color: #fff; }
  .re-share { display: flex; gap: 18px; align-items: center; padding: 18px; }
  .re-share__qr { flex-shrink: 0; line-height: 0; }
  .re-share__body { flex: 1 1 auto; min-width: 0; display: grid; gap: 10px; }
  .re-link { display: flex; gap: 8px; align-items: center; min-width: 0; }
  .re-link code { flex: 1 1 auto; min-width: 0; font-size: 13.5px; color: ${BRAND.navy}; background: ${BRAND.skyTint}; padding: 8px 10px; border-radius: 8px; overflow-wrap: anywhere; }
  .re-code { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .re-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .re-stats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
  .re-stat__value { font-size: 22px; font-weight: 900; color: ${BRAND.ink}; margin-top: 4px; overflow-wrap: anywhere; }
  .re-pay-fields { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .re-pay-ask { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .re-row { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center; }
  .re-row__end { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
  @media (max-width: 640px) {
    .re-page { gap: 12px; }
    .re-hero { padding: 20px 18px; border-radius: 16px; }
    .re-hero h1 { font-size: 21px; }
    .re-share { flex-direction: column; align-items: stretch; padding: 16px; gap: 14px; }
    .re-share__qr { align-self: center; }
    .re-link { flex-direction: column; align-items: stretch; }
    .re-code .re-btn { margin-left: auto; }
    .re-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .re-actions .re-native { grid-column: 1 / -1; }
    .re-btn { justify-content: center; min-height: 44px; }
    .re-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .re-stat { padding: 12px 14px !important; }
    .re-stat__value { font-size: 19px; }
    .re-pay-fields > label { flex-basis: 100% !important; }
    .re-pay-fields > button, .re-pay-ask > button { width: 100%; }
    .re-page input, .re-page select { font-size: 16px !important; min-height: 44px; }
  }
`;

// Copies on every device: the clipboard API where the browser allows it (secure pages only), else
// the older select-and-copy.
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* falls through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0" });
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
const canShareNatively = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

function Stat({ label, value, note }) {
  return (
    <div className="re-stat" style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="re-stat__value">{value}</div>
      {note && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function Share({ affiliate, kind }) {
  const qrRef = useRef(null);
  const copy = async (text, what) => ((await copyText(text)) ? toast.success(what) : toast.error("Couldn't copy — press and hold to copy it"));
  const message = kind === "parent"
    ? `I use Digifunzi for my children's digital skills — have a look: ${affiliate.link}  (or use my code ${affiliate.code} when you sign up)`
    : `Digifunzi teaches children digital skills — coding, robotics and more. Have a look: ${affiliate.link}  (or use my code ${affiliate.code} when you sign up)`;
  // The device's own share sheet (WhatsApp, SMS, email, Telegram… whatever is on the phone).
  const shareNative = async () => {
    try {
      await navigator.share({ title: "Digifunzi", text: message });
    } catch (err) {
      if (err?.name !== "AbortError") toast.error("Couldn't open sharing — copy the link instead");
    }
  };
  // The QR as a picture: shared straight to an app where the phone can share files, else saved.
  const qrPicture = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const name = `referral-${affiliate.code}.png`;
    const save = () => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = name;
      a.click();
    };
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (!touch || !canShareNatively() || typeof canvas.toBlob !== "function" || typeof File !== "function") {
      save();
      return;
    }
    canvas.toBlob(async (blob) => {
      try {
        const file = new File([blob], name, { type: "image/png" });
        if (!navigator.canShare?.({ files: [file] })) {
          save();
          return;
        }
        await navigator.share({ files: [file], title: "Digifunzi", text: message });
      } catch (err) {
        if (err?.name !== "AbortError") save();
      }
    }, "image/png");
  };
  return (
    <section className="re-share" style={card}>
      {affiliate.link && <div ref={qrRef} className="re-share__qr"><QRCodeCanvas value={affiliate.link} size={120} includeMargin={false} /></div>}
      <div className="re-share__body">
        <h2 style={cardHeading}><FiLink size={13} /> Your link and code</h2>
        {affiliate.link && (
          <div className="re-link">
            <code>{affiliate.link}</code>
            <button type="button" className="re-btn" style={btn} onClick={() => copy(affiliate.link, "Link copied")}><FiCopy size={14} /> Copy link</button>
          </div>
        )}
        <div className="re-code">
          <span style={{ fontSize: 13, color: BRAND.muted }}>Code</span>
          <strong style={{ fontSize: 18, letterSpacing: "0.06em", color: BRAND.ink }}>{affiliate.code}</strong>
          <button type="button" className="re-btn" style={btn} onClick={() => copy(affiliate.code, "Code copied")}><FiCopy size={14} /> Copy code</button>
        </div>
        <div className="re-actions">
          {canShareNatively() && <button type="button" className="re-btn re-native" style={primary} onClick={shareNative}><FiShare2 size={14} /> Share…</button>}
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="re-btn" style={{ ...btn, textDecoration: "none" }}><FiShare2 size={14} /> WhatsApp</a>
          {affiliate.link && <button type="button" className="re-btn" style={btn} onClick={qrPicture}><FiDownload size={14} /> QR picture</button>}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>A family who opens your link, or types your code when signing up, is credited to you.</p>
      </div>
    </section>
  );
}

// A manager's team (level 1): their recruit link, what the team has earned them, and each member —
// families and what they earned the manager (never the families' names or contacts).
function TeamCard({ team, programme }) {
  const share = programme.teamRate != null
    ? `${programme.teamRate}% of what ${programme.teamBasis === "commission" ? "each member earns" : "their families pay"}`
    : "a share of what their families pay";
  const invite = `Join my Digifunzi affiliate team — earn when families you refer sign up and pay: ${team.recruitLink || ""}`;
  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
      <h2 style={cardHeading}><FiUsers size={13} /> Your team</h2>
      <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.55 }}>
        You earn {share}, on top of what they earn — and you still earn from the families you refer yourself.
        {team.earned > 0 ? <> Your team has earned you <strong>{formatKsh(team.earned)}</strong> so far.</> : null}
      </p>
      {team.recruitLink && (
        <div className="re-link">
          <code>{team.recruitLink}</code>
          <button type="button" className="re-btn" style={btn} onClick={async () => ((await copyText(team.recruitLink)) ? toast.success("Recruit link copied") : toast.error("Couldn't copy"))}><FiCopy size={14} /> Copy recruit link</button>
        </div>
      )}
      {team.recruitLink && (
        <div className="re-actions">
          <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer" className="re-btn" style={{ ...btn, textDecoration: "none" }}><FiShare2 size={14} /> Invite on WhatsApp</a>
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>People who apply with your recruit link join your team once our team approves them.</p>
      {team.members.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>No one in your team yet.</p> : (
        <div style={{ display: "grid", gap: 8 }}>
          {team.members.map((m) => (
            <div key={m.id} className="re-row" style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${BRAND.line}` }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ color: BRAND.ink }}>{m.name}</strong>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>
                  {m.families} {m.families === 1 ? "family" : "families"} · {m.payingFamilies} paying · since {formatDay(m.joinedAt)}{m.status !== "active" ? ` · ${m.status === "pending" ? "waiting for approval" : "paused"}` : ""}
                </div>
              </div>
              <div className="re-row__end">
                <strong style={{ color: BRAND.navy }}>{formatKsh(m.earnedYou)}</strong>
                <span style={{ fontSize: 12, color: BRAND.muted }}>earned you</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PayoutCard({ data }) {
  const qc = useQueryClient();
  const { affiliate, totals, programme, kind } = data;
  const [method, setMethod] = useState(affiliate.payoutMethod);
  const [phone, setPhone] = useState(affiliate.payoutPhone || "");
  const [bank, setBank] = useState(affiliate.payoutDetails || "");
  const save = useMutation({
    mutationFn: () => affiliatesApi.updateMine({ payoutMethod: method, payoutPhone: phone || null, payoutDetails: bank || null }),
    onSuccess: (d) => { qc.setQueryData(["affiliates", "me"], d); toast.success("Saved"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const ask = useMutation({
    mutationFn: affiliatesApi.requestPayout,
    onSuccess: (d) => { qc.setQueryData(["affiliates", "me"], d); toast.success("Payout asked for — our team will pay it"); },
    onError: (err) => toast.error(errorOf(err)),
  });
  const changed = method !== affiliate.payoutMethod || (phone || "") !== (affiliate.payoutPhone || "") || (bank || "") !== (affiliate.payoutDetails || "");
  const canAsk = totals.available >= programme.minimumPayout && totals.available > 0 && totals.requested === 0;
  return (
    <section style={{ ...card, padding: 18, display: "grid", gap: 12 }}>
      <h2 style={cardHeading}><FiGift size={13} /> Getting paid</h2>
      <div className="re-pay-fields">
        <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, flex: "1 1 200px" }}>How
          <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
            {kind === "parent" && <option value="credit">Taken off my invoices</option>}
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank transfer</option>
          </select>
        </label>
        {method === "mpesa" && (
          <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, flex: "1 1 200px" }}>M-Pesa number
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07…" inputMode="tel" autoComplete="tel" />
          </label>
        )}
        {method === "bank" && (
          <label style={{ display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, flex: "2 1 260px" }}>Bank, account name and number
            <input style={input} value={bank} onChange={(e) => setBank(e.target.value)} placeholder="E.g. KCB, Jane Wanjiru, 1234567890" />
          </label>
        )}
        {changed && <button type="button" className="re-btn" style={btn} onClick={() => save.mutate()} disabled={save.isPending}>Save</button>}
      </div>
      <div className="re-pay-ask">
        <button type="button" className="re-btn" style={{ ...primary, opacity: canAsk ? 1 : 0.55, cursor: canAsk ? "pointer" : "not-allowed" }} disabled={!canAsk || ask.isPending} onClick={() => ask.mutate()}>
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
    <div className="re-page">
      <style>{PAGE_CSS}</style>
      <div className="re-hero">
        <h1>Refer &amp; earn</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.55 }}>
          {programme.offer ? `Earn ${programme.offer}.` : "Invite other families to Digifunzi."}
          {programme.programmes?.length ? ` Counts for: ${programme.programmes.join(", ")}.` : ""}
        </p>
        {data.manager && <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#feb139" }}>You&rsquo;re in {data.manager.name}&rsquo;s team.</p>}
        {data.team && <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "#feb139" }}>You manage a team of {data.team.members.length}.</p>}
      </div>

      {!affiliate && (
        <section style={{ ...card, padding: 22, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: BRAND.ink }}>How it works</h2>
          <ol style={{ margin: 0, paddingLeft: 20, color: BRAND.inkSoft, fontSize: 14, lineHeight: 1.7 }}>
            <li>Join and get your own link and code.</li>
            <li>Share them with families — on WhatsApp, at school, anywhere.</li>
            <li>When a family signs up through you and pays, you earn. {programme.holdDays ? `Each amount can be paid out ${programme.holdDays} days later.` : ""}</li>
          </ol>
          {programme.enabled && programme.selfJoin && data.kind !== "other" ? (
            <div><button type="button" className="re-btn" style={primary} onClick={() => join.mutate()} disabled={join.isPending}>{join.isPending ? "Joining…" : "Join the referral programme"}</button></div>
          ) : (
            <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>Joining is by invitation for now — ask our team to add you.</p>
          )}
        </section>
      )}

      {affiliate?.status === "pending" && (
        <section style={{ ...card, padding: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={pill("waiting")}>Waiting for approval</span>
          <span style={{ fontSize: 13.5, color: BRAND.inkSoft }}>Our team will approve you shortly — your link and code ({affiliate.code}) work from then.</span>
        </section>
      )}
      {affiliate?.status === "suspended" && (
        <section style={{ ...card, padding: 18, fontSize: 13.5, color: BRAND.inkSoft }}>Your referral link is paused. Talk to our team if you think this is a mistake.</section>
      )}

      {affiliate?.status === "active" && <Share affiliate={affiliate} kind={data.kind} />}

      {affiliate && data.totals && (
        <>
          <div className="re-stats">
            <Stat label="Earned" value={formatKsh(data.totals.earned)} note={`${data.referrals.filter((r) => r.status === "paid").length} paying ${data.referrals.filter((r) => r.status === "paid").length === 1 ? "family" : "families"}`} />
            <Stat label="Available" value={formatKsh(data.totals.available)} note={data.totals.waiting > 0 ? `+ ${formatKsh(data.totals.waiting)} waiting` : null} />
            <Stat label="Paid to you" value={formatKsh(data.totals.paid)} />
            <Stat label="Families referred" value={data.referrals.length} />
          </div>
          {affiliate.status === "active" && <PayoutCard data={data} />}
          {data.team && <TeamCard team={data.team} programme={programme} />}

          <section style={{ ...card, padding: 18, display: "grid", gap: 10 }}>
            <h2 style={cardHeading}><FiCheckCircle size={13} /> Families you referred</h2>
            {data.referrals.length === 0 ? <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>No one yet — share your link to get started.</p> : (
              <div style={{ display: "grid", gap: 8 }}>
                {data.referrals.map((r) => (
                  <div key={r.id} className="re-row" style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${BRAND.line}` }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: BRAND.ink }}>{r.firstName}</strong>
                      <div style={{ fontSize: 12.5, color: BRAND.muted }}>{r.programme} · {formatDay(r.createdAt)} · {r.via === "code" ? "used your code" : "came by your link"}</div>
                    </div>
                    <div className="re-row__end">
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
                <div key={c.id} className="re-row" style={{ fontSize: 13.5, color: BRAND.inkSoft, borderBottom: `1px solid ${BRAND.line}`, paddingBottom: 8 }}>
                  <span>{c.team ? `Team · ${c.from} · ${c.firstName}` : c.firstName} · {c.programme}{c.periodNumber > 1 ? ` · payment ${c.periodNumber}` : ""} · {formatDay(c.createdAt)}</span>
                  <span className="re-row__end">
                    <strong style={{ color: BRAND.ink }}>{formatKsh(c.amount)}</strong>
                    <span style={pill(STATE[c.state][1])}>{c.state === "waiting" ? `From ${formatDay(c.availableAt)}` : STATE[c.state][0]}</span>
                  </span>
                </div>
              ))}
              {data.payouts.map((p) => (
                <div key={p.id} className="re-row" style={{ fontSize: 13.5, color: BRAND.inkSoft }}>
                  <span>Payout · {METHOD_LABEL[p.method]} · {formatDay(p.createdAt)}{p.reference ? ` · ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="re-row__end">
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
