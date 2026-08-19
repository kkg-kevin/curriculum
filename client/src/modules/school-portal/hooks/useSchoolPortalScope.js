import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { learningHubApi } from "../../learning-hubs/services/learningHubApi";
import { setActiveHubId } from "../utils/activeHub";

const STORAGE_KEY = "schoolPortal.selectedHubId";

// Resolves the logged-in school account's own hub plus any branch hubs under it, and which one
// the portal is currently scoped to — called once by SchoolPortalLayout and threaded to every
// page via <Outlet context={...}>/useOutletContext(), so no page repeats this boilerplate
// individually. Mirrors useTeacherPortalScope.js's shape exactly; the resolved selectedHubId is
// also mirrored into localStorage under a separate key (see activeHub.js) for api.js's
// X-Active-Hub-Id request interceptor to read, since that header is what actually makes the
// server treat a branch hub as "your own hub" once switched to (see scope.middleware.js).
export function useSchoolPortalScope() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // GET /learning-hubs/mine already resolves server-side to [ownHub, ...branchHubs] off the
  // caller's email (see learning-hub.controller.js's getMyLearningHubs) — no separate "own hub"
  // query needed the way teacher-portal needs one for the teacher record itself.
  const { data: hubsData, isLoading: hubsLoading } = useQuery({
    queryKey: ["schools", "mine", user?.email],
    queryFn: () => learningHubApi.getMine(),
    enabled: !!user?.email,
  });
  const hubs = hubsData || [];

  const urlHubId = searchParams.get("hub");
  const storedHubId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  let selectedHubId;
  if (urlHubId && hubs.some((h) => h.id === urlHubId)) selectedHubId = urlHubId;
  else if (storedHubId && hubs.some((h) => h.id === storedHubId)) selectedHubId = storedHubId;
  else selectedHubId = hubs[0]?.id;

  const selectedHub = hubs.find((h) => h.id === selectedHubId) || null;
  // Keeps api.js's X-Active-Hub-Id header in sync with whatever this render resolved — covers
  // first load (no explicit switch yet) as well as an actual switch below.
  if (typeof window !== "undefined" && selectedHubId) setActiveHubId(selectedHubId);

  const setSelectedHubId = (hubId) => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, hubId);
    setActiveHubId(hubId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("hub", hubId);
      return next;
    });
  };

  const hasNoHub = !hubsLoading && hubs.length === 0;

  return { school: selectedHub, hubs, hubsLoading, selectedHub, selectedHubId, setSelectedHubId, hasNoHub, email: user?.email || null };
}
