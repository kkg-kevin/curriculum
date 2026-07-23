import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCoursesForGrades } from "../../curriculum/hooks/useCurriculumVersion";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";

export default function CourseContentPage() {
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
        <CourseCatalogGrid role="teacher" courses={courses || []} />
      )}
    </div>
  );
}
