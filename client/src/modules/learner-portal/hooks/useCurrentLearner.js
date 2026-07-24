import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useLearnerHubsQuery } from "../../learners/hooks/useLearners";

// Resolves the logged-in guardian's learner record, their hub enrollments, and their class
// teacher(s) — the same context (learner/hubs/mentors) every learner-portal page ends up
// needing. A learner can be enrolled at several hubs now — the first active enrollment is used
// as the "current" context for curriculum-scoped data, same default used everywhere else.
export function useCurrentLearner() {
  const { user } = useAuth();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: hubs = [], isLoading: hubsLoading } = useLearnerHubsQuery(learner?.id);
  const primary = hubs.find((h) => h.status === "active") || hubs[0] || null;
  const cls = primary?.class || null;
  const school = primary || null;

  // "My Teachers & Mentors" resolves each hub's class teacher — real data via a small join,
  // not a fabricated mentor list. Hubs with no class teacher assigned are simply omitted.
  const teacherIds = useMemo(
    () => [...new Set(hubs.map((h) => h.class?.classTeacherId).filter(Boolean))],
    [hubs]
  );
  const { data: mentorTeachers = [], isLoading: mentorTeachersLoading } = useQuery({
    queryKey: ["learner-mentor-teachers", teacherIds],
    queryFn: () => Promise.all(teacherIds.map((id) => teacherApi.getById(id))),
    enabled: teacherIds.length > 0,
  });
  const mentors = useMemo(
    () => hubs
      .filter((h) => h.class?.classTeacherId)
      .map((h) => {
        const teacher = mentorTeachers.find((t) => t.id === h.class.classTeacherId);
        return teacher ? { teacher, hubName: h.name } : null;
      })
      .filter(Boolean),
    [hubs, mentorTeachers]
  );

  return {
    user,
    learner,
    learnerLoading,
    hubs,
    hubsLoading,
    primary,
    cls,
    school,
    mentors,
    mentorsLoading: teacherIds.length > 0 && mentorTeachersLoading,
    isLoading: learnerLoading || (!!learner && hubsLoading),
  };
}
