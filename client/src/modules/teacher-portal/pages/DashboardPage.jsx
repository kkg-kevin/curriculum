import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { teacherApi } from "../../teachers/services/teacherApi";
import { classApi } from "../../classes/services/classApi";

const ACCENT = "#25476a";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: teachersData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", teacher?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: teacher.schoolId }),
    enabled: !!teacher?.schoolId,
  });
  const myClasses = (classesData?.data || []).filter((c) => c.classTeacherId === teacher?.id);

  const isLoading = teacherLoading || (!!teacher && classesLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "560px" }}>
            Here's an overview of the classes you teach.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !teacher ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>👩‍🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No teacher profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a teacher record yet. Ask your school admin to add you as a
            teacher using this same email address.
          </p>
        </div>
      ) : myClasses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>📚</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No classes assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>You're not currently set as the class teacher for any class.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {myClasses.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/teacher-portal/classes/${c.id}`)}
              style={{ backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "20px 22px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #feb139, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎓</div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "#111827" }}>{c.gradeName}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{c.academicYear}</p>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>View roster →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
