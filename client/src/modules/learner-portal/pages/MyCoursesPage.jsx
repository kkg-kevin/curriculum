import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import CourseCatalogGrid from "../../courses/components/CourseCatalogGrid";

export default function MyCoursesPage() {
  const { user } = useAuth();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: cls, isLoading: classLoading } = useQuery({
    queryKey: ["classes", "detail", learner?.classId],
    queryFn: () => classApi.getById(learner.classId),
    enabled: !!learner?.classId,
  });

  const { data: courses, isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);

  const isLoading = learnerLoading || (!!learner && classLoading);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>
            My Courses
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", maxWidth: "560px" }}>
            Browse the courses your class is following this year.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !learner ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No learner profile linked yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask your school to record this same email address as your guardian email.</p>
        </div>
      ) : !cls?.curriculumId ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No curriculum assigned yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Your school hasn't been assigned a curriculum yet.</p>
        </div>
      ) : coursesLoading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : (
        <CourseCatalogGrid role="learner" courses={courses || []} />
      )}
    </div>
  );
}
