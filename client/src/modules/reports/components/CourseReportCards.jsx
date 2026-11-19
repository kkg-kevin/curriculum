import { useState } from "react";
import { Assignment as AssignmentIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useBulkReports, useGenerateReport, useIssueCertificate, useRevokeReportCertificate } from "../hooks/useReports";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import { classLabel } from "../../../utils/classLabel";

/*
 * One (class, course)'s reports — sessions, module reports and the final combined report — with
 * every action on them. Shared by the teacher portal's Reports page and (19 Nov 2026) the admin and
 * hub class page, so anyone who can reach the class can get its learners their reports and
 * certificates. `reportPath(id)` is where a report opens in the caller's portal.
 *
 * Rows come from GET /api/reports/readiness (ReportService.getReadinessForClassCourse).
 */
export const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
export const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  not_ready: { label: "Not Ready", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  ready:     { label: "Ready", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" },
  draft:     { label: "Draft", bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  published: { label: "Published", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
};
const pillButton = (bg, color, border = "none", busy = false) => ({ padding: "6px 14px", backgroundColor: busy ? "#F9FAFB" : bg, color, border, borderRadius: 20, fontSize: 11.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap" });
const sectionHead = { padding: "10px 20px", backgroundColor: "#F9FAFB", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" };
const sectionLabel = { margin: 0, flex: 1, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "");

export function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_ready;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1.5px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export function rowStatus(row) {
  if (row.report?.status === "published") return "published";
  if (row.report?.status === "draft") return "draft";
  return row.ready ? "ready" : "not_ready";
}

// Every final and module report row of these (class, course) sections, each with its class and
// course — for the counts and "Needs publishing".
export function flattenReportRows(sections) {
  return sections.flatMap((s) => s.rows.flatMap((r) => [
    { ...r, cls: s.cls, course: s.course },
    ...(r.modules || []).map((m) => ({ learner: r.learner, ready: m.ready, report: m.report, certificate: m.certificate, moduleName: m.moduleName, cls: s.cls, course: s.course })),
  ]));
}

// One learner's standing for the session picked in the navigator.
function SessionLearnerRow({ learner, session, reportPath, navigate }) {
  const published = session?.report?.status === "published";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F9FAFB" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.ink }}>{learner.firstName} {learner.lastName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {!session || session.requiredCount === 0 ? "no assessments to report on" : `${session.gradedCount}/${session.requiredCount} assessments graded`}
        </p>
      </div>
      <StatusBadge status={published ? "published" : "not_ready"} />
      {published && (
        <button type="button" onClick={() => navigate(reportPath(session.report.id))} style={{ display: "inline-flex", alignItems: "center", gap: 6, ...pillButton(T.tintBg, T.accent, `1.5px solid ${T.tintBorder}`) }}>
          <VisibilityIcon sx={{ fontSize: 13 }} /> View
        </button>
      )}
    </div>
  );
}

// Prev / next, one at a time — sessions, or modules.
function Navigator({ items, index, onChange, label, extra }) {
  const current = items[index];
  const nav = (disabled) => ({ padding: "6px 12px", backgroundColor: "#fff", color: disabled ? T.inkFaint : T.accent, border: `1.5px solid ${T.border}`, borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer" });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", backgroundColor: "#FAFBFF", borderBottom: `1px solid ${T.border}` }}>
      <button type="button" onClick={() => onChange(index - 1)} disabled={index === 0} style={nav(index === 0)}>‹ Prev</button>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, textAlign: "center" }}>
        {label(current, index)}
        {extra && <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#B45309" }}>{extra}</span>}
      </p>
      <button type="button" onClick={() => onChange(index + 1)} disabled={index === items.length - 1} style={nav(index === items.length - 1)}>Next ›</button>
    </div>
  );
}

// A final report's row, or (moduleRow set) a module report's: status, what the report will leave out,
// and the action — Generate, Review / View, then Issue certificate (or Revoke).
//
// 19 Nov 2026 (user): missing work no longer holds a learner back. Every learner's report opens at
// the module's (course's) last session — the report names what wasn't handed in or marked — and a
// published report gets its certificate when the educator issues it, not automatically.
function ReportRow({ row, cls, course, moduleRow = null, reportPath, navigate, generate }) {
  const subject = moduleRow || row;
  const status = rowStatus(subject);
  const issue = useIssueCertificate();
  const revoke = useRevokeReportCertificate();
  const blocking = (row.sessions || []).filter((s) => !moduleRow || s.moduleId === moduleRow.moduleId);
  const missing = blocking.filter((s) => s.state === "not_submitted" || s.state === "open").length;
  const toMark = blocking.filter((s) => s.state === "needs_grading").length;
  const name = row.learner.firstName || "this learner";
  const scope = { learnerId: row.learner.id, courseId: course.id, classId: cls.id, ...(moduleRow ? { moduleId: moduleRow.moduleId } : {}) };
  const generating = generate.isPending && generate.variables?.learnerId === row.learner.id && generate.variables?.courseId === course.id && (generate.variables?.moduleId || null) === (moduleRow?.moduleId || null);
  const filing = subject.filing;
  const certificate = subject.certificate || null;
  const reportId = subject.report?.id;
  const issuing = issue.isPending && issue.variables === reportId;
  const what = moduleRow ? `${moduleRow.moduleName} certificate` : `${course.name} certificate`;
  // Final report rows: module reports not yet published (their certificates are separate).
  const modulesLeft = moduleRow ? [] : (row.modules || []).filter((m) => m.report?.status !== "published");

  const notes = [];
  if (status === "not_ready") notes.push({ tone: "muted", text: `Opens at the ${moduleRow ? "module's" : "course's"} last session${filing?.date ? ` (${fmtDay(filing.date)})` : ""}` });
  else if (status !== "published" && !subject.complete && (missing || toMark)) {
    notes.push({ tone: "warm", text: `${[missing ? `${plural(missing, "session")} not handed in` : null, toMark ? `${toMark} still to mark` : null].filter(Boolean).join(" · ")} — the report lists ${missing + toMark === 1 ? "it" : "them"}` });
  }
  if (status !== "not_ready" && modulesLeft.length > 0) notes.push({ tone: "warm", text: `Module ${modulesLeft.length === 1 ? "report" : "reports"} not published: ${modulesLeft.map((m) => m.moduleName).join(", ")}` });
  if (status === "published" && certificate?.status === "issued") notes.push({ tone: "good", text: `Certificate ${certificate.certificateNumber} issued` });
  if (status === "published" && certificate?.status === "revoked") notes.push({ tone: "bad", text: `Certificate ${certificate.certificateNumber} revoked${certificate.revokeReason ? ` — ${certificate.revokeReason}` : ""}` });
  const toneColor = { muted: T.inkMuted, warm: "#B45309", good: "#059669", bad: "#B91C1C" };

  const issueOne = () => issue.mutate(reportId);
  const revokeOne = async () => {
    const reason = await askText({
      title: `Revoke ${name}'s certificate?`,
      message: `${certificate.certificateNumber} (${what}) stops being valid — its verify link says so. You can issue it again later; it keeps its number.`,
      label: "Why",
      placeholder: "e.g. issued to the wrong learner",
      confirmLabel: "Revoke",
      tone: "danger",
      required: true,
    });
    if (reason) revoke.mutate({ id: certificate.id, reason });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #F9FAFB", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learner.firstName} {row.learner.lastName}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {moduleRow
            ? `${moduleRow.moduleName} · ${moduleRow.done}/${moduleRow.total} sessions done`
            : `${course.name} · ${row.requiredCount === 0 ? "no assessments to report on" : `${row.gradedCount}/${row.requiredCount} assessments graded`}`}
        </p>
        {notes.map((n) => <p key={n.text} style={{ margin: "3px 0 0", fontSize: 11.5, color: toneColor[n.tone], fontWeight: n.tone === "muted" ? 500 : 600 }}>{n.text}</p>)}
      </div>
      <StatusBadge status={status} />
      {status === "ready" && (
        <button type="button" disabled={generating} onClick={() => generate.mutate(scope, { onSuccess: (report) => navigate(reportPath(report.id)) })} style={pillButton("#feb139", "#25476a", "none", generating)}>
          {generating ? "Generating…" : "Generate"}
        </button>
      )}
      {(status === "draft" || status === "published") && (
        <button type="button" onClick={() => navigate(reportPath(subject.report.id))} style={{ display: "inline-flex", alignItems: "center", gap: 6, ...pillButton(T.tintBg, T.accent, `1.5px solid ${T.tintBorder}`) }}>
          <VisibilityIcon sx={{ fontSize: 13 }} /> {status === "draft" ? "Review" : "View"}
        </button>
      )}
      {status === "published" && certificate?.status !== "issued" && (
        <button type="button" disabled={issuing} onClick={issueOne} title={`Issue ${name}'s ${what} — the family is told`} style={pillButton("#059669", "#fff", "none", issuing)}>
          {issuing ? "Issuing…" : certificate?.status === "revoked" ? "Issue again" : "Issue certificate"}
        </button>
      )}
      {status === "published" && certificate?.status === "issued" && (
        <button type="button" disabled={revoke.isPending} onClick={revokeOne} style={pillButton("#fff", "#B91C1C", "1.5px solid #FECACA", revoke.isPending)}>
          Revoke
        </button>
      )}
    </div>
  );
}

// "Generate all ready" / "Publish all drafts" / "Issue all certificates" for one set of rows (a
// module's, or the final reports) — the whole class at once, so every learner gets their report and
// certificate as the module (course) ends.
function BulkActions({ cls, course, moduleId = null, subjects, what }) {
  const bulk = useBulkReports();
  const readyCount = subjects.filter((s) => rowStatus(s) === "ready").length;
  const draftCount = subjects.filter((s) => rowStatus(s) === "draft").length;
  const issueCount = subjects.filter((s) => rowStatus(s) === "published" && s.certificate?.status !== "issued").length;
  if (!readyCount && !draftCount && !issueCount) return null;
  const busy = (action) => bulk.isPending && bulk.variables?.action === action && (bulk.variables?.moduleId || null) === moduleId && bulk.variables?.courseId === course.id;
  const run = (action) => bulk.mutate({ action, classId: cls.id, courseId: course.id, ...(moduleId ? { moduleId } : {}) });
  const publishAll = async () => {
    const ok = await askConfirm({
      title: `Publish ${plural(draftCount, "draft")}?`,
      message: `Learners and parents will see ${draftCount === 1 ? "this" : "these"} ${what}. Remarks you haven't written stay empty — review drafts one by one first if you want to add them. Then issue the certificates.`,
      confirmLabel: `Publish ${draftCount}`,
    });
    if (ok) run("publish");
  };
  const issueAll = async () => {
    const ok = await askConfirm({
      title: `Issue ${plural(issueCount, "certificate")}?`,
      message: `Every learner here whose report is published gets their ${moduleId ? "module" : "course"} certificate, and their family is told. You can revoke one later.`,
      confirmLabel: `Issue ${issueCount}`,
    });
    if (ok) run("issue");
  };
  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
      {readyCount > 0 && <button type="button" disabled={bulk.isPending} onClick={() => run("generate")} style={pillButton("#feb139", "#25476a", "none", bulk.isPending)}>{busy("generate") ? "Generating…" : `Generate all (${readyCount})`}</button>}
      {draftCount > 0 && <button type="button" disabled={bulk.isPending} onClick={publishAll} style={pillButton(T.accent, "#fff", "none", bulk.isPending)}>{busy("publish") ? "Publishing…" : `Publish all drafts (${draftCount})`}</button>}
      {issueCount > 0 && <button type="button" disabled={bulk.isPending} onClick={issueAll} style={pillButton("#059669", "#fff", "none", bulk.isPending)}>{busy("issue") ? "Issuing…" : `Issue all certificates (${issueCount})`}</button>}
    </span>
  );
}

// Every generated-but-unpublished report across these sections, up front — Generate only makes a
// draft, and an unpublished one leaves the family (and the certificate) waiting.
export function NeedsPublishingSection({ rows, reportPath }) {
  const navigate = useNavigate();
  if (rows.length === 0) return null;
  return (
    <div style={{ ...cardStyle, overflow: "hidden", border: "1.5px solid #FED7AA" }}>
      <div style={{ padding: "14px 20px", backgroundColor: "#FFF7ED", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.05em" }}>Needs Publishing</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{plural(rows.length, "report")} generated but not yet visible to the learner or guardian</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((row) => (
          <div key={row.report.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #F9FAFB", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learner.firstName} {row.learner.lastName}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{row.course.name}{row.moduleName ? ` · ${row.moduleName}` : ""} · {classLabel(row.cls)}</p>
            </div>
            <button type="button" onClick={() => navigate(reportPath(row.report.id))} style={{ ...pillButton("#feb139", "#25476a"), padding: "7px 16px", fontSize: 12 }}>Review & Publish →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// One (class, course) card: sessions (one at a time), module reports (one module at a time) and
// the final combined report, each list with its whole-class actions.
export function CourseReportCard({ cls, course, rows, reportPath, showClass = true }) {
  const navigate = useNavigate();
  const generate = useGenerateReport();
  const { requiredCount = 0, attachedCount = 0 } = rows[0] || {};
  const missingCount = attachedCount - requiredCount;
  const sessions = (rows[0]?.sessions || []).filter((s) => s.requiredCount > 0);
  const [sessionIndex, setSessionIndex] = useState(0);
  const activeIndex = Math.min(sessionIndex, sessions.length - 1);
  const activeSession = sessions[activeIndex];
  const modules = rows[0]?.modules || [];
  const moduleInfo = rows[0]?.moduleInfo || {};
  // Reports sit on the session they belong to (19 Nov 2026, user): a module's report on that
  // module's last session, the final combined report on the course's last session (the last
  // session of the last module). Elsewhere a line points to where they are.
  const lastIndexOf = (moduleId) => sessions.reduce((last, s, i) => (s.moduleId === moduleId ? i : last), -1);
  const activeModule = activeSession ? modules.find((m) => m.moduleId === activeSession.moduleId) || null : null;
  const moduleLast = activeModule ? lastIndexOf(activeModule.moduleId) : -1;
  const atModuleEnd = Boolean(activeModule) && moduleLast === activeIndex;
  const atCourseEnd = sessions.length === 0 || activeIndex === sessions.length - 1;
  const moduleRows = rows.map((row) => ({ row, moduleRow: row.modules?.find((m) => m.moduleId === activeModule?.moduleId) })).filter((x) => x.moduleRow);
  const shared = { cls, course, reportPath, navigate, generate };
  const sessionLabel = (i) => `session ${i + 1}${sessions[i]?.sessionTitle ? ` — ${sessions[i].sessionTitle}` : ""}`;
  const Pointer = ({ text, to }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 20px", backgroundColor: "#F8FAFC", borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.inkMuted }}>
      <span style={{ flex: 1, minWidth: 200 }}>{text}</span>
      <button type="button" onClick={() => setSessionIndex(to)} style={pillButton(T.tintBg, T.accent, `1.5px solid ${T.tintBorder}`)}>Go to {sessionLabel(to).split(" — ")[0]} →</button>
    </div>
  );

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <AssignmentIcon sx={{ fontSize: 18, color: T.accentLight }} />
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{course.name}</p>
          {showClass && <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{classLabel(cls)}</p>}
        </div>
      </div>
      {/* A course's sessions can keep referencing assessments that were later deleted — those
          can never be graded, so they're excluded from the requirement. */}
      {missingCount > 0 && (
        <div style={{ padding: "8px 20px", backgroundColor: "#FFFBEB", borderBottom: "1px solid #FDE68A", fontSize: 11.5, color: "#B45309", fontWeight: 600 }}>
          {requiredCount === 0
            ? `All ${plural(attachedCount, "assessment")} attached to this course have been deleted — there's nothing left to report on.`
            : `${missingCount} of ${plural(attachedCount, "attached assessment")} ${missingCount === 1 ? "has" : "have"} been deleted and ${missingCount === 1 ? "is" : "are"} excluded from the ${requiredCount} required here.`}
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <Navigator items={sessions} index={Math.min(sessionIndex, sessions.length - 1)} onChange={setSessionIndex}
            label={(s, i) => `Session ${i + 1} of ${sessions.length}${s?.sessionTitle ? ` — ${s.sessionTitle}` : ""}`} />
          {rows.map((row) => (
            <SessionLearnerRow key={row.learner.id} learner={row.learner} session={row.sessions?.find((s) => s.sessionId === activeSession?.sessionId)} reportPath={reportPath} navigate={navigate} />
          ))}
        </>
      )}

      {/* This module's report — on its last session only. */}
      {activeModule && atModuleEnd && (
        <>
          <div style={sectionHead}>
            <p style={sectionLabel}>Module Report — {activeModule.moduleName}</p>
            <BulkActions cls={cls} course={course} moduleId={activeModule.moduleId} subjects={moduleRows.map((x) => x.moduleRow)} what={`${activeModule.moduleName} reports`} />
          </div>
          <div style={{ padding: "8px 20px", backgroundColor: "#FFFBEB", borderBottom: `1px solid ${T.border}`, fontSize: 11.5, fontWeight: 600, color: "#B45309" }}>
            The last session of {activeModule.moduleName}: generate the reports, publish them, then issue the certificates.
          </div>
          {moduleRows.map(({ row, moduleRow }) => <ReportRow key={`${row.learner.id}:${moduleRow.moduleId}`} row={row} moduleRow={moduleRow} {...shared} />)}
        </>
      )}
      {activeModule && !atModuleEnd && moduleLast >= 0 && (
        <Pointer text={`The ${activeModule.moduleName} report and certificates are at this module's last session (${sessionLabel(moduleLast)}).`} to={moduleLast} />
      )}

      {/* The final combined report — on the course's last session only. */}
      {atCourseEnd ? (
        <>
          {(moduleInfo.coveredByFinal || moduleInfo.unassessed?.length > 0) && (
            <div style={{ padding: "8px 20px", backgroundColor: "#F8FAFC", borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.inkMuted }}>
              {moduleInfo.coveredByFinal && <>Only one module has assessments ({moduleInfo.coveredByFinal}), so the final report below covers it — with the course certificate. </>}
              {moduleInfo.unassessed?.length > 0 && <>{moduleInfo.unassessed.join(", ")} {moduleInfo.unassessed.length === 1 ? "has" : "have"} no assessments, so no module report or certificate.</>}
            </div>
          )}
          <div style={{ ...sectionHead, borderTop: sessions.length > 0 ? `1px solid ${T.border}` : "none" }}>
            <p style={sectionLabel}>Final Combined Report — {course.name}</p>
            <BulkActions cls={cls} course={course} subjects={rows} what={`${course.name} final reports`} />
          </div>
          {sessions.length > 0 && (
            <div style={{ padding: "8px 20px", backgroundColor: "#FFFBEB", borderBottom: `1px solid ${T.border}`, fontSize: 11.5, fontWeight: 600, color: "#B45309" }}>
              The course&apos;s last session: generate the final reports, publish them, then issue the course certificates.
            </div>
          )}
          {rows.map((row) => <ReportRow key={row.learner.id} row={row} {...shared} />)}
        </>
      ) : (
        <Pointer text={`The final combined report and course certificates are at the course's last session (${sessionLabel(sessions.length - 1)}).`} to={sessions.length - 1} />
      )}
    </div>
  );
}
