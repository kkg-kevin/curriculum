import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { classApi } from "../../classes/services/classApi";
import { useLearnerHubsQuery } from "../../learners/hooks/useLearners";
import { getActiveLearnerId, setActiveLearnerId } from "../utils/activeLearner";

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
  const learners = learnersData?.data || [];

  // A guardian can have more than one learner linked to their email (siblings) — resolved with
  // the same URL-param + localStorage pattern as selectedHubId below, but on its own `child`
  // param so switching hub and switching child are independent choices.
  const urlLearnerId = searchParams.get("child");
  const storedLearnerId = getActiveLearnerId();

  let selectedLearnerId;
  if (urlLearnerId && learners.some((l) => l.id === urlLearnerId)) selectedLearnerId = urlLearnerId;
  else if (storedLearnerId && learners.some((l) => l.id === storedLearnerId)) selectedLearnerId = storedLearnerId;
  else selectedLearnerId = learners[0]?.id;

  const learner = learners.find((l) => l.id === selectedLearnerId) || learners[0] || null;

  // The one place that writes the active child — persisted via activeLearner.js (read by the
  // axios interceptor on every request, see api.js) and mirrored into the URL so a shared/
  // bookmarked link keeps working.
  const setSelectedLearnerId = (learnerId) => {
    setActiveLearnerId(learnerId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("child", learnerId);
      return next;
    });
  };

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

  // "My Teachers & Mentors" resolves every educator assigned to any course in each hub's
  // class — real data via a small join, not a fabricated mentor list. A class can now have
  // more than one educator (assigned per course), so this naturally becomes a richer list than
  // the old single-class-teacher lookup. Hubs with no educators assigned are simply omitted.
  // Deliberately built from the FULL hub list, not just selectedHub — this list is meant to
  // stay unscoped (every hub's educators), same as the hub list itself.
  const classIds = useMemo(() => [...new Set(hubs.map((h) => h.class?.id).filter(Boolean))], [hubs]);
  const { data: mentorLinks = [], isLoading: mentorLinksLoading } = useQuery({
    queryKey: ["learner-mentor-links", classIds],
    queryFn: () => Promise.all(classIds.map((id) => classApi.getCourseTeachers(id))).then((r) => r.flat()),
    enabled: classIds.length > 0,
  });
  const mentors = useMemo(() => {
    const seen = new Set();
    const result = [];
    hubs.forEach((h) => {
      if (!h.class?.id) return;
      const links = mentorLinks.filter((l) => l.classId === h.class.id);
      const uniqueTeacherIds = [...new Set(links.map((l) => l.teacherId))];
      uniqueTeacherIds.forEach((teacherId) => {
        const key = `${h.id}:${teacherId}`;
        if (seen.has(key)) return;
        seen.add(key);
        const link = links.find((l) => l.teacherId === teacherId);
        if (link?.teacher) result.push({ teacher: link.teacher, hubName: h.name });
      });
    });
    return result;
  }, [hubs, mentorLinks]);

  const hasNoHubs = !learnerLoading && !hubsLoading && !!learner && hubs.length === 0;

  return {
    user,
    learner,
    learners,
    selectedLearnerId,
    setSelectedLearnerId,
    learnerLoading,
    hubs,
    hubsLoading,
    selectedHub,
    selectedHubId,
    setSelectedHubId,
    cls,
    hasNoHubs,
    mentors,
    mentorsLoading: classIds.length > 0 && mentorLinksLoading,
    isLoading: learnerLoading || (!!learner && hubsLoading),
  };
}
