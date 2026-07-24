import { useMemo } from "react";
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoStories as AutoStoriesIcon,
  MenuBook as MenuBookIcon,
  PeopleAlt as PeopleAltIcon,
  School as SchoolIcon,
  SchoolOutlined as SchoolOutlinedIcon,
} from "@mui/icons-material";
import { FiAlertCircle } from "react-icons/fi";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useCurriculumCoursesByGrade, useCurriculumCurrentCoursesForGrades } from "../../curriculum/hooks/useCurriculumVersion";
import { ATTENDANCE_KEYS } from "../../attendance/hooks/useAttendance";
import { attendanceApi } from "../../attendance/services/attendanceApi";
import Avatar from "../../../components/ui/Avatar";

const ACCENT = "#25476a";
const T = {
  accent: ACCENT, accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};

const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function HeroPill({ icon, value, label, highlight }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14,
        backgroundColor: highlight ? "rgba(254,177,57,0.18)" : "rgba(255,255,255,0.12)",
        border: `1px solid ${highlight ? "rgba(254,177,57,0.4)" : "rgba(255,255,255,0.22)"}`,
        backdropFilter: "blur(6px)",
      }}
    >
      <span style={{ color: highlight ? "#feb139" : "rgba(255,255,255,0.85)", display: "flex" }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  const { data: curriculum } = useCurriculumQuery(selectedHub?.curriculumId);

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn: () => classApi.getAll({ classTeacherId: teacher.id, schoolId: selectedHubId }),
    enabled: !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const gradeNames = [...new Set(myClasses.map((c) => c.gradeName))];

  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, gradeNames);
  const { data: allMyCourses }   = useCurriculumCurrentCoursesForGrades(selectedHub?.curriculumId, gradeNames);

  const totalLearners = myClasses.reduce((sum, c) => sum + (c.learnerCount ?? 0), 0);

  // Real, cheap signal for "needs attention" — which of today's classes still have zero
  // attendance records for today, one lightweight query per class (same query the Attendance
  // page itself uses, just checked across every class instead of one at a time).
  const today = todayStr();
  const attendanceChecks = useQueries({
    queries: myClasses.map((c) => ({
      queryKey: ATTENDANCE_KEYS.byDate(c.id, today),
      queryFn: () => attendanceApi.getByClassDate(c.id, today),
      enabled: !!c.id,
    })),
  });
  const unmarkedClasses = useMemo(
    () => myClasses.filter((c, i) => (c.learnerCount ?? 0) > 0 && attendanceChecks[i]?.data && (attendanceChecks[i].data.data || []).length === 0),
    [myClasses, attendanceChecks]
  );
  const attendanceChecksLoading = attendanceChecks.some((q) => q.isLoading);

  const isLoading = teacherLoading || (!!teacher && classesLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {teacher && <Avatar firstName={teacher.firstName} lastName={teacher.lastName} size={64} borderColor="rgba(255,255,255,0.3)" />}
            <div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
                Welcome back{user?.name ? `, ${user.name}` : ""}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, maxWidth: 560 }}>
                {selectedHub ? (
                  <>
                    {selectedHub.name}
                    {curriculum && <> · {curriculum.name}</>}
                    {curriculum?.publishedAcademicYear && <> · {curriculum.publishedAcademicYear}</>}
                  </>
                ) : "Here's an overview of the classes you teach."}
              </p>
            </div>
          </div>

          {teacher && myClasses.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <HeroPill icon={<AutoStoriesIcon fontSize="small" />} value={myClasses.length} label={`Class${myClasses.length === 1 ? "" : "es"} taught`} />
              <HeroPill icon={<PeopleAltIcon fontSize="small" />} value={totalLearners} label="Learners" />
              <HeroPill icon={<AssignmentTurnedInIcon fontSize="small" />} value={allMyCourses?.length ?? 0} label={`Course${(allMyCourses?.length ?? 0) === 1 ? "" : "s"} to deliver`} />
              <HeroPill icon={<FiAlertCircle size={16} />} value={unmarkedClasses.length} label="Attendance to mark today" highlight={unmarkedClasses.length > 0} />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !teacher ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: T.accent }}><SchoolOutlinedIcon fontSize="large" /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No teacher profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Your account ({user?.email}) isn't linked to a teacher record yet. Ask your school admin to add you as a
            teacher using this same email address.
          </p>
        </div>
      ) : myClasses.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: T.accent }}><MenuBookIcon fontSize="large" /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No classes assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>You're not currently set as the class teacher for any class.</p>
        </div>
      ) : (
        <>
          {!attendanceChecksLoading && unmarkedClasses.length > 0 && (
            <div style={{ ...cardStyle, padding: 20 }}>
              <h2 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: T.accentMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>Needs Your Attention</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {unmarkedClasses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/teacher-portal/attendance?classId=${c.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 8px", borderRadius: 10, borderLeft: "3px solid #feb139" }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", color: "#B45309", flexShrink: 0 }}>
                      <FiAlertCircle size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{c.gradeName} — attendance not marked today</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted }}>{c.learnerCount ?? 0} learner{(c.learnerCount ?? 0) !== 1 ? "s" : ""}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>Mark now →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {myClasses.map((c) => {
              const courseCount = (coursesByGrade?.get(c.gradeName) || []).length;
              return (
                <div key={c.id} style={{ ...cardStyle, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #feb139, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}><SchoolIcon fontSize="small" /></div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: T.ink }}>{c.gradeName}</h3>
                      <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>Academic Year {c.academicYear}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: T.inkMuted, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><PeopleAltIcon fontSize="small" /> {c.learnerCount ?? 0} learner{(c.learnerCount ?? 0) !== 1 ? "s" : ""}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MenuBookIcon fontSize="small" /> {courseCount} course{courseCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "auto" }}>
                    <button type="button" onClick={() => navigate(`/teacher-portal/classes/${c.id}`)} style={{ flex: "1 1 130px", minWidth: 130, padding: "8px 10px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Roster
                    </button>
                    <button type="button" onClick={() => navigate(`/teacher-portal/attendance?classId=${c.id}`)} style={{ flex: "1 1 130px", minWidth: 130, padding: "8px 10px", backgroundColor: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Attendance
                    </button>
                    <button type="button" onClick={() => navigate("/teacher-portal/assessments")} style={{ flex: "1 1 130px", minWidth: 130, padding: "8px 10px", backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1.5px solid #DDD6FE", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                      Assessments
                    </button>
                    <button type="button" onClick={() => navigate("/teacher-portal/course-content")} style={{ flex: "1 1 130px", minWidth: 130, padding: "8px 10px", backgroundColor: "transparent", color: T.inkMuted, border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
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
