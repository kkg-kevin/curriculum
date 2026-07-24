import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { FiBookOpen, FiLayers, FiUsers } from "react-icons/fi";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCoursesForGrades, useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";

const T = { accent: "#25476a", accentMid: "#2e7db5", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", border: "#E5E7EB" };

function cardStyle() {
  return { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` };
}

// Same "Viewing: ___" pattern as the hub switcher — a clean dropdown instead of stacking
// every class's courses one after another, which gets long once a teacher has more than one.
function ClassSwitcher({ classes, selectedClassId, onChange }) {
  if (!classes || classes.length <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.inkMuted, fontFamily: "Inter, sans-serif" }}>Viewing:</span>
      <select
        value={selectedClassId || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 30px 8px 12px", borderRadius: 10, border: `1.5px solid ${T.tintBorder}`,
          backgroundColor: T.tintBg, color: T.accent, fontSize: 13, fontWeight: 700,
          fontFamily: "Inter, sans-serif", cursor: "pointer", appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2325476a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        }}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.gradeName}</option>
        ))}
      </select>
    </div>
  );
}

function StatTile({ icon, value, label }) {
  return (
    <div style={{ ...cardStyle(), padding: "18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: T.tintBg, display: "grid", placeItems: "center", color: T.accent, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.accent }}>{value}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{label}</p>
      </div>
    </div>
  );
}

export default function CourseContentPage() {
  const navigate = useNavigate();
  const { teacher, teacherLoading, selectedHub, selectedHubId } = useOutletContext();

  // A curriculum's courses are assigned per grade (see Curriculum Version Control) — so a
  // teacher only ever sees the courses for the grade(s) of the class(es) they're the class
  // teacher for at the currently selected hub, not every course in the hub's curriculum.
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["classes", "byTeacherHub", teacher?.id, selectedHubId],
    queryFn: () => classApi.getAll({ classTeacherId: teacher.id, schoolId: selectedHubId }),
    enabled: !!teacher?.id && !!selectedHubId,
  });
  const myClasses = classesData?.data || [];
  const myGradeNames = [...new Set(myClasses.map((c) => c.gradeName))];

  const { data: courses, isLoading: coursesLoading } = useCurriculumCurrentCoursesForGrades(selectedHub?.curriculumId, myGradeNames);
  const { data: coursesByGrade } = useCurriculumCoursesByGrade(selectedHub?.curriculumId, myGradeNames);

  const totalLearners = useMemo(() => myClasses.reduce((sum, c) => sum + (c.learnerCount ?? 0), 0), [myClasses]);

  const [selectedClassId, setSelectedClassId] = useState(null);
  useEffect(() => {
    if (!selectedClassId && myClasses.length > 0) setSelectedClassId(myClasses[0].id);
  }, [myClasses, selectedClassId]);
  const selectedClass = myClasses.find((c) => c.id === selectedClassId) || myClasses[0] || null;
  const selectedClassCourses = selectedClass ? (coursesByGrade?.get(selectedClass.gradeName) || []) : [];

  const isLoading = teacherLoading || (!!teacher && classesLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>
            Course Content
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", maxWidth: "560px" }}>
            Browse the curriculum content your class follows.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !teacher ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No teacher profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask your school admin to add you as a teacher using this same email address.</p>
        </div>
      ) : !selectedHub?.curriculumId ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No curriculum assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>This hub hasn't been assigned a curriculum yet.</p>
        </div>
      ) : myClasses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No classes assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Course content follows your assigned class's grade — ask your school admin to set you as a class teacher.</p>
        </div>
      ) : coursesLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <StatTile icon={<FiBookOpen size={18} />} value={(courses || []).length} label="Courses assigned" />
            <StatTile icon={<FiLayers size={18} />} value={myClasses.length} label="Classes covered" />
            <StatTile icon={<FiUsers size={18} />} value={totalLearners} label="Total learners" />
          </div>

          <ClassSwitcher classes={myClasses} selectedClassId={selectedClass?.id} onChange={setSelectedClassId} />

          {selectedClass && (
            <div style={{ ...cardStyle(), padding: 20 }}>
              <div
                onClick={() => navigate(`/teacher-portal/classes/${selectedClass.id}`)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 16 }}
              >
                <div>
                  <h2 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: T.ink }}>{selectedClass.gradeName}</h2>
                  <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted }}>{selectedClass.learnerCount ?? 0} learner{(selectedClass.learnerCount ?? 0) !== 1 ? "s" : ""} · View roster →</p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>
                  {selectedClassCourses.length} course{selectedClassCourses.length !== 1 ? "s" : ""}
                </span>
              </div>
              <CourseCatalogGrid role="teacher" courses={selectedClassCourses} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
