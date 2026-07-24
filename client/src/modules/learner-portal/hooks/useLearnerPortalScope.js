import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useLearnerHubsQuery } from "../../learners/hooks/useLearners";

const STORAGE_KEY = "learnerPortal.selectedHubId";

// Resolves the logged-in guardian's learner record, every hub they're enrolled at, and which
// one the portal is currently scoped to — called once by LearnerPortalLayout and threaded to
// every page via <Outlet context={...}>/useOutletContext(), mirroring
// useTeacherPortalScope so a learner enrolled at several hubs (each possibly running a
// different curriculum) can switch which one their courses/competencies/assessments reflect.
export function useLearnerPortalScope() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  const { data: hubs = [], isLoading: hubsLoading } = useLearnerHubsQuery(learner?.id);

  const urlHubId = searchParams.get("hub");
  const storedHubId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  let selectedHubId;
  if (urlHubId && hubs.some((h) => h.id === urlHubId)) selectedHubId = urlHubId;
  else if (storedHubId && hubs.some((h) => h.id === storedHubId)) selectedHubId = storedHubId;
  else selectedHubId = (hubs.find((h) => h.status === "active") || hubs[0])?.id;

  const selectedHub = hubs.find((h) => h.id === selectedHubId) || null;
  const cls = selectedHub?.class || null;

  const setSelectedHubId = (hubId) => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, hubId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("hub", hubId);
      return next;
    });
  };

  // "My Teachers & Mentors" resolves each hub's class teacher — real data via a small join,
  // not a fabricated mentor list. Hubs with no class teacher assigned are simply omitted.
  // Deliberately built from the FULL hub list, not just selectedHub — this list is meant to
  // stay unscoped (every hub's teacher), same as the hub list itself.
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

  const hasNoHubs = !learnerLoading && !hubsLoading && !!learner && hubs.length === 0;

  return {
    user,
    learner,
    learnerLoading,
    hubs,
    hubsLoading,
    selectedHub,
    selectedHubId,
    setSelectedHubId,
    cls,
    hasNoHubs,
    mentors,
    mentorsLoading: teacherIds.length > 0 && mentorTeachersLoading,
    isLoading: learnerLoading || (!!learner && hubsLoading),
  };
}
