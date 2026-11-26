import { useState } from "react";
import { Assignment as AssignmentIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useGenerateCertificates, useRevokeReportCertificate } from "../hooks/useReports";
import { askConfirm, askText } from "../../../components/ui/AskDialog";
import CertificatePreviewDialog from "../../certificates/components/CertificatePreviewDialog";
import { classLabel } from "../../../utils/classLabel";
import ClassRunBadge, { MovedOnTag } from "../../classes/components/ClassRun";

/*
 * One (class, course): its sessions one at a time, each learner's session report — and, on a
 * module's last session and on the course's last session, that module's or the course's
 * certificates. Shared by the teacher portal's Reports page and the admin and hub class page.
 * `reportPath(id)` is where a report opens in the caller's portal.
 *
 * The simple flow (19 Nov 2026, user): assessment issued → marked → the session report goes to the
 * family by itself; at the last session of a module the educator generates the learner's
 * certificate (course and module named on it) — no module or final report to make or publish.
 *
 * Rows come from GET /api/reports/readiness (ReportService.getReadinessForClassCourse): each with
 * the learner's sessions, `certificates` ({ course, modules: { [moduleId]: cert } }) and
 * `certificateScopes` (which certificates the course offers and when each opens).
 */
export const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
export const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

const STATUS_CONFIG = {
  not_ready: { label: "Not Ready", bg: "#F9FAFB", color: T.inkMuted, border: T.border },
  published: { label: "Sent", bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" },
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

// Figures for a page of (class, course) sections: session reports sent, certificates issued, and
// certificates that can be generated now (open, not yet held).
export function reportStats(sections) {
  let sent = 0;
  let issued = 0;
  let toGenerate = 0;
  for (const { rows } of sections) {
    const scopes = rows[0]?.certificateScopes;
    for (const row of rows) {
      sent += (row.sessions || []).filter((s) => s.report?.status === "published").length;
      const certs = [row.certificates?.course, ...Object.values(row.certificates?.modules || {})];
      issued += certs.filter((c) => c?.status === "issued").length;
      if (scopes?.course?.window?.open && row.certificates?.course?.status !== "issued") toGenerate += 1;
      for (const m of scopes?.modules || []) if (m.window?.open && row.certificates?.modules?.[m.moduleId]?.status !== "issued") toGenerate += 1;
    }
  }
  return { sent, issued, toGenerate };
}

// One learner's session report for the session picked in the navigator.
function SessionLearnerRow({ learner, session, movedOn = null, reportPath, navigate }) {
  const published = session?.report?.status === "published";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid #F9FAFB" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.ink }}>{learner.firstName} {learner.lastName}<MovedOnTag movedOn={movedOn} /></p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>
          {!session || session.requiredCount === 0 ? "no assessments to report on" : `${session.gradedCount}/${session.requiredCount} assessments marked`}
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

// Prev / next through the course's sessions.
function Navigator({ items, index, onChange, label }) {
  const current = items[index];
  const nav = (disabled) => ({ padding: "6px 12px", backgroundColor: "#fff", color: disabled ? T.inkFaint : T.accent, border: `1.5px solid ${T.border}`, borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "not-allowed" : "pointer" });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", backgroundColor: "#FAFBFF", borderBottom: `1px solid ${T.border}` }}>
      <button type="button" onClick={() => onChange(index - 1)} disabled={index === 0} style={nav(index === 0)}>‹ Prev</button>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, textAlign: "center" }}>{label(current, index)}</p>
      <button type="button" onClick={() => onChange(index + 1)} disabled={index === items.length - 1} style={nav(index === items.length - 1)}>Next ›</button>
    </div>
  );
}

// The certificates of one module (moduleId) or of the course, for every learner: Generate per
// learner or for everyone, Revoke, Generate again. Waits for the class to reach the last session.
function CertificateSection({ cls, course, rows, moduleId = null, name, window: win }) {
  const generate = useGenerateCertificates();
  const revoke = useRevokeReportCertificate();
  // The certificate open over the page (its id) — "View" on an issued or revoked row.
  const [viewing, setViewing] = useState(null);
  const what =moduleId ? `${name} certificate` : `${course.name} certificate`;
  const certOf = (row) => (moduleId ? row.certificates?.modules?.[moduleId] : row.certificates?.course) || null;
  const open = Boolean(win?.open);
  const missing = rows.filter((row) => certOf(row)?.status !== "issued");
  const busyFor = (learnerIds) => generate.isPending && (generate.variables?.moduleId || null) === moduleId && generate.variables?.courseId === course.id
    && JSON.stringify(generate.variables?.learnerIds || null) === JSON.stringify(learnerIds);
  const run = (learnerIds = null) => generate.mutate({ classId: cls.id, courseId: course.id, ...(moduleId ? { moduleId } : {}), ...(learnerIds ? { learnerIds } : {}) });
  const generateAll = async () => {
    const ok = await askConfirm({
      title: `Generate ${plural(missing.length, "certificate")}?`,
      message: `Every learner here without one gets their ${what} — ${course.name}${moduleId ? `, ${name}` : ""} — and their family is told. You can revoke one later.`,
      confirmLabel: `Generate ${missing.length}`,
    });
    if (ok) run();
  };
  const revokeOne = async (row) => {
    const cert = certOf(row);
    const reason = await askText({
      title: `Revoke ${row.learner.firstName}'s certificate?`,
      message: `${cert.certificateNumber} (${what}) stops being valid — its verify link says so. You can generate it again later; it keeps its number.`,
      label: "Why",
      placeholder: "e.g. issued to the wrong learner",
      confirmLabel: "Revoke",
      tone: "danger",
      required: true,
    });
    if (reason) revoke.mutate({ id: cert.id, reason });
  };

  return (
    <>
      <div style={sectionHead}>
        <p style={sectionLabel}>{moduleId ? `Module certificate — ${name}` : `Course certificate — ${course.name}`}</p>
        {open && missing.length > 0 && (
          <button type="button" disabled={generate.isPending} onClick={generateAll} style={pillButton("#059669", "#fff", "none", generate.isPending)}>
            {busyFor(null) ? "Generating…" : `Generate certificates for all (${missing.length})`}
          </button>
        )}
      </div>
      <div style={{ padding: "8px 20px", backgroundColor: open ? "#ECFDF5" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, fontSize: 11.5, fontWeight: 600, color: open ? "#065F46" : T.inkMuted }}>
        {open
          ? `The last session of ${moduleId ? name : "the course"}: generate each learner's certificate (${course.name}${moduleId ? ` · ${name}` : ""}).`
          : `Opens when the class reaches this session${win?.date ? ` (${fmtDay(win.date)})` : ""}.`}
      </div>
      {rows.map((row) => {
        const cert = certOf(row);
        const ids = [row.learner.id];
        return (
          <div key={row.learner.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #F9FAFB", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: T.ink }}>{row.learner.firstName} {row.learner.lastName}<MovedOnTag movedOn={row.movedOn} /></p>
              <p style={{ margin: 0, fontSize: 11.5, color: cert?.status === "issued" ? "#059669" : cert?.status === "revoked" ? "#B91C1C" : T.inkFaint, fontWeight: cert ? 600 : 400 }}>
                {cert?.status === "issued"
                  ? `Certificate ${cert.certificateNumber} issued`
                  : cert?.status === "revoked"
                    ? `Certificate ${cert.certificateNumber} revoked${cert.revokeReason ? ` — ${cert.revokeReason}` : ""}`
                    : "No certificate yet"}
              </p>
            </div>
            {cert?.id && (
              <button type="button" onClick={() => setViewing(cert.id)} title={`View ${row.learner.firstName}'s certificate`}
                style={{ ...pillButton("#fff", T.accent, `1.5px solid ${T.tintBorder}`), display: "inline-flex", alignItems: "center", gap: 5 }}>
                <VisibilityIcon sx={{ fontSize: 14 }} /> View
              </button>
            )}
            {cert?.status === "issued" ? (
              <button type="button" disabled={revoke.isPending} onClick={() => revokeOne(row)} style={pillButton("#fff", "#B91C1C", "1.5px solid #FECACA", revoke.isPending)}>Revoke</button>
            ) : (
              <button type="button" disabled={!open || generate.isPending} onClick={() => run(ids)} title={open ? `Generate ${row.learner.firstName}'s ${what} — the family is told` : "Opens at this session"}
                style={pillButton(open ? "#059669" : "#F3F4F6", open ? "#fff" : T.inkFaint, "none", generate.isPending)}>
                {busyFor(ids) ? "Generating…" : cert?.status === "revoked" ? "Generate again" : "Generate certificate"}
              </button>
            )}
          </div>
        );
      })}
      {viewing && <CertificatePreviewDialog certificateId={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

// Every certificate this course offers — each module's, then the whole course's — with how far
// each has got. Tapping one goes to the last session where it is generated.
function CertificateStrip({ scopes, rows, course, sessions, activeSessionId, onGo }) {
  const issuedCount = (certOf) => rows.filter((row) => certOf(row)?.status === "issued").length;
  const items = [
    ...scopes.modules.map((m) => ({
      key: m.moduleId, name: m.moduleName, lastSessionId: m.lastSessionId, window: m.window,
      issued: issuedCount((row) => row.certificates?.modules?.[m.moduleId]),
    })),
    {
      key: "course", name: scopes.modules.length ? "Whole course" : course.name, lastSessionId: scopes.course?.lastSessionId, window: scopes.course?.window,
      issued: issuedCount((row) => row.certificates?.course),
    },
  ];
  const statusOf = ({ issued, window: win }) => {
    if (rows.length > 0 && issued === rows.length) return { text: `All ${issued} issued`, color: "#059669" };
    if (issued > 0) return { text: `${issued} of ${rows.length} issued`, color: "#059669" };
    if (win?.open) return { text: "Ready to generate", color: T.accentMid };
    return { text: win?.date ? `Opens ${fmtDay(win.date)}` : "Not open yet", color: T.inkMuted };
  };
  return (
    <div style={{ padding: "12px 20px", backgroundColor: "#F8FAFC", borderBottom: `1px solid ${T.border}` }}>
      <p style={{ ...sectionLabel, marginBottom: 8 }}>Certificates</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((item) => {
          const to = sessions.findIndex((s) => s.sessionId === item.lastSessionId);
          const here = item.lastSessionId === activeSessionId;
          const status = statusOf(item);
          return (
            <button key={item.key} type="button" disabled={to < 0} onClick={() => onGo(to)} aria-current={here ? "true" : undefined}
              title={`Go to the last session of ${item.key === "course" ? "the course" : item.name}`}
              style={{ flex: "0 1 auto", maxWidth: "100%", padding: "7px 13px", textAlign: "left", backgroundColor: here ? T.tintBg : "#fff", border: `1.5px solid ${here ? T.accentMid : T.border}`, borderRadius: 10, fontFamily: "Inter, sans-serif", cursor: to < 0 ? "not-allowed" : "pointer" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.accent }}>{item.name}</span>
              <span style={{ display: "block", marginTop: 1, fontSize: 11, fontWeight: 600, color: status.color }}>{status.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One (class, course) card.
export function CourseReportCard({ cls, course, rows, reportPath, showClass = true }) {
  const navigate = useNavigate();
  const { requiredCount = 0, attachedCount = 0 } = rows[0] || {};
  const missingCount = attachedCount - requiredCount;
  // Every session, in course order — a module's last session may have nothing to assess.
  const sessions = rows[0]?.sessions || [];
  const [sessionIndex, setSessionIndex] = useState(0);
  const activeIndex = Math.min(sessionIndex, Math.max(sessions.length - 1, 0));
  const activeSession = sessions[activeIndex];
  const scopes = rows[0]?.certificateScopes || { modules: [], course: {} };
  const moduleScope = scopes.modules.find((m) => m.lastSessionId === activeSession?.sessionId) || null;
  const courseHere = Boolean(activeSession) && scopes.course?.lastSessionId === activeSession.sessionId;
  const assessedHere = rows.some((r) => (r.sessions || []).find((s) => s.sessionId === activeSession?.sessionId)?.requiredCount > 0);
  // Numbers restart in each module: "Module 2 · Session 1 of 12".
  const label = (s, i) => `${s?.moduleName ? `${s.moduleName} · ` : ""}Session ${s?.sessionNumber ?? i + 1}${s?.sessionCount ? ` of ${s.sessionCount}` : ""}${s?.sessionTitle ? ` — ${s.sessionTitle}` : ""}`;

  return (
    <div style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <AssignmentIcon sx={{ fontSize: 18, color: T.accentLight }} />
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{course.name}</p>
          {showClass && <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint }}>{classLabel(cls)}</p>}
          <ClassRunBadge cls={cls} style={{ marginTop: 4 }} />
        </div>
      </div>
      {/* A course's sessions can keep referencing assessments that were later deleted — those
          can never be marked, so they're left out. */}
      {missingCount > 0 && (
        <div style={{ padding: "8px 20px", backgroundColor: "#FFFBEB", borderBottom: "1px solid #FDE68A", fontSize: 11.5, color: "#B45309", fontWeight: 600 }}>
          {requiredCount === 0
            ? `All ${plural(attachedCount, "assessment")} attached to this course have been deleted — there's nothing left to report on.`
            : `${missingCount} of ${plural(attachedCount, "attached assessment")} ${missingCount === 1 ? "has" : "have"} been deleted and ${missingCount === 1 ? "is" : "are"} left out.`}
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <CertificateStrip scopes={scopes} rows={rows} course={course} sessions={sessions} activeSessionId={activeSession?.sessionId} onGo={setSessionIndex} />
          <Navigator items={sessions} index={activeIndex} onChange={setSessionIndex} label={label} />
          {assessedHere
            ? rows.map((row) => (
              <SessionLearnerRow key={row.learner.id} learner={row.learner} movedOn={row.movedOn} session={row.sessions?.find((s) => s.sessionId === activeSession?.sessionId)} reportPath={reportPath} navigate={navigate} />
            ))
            : <p style={{ margin: 0, padding: "12px 20px", fontSize: 12.5, color: T.inkFaint }}>No assessments in this session — nothing to report.</p>}
        </>
      )}

      {/* The module's certificates — on its last session. */}
      {moduleScope && <CertificateSection cls={cls} course={course} rows={rows} moduleId={moduleScope.moduleId} name={moduleScope.moduleName} window={moduleScope.window} />}

      {/* The course's certificates — on its last session. */}
      {courseHere && <CertificateSection cls={cls} course={course} rows={rows} window={scopes.course.window} />}
    </div>
  );
}
