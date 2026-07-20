import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { getLearnerProgress, getProgressSummary, updateCourseProgress } from "../utils/progressStorage";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function cardStyle() {
  return {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: `1px solid ${T.border}`,
  };
}

export default function LearnerProgressPage() {
  const navigate = useNavigate();
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

  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);

  const storedProgress = useMemo(() => getLearnerProgress(user?.email), [user?.email]);
  const summary = useMemo(() => getProgressSummary(user?.email), [user?.email]);

  const courseRows = useMemo(() => {
    return (courses || []).map((course) => {
      const progress = storedProgress.courses?.[course.id] || null;
      return {
        id: course.id,
        name: course.name,
        status: progress?.status || "not-started",
        updatedAt: progress?.updatedAt || null,
      };
    });
  }, [courses, storedProgress]);

  const isLoading = learnerLoading || (!!learner && classLoading) || coursesLoading;

  const handleStatusChange = (courseId, courseName, nextStatus) => {
    updateCourseProgress(user?.email, courseId, courseName, nextStatus);
  };

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  if (!learner) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learner profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school to connect your account to a learner record.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Progress</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>Track how your current courses are moving from not started to completed.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <div style={{ ...cardStyle(), padding: "18px 20px" }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent }}>{summary.percent}%</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>Overall completion</p>
        </div>
        <div style={{ ...cardStyle(), padding: "18px 20px" }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent }}>{summary.completed}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>Completed courses</p>
        </div>
        <div style={{ ...cardStyle(), padding: "18px 20px" }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent }}>{summary.inProgress}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>In progress</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate("/learner-portal/courses")} style={{ padding: "10px 18px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Open courses</button>
        <button type="button" onClick={() => navigate("/learner-portal/assessments")} style={{ padding: "10px 18px", backgroundColor: "#FFFBEB", color: "#B45309", border: "1.5px solid #FDE68A", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>View assessments</button>
      </div>

      {courseRows.length === 0 ? (
        <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No courses yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your courses will appear here once your class is assigned a curriculum.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {courseRows.map((course) => (
            <div key={course.id} style={{ ...cardStyle(), padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{course.name}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.inkMuted }}>
                  {course.status === "completed" ? "Completed" : course.status === "in-progress" ? "In progress" : "Not started"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => handleStatusChange(course.id, course.name, "in-progress")} style={{ padding: "8px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1px solid ${T.tintBorder}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Start</button>
                <button type="button" onClick={() => handleStatusChange(course.id, course.name, "completed")} style={{ padding: "8px 12px", backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Complete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
