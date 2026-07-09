import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { schoolApi } from "../../schools/services/schoolApi";
import { classApi } from "../../classes/services/classApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { learnerApi } from "../../learners/services/learnerApi";

const ACCENT = "#25476a";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: schoolsData, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;

  const { data: classesData }  = useQuery({ queryKey: ["classes", "bySchool", school?.id],  queryFn: () => classApi.getAll({ schoolId: school.id }),  enabled: !!school?.id });
  const { data: teachersData } = useQuery({ queryKey: ["teachers", "bySchool", school?.id], queryFn: () => teacherApi.getAll({ schoolId: school.id }), enabled: !!school?.id });
  const { data: learnersData } = useQuery({ queryKey: ["learners", "bySchool", school?.id], queryFn: () => learnerApi.getAll({ schoolId: school.id }), enabled: !!school?.id });

  const classCount   = classesData?.data?.length  ?? 0;
  const teacherCount = teachersData?.data?.length ?? 0;
  const learnerCount = learnersData?.data?.length ?? 0;

  const tiles = school ? [
    { label: "Classes",  count: classCount,   icon: "📚", path: `/school-portal/classes/${school.id}` },
    { label: "Teachers", count: teacherCount, icon: "👩‍🏫", path: `/school-portal/teachers/${school.id}` },
    { label: "Learners", count: learnerCount, icon: "🎓", path: `/school-portal/learners/${school.id}` },
  ] : [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            {school ? school.name : `Welcome back${user?.name ? `, ${user.name}` : ""}`}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
            {school ? "Here's an overview of your school." : "Here's an overview of your school."}
          </p>
        </div>
      </div>

      {schoolLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !school ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No school profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a school yet. Ask a platform admin to add this school using
            this same email address as its contact email.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {tiles.map((t) => (
            <div
              key={t.label}
              onClick={() => navigate(t.path)}
              style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{t.count}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>{t.label} · Manage →</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
