import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useLearningHubQuery as useSchoolQuery } from "../../learning-hubs/hooks/useLearningHub";
import { classApi } from "../services/classApi";
import { ClassCard } from "../components/ClassCard";
import { classesListPath, classCreatePath } from "../../../routes/portalPaths";

const ACCENT    = "#25476a";
const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";

export default function GradeStreamsPage() {
  const { schoolId, gradeId, academicYear } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: school, isLoading: schoolLoading } = useSchoolQuery(schoolId);

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", schoolId],
    queryFn: () => classApi.getAll({ schoolId }),
    enabled: !!schoolId,
  });

  const streams = (classesData?.data || []).filter((c) => c.gradeId === gradeId && c.academicYear === academicYear);
  const gradeName = streams[0]?.gradeName || "Grade";
  const totalLearners = streams.reduce((sum, c) => sum + (c.learnerCount || 0), 0);

  const backPath = classesListPath(user?.role, schoolId);
  // schoolId is always present here, so classCreatePath always comes back with a "?schoolId="
  // query string already — safe to just append the grade/year prefill params onto it.
  const addStreamPath = `${classCreatePath(user?.role, schoolId)}&gradeName=${encodeURIComponent(gradeName)}&academicYear=${encodeURIComponent(academicYear)}`;

  if (schoolLoading || classesLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(backPath)}
          style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Classes
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <button type="button" onClick={() => navigate(backPath)}
          style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          {school?.name || "School"}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{gradeName}</span>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 40%, #2e7db5 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>{gradeName}</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
              {school?.name} · {academicYear} · {streams.length} stream{streams.length !== 1 ? "s" : ""} · {totalLearners} learner{totalLearners !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(addStreamPath)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Add Stream
          </button>
        </div>
      </div>

      {/* Stream cards */}
      {streams.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>No classes found for this grade.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {streams.map((c) => <ClassCard key={c.id} cls={c} />)}
        </div>
      )}
    </div>
  );
}
