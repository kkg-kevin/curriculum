import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { teacherApi } from "../../teachers/services/teacherApi";
import { classApi } from "../../classes/services/classApi";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useCurriculumCoursesByGrade, useCurriculumCurrentCoursesForGrades } from "../../curriculum/hooks/useCurriculumVersion";

const ACCENT = "#25476a";
const T = {
  accent: ACCENT, accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};

const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function KpiTile({ icon, num, label }) {
  return (
    <div style={{ ...cardStyle, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: T.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{num}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: teachersData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ["schools", "detail", teacher?.schoolId],
    queryFn: () => schoolApi.getById(teacher.schoolId),
    enabled: !!teacher?.schoolId,
  });

  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "bySchool", teacher?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: teacher.schoolId }),
    enabled: !!teacher?.schoolId,
  });
  const myClasses = (classesData?.data || []).filter((c) => c.classTeacherId === teacher?.id);
  const gradeNames = [...new Set(myClasses.map((c) => c.gradeName))];

  const { data: coursesByGrade } = useCurriculumCoursesByGrade(school?.curriculumId, gradeNames);
  const { data: allMyCourses }   = useCurriculumCurrentCoursesForGrades(school?.curriculumId, gradeNames);

  const totalLearners = myClasses.reduce((sum, c) => sum + (c.learnerCount ?? 0), 0);

  const isLoading = teacherLoading || (!!teacher && (schoolLoading || classesLoading));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
            Welcome back{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, maxWidth: 560 }}>
            {school ? (
              <>
                {school.name}
                {curriculum && <> · {curriculum.name}</>}
                {curriculum?.publishedAcademicYear && <> · {curriculum.publishedAcademicYear}</>}
              </>
            ) : "Here's an overview of the classes you teach."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !teacher ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>👩‍🏫</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No teacher profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a teacher record yet. Ask your school admin to add you as a
            teacher using this same email address.
          </p>
        </div>
      ) : myClasses.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>📚</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No classes assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>You're not currently set as the class teacher for any class.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <KpiTile icon="📚" num={myClasses.length} label={`Class${myClasses.length === 1 ? "" : "es"} taught`} />
            <KpiTile icon="🎓" num={totalLearners} label="Learners" />
            <KpiTile icon="🧩" num={allMyCourses?.length ?? 0} label={`Course${(allMyCourses?.length ?? 0) === 1 ? "" : "s"} to deliver`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {myClasses.map((c) => {
              const courseCount = (coursesByGrade?.get(c.gradeName) || []).length;
              return (
                <div key={c.id} style={{ ...cardStyle, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #feb139, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎓</div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: T.ink }}>{c.gradeName}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>Academic Year {c.academicYear}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: T.inkMuted, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                    <span>👥 {c.learnerCount ?? 0} learner{(c.learnerCount ?? 0) !== 1 ? "s" : ""}</span>
                    <span>📖 {courseCount} course{courseCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <button type="button" onClick={() => navigate(`/teacher-portal/classes/${c.id}`)} style={{ flex: 1, padding: "8px 10px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Roster
                    </button>
                    <button type="button" onClick={() => navigate(`/teacher-portal/attendance?classId=${c.id}`)} style={{ flex: 1, padding: "8px 10px", backgroundColor: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Attendance
                    </button>
                    <button type="button" onClick={() => navigate("/teacher-portal/assessments")} style={{ flex: 1, padding: "8px 10px", backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1.5px solid #DDD6FE", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Assessments
                    </button>
                    <button type="button" onClick={() => navigate("/teacher-portal/course-content")} style={{ flex: 1, padding: "8px 10px", backgroundColor: "transparent", color: T.inkMuted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Courses
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
