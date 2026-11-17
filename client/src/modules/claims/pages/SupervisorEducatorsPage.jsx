import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiArrowRight, FiCalendar, FiCheckCircle, FiEdit3, FiFileText, FiHome, FiInbox, FiMail, FiMapPin, FiSearch, FiSend, FiStar, FiUsers } from "react-icons/fi";
import MessageEducatorsDialog from "../../supervisor-portal/components/MessageEducatorsDialog";
import { useSupervisorClaims } from "../hooks/useClaims";
import { useQaEducators } from "../../qa/hooks/useQa";
import { useTotMarking } from "../../tot/hooks/useTot";
import VisitDialog from "../../qa/components/VisitDialog";
import { ScoreBadge, VisitTypePill } from "../../qa/shared";
import { T, cardStyle, formatDate } from "../shared";
import { Avatar, HeroStat } from "../components/supervisorParts";

/*
 * My Educators (supervisor portal, redesigned 17 Nov 2026): the educators the admin assigned to
 * this supervisor (People → Supervisors, or the educator form). A header with the team in figures,
 * then search, a school filter (?school=) and "Needs me" (?show=attention), and one card per
 * educator — once each, even at two schools — with what's waiting on the supervisor (claims to
 * review, QA reports to write, training work to mark), their QA so far and next visit, and the
 * ways in: their page, plan a QA visit, their claims. Those needing the supervisor come first.
 */
const STATUS = {
  active: { label: "Active", bg: "#ECFDF5", color: "#047857" },
  on_leave: { label: "On leave", bg: "#FFFBEB", color: "#B45309" },
  in_training: { label: "In training", bg: "#dff2fb", color: "#1f6f99" },
  inactive: { label: "Inactive", bg: "#F3F4F6", color: "#6B7280" },
};
const NO_SCHOOL = "none";

function Chip({ on, onClick, children }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "#fff", color: on ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, padding: "9px 11px", borderRadius: 11, background: "#F5F8FB" }}>
      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}><Icon size={11} /> {label}</p>
      <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", minHeight: 22 }}>{children}</div>
    </div>
  );
}

export default function SupervisorEducatorsPage() {
  const { data, isLoading, isError, error } = useSupervisorClaims();
  const { data: qaEducators = [] } = useQaEducators();
  const { data: marking = [] } = useTotMarking();
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const [planning, setPlanning] = useState(null);
  const [messaging, setMessaging] = useState(false);

  const schools = useMemo(() => data?.schools || [], [data]);
  const picked = params.get("school") || "all";
  const school = picked === "all" || picked === NO_SCHOOL || schools.some((s) => s.id === picked) ? picked : "all";
  const onlyAttention = params.get("show") === "attention";
  const setParam = (key, value) => setParams((prev) => { const next = new URLSearchParams(prev); if (value == null) next.delete(key); else next.set(key, value); return next; }, { replace: true });

  // Each educator with what's waiting on the supervisor and their QA so far.
  const all = useMemo(() => {
    const qaById = new Map(qaEducators.map((e) => [e.id, e]));
    const claimStats = new Map();
    for (const claim of data?.claims || []) {
      const s = claimStats.get(claim.teacherId) || { waiting: 0, total: 0, last: null };
      s.total += 1;
      if (claim.status === "pending_supervisor") s.waiting += 1;
      if (!s.last || new Date(claim.createdAt) > new Date(s.last)) s.last = claim.createdAt;
      claimStats.set(claim.teacherId, s);
    }
    const markingBy = new Map();
    for (const m of marking) if (m.educator?.id) markingBy.set(m.educator.id, (markingBy.get(m.educator.id) || 0) + 1);
    return (data?.educators || []).map((e) => {
      const c = claimStats.get(e.id) || { waiting: 0, total: 0, last: null };
      const qa = qaById.get(e.id);
      const toMark = markingBy.get(e.id) || 0;
      const qaDue = qa?.due || 0;
      return { ...e, claims: c, qa, toMark, qaDue, needs: c.waiting + qaDue + toMark };
    });
  }, [data, qaEducators, marking]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((e) => !term || [e.name, e.email].some((t) => t?.toLowerCase().includes(term)))
      .filter((e) => school === "all" || (school === NO_SCHOOL ? !e.schools?.length : e.schools?.some((s) => s.id === school)))
      .filter((e) => !onlyAttention || e.needs > 0)
      .sort((a, b) => (b.needs > 0) - (a.needs > 0) || b.needs - a.needs || a.name.localeCompare(b.name));
  }, [all, search, school, onlyAttention]);

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading your educators…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your educators couldn&apos;t be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  const total = all.length;
  const sum = (key) => all.reduce((n, e) => n + (typeof key === "function" ? key(e) : e[key]), 0);
  const needing = all.filter((e) => e.needs > 0).length;
  const unplaced = all.filter((e) => !e.schools?.length).length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 22, padding: "26px 28px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 42%, ${T.accentMid} 78%, ${T.accentLight} 100%)`, boxShadow: "0 14px 34px rgba(37,71,106,0.22)" }}>
        <div style={{ position: "absolute", top: -70, right: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, maxWidth: 640 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 10 }}><FiUsers size={24} /> My Educators</h1>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.55 }}>
                {total === 1 ? "The educator" : `The ${total} educators`} you look after — you review their claims, do their QA visits and mark their training work. The admin decides who is on this list.
              </p>
            </div>
            {total > 0 && (
              <button type="button" onClick={() => setMessaging(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 12, border: "none", background: T.gold, color: "#17304B", fontSize: 13.5, fontWeight: 800, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                <FiSend size={15} /> Message educators
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <HeroStat icon={FiUsers} value={total} label="Educators" sub={`${schools.length} school${schools.length === 1 ? "" : "s"}`} />
            <HeroStat icon={FiInbox} value={sum((e) => e.claims.waiting)} label="Claims to review" sub="waiting on you" />
            <HeroStat icon={FiStar} value={sum("qaDue")} label="QA reports to write" sub={`${all.filter((e) => e.qa?.nextVisit).length} with a visit planned`} />
            <HeroStat icon={FiEdit3} value={sum("toMark")} label="Work to mark" sub="training (TOT)" />
          </div>
        </div>
      </section>

      {total > 0 && (
        <section style={{ ...cardStyle, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ position: "relative", flex: "1 1 240px", maxWidth: 380 }}>
              <FiSearch size={15} color={T.inkFaint} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" aria-label="Search educators" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none" }} />
            </label>
            <Chip on={onlyAttention} onClick={() => setParam("show", onlyAttention ? null : "attention")}><FiAlertCircle size={13} /> Needs me ({needing})</Chip>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: T.inkMuted }}>Showing {shown.length} of {total}</span>
          </div>
          {schools.length > 1 && (
            <div role="group" aria-label="School" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip on={school === "all"} onClick={() => setParam("school", null)}>All schools</Chip>
              {schools.map((s) => <Chip key={s.id} on={school === s.id} onClick={() => setParam("school", s.id)}>{s.isHomeLearning ? <FiHome size={12} /> : <FiMapPin size={12} />} {s.name} · {s.educators}</Chip>)}
              {unplaced > 0 && <Chip on={school === NO_SCHOOL} onClick={() => setParam("school", NO_SCHOOL)}>No school yet · {unplaced}</Chip>}
            </div>
          )}
        </section>
      )}

      {total === 0 ? (
        <div style={{ ...cardStyle, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 18, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><FiUsers size={26} /></div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>No educators are assigned to you yet</p>
          <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>The admin assigns educators to you. Once they do, they show here: their claims come to you, and you plan their QA visits.</p>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{onlyAttention && !search.trim() ? "Nothing is waiting on you here — all caught up." : search.trim() ? `No educator matches "${search}"` : "No educators at this school"}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
          {shown.map((e) => <EducatorCard key={e.id} educator={e} schoolId={school === "all" || school === NO_SCHOOL ? null : school} onPlan={() => setPlanning(e.id)} />)}
        </div>
      )}

      {messaging && <MessageEducatorsDialog educators={all.map((e) => ({ id: e.id, name: e.name }))} onClose={() => setMessaging(false)} />}
      {planning && <VisitDialog teacherId={planning} title="Plan a QA visit" onClose={() => setPlanning(null)} />}
    </div>
  );
}

function EducatorCard({ educator: e, schoolId, onPlan }) {
  const status = STATUS[e.status] || STATUS.active;
  const page = `/supervisor-portal/educators/${e.id}`;
  const waitingItems = [
    e.claims.waiting > 0 && { to: `/supervisor-portal/claims?educator=${e.id}${schoolId ? `&school=${schoolId}` : ""}`, text: `${e.claims.waiting} claim${e.claims.waiting === 1 ? "" : "s"} to review` },
    e.qaDue > 0 && { to: `${page}?tab=quality`, text: `${e.qaDue} QA report${e.qaDue === 1 ? "" : "s"} to write` },
    e.toMark > 0 && { to: "/supervisor-portal/marking", text: `${e.toMark} to mark` },
  ].filter(Boolean);
  const small = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 11px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" };

  return (
    <article style={{ ...cardStyle, padding: 16, display: "flex", flexDirection: "column", gap: 12, borderTop: `3px solid ${e.needs ? "#F59E0B" : "transparent"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={e.name} photo={e.photo} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={page} style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: T.ink, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</Link>
          <p style={{ margin: "2px 0 0", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><FiMail size={11} style={{ flexShrink: 0 }} /> {e.email || "No email"}</p>
        </div>
        <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, whiteSpace: "nowrap" }}>{status.label}</span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {e.schools?.length ? e.schools.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#F1F5F9", color: T.inkMuted, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.isHomeLearning ? <FiHome size={11} /> : <FiMapPin size={11} />} {s.name}
          </span>
        )) : <span style={{ fontSize: 11.5, color: T.inkFaint }}>No school yet</span>}
      </div>

      {waitingItems.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {waitingItems.map((w) => (
            <Link key={w.text} to={w.to} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "#FFF4DC", color: "#92400E", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
              {w.text} <FiArrowRight size={11} />
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#047857" }}><FiCheckCircle size={13} /> Nothing waiting on you</p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Fact icon={FiStar} label="QA average">
          {e.qa?.reports ? <><ScoreBadge score={e.qa.averageScore} /><span style={{ fontWeight: 600, color: T.inkMuted }}>of {e.qa.reports}</span></> : <span style={{ color: T.inkMuted, fontWeight: 600 }}>No reports yet</span>}
        </Fact>
        <Fact icon={FiCalendar} label="Next visit">
          {e.qa?.nextVisit ? <>{formatDate(e.qa.nextVisit.date)} <VisitTypePill type={e.qa.nextVisit.visitType} /></> : <span style={{ color: T.inkMuted, fontWeight: 600 }}>None planned</span>}
        </Fact>
        <Fact icon={FiFileText} label="Claims">
          {e.claims.total ? <>{e.claims.total}<span style={{ display: "block", width: "100%", fontSize: 11.5, fontWeight: 600, color: T.inkMuted }}>last {formatDate(e.claims.last)}</span></> : <span style={{ color: T.inkMuted, fontWeight: 600 }}>None yet</span>}
        </Fact>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
        <Link to={page} style={{ ...small, background: T.accent, color: "#fff", border: "none", flex: "1 1 auto", justifyContent: "center" }}>Open profile <FiArrowRight size={13} /></Link>
        <button type="button" onClick={onPlan} style={{ ...small, background: "#fff", color: T.accent, border: `1.5px solid ${T.tintBorder}` }}><FiCalendar size={13} /> Plan QA visit</button>
        <Link to={`/supervisor-portal/claims?educator=${e.id}${schoolId ? `&school=${schoolId}` : ""}`} style={{ ...small, background: "#F1F5F9", color: T.accent, border: "none" }}><FiFileText size={13} /> Claims</Link>
      </div>
    </article>
  );
}
