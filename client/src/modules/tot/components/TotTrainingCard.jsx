import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAward, FiBookOpen, FiEdit3 } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { useEducatorTraining, useEnrolInTot, useTotClasses } from "../hooks/useTot";

const fmt = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const select = { flex: "1 1 220px", minWidth: 0, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", background: "#fff" };

// An educator's training of trainers (modules/tot) on their page — the admin app's and the hub
// portal's educator page, and the supervisor portal's: their TOT class, each course in progress,
// their certificates (each one qualifies them to teach that course), and work waiting to be marked.
// An admin can enrol them in a TOT class here.
export default function TotTrainingCard({ teacherId }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = user?.role === "admin" || user?.role === "collaborator";
  const canEnrol = isAdmin && can("teachers", "edit");
  const { data: training, isLoading } = useEducatorTraining(teacherId);
  const { data: classes = [] } = useTotClasses({ enabled: canEnrol });
  const enrol = useEnrolInTot(teacherId);
  const [classId, setClassId] = useState("");
  const [adding, setAdding] = useState(false);
  const markingPath = user?.role === "supervisor" ? "/supervisor-portal/marking" : isAdmin ? "/teachers/training" : null;

  if (isLoading) return null;
  if (!training && !canEnrol) return null;

  const enrolled = new Set((training?.classes || []).map((c) => c.classId));
  const offer = classes.filter((c) => !enrolled.has(c.id));
  const enrolForm = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="TOT class" style={select}>
        <option value="">{offer.length ? "Choose a TOT class…" : "No TOT classes yet"}</option>
        {offer.map((c) => <option key={c.id} value={c.id}>{c.curriculumName} · {c.gradeName}{c.streamName ? ` (${c.streamName})` : ""} — {c.hubName}</option>)}
      </select>
      <button
        type="button"
        disabled={!classId || enrol.isPending}
        onClick={() => { const c = classes.find((x) => x.id === classId); enrol.mutate({ hubId: c.hubId, classId }, { onSuccess: () => { setClassId(""); setAdding(false); } }); }}
        style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: !classId || enrol.isPending ? "#b8d9ee" : "#25476a", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !classId ? "not-allowed" : "pointer" }}
      >
        {enrol.isPending ? "Enrolling…" : "Enrol"}
      </button>
    </div>
  );

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em", display: "inline-flex", alignItems: "center", gap: 6 }}><FiBookOpen size={12} /> Training (TOT)</h2>
        {training?.toMark > 0 && markingPath && (
          <Link to={markingPath} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: "#FFFBEB", color: "#B45309", fontSize: 11.5, fontWeight: 800, textDecoration: "none" }}>
            <FiEdit3 size={11} /> {training.toMark} to mark
          </Link>
        )}
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {!training ? (
          <>
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>Not in training. Enrol them in a TOT class — they learn in their teacher portal&apos;s &ldquo;My learning&rdquo; while they teach, and their supervisor marks their work.</p>
            {enrolForm}
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {training.classes.map((c) => (
                <span key={c.classId} style={{ padding: "4px 10px", borderRadius: 999, background: "#e8f5fb", border: "1px solid #a8d5ee", color: "#25476a", fontSize: 12, fontWeight: 700 }}>
                  {c.curriculumName} · {c.className} — {c.hubName}
                </span>
              ))}
            </div>

            {training.courses.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {training.courses.map((course) => {
                  const pct = course.total ? Math.round((course.done / course.total) * 100) : 0;
                  return (
                    <div key={course.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#374151", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{course.title}</span>
                        <span style={{ color: "#6B7280" }}>{course.done} of {course.total} sessions</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: "#EEF1F4", overflow: "hidden" }}><div style={{ width: `${Math.max(3, pct)}%`, height: "100%", background: "#2e7db5", borderRadius: 999 }} /></div>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Certificates — qualified to teach</p>
              {training.certificates.filter((c) => c.kind === "course").length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>None yet. Each course they finish qualifies them to teach it.</p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {training.certificates.filter((c) => c.kind === "course").map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111827" }}>
                      <FiAward size={14} color="#16A34A" /> <span style={{ fontWeight: 600 }}>{c.title}</span> <span style={{ color: "#9CA3AF", fontSize: 12 }}>{fmt(c.issuedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {training.classes.some((c) => c.completionTeacherLevel) && (
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                Finishing every course of {training.classes.filter((c) => c.completionTeacherLevel).map((c) => `${c.curriculumName} raises them to Level ${c.completionTeacherLevel}`).join("; ")}.
              </p>
            )}

            {canEnrol && (adding ? enrolForm : offer.length > 0 && (
              <button type="button" onClick={() => setAdding(true)} style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "none", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>+ Enrol in another TOT class</button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
