import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import { usePromotionReadiness, usePromoteLearners } from "../hooks/useClasses";
import { useAuth } from "../../../context/AuthContext";
import { classesListPath } from "../../../routes/portalPaths";

const ACCENT = "#25476a";

// A learner's grade-completion readiness is computed live off the same signal the Reports page
// already uses (every course's final report is publishable) — see ClassService.getPromotionReadiness
// server-side. Promotion is never automatic: an admin still has to select and click, same posture
// as publishing a final report.
export default function PromotionPanel({ classId, schoolId, classLearners }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: readiness, isLoading } = usePromotionReadiness(classId);
  const { mutate: promote, isPending } = usePromoteLearners();
  const [selectedIds, setSelectedIds] = useState([]);

  const toggle = (learnerId) => {
    setSelectedIds((ids) => (ids.includes(learnerId) ? ids.filter((i) => i !== learnerId) : [...ids, learnerId]));
  };

  const handlePromote = (learnerIds) => {
    promote({ classId, learnerIds }, { onSuccess: () => setSelectedIds([]) });
  };

  const cardStyle = { backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
  const headerRow = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Promotion</h3>
      {readiness?.nextGradeName && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#e8f5fb", color: ACCENT, border: "1px solid #a8d5ee" }}>
          <FiArrowRight size={11} /> {readiness.nextGradeName} · {readiness.nextAcademicYear}
        </span>
      )}
    </div>
  );

  if (isLoading || !readiness) {
    return (
      <div style={cardStyle}>
        {headerRow}
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
      </div>
    );
  }

  const learnerById = new Map(classLearners.map((l) => [l.id, l]));
  const rows = readiness.learners.map((r) => ({ ...r, learner: learnerById.get(r.learnerId) })).filter((r) => r.learner);
  const readyRows = rows.filter((r) => r.ready);

  return (
    <div style={cardStyle}>
      {headerRow}

      {!readiness.nextGradeId ? (
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>This is the final grade in the curriculum — there's nothing to promote learners into.</p>
      ) : !readiness.nextClass ? (
        <div style={{ padding: "14px 16px", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, fontSize: 13, color: "#92400E" }}>
          No {readiness.nextGradeName} class exists yet for {readiness.nextAcademicYear}.{" "}
          <button
            type="button"
            onClick={() => navigate(classesListPath(user?.role, schoolId))}
            style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13, padding: 0 }}
          >
            Set up classes for {readiness.nextAcademicYear} first →
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>No learners enrolled in this class yet.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {rows.map((r) => (
              <div key={r.learnerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E7EB" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: r.ready ? "pointer" : "default" }}>
                  <input type="checkbox" checked={selectedIds.includes(r.learnerId)} disabled={!r.ready} onChange={() => toggle(r.learnerId)} />
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: r.ready ? "#111827" : "#9CA3AF" }}>{r.learner.firstName} {r.learner.lastName}</p>
                </label>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.ready ? "#059669" : "#9CA3AF" }}>
                  {r.completedCourses}/{r.totalCourses} course{r.totalCourses !== 1 ? "s" : ""} done
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={selectedIds.length === 0 || isPending}
              onClick={() => handlePromote(selectedIds)}
              style={{ padding: "8px 16px", backgroundColor: selectedIds.length === 0 || isPending ? "#b8d9ee" : ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: selectedIds.length === 0 || isPending ? "not-allowed" : "pointer" }}
            >
              {isPending ? "Promoting…" : `Promote Selected (${selectedIds.length})`}
            </button>
            {readyRows.length > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handlePromote(readyRows.map((r) => r.learnerId))}
                style={{ padding: "8px 16px", backgroundColor: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
              >
                Promote All Ready ({readyRows.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
