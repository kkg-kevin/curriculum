import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowRight, FiAward, FiBookOpen, FiCalendar, FiChevronRight, FiFileText, FiHome, FiMail, FiPhone, FiSend, FiShield, FiTarget, FiTrendingUp } from "react-icons/fi";
import { EducatorAboutCard, EducatorClassesCard, EDUCATOR_STATUS } from "../../supervisor-portal/components/EducatorDetailsCard";
import MessageEducatorsDialog from "../../supervisor-portal/components/MessageEducatorsDialog";
import { useSupervisorEducator } from "../../supervisor-portal/hooks/useSupervisorPortal";
import { useQaEducators } from "../hooks/useQa";
import EducatorQaSection from "../components/EducatorQaSection";
import VisitDialog from "../components/VisitDialog";
import TotTrainingCard from "../../tot/components/TotTrainingCard";
import { useTotMarking } from "../../tot/hooks/useTot";
import ParentFeedbackSection from "../../mentor-reviews/components/ParentFeedbackSection";
import { useEducatorProfile } from "../../educator-profiles/hooks/useEducatorProfile";
import { OverviewPanel, ProfileKpis, QualityPanel, TeachingPanel } from "../../educator-profiles/components/PerformanceProfile";
import PublishingCard from "../../educator-profiles/components/PublishingCard";
import StandardsCard from "../../mentor-standards/StandardsCard";
import { useSupervisorClaims } from "../../claims/hooks/useClaims";
import { ClaimStatusPill, TYPE_LABEL, cardStyle, formatDate, formatMoney } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";
import { Tabs } from "../../../components/ui/TabBar";
import { QaPageStyles, QaStyles, T, font, hint } from "../shared";

/*
 * One of a supervisor's educators (/supervisor-portal/educators/:id), laid out like the admin's
 * educator page (17 Nov 2026): a header with who they are and the actions (Message, Plan a QA
 * visit, their claims), the figures that matter (ProfileKpis — each opens its tab), then tabs
 * (?tab=) Overview · Standards · Quality & feedback · Teaching · Training · Claims, with "About"
 * and their public profile card alongside on every tab. Read only except QA visits, parent
 * feedback housekeeping, marking and claims, which are the supervisor's job.
 */
const STATUS_LOOK = {
  active: { bg: "rgba(16,185,129,0.18)", color: "#D1FAE5", border: "rgba(167,243,208,0.45)" },
  on_leave: { bg: "rgba(245,158,11,0.2)", color: "#FEF3C7", border: "rgba(253,230,138,0.45)" },
  in_training: { bg: "rgba(56,170,225,0.25)", color: "#E0F2FE", border: "rgba(186,230,253,0.45)" },
  inactive: { bg: "rgba(255,255,255,0.14)", color: "#E5E7EB", border: "rgba(255,255,255,0.3)" },
};
const heroButton = (kind) => ({
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, fontSize: 13, fontWeight: 800, fontFamily: font, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
  ...(kind === "gold" ? { background: "#feb139", color: "#25476a", border: "none", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }
    : { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)" }),
});

function ClaimsPanel({ claims }) {
  if (!claims.length) {
    return <section style={{ ...cardStyle, padding: "34px 20px", textAlign: "center", fontSize: 13, color: T.inkMuted }}>No claims from them yet.</section>;
  }
  const currency = claims[0]?.currency || "KES";
  const paid = claims.filter((c) => c.status === "paid").reduce((n, c) => n + Number(c.amount || 0), 0);
  return (
    <section style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><FiFileText size={15} /> Their claims</h2>
        <span style={{ fontSize: 12.5, color: T.inkMuted }}>{claims.length} claim{claims.length === 1 ? "" : "s"} · paid so far <strong style={{ color: T.ink }}>{formatMoney(paid, currency)}</strong></span>
      </div>
      {claims.map((c) => (
        <Link key={c.id} to={`/supervisor-portal/claims/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit" }}>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{c.courseName || TYPE_LABEL[c.type] || "Claim"}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{[TYPE_LABEL[c.type], c.className, c.hubName, formatDate(c.createdAt)].filter(Boolean).join(" · ")}</p>
          </div>
          <strong style={{ fontSize: 14, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{formatMoney(c.amount, c.currency || currency)}</strong>
          <ClaimStatusPill status={c.status} size="small" />
          <FiChevronRight size={16} color={T.inkFaint} />
        </Link>
      ))}
    </section>
  );
}

export default function SupervisorEducatorPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: educators = [], isLoading } = useQaEducators();
  const educator = educators.find((e) => e.id === id);
  const { data: details } = useSupervisorEducator(educator ? id : null);
  const { data: profile } = useEducatorProfile(id, { enabled: !!educator });
  const { data: claimsData } = useSupervisorClaims();
  const { data: marking = [] } = useTotMarking();
  const [messaging, setMessaging] = useState(false);
  const [planning, setPlanning] = useState(false);

  const claims = useMemo(() => (claimsData?.claims || []).filter((c) => c.teacherId === id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [claimsData, id]);
  const waiting = claims.filter((c) => c.status === "pending_supervisor").length;
  const toMark = marking.filter((m) => m.educator?.id === id).length;

  const TABS = [
    profile && { key: "overview", label: "Overview", icon: FiTrendingUp },
    profile?.standards && { key: "standards", label: "Standards", icon: FiTarget },
    { key: "quality", label: "Quality & feedback", icon: FiShield, count: educator?.due || null, alert: true },
    { key: "teaching", label: "Teaching", icon: FiBookOpen },
    { key: "training", label: "Training", icon: FiAward, count: toMark || null, alert: true },
    { key: "claims", label: "Claims", icon: FiFileText, count: waiting || null, alert: true },
  ].filter(Boolean);
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : TABS[0].key;
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === TABS[0].key) next.delete("tab"); else next.set("tab", key);
    setParams(next, { replace: true });
  };

  if (isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (!educator) {
    return (
      <div style={{ fontFamily: font }}>
        <Link to="/supervisor-portal/educators" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}>My Educators</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>This educator isn&apos;t assigned to you.</p>
      </div>
    );
  }

  const look = STATUS_LOOK[educator.status] || STATUS_LOOK.active;
  const phone = details?.phone;
  const hubs = details?.hubs || educator.hubs || [];
  // What's waiting on the supervisor for this educator — shown under the header when anything is.
  const attention = [
    waiting > 0 && { key: "claims", text: `${waiting} claim${waiting === 1 ? "" : "s"} to review` },
    educator.due > 0 && { key: "quality", text: `${educator.due} QA report${educator.due === 1 ? "" : "s"} to write` },
    toMark > 0 && { key: "training", text: `${toMark} piece${toMark === 1 ? "" : "s"} of training work to mark` },
  ].filter(Boolean);

  return (
    <div className="qa-page" style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16 }}>
      <QaStyles />
      <QaPageStyles />

      <section style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: "22px 26px", background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
            <Link to="/supervisor-portal/educators" style={{ color: "rgba(255,255,255,0.72)", textDecoration: "none" }}>My Educators</Link>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>{educator.name}</span>
          </nav>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 340px" }}>
              <span style={{ borderRadius: "50%", border: "3px solid rgba(255,255,255,0.85)", display: "inline-flex", flexShrink: 0 }}><Avatar name={educator.name} photo={educator.photo} size={64} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{educator.name}</h1>
                  <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: look.bg, color: look.color, border: `1px solid ${look.border}` }}>{EDUCATOR_STATUS[educator.status] || educator.status}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.84)" }}>
                  {educator.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, overflowWrap: "anywhere" }}><FiMail size={13} /> {educator.email}</span>}
                  {phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiPhone size={13} /> {phone}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiHome size={13} /> {hubs.map((h) => h.name).join(" · ") || "No school yet"}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setMessaging(true)} style={heroButton("gold")}><FiSend size={14} /> Message</button>
              <button type="button" onClick={() => setPlanning(true)} style={heroButton()}><FiCalendar size={14} /> Plan a QA visit</button>
              <button type="button" onClick={() => setTab("claims")} style={heroButton()}><FiFileText size={14} /> Claims{waiting ? ` · ${waiting} to review` : ""}</button>
            </div>
          </div>
        </div>
      </section>

      {attention.length > 0 && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 16px", borderRadius: 14, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", fontSize: 13 }}>
          <FiAlertTriangle size={15} style={{ flexShrink: 0 }} />
          <strong>Waiting on you:</strong>
          {attention.map((a) => (
            <button key={a.key} type="button" onClick={() => setTab(a.key)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, border: "1px solid #FCD34D", background: "#fff", color: "#92400E", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
              {a.text} <FiArrowRight size={12} />
            </button>
          ))}
        </div>
      )}

      {profile && <ProfileKpis profile={profile} onOpen={(key) => (TABS.some((t) => t.key === key) ? setTab(key) : null)} />}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="Educator" tabs={TABS} value={tab} onChange={setTab} /></div>

          {tab === "overview" && profile && <OverviewPanel profile={profile} teacherId={id} onOpen={setTab} />}
          {tab === "standards" && profile?.standards && <StandardsCard standing={profile.standards} />}
          {tab === "quality" && (
            <>
              {profile && <QualityPanel profile={profile} showVisits={false} />}
              {/* Every visit — plan one, regular visits, open a report. */}
              <EducatorQaSection teacherId={id} />
              <ParentFeedbackSection teacherId={id} />
            </>
          )}
          {tab === "teaching" && (
            <>
              <EducatorClassesCard details={details} />
              {profile && <TeachingPanel profile={profile} />}
            </>
          )}
          {tab === "training" && <TotTrainingCard teacherId={id} />}
          {tab === "claims" && <ClaimsPanel claims={claims} />}
        </div>

        <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <EducatorAboutCard details={details} />
          {profile?.view === "manager" && <PublishingCard profile={profile} teacherId={id} canPublish={false} />}
        </div>
      </div>

      {messaging && <MessageEducatorsDialog educators={educators.map((x) => ({ id: x.id, name: x.name }))} selected={[id]} onClose={() => setMessaging(false)} />}
      {planning && <VisitDialog teacherId={id} title={`Plan a QA visit · ${educator.name}`} onClose={() => setPlanning(false)} />}
    </div>
  );
}
