import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiLayers, FiBookOpen, FiCalendar, FiCheckCircle, FiChevronDown, FiChevronUp, FiTrendingUp, FiX } from "react-icons/fi";
import { useCoverageDetail } from "../../hooks/useAnalytics";
import { Card, DataTable, Empty, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

/*
 * Curriculum coverage (17 Nov 2026; server analytics.coverage.js): how far each class has got
 * through its courses as of today. A session counts as covered once it is marked taught or its
 * register is taken. Each class lists its courses as chips coloured by pace; a chip opens that
 * course session by session. Courses with no weekly lessons or no start date can't be measured
 * and are listed under "Not scheduled".
 */

// Pace words, worst first. Colour always comes with the word.
export const COVERAGE_STATUS = {
  behind: { label: "Behind", color: "#B91C1C", bg: "#FEF2F2" },
  slightly_behind: { label: "Slightly behind", color: "#B87708", bg: "#FFF8EB" },
  not_scheduled: { label: "Not scheduled", color: "#6B7280", bg: "#F3F4F6" },
  not_started: { label: "Not started", color: "#5B6475", bg: "#F5F8FC" },
  on_pace: { label: "On pace", color: T.mid, bg: "#EAF4FB" },
  complete: { label: "Complete", color: T.navy, bg: "#E8EEF5" },
};
const ORDER = Object.keys(COVERAGE_STATUS);

const SESSION_STATE = {
  covered: { label: "Covered", color: T.navy },
  open: { label: "Due, not recorded", color: "#B91C1C" },
  cancelled: { label: "Cancelled", color: "#6B7280" },
  upcoming: { label: "Coming up", color: T.mid },
  unscheduled: { label: "Not on the timetable", color: T.faint },
};

function StatusPill({ status, small }) {
  const s = COVERAGE_STATUS[status] || COVERAGE_STATUS.not_scheduled;
  return (
    <span style={{ display: "inline-block", padding: small ? "1px 7px" : "2px 9px", borderRadius: 999, background: s.bg, color: s.color, fontSize: small ? 10.5 : 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

// Covered out of planned, with the due-so-far mark drawn on the same bar.
function ProgressBar({ covered, due, total, color }) {
  const w = (n) => `${total > 0 ? Math.min(100, (n / total) * 100) : 0}%`;
  return (
    <div title={`${covered} covered · ${due} due so far · ${total} planned`} style={{ position: "relative", height: 8, borderRadius: 4, background: T.track, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, width: w(due), background: "#F4D7D7" }} />
      <div style={{ position: "absolute", inset: 0, width: w(covered), background: color || T.mid, borderRadius: 4 }} />
    </div>
  );
}

function CourseChip({ cell, active, onClick }) {
  const s = COVERAGE_STATUS[cell.status];
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      title={`${cell.scheduled ? `${cell.courseName}: ${cell.covered} of ${cell.total} covered, ${cell.due} due so far` : `${cell.courseName}: not scheduled`}${(cell.evidence || []).length ? ` · evidence: ${cell.evidence.map((e) => `${e.name} ${e.done}/${e.minimum}`).join(", ")}` : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", padding: "5px 9px", borderRadius: 9, border: `1.5px solid ${active ? s.color : T.border}`, borderStyle: cell.scheduled ? "solid" : "dashed", background: active ? s.bg : "#fff", cursor: "pointer", fontSize: 12, color: T.ink, textAlign: "left" }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.courseName}</span>
      <span style={{ color: T.muted, fontWeight: 700, flexShrink: 0 }}>{cell.scheduled ? `${cell.covered}/${cell.total}` : "–"}</span>
    </button>
  );
}

// One evidence type against its minimum for a class + course: "Capstone 1 of 2 · 1 to go".
function EvidenceLine({ e }) {
  const color = e.met ? T.navy : e.done ? "#B87708" : "#B91C1C";
  return (
    <div title={`Minimum ${e.minimum} · ${e.planned} in the course plan · ${e.issued} given to the class · ${e.done} fully marked`}
      style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12.5, padding: "5px 8px", borderRadius: 8, background: "#fff" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: T.ink }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
        {e.name}: {e.done} of {e.minimum} done
      </span>
      <span style={{ color, fontWeight: 700 }}>
        {e.met ? "Minimum met" : `${e.remaining} to go`}
        <span style={{ color: T.faint, fontWeight: 600 }}> · planned {e.planned} · given {e.issued}{e.plannedShort ? " · the course plan has too few" : ""}</span>
      </span>
    </div>
  );
}

function CourseDetail({ classId, cell, onClose }) {
  const { data, isLoading, isError } = useCoverageDetail(classId, cell.courseId);
  return (
    <div style={{ marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", background: T.tint }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{cell.courseName} <StatusPill status={cell.status} small /></p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>
            {cell.scheduled
              ? `${cell.covered} of ${cell.total} covered · ${cell.due} due so far${cell.cancelled ? ` · ${cell.cancelled} cancelled` : ""} · started ${fmtDate(cell.startDate)}`
              : "Not scheduled — give this course weekly lessons and a start date on the class timetable."}
            {cell.educator ? ` · ${cell.educator.name}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: "none", color: T.muted, cursor: "pointer", padding: 2 }}><FiX size={16} /></button>
      </div>
      {cell.evidence?.length > 0 && (
        <div style={{ margin: "10px 0 0", display: "grid", gap: 4 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: T.faint }}>Minimum evidence</p>
          {cell.evidence.map((e) => <EvidenceLine key={e.evidenceTypeId} e={e} />)}
        </div>
      )}
      {isLoading ? <Empty>Loading sessions…</Empty> : isError || !data ? <Empty>The sessions couldn't be loaded.</Empty> : (
        <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 4 }}>
          {data.sessions.map((s) => {
            const st = SESSION_STATE[s.state];
            return (
              <li key={s.sessionId} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 8, alignItems: "center", fontSize: 12.5, padding: "5px 8px", borderRadius: 8, background: "#fff" }}>
                <span style={{ color: T.faint, fontWeight: 800 }}>{s.number}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.ink }}>{s.title}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: st.color, fontWeight: 700, whiteSpace: "nowrap" }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: st.color }} />
                  {st.label}{s.date ? ` · ${fmtDate(s.date)}` : ""}{s.via === "attendance" ? " (register)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ClassRow({ row, isHub }) {
  const [open, setOpen] = useState(null);
  const cell = row.cells.find((c) => c.courseId === open);
  const s = COVERAGE_STATUS[row.status];
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>
            {row.label}{!isHub && row.hubName ? <span style={{ color: T.muted, fontWeight: 600 }}> · {row.hubName}</span> : null}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.faint }}>
            {[row.curriculumName, `${fmtNum(row.learners)} learner${row.learners === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 0, display: "grid", gap: 5 }}>
          {row.coursesScheduled ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                <span style={{ color: T.ink, fontWeight: 800 }}>{fmtPct(row.coverage)} covered <span style={{ color: T.faint, fontWeight: 600 }}>· {row.covered} of {row.total}</span></span>
                <StatusPill status={row.status} small />
              </div>
              <ProgressBar covered={row.covered} due={row.due} total={row.total} color={s.color} />
              <span style={{ fontSize: 11.5, color: T.muted }}>
                {row.behind ? `${row.behind} session${row.behind === 1 ? "" : "s"} due but not covered` : row.due ? "Up to date" : "First lessons still to come"}
              </span>
            </>
          ) : <span style={{ fontSize: 12, color: T.muted, display: "flex", justifyContent: "space-between", gap: 8 }}>No timetable yet <StatusPill status="not_scheduled" small /></span>}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
        {row.cells.map((c) => <CourseChip key={c.courseId} cell={c} active={open === c.courseId} onClick={() => setOpen(open === c.courseId ? null : c.courseId)} />)}
      </div>
      {row.evidenceShort > 0 && !cell && (
        <p style={{ margin: "7px 0 0", fontSize: 11.5, color: "#B87708", display: "flex", alignItems: "center", gap: 5 }}>
          <FiLayers size={12} aria-hidden /> Minimum evidence not yet reached in {row.evidenceShort} place{row.evidenceShort === 1 ? "" : "s"} — open a course to see which
        </p>
      )}
      {cell && <CourseDetail classId={row.classId} cell={cell} onClose={() => setOpen(null)} />}
    </div>
  );
}

const PAGE = 15;

export default function CoverageTab({ data, isHub, level }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("all");
  const [showAll, setShowAll] = useState(false);
  if (!data.classes) return <Card><Empty>No active classes with a curriculum and grade in this view.</Empty></Card>;

  const rows = status === "all" ? data.rows : data.rows.filter((r) => r.status === status);
  const shown = showAll ? rows : rows.slice(0, PAGE);
  const counts = data.rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
  const flat = data.rows.flatMap((r) => r.cells.map((c) => ({ ...c, key: `${r.classId}:${c.courseId}`, label: r.label, hubName: r.hubName, curriculumName: r.curriculumName })));
  const evidence = data.evidence || { summary: [], needsChoice: [] };
  const evidenceFlat = flat.flatMap((c) => (c.evidence || []).map((e) => ({ ...e, key: `${c.key}:${e.evidenceTypeId}`, label: c.label, hubName: c.hubName, courseName: c.courseName })));
  const classCell = (r) => [r.label, !isHub ? r.hubName : null].filter(Boolean).join(" · ");
  const classCsv = (r) => [r.label, r.hubName].filter(Boolean).join(" · ");

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiBookOpen} label="Curriculum covered" value={fmtPct(data.coverage)} tone="navy"
          sub={data.planned ? `${fmtNum(data.covered)} of ${fmtNum(data.planned)} sessions in scheduled classes` : "No class has a timetable yet"} />
        <Stat icon={FiTrendingUp} label="On pace" value={fmtPct(data.pace)} tone="mid"
          sub={data.due ? `${fmtNum(data.covered)} covered of ${fmtNum(data.due)} due so far` : "Nothing due yet"} />
        <Stat icon={FiAlertTriangle} label="Sessions behind" value={fmtNum(data.behind)} tone={data.behind ? "danger" : "navy"}
          sub={`${fmtNum(data.classesBehind)} class${data.classesBehind === 1 ? "" : "es"} ${data.behindThreshold}+ behind`} />
        <Stat icon={FiCheckCircle} label="Covered this period" value={fmtNum(data.coveredInPeriod)} sub="sessions, by the period chosen above" />
        <Stat icon={FiCalendar} label="Not scheduled" value={fmtNum(data.classesNotScheduled)} tone={data.classesNotScheduled ? "gold" : "navy"}
          sub={`of ${fmtNum(data.classes)} classes have no timetable`} />
      </div>

      <Card title="Class by class" subtitle={`As of ${fmtDate(data.asOf)}. Each chip is a course — click it to see its sessions. The pale part of a bar is what was due but not covered.`}
        action={(
          <div role="group" aria-label="Show classes" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", ...ORDER].filter((k) => k === "all" || counts[k]).map((k) => (
              <button key={k} type="button" onClick={() => { setStatus(k); setShowAll(false); }} aria-pressed={status === k}
                style={{ padding: "5px 10px", borderRadius: 999, border: `1.5px solid ${status === k ? T.navy : T.border}`, background: status === k ? T.navy : "#fff", color: status === k ? "#fff" : T.ink, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {k === "all" ? `All ${data.rows.length}` : `${COVERAGE_STATUS[k].label} ${counts[k]}`}
              </button>
            ))}
          </div>
        )}>
        {!rows.length ? <Empty>No classes here.</Empty> : shown.map((r) => <ClassRow key={r.classId} row={r} isHub={isHub} />)}
        {rows.length > PAGE && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="an-link" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {showAll ? <><FiChevronUp /> Show fewer</> : <><FiChevronDown /> Show all {rows.length}</>}
          </button>
        )}
      </Card>

      <DataTable
        title="Minimum evidence"
        subtitle="Each course should have at least the minimum of each evidence type set on its curriculum (Curriculum → Assessment → Evidence Types). Done means given to the class and fully marked."
        columns={[
          { key: "name", label: "Evidence type", render: (r) => <><strong>{r.name}</strong><span style={{ color: T.faint }}> · {r.curriculumName}</span></>, csv: (r) => `${r.name} (${r.curriculumName})` },
          { key: "minimum", label: "Per course", align: "num" },
          { key: "met", label: "Classes met", align: "num", render: (r) => `${r.met} of ${r.classCourses}`, csv: (r) => `${r.met} of ${r.classCourses}`, sort: (r) => (r.classCourses ? r.met / r.classCourses : 0) },
          { key: "done", label: "Done", align: "num", render: (r) => `${fmtNum(r.done)} of ${fmtNum(r.needed)}`, csv: (r) => `${r.done} of ${r.needed}` },
          { key: "remaining", label: "Still to do", align: "num" },
          { key: "plannedShort", label: "Courses planned with too few", render: (r) => r.plannedShort.join(", ") || "–", csv: (r) => r.plannedShort.join("; "), sort: (r) => r.plannedShort.length },
        ]}
        rows={evidence.summary}
        filename="minimum-evidence.csv"
        limit={10}
        empty="No evidence type in these curricula has a minimum yet. Set one in Curriculum → Assessment → Evidence Types (Minimum Count)."
      />

      {evidence.needsChoice.length > 0 && (
        <DataTable
          title="Assessments that need an evidence type"
          subtitle="These can't be counted toward a minimum until someone chooses which evidence type they are. Open one and pick it under “Counts as”."
          columns={[
            { key: "name", label: "Assessment", render: (r) => (isHub || level === "supervisor" ? r.name : <button type="button" className="an-link" onClick={() => navigate(`/assessments/${r.assessmentId}/edit`)}>{r.name}</button>), csv: (r) => r.name },
            { key: "type", label: "Type" },
            { key: "curriculumName", label: "Curriculum" },
            { key: "reason", label: "Why" },
          ]}
          rows={evidence.needsChoice}
          filename="assessments-needing-evidence-type.csv"
          limit={10}
        />
      )}

      {evidenceFlat.length > 0 && (
        <DataTable
          title="Evidence by class and course"
          columns={[
            { key: "label", label: "Class", render: classCell, csv: classCsv },
            { key: "courseName", label: "Course" },
            { key: "name", label: "Evidence type" },
            { key: "minimum", label: "Minimum", align: "num" },
            { key: "planned", label: "Planned", align: "num" },
            { key: "issued", label: "Given", align: "num" },
            { key: "done", label: "Done", align: "num" },
            { key: "remaining", label: "Still to do", align: "num" },
          ]}
          rows={evidenceFlat}
          filename="evidence-by-class.csv"
          initialSort={{ key: "remaining", dir: "desc" }}
          limit={10}
        />
      )}

      <DataTable
        title="Not scheduled"
        subtitle="These courses have no weekly lessons or no start date, so nothing can be measured yet. Set them on the class's timetable."
        columns={[
          { key: "label", label: "Class", render: (r) => [r.label, !isHub ? r.hubName : null].filter(Boolean).join(" · "), csv: (r) => [r.label, r.hubName].filter(Boolean).join(" · ") },
          { key: "courseName", label: "Course" },
          { key: "reason", label: "Missing" },
          { key: "educator", label: "Educator", render: (r) => r.educator || "–", csv: (r) => r.educator || "" },
        ]}
        rows={data.notScheduled}
        filename="coverage-not-scheduled.csv"
        limit={10}
        empty="Every course in view has a timetable."
      />

      <DataTable
        title="Every class and course"
        columns={[
          { key: "label", label: "Class", render: (r) => [r.label, !isHub ? r.hubName : null].filter(Boolean).join(" · "), csv: (r) => [r.label, r.hubName].filter(Boolean).join(" · ") },
          { key: "courseName", label: "Course" },
          { key: "status", label: "Pace", render: (r) => <StatusPill status={r.status} small />, csv: (r) => COVERAGE_STATUS[r.status]?.label, sort: (r) => ORDER.indexOf(r.status) },
          { key: "covered", label: "Covered", align: "num" },
          { key: "due", label: "Due so far", align: "num" },
          { key: "total", label: "Planned", align: "num" },
          { key: "behind", label: "Behind", align: "num" },
          { key: "coverage", label: "Covered %", align: "num", render: (r) => fmtPct(r.coverage) },
          { key: "lastCovered", label: "Last covered", render: (r) => fmtDate(r.lastCovered), csv: (r) => r.lastCovered || "" },
          { key: "educator", label: "Educator", render: (r) => r.educator?.name || "–", csv: (r) => r.educator?.name || "", sort: (r) => r.educator?.name || "" },
        ]}
        rows={flat}
        filename="curriculum-coverage.csv"
        initialSort={{ key: "status", dir: "asc" }}
        limit={10}
      />
      <Note>
        A session counts as covered once it is marked taught or its register is taken. "Due so far" is every session the timetable has placed on a date up to today.
        Behind means {data.behindThreshold} or more due sessions not covered; slightly behind, 1–{data.behindThreshold - 1}. Coverage is as of today — the period above only changes "Covered this period".
        Stage, pathway and gender filters don't apply here.
      </Note>
    </>
  );
}
