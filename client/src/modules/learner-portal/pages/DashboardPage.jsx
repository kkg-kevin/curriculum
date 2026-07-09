import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { schoolApi } from "../../schools/services/schoolApi";

const ACCENT = "#25476a";

const TILES = [
  { label: "My Courses",  icon: "📚", path: "/learner-portal/courses" },
  { label: "Assessments", icon: "📝", path: "/learner-portal/assessments" },
  { label: "Progress",    icon: "📈", path: "/learner-portal/progress" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: cls } = useQuery({
    queryKey: ["classes", "detail", learner?.classId],
    queryFn: () => classApi.getById(learner.classId),
    enabled: !!learner?.classId,
  });

  const { data: school } = useQuery({
    queryKey: ["schools", "detail", cls?.schoolId],
    queryFn: () => schoolApi.getById(cls.schoolId),
    enabled: !!cls?.schoolId,
  });

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Welcome back{learner?.firstName ? `, ${learner.firstName}` : ""}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
            {cls ? `${cls.gradeName} · ${school?.name || "…"}` : "Here's an overview of your learning."}
          </p>
        </div>
      </div>

      {learnerLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !learner ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🎓</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No learner profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a learner profile yet. Ask your school to record this same
            email address as the guardian email on your learner record.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {TILES.map((t) => (
            <div
              key={t.label}
              onClick={() => navigate(t.path)}
              style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ACCENT }}>{t.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
