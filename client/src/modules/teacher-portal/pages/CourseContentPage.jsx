import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiBookOpen, FiChevronDown, FiChevronUp, FiLayers, FiUser, FiUsers } from "react-icons/fi";
import { School as SchoolIcon } from "@mui/icons-material";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCoursesForGrades, useCurriculumCoursesByGrade } from "../../curriculum/hooks/useCurriculumVersion";
import { courseHomePath } from "../../../routes/portalPaths";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";

const T = { accent: "#25476a", accentMid: "#2e7db5", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };

function cardStyle() {
  return { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` };
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

function CourseMiniRow({ course, navigate }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: T.tintBg, flexShrink: 0, overflow: "hidden" }}>
        {course.coverImage && <img src={course.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {stripHtml(course.description) || "No description added"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate(courseHomePath("teacher", course.id))}
        style={{ background: "none", border: "none", color: T.accentMid, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
      >
        Open →
      </button>
    </div>
  );
}

function ClassCard({ cls, courses, teacherName, isOpen, onToggleOpen, showFullCatalog, onToggleFullCatalog, navigate }) {
  return (
    <div style={{ ...cardStyle(), overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: "linear-gradient(90deg, #25476a, #2e7db5, #38aae1)" }} />
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
              <SchoolIcon fontSize="small" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cls.gradeName}</h3>
              <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>1 class</p>
            </div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.accent, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 20, padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap" }}>
            {courses.length} course{courses.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${T.border}`, paddingTop: 10, fontSize: 12.5, color: T.inkMuted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><FiUsers size={13} /> {cls.learnerCount ?? 0} learner{(cls.learnerCount ?? 0) !== 1 ? "s" : ""}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><FiUser size={13} /> {teacherName}</span>
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 10, color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          Courses {isOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
        </button>

        {isOpen && (
          showFullCatalog ? (
            <CourseCatalogGrid role="teacher" courses={courses} />
          ) : courses.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "8px 0" }}>No courses for this grade yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {courses.map((c, i) => (
                <div key={c.id} style={{ borderTop: i > 0 ? `1px solid #F3F4F6` : "none" }}>
                  <CourseMiniRow course={c} navigate={navigate} />
                </div>
              ))}
            </div>
          )
        )}

        {isOpen && courses.length > 0 && (
          <button
            type="button"
            onClick={onToggleFullCatalog}
            style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.inkMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, marginTop: -4 }}
          >
            {showFullCatalog ? "View as compact list ←" : "View as full catalog →"}
          </button>
        )}
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

  const [openClassIds, setOpenClassIds] = useState(() => new Set(myClasses.map((c) => c.id)));
  const [fullCatalogClassIds, setFullCatalogClassIds] = useState(() => new Set());
  const toggleOpen = (id) => setOpenClassIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleFullCatalog = (id) => setFullCatalogClassIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "";

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
            {myClasses.map((cls) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                courses={coursesByGrade?.get(cls.gradeName) || []}
                teacherName={teacherName}
                isOpen={openClassIds.has(cls.id)}
                onToggleOpen={() => toggleOpen(cls.id)}
                showFullCatalog={fullCatalogClassIds.has(cls.id)}
                onToggleFullCatalog={() => toggleFullCatalog(cls.id)}
                navigate={navigate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
