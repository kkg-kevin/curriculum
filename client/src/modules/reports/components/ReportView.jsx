import { useMemo, useState } from "react";
import { FiArrowRight, FiChevronDown, FiChevronUp, FiHome, FiMessageCircle, FiStar, FiTarget, FiClock, FiCheckCircle, FiUser } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { LEVELS, buildReportView, marks } from "../utils/reportView";

/*
 * A learner's report, laid out to be understood at a glance by a child or a parent:
 *   1. how it went — a score ring, its plain level word and one sentence;
 *   2. the teacher's comment (and an optional "How to help at home" note);
 *   3. doing well / to practise next;
 *   4. skills — one card per competency with a bar, its indicators one tap away;
 *   5. the assessments, each with a link to the marked work;
 *   6. what's next.
 * Two columns on a large screen, one on a phone (comments come straight after the summary there).
 * Families never see raw marks; staff can switch them on (`showMarks`).
 */

const T = { navy: "#25476a", ink: "#1F2937", muted: "#5B6475", faint: "#8C94A3", border: "#E8ECF4", track: "#EEF0F4", tint: "#EAF6FD", tintBorder: "#BFE3F7" };
const KID_FONT = "'Nunito', Inter, sans-serif";

const card = { backgroundColor: "#fff", borderRadius: 20, border: `1.5px solid ${T.border}`, boxShadow: "0 6px 20px rgba(37, 71, 106, 0.06)", padding: "18px 20px", minWidth: 0 };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");

const STYLES = `
.rv { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.rv-summary { grid-column: 1 / -1; }
.rv.rv-one { grid-template-columns: minmax(0, 1fr); }
.rv-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.rv-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.rv-hero { display: flex; align-items: center; gap: 22px; }
.rv button { font-family: inherit; }
@media (max-width: 900px) {
  .rv { display: flex; flex-direction: column; align-items: stretch; }
  .rv-col { display: contents; }
  .rv-summary { order: 0; } .rv-o1 { order: 1; } .rv-o2 { order: 2; } .rv-o3 { order: 3; } .rv-o4 { order: 4; } .rv-o5 { order: 5; } .rv-o6 { order: 6; }
}
@media (max-width: 560px) {
  .rv-pair { display: flex; flex-direction: column; }
  .rv-hero { flex-direction: column; align-items: flex-start; gap: 14px; }
}
`;

export function Ring({ percent, color, size = 116 }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${p}%`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.track} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" style={{ fontSize: size * 0.25, fontWeight: 900, fill: T.ink, fontFamily: "Inter, sans-serif" }}>{p}%</text>
    </svg>
  );
}

export function Bar({ percent, color, height = 10 }) {
  return (
    <div style={{ height, borderRadius: 999, backgroundColor: T.track, overflow: "hidden", flex: 1, minWidth: 60 }}>
      <div style={{ width: `${Math.max(2, Math.min(100, percent))}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </div>
  );
}

export function LevelPill({ level, small }) {
  return (
    <span style={{ display: "inline-block", padding: small ? "1px 8px" : "3px 11px", borderRadius: 999, fontSize: small ? 11 : 12.5, fontWeight: 800, color: level.color, backgroundColor: level.soft, border: `1px solid ${level.border}`, whiteSpace: "nowrap" }}>
      {level.label}
    </span>
  );
}

export function CardTitle({ icon, children, color = T.navy, aside }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
      <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, fontSize: 16, fontWeight: 900, color: T.ink }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", backgroundColor: `${color}14`, color, flexShrink: 0 }}>{icon}</span>
        {children}
      </h2>
      {aside}
    </div>
  );
}

// The four level words, the current one marked — so "Getting started" reads as a step on a scale.
export function LevelScale({ current }) {
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
      {LEVELS.map((l) => {
        const on = l.key === current.key;
        return (
          <div key={l.key} style={{ flex: "1 1 0", minWidth: 0 }}>
            <div style={{ height: 6, borderRadius: 999, backgroundColor: on ? l.fill : T.track }} />
            <p style={{ margin: "5px 0 0", fontSize: 11, lineHeight: 1.3, fontWeight: on ? 800 : 600, color: on ? l.color : T.faint }}>{l.label}</p>
            <p style={{ margin: 0, fontSize: 10.5, color: on ? l.color : T.faint }}>{l.min}–{l.max}%</p>
          </div>
        );
      })}
    </div>
  );
}

function Summary({ view, showMarks, title }) {
  return (
    <div className="rv-summary" style={{ ...card, padding: "22px 24px" }}>
      <div className="rv-hero">
        <Ring percent={view.percent} color={view.level.fill} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint }}>{title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "6px 0 8px" }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: view.level.color, lineHeight: 1.1 }}>{view.level.label}</span>
            {view.band && (
              <span title={view.bandDescription || undefined} style={{ fontSize: 12.5, fontWeight: 700, color: T.navy, backgroundColor: T.tint, border: `1px solid ${T.tintBorder}`, borderRadius: 999, padding: "3px 11px" }}>
                Level: {view.band}
              </span>
            )}
          </div>
          {view.sentence && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: T.ink }}>{view.sentence}</p>}
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.muted }}>
            {view.marked} {view.marked === 1 ? "assessment" : "assessments"} marked
            {view.pending > 0 ? ` · ${view.pending} more to come` : ""}
            {showMarks ? ` · ${marks(view.overall.totalScore, view.overall.maxScore)} marks` : ""}
          </p>
        </div>
      </div>
      <LevelScale current={view.level} />
      {view.pending > 0 && (
        <p style={{ margin: "14px 0 0", padding: "10px 14px", borderRadius: 12, backgroundColor: "#FFF5E1", border: "1px solid #FDD89A", fontSize: 13, fontWeight: 600, color: "#7A4F00" }}>
          {view.pending} more {view.pending === 1 ? "assessment" : "assessments"} from this session {view.pending === 1 ? "is" : "are"} still to be marked — this report updates as {view.pending === 1 ? "it is" : "they are"}.
        </p>
      )}
    </div>
  );
}

// One note from the teacher, with the teacher themself on it: their photo (else their initials),
// their name and "Your teacher", then what they said in a speech bubble. A face the child knows
// makes the note theirs to read (10 Nov 2026). Shared with the marked-assessment page.
export function TeacherNote({ name, photo, text, meta, audience = "learner", continued = false }) {
  const parts = String(name || "").split(" ").filter(Boolean);
  const role = audience === "learner" ? "Your teacher" : "Teacher";
  if (continued) {
    return (
      <div style={{ paddingLeft: 64, minWidth: 0 }}>
        <div style={{ padding: "11px 14px", backgroundColor: "#fff", border: `1px solid ${T.tintBorder}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(37,71,106,0.06)" }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: T.ink, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{text}</p>
        </div>
        {meta && <p style={{ margin: "6px 0 0 2px", fontSize: 12, color: T.faint }}>{meta}</p>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        {name ? (
          <Avatar firstName={parts[0]} lastName={parts.length > 1 ? parts[parts.length - 1] : ""} photo={photo} size={52} />
        ) : (
          <div aria-hidden style={{ width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg, #25476a, #2e7db5)", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", border: "2px solid #fff" }}>
            <FiUser size={22} />
          </div>
        )}
        <span aria-hidden style={{ position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: "50%", backgroundColor: "#F5A623", color: "#fff", display: "grid", placeItems: "center", border: "2px solid #fff" }}>
          <FiMessageCircle size={11} />
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 8px" }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: T.ink }}>{name || role}</span>
          {name && <span style={{ fontSize: 12, fontWeight: 700, color: T.navy, backgroundColor: T.tint, border: `1px solid ${T.tintBorder}`, borderRadius: 999, padding: "1px 9px" }}>{role}</span>}
        </p>
        <div style={{ position: "relative", marginTop: 8, padding: "11px 14px", backgroundColor: "#fff", border: `1px solid ${T.tintBorder}`, borderRadius: "4px 14px 14px 14px", boxShadow: "0 1px 3px rgba(37,71,106,0.06)" }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: T.ink, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{text}</p>
        </div>
        {meta && <p style={{ margin: "6px 0 0 2px", fontSize: 12, color: T.faint }}>{meta}</p>}
      </div>
    </div>
  );
}

function Comments({ view, audience, className }) {
  if (!view.comments.length) return null;
  return (
    <div className={className} style={{ ...card, backgroundColor: "#F7FAFD", borderColor: T.tintBorder }}>
      <CardTitle icon={<FiMessageCircle size={16} />}>From the teacher</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {view.comments.map((c, i) => (
          <TeacherNote key={c.key} name={c.by} photo={c.photo} text={c.text} audience={audience}
            continued={i > 0 && Boolean(c.by) && c.by === view.comments[i - 1].by}
            meta={[c.about, fmtDate(c.at)].filter(Boolean).join(" · ")} />
        ))}
      </div>
    </div>
  );
}

function HomeNote({ view, audience, className }) {
  if (!view.homeNote) return null;
  return (
    <div className={className} style={{ ...card, backgroundColor: "#FFF5E1", borderColor: "#FDD89A" }}>
      <CardTitle icon={<FiHome size={16} />} color="#9A6300">{audience === "learner" ? "Try this at home" : "How to help at home"}</CardTitle>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: T.ink, whiteSpace: "pre-line" }}>{view.homeNote}</p>
    </div>
  );
}

export function GlanceList({ items, empty, color }) {
  if (!items.length) return <p style={{ margin: 0, fontSize: 13.5, color: T.muted }}>{empty}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((x) => (
        <div key={x.id} style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, minWidth: 0 }}>{x.name}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, flexShrink: 0 }}>{x.percent}%</span>
          </div>
          {x.competencyName && x.competencyName !== x.name && <p style={{ margin: "1px 0 5px", fontSize: 12, color: T.faint }}>{x.competencyName}</p>}
          <Bar percent={x.percent} color={color} height={7} />
        </div>
      ))}
    </div>
  );
}

function Glance({ view }) {
  if (!view.competencies.length) return null;
  const v = view.voice;
  return (
    <div className="rv-pair rv-o3">
      <div style={card}>
        <CardTitle icon={<FiStar size={16} />} color="#25476a">Doing well</CardTitle>
        <GlanceList items={view.strengths} color="#2e7db5" empty={`Nothing stands out yet — keep going and ${v.their} strengths will show here.`} />
      </div>
      <div style={card}>
        <CardTitle icon={<FiTarget size={16} />} color="#9A6300">To practise next</CardTitle>
        <GlanceList items={view.practise} color="#feb139" empty="Nothing below halfway — nice work. Keep practising to stay sharp." />
      </div>
    </div>
  );
}

export function CompetencyCard({ c, showMarks, showBand }) {
  const [open, setOpen] = useState(false);
  const hasIndicators = c.indicators.length > 0;
  return (
    <div style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.border}`, backgroundColor: "#FBFCFE" }}>
      <button
        type="button"
        onClick={() => hasIndicators && setOpen((x) => !x)}
        aria-expanded={hasIndicators ? open : undefined}
        style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: hasIndicators ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, minWidth: 0 }}>{c.name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {showBand && c.band && <span style={{ fontSize: 11.5, color: T.muted }}>{c.band}</span>}
            <LevelPill level={c.level} small />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
          <Bar percent={c.percent} color={c.level.fill} />
          <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, width: 40, textAlign: "right" }}>{c.percent}%</span>
          {hasIndicators && (open ? <FiChevronUp color={T.faint} /> : <FiChevronDown color={T.faint} />)}
        </div>
        {hasIndicators && !open && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.faint }}>{c.indicators.length} {c.indicators.length === 1 ? "skill" : "skills"} — tap to see each</p>}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
          {c.indicators.map((i) => (
            <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: T.ink, flex: "1 1 160px", minWidth: 0 }}>{i.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 180px", minWidth: 0 }}>
                <Bar percent={i.percent} color={i.level.fill} height={7} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, width: showMarks ? 96 : 40, textAlign: "right", whiteSpace: "nowrap" }}>
                  {i.percent}%{showMarks ? ` · ${marks(i.earned, i.possible)}` : ""}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Skills({ view, showMarks }) {
  if (!view.competencies.length) return null;
  return (
    <div className="rv-o4" style={card}>
      <CardTitle icon={<FiCheckCircle size={16} />}>Skills</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {view.competencies.map((c) => <CompetencyCard key={c.id} c={c} showMarks={showMarks} showBand={!view.band} />)}
      </div>
    </div>
  );
}

function Work({ view, showMarks, onOpenAssessment, onOpenSessionReport }) {
  const sessions = view.sessionReports;
  if (!view.assessments.length && !sessions.length) return null;
  const row = { display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: `1px solid ${T.border}`, flexWrap: "wrap" };
  const link = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, color: "#2e7db5", fontSize: 12.5, fontWeight: 800, cursor: "pointer" };
  return (
    <div className="rv-o5" style={card}>
      {sessions.length > 0 && (
        <>
          <CardTitle icon={<FiCheckCircle size={16} />}>Sessions in this course</CardTitle>
          <div style={{ marginBottom: view.assessments.length ? 18 : 0 }}>
            {sessions.map((s) => (
              <div key={s.sessionId} style={row}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, flex: "1 1 180px", minWidth: 0 }}>{s.sessionTitle || "Session"}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{s.percent}%</span>
                  <LevelPill level={s.level} small />
                  {s.reportId && onOpenSessionReport && <button type="button" style={link} onClick={() => onOpenSessionReport(s.reportId)}>Report <FiArrowRight size={13} /></button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {view.assessments.length > 0 && (
        <>
          <CardTitle icon={<FiCheckCircle size={16} />}>{view.isSession ? "This session's work" : "Assessments"}</CardTitle>
          <div>
            {view.assessments.map((a) => (
              <div key={a.assessmentId} style={row}>
                <span style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: T.ink }}>{a.name}</span>
                  {a.gradedAt && <span style={{ fontSize: 12, color: T.faint }}>Marked {fmtDate(a.gradedAt)}{showMarks ? ` · ${marks(a.totalScore, a.maxScore)} marks` : ""}</span>}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{a.percent}%</span>
                  <LevelPill level={a.level} small />
                  {a.issueId && onOpenAssessment && <button type="button" style={link} onClick={() => onOpenAssessment(a.issueId)}>See marked work <FiArrowRight size={13} /></button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function nextLines(view, audience) {
  const lines = [];
  if (view.isSession && view.sessionNumber && view.sessionCount) lines.push(`Session ${view.sessionNumber} of ${view.sessionCount} in ${view.courseName || "the course"}.`);
  if (view.isSession && view.nextSessionTitle) lines.push(`Up next: ${view.nextSessionTitle}.`);
  if (view.isSession && view.sessionNumber && view.sessionCount && view.sessionNumber === view.sessionCount) lines.push("This is the last session — the course report comes once everything is marked.");
  if (view.practise.length) lines.push(`${audience === "learner" ? "Practise" : "Practising"} ${view.practise[0].name} will help most.`);
  return lines;
}

function Next({ view, audience, onOpenCourse }) {
  const lines = nextLines(view, audience);
  if (!lines.length && !onOpenCourse) return null;
  return (
    <div className="rv-o6" style={card}>
      <CardTitle icon={<FiClock size={16} />}>What’s next</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lines.map((l) => <p key={l} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.ink }}>{l}</p>)}
      </div>
      {onOpenCourse && (
        <button type="button" onClick={onOpenCourse}
          style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: "none", backgroundColor: T.navy, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
          {audience === "learner" ? "Continue the course" : "Open the course"} <FiArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function NotSubmitted({ view, audience }) {
  return (
    <div style={{ ...card, backgroundColor: "#FFF5E1", borderColor: "#FDD89A" }}>
      <CardTitle icon={<FiClock size={16} />} color="#9A6300">Not handed in</CardTitle>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.ink }}>
        {audience === "learner" ? "Your work for this session wasn't handed in, so there's nothing to mark yet." : `${view.voice.name}'s work for this session wasn't handed in, so there's nothing to mark yet.`}
      </p>
      {view.notSubmittedAssessments.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13.5, color: T.muted }}>
          {view.notSubmittedAssessments.map((a) => <li key={a.assessmentId}>{a.name}</li>)}
        </ul>
      )}
    </div>
  );
}

/**
 * report: the report as stored. audience: "learner" (the child), "parent" or "staff".
 * firstName: the learner's first name (for "Ama did well"). showMarks: staff only.
 * onOpenAssessment(issueId), onOpenSessionReport(reportId), onOpenCourse(): optional links.
 */
// The report's look, shared with the learner's marked-work page (learner-portal's AssessmentResultView).
export { T as REPORT_T, card as reportCard, STYLES as REPORT_STYLES, KID_FONT, fmtDate };

export default function ReportView({ report, audience = "learner", firstName = "", showMarks = false, onOpenAssessment, onOpenSessionReport, onOpenCourse }) {
  const view = useMemo(() => buildReportView(report, { audience, firstName }), [report, audience, firstName]);
  const font = audience === "staff" ? "Inter, sans-serif" : KID_FONT;
  const title = view.isSession ? "How this session went" : "How the course went";

  if (view.notSubmitted) {
    return (
      <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16 }}>
        <NotSubmitted view={view} audience={audience} />
        <Comments view={view} audience={audience} />
        <HomeNote view={view} audience={audience} />
      </div>
    );
  }

  const hasSide = view.comments.length > 0 || Boolean(view.homeNote) || Boolean(onOpenCourse) || nextLines(view, audience).length > 0;
  return (
    <div className={hasSide ? "rv" : "rv rv-one"} style={{ fontFamily: font }}>
      <style>{STYLES}</style>
      <Summary view={view} showMarks={showMarks} title={title} />
      <div className="rv-col">
        <Glance view={view} />
        <Skills view={view} showMarks={showMarks} />
        <Work view={view} showMarks={showMarks} onOpenAssessment={onOpenAssessment} onOpenSessionReport={onOpenSessionReport} />
      </div>
      {hasSide && <div className="rv-col">
        <Comments view={view} audience={audience} className="rv-o1" />
        <HomeNote view={view} audience={audience} className="rv-o2" />
        <Next view={view} audience={audience} onOpenCourse={onOpenCourse} />
      </div>}
    </div>
  );
}
