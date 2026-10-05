import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiClock, FiDollarSign, FiInbox, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useSupervisorClaims } from "../hooks/useClaims";
import { T, cardStyle, formatDate, formatMoney, TYPE_LABEL, ClaimStatusPill } from "../shared";
import ClaimReviewDialog from "../components/ClaimReviewDialog";
import { Avatar, ClaimCard, HeroStat, OVERDUE_DAYS, daysSince, greeting } from "../components/supervisorParts";

// The supervisor's dashboard: what needs them now. The claims that have waited longest are here
// to act on directly; the full list, with its filters and export, is the Claims page.

const SHOWN = 4;

export default function SupervisorDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error } = useSupervisorClaims();

  const claims = useMemo(() => data?.claims || [], [data]);
  const educators = useMemo(() => data?.educators || [], [data]);
  const counts = data?.counts || {};
  const amounts = data?.amounts || {};
  const currency = claims[0]?.currency || "KES";
  const money = (value) => formatMoney(value, currency);

  // Opened from a notification with ?claim=<id>.
  const openId = searchParams.get("claim");
  const open = (id) => setSearchParams(id ? { claim: id } : {}, { replace: true });

  // Longest-waiting first.
  const waiting = useMemo(() => claims.filter((c) => c.status === "pending_supervisor").sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [claims]);
  const overdueCount = waiting.filter((c) => daysSince(c.createdAt) >= OVERDUE_DAYS).length;
  const decided = useMemo(
    () => claims.filter((c) => c.status !== "pending_supervisor").sort((a, b) => new Date(b.supervisorDecidedAt || b.updatedAt || b.createdAt) - new Date(a.supervisorDecidedAt || a.updatedAt || a.createdAt)).slice(0, 5),
    [claims]
  );
  const perEducator = useMemo(() => {
    const map = new Map();
    for (const claim of waiting) map.set(claim.teacherId, (map.get(claim.teacherId) || 0) + 1);
    return map;
  }, [waiting]);

  const firstName = String(user?.name || "").trim().split(/\s+/)[0] || "there";

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading your dashboard…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your dashboard couldn't be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const linkStyle = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.accentMid, textDecoration: "none" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: "28px 30px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 42%, ${T.accentMid} 78%, ${T.accentLight} 100%)`, boxShadow: "0 14px 34px rgba(37,71,106,0.22)" }}>
        <div style={{ position: "absolute", top: -70, right: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -90, right: 140, width: 200, height: 200, borderRadius: "50%", background: "rgba(254,177,57,0.14)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>Claims supervisor</p>
            <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.6px" }}>{greeting()}, {firstName}</h1>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "rgba(255,255,255,0.86)", lineHeight: 1.5, maxWidth: 620 }}>
              {waiting.length > 0
                ? <>You have <strong style={{ color: "#fff" }}>{waiting.length} {waiting.length === 1 ? "claim" : "claims"}</strong> worth <strong style={{ color: "#fff" }}>{money(amounts.pending_supervisor)}</strong> waiting for your review{overdueCount > 0 ? <> — <strong style={{ color: "#FFD58A" }}>{overdueCount} for more than {OVERDUE_DAYS} days</strong></> : null}.</>
                : "You're all caught up — no claims are waiting for your review."}
            </p>
          </div>
          {waiting.length > 0 && (
            <button type="button" onClick={() => navigate("/supervisor-portal/claims")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, border: "none", background: T.gold, color: "#17304B", fontSize: 14, fontWeight: 800, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Review claims <FiArrowRight size={15} />
            </button>
          )}
        </div>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 12, marginTop: 22 }}>
          <HeroStat icon={FiInbox} value={waiting.length} label="To review" sub={money(amounts.pending_supervisor)} />
          <HeroStat icon={FiClock} value={counts.approved || 0} label="Awaiting payment" sub={money(amounts.approved)} />
          <HeroStat icon={FiDollarSign} value={counts.paid || 0} label="Paid" sub={money(amounts.paid)} />
          <HeroStat icon={FiUsers} value={educators.length} label={educators.length === 1 ? "Educator" : "Educators"} sub="you supervise" />
        </div>
      </section>

      <div className="supervisor-dash">
        <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.ink }}>Needs your review</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>The claims that have waited longest come first.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {overdueCount > 0 && (
                <Link to="/supervisor-portal/claims?overdue=1" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
                  <FiAlertTriangle size={13} /> {overdueCount} waiting {OVERDUE_DAYS}+ days
                </Link>
              )}
              {waiting.length > SHOWN && <Link to="/supervisor-portal/claims" style={linkStyle}>See all {waiting.length} <FiArrowRight size={14} /></Link>}
            </div>
          </div>

          {waiting.length === 0 ? (
            <div style={{ ...cardStyle, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 18, background: "#ECFDF5", color: "#16A34A", display: "grid", placeItems: "center" }}><FiCheckCircle size={26} /></div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>You're all caught up</p>
              <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>No claims are waiting for your review. New ones appear here as your educators send them, and you'll get a notification.</p>
            </div>
          ) : (
            waiting.slice(0, SHOWN).map((claim) => <ClaimCard key={claim.id} claim={claim} onOpen={() => open(claim.id)} />)
          )}

          {decided.length > 0 && (
            <div style={{ ...cardStyle, overflow: "hidden", marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>Recently decided</h2>
                <Link to="/supervisor-portal/claims?tab=approved" style={linkStyle}>All claims <FiArrowRight size={14} /></Link>
              </div>
              {decided.map((claim, index) => (
                <button key={claim.id} type="button" onClick={() => open(claim.id)} className="supervisor-recent" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 18px", textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif", background: "#fff", border: "none", borderTop: index ? "1px solid #F1F5F9" : "none", flexWrap: "wrap" }}>
                  <Avatar name={claim.teacherName} size={32} />
                  <span style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.teacherName} · {TYPE_LABEL[claim.type]}</span>
                    <span style={{ display: "block", fontSize: 12, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.courseName} · decided {formatDate(claim.supervisorDecidedAt || claim.updatedAt)}</span>
                  </span>
                  <ClaimStatusPill status={claim.status} size="small" />
                  <span style={{ minWidth: 96, textAlign: "right", fontSize: 14, fontWeight: 800, color: T.accent, fontVariantNumeric: "tabular-nums" }}>{formatMoney(claim.amount, claim.currency)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ ...cardStyle, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>Your educators</h2>
              <Link to="/supervisor-portal/educators" style={linkStyle}>View all <FiArrowRight size={14} /></Link>
            </div>
            {educators.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>No educators are assigned to you yet. The admin assigns them, and their claims then come to you.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {educators.slice(0, 6).map((educator) => {
                  const count = perEducator.get(educator.id) || 0;
                  return (
                    <Link key={educator.id} to={`/supervisor-portal/claims?educator=${educator.id}`} className="supervisor-educator" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, textDecoration: "none" }}>
                      <Avatar name={educator.name} photo={educator.photo} size={36} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{educator.name}</span>
                      {count > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: T.gold, color: "#17304B", fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{count} to review</span>}
                    </Link>
                  );
                })}
                {educators.length > 6 && <p style={{ margin: "6px 10px 0", fontSize: 12, color: T.inkFaint }}>and {educators.length - 6} more</p>}
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 18, background: "#F8FBFE" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: T.ink }}>How a claim moves</h2>
            {[
              ["The educator sends it", "An advance or the full payment for a course, with their invoice."],
              ["You approve or decline", "Check the invoice and the session records. If you decline, they see your reason and can claim again."],
              ["The admin pays", "An approved claim goes straight to the admin to be paid."],
            ].map(([title, text], index) => (
              <div key={title} style={{ display: "flex", gap: 12, marginTop: index ? 12 : 0 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, background: index === 1 ? T.gold : "#fff", color: "#17304B", border: `1.5px solid ${index === 1 ? T.gold : T.tintBorder}` }}>{index + 1}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{title}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.5 }}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {openId && <ClaimReviewDialog claimId={openId} canSupervise canApprove={false} onClose={() => open(null)} />}

      <style>{`
        .supervisor-dash { display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 26vw, 400px); gap: 20px; align-items: start; }
        @media (max-width: 1100px) { .supervisor-dash { grid-template-columns: minmax(0, 1fr); } }
        .supervisor-claim { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .supervisor-claim:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(37,71,106,0.13); }
        .supervisor-claim:focus-visible, .supervisor-educator:focus-visible, .supervisor-recent:focus-visible { outline: 2px solid ${T.accentLight}; outline-offset: 2px; }
        .supervisor-educator:hover, .supervisor-recent:hover { background: #F3F8FC !important; }
      `}</style>
    </div>
  );
}
