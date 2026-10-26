import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { useLearnerMentors } from "./useLearnerMentors";
import { useLearnerHubsQuery } from "../../learners/hooks/useLearners";
import { getActiveLearnerId, setActiveLearnerId } from "../utils/activeLearner";
import { homeLearningApi } from "../../home-learning/services/homeLearningApi";

const STORAGE_KEY = "learnerPortal.selectedHubId";

// Resolves the logged-in guardian's learner record, every hub they're enrolled at, and which
// one the portal is currently scoped to — called once by LearnerPortalLayout and threaded to
// every page via <Outlet context={...}>/useOutletContext(), mirroring
// useTeacherPortalScope so a learner enrolled at several hubs (each possibly running a
// different curriculum) can switch which one their courses/competencies/assessments reflect.
export function useLearnerPortalScope() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // A learner's own dedicated login (see auth.service.js's setOrCreatePasswordByUsername) has no
  // email at all — the server ignores this guardianEmail param for that login anyway (scoped
  // server-side off req.ownLearner instead), but the query must still be enabled and keyed
  // distinctly for it, or a username-only login would never fetch its own record at all.
  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email, user?.username],
    queryFn: () => learnerApi.getAll(user?.email ? { guardianEmail: user.email } : {}),
    enabled: !!(user?.email || user?.username),
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
  const { data: homeEnrollments = [], isLoading: homeLearningLoading } = useQuery({
    queryKey: ["home-learning", "learner", learner?.id],
    queryFn: () => homeLearningApi.getForLearner(learner.id),
    enabled: !!learner?.id,
  });
  const activeHomeEnrollment = homeEnrollments.find((enrollment) => enrollment.status === "active" && enrollment.curriculumId) || null;

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

  const { mentors, mentorsLoading } = useLearnerMentors(hubs, activeHomeEnrollment?.educator || null);

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
    homeEnrollments,
    activeHomeEnrollment,
    homeLearningLoading,
    selectedHub,
    selectedHubId,
    setSelectedHubId,
    cls,
    hasNoHubs,
    mentors,
    mentorsLoading,
    isLoading: learnerLoading || (!!learner && (hubsLoading || homeLearningLoading)),
  };
}
