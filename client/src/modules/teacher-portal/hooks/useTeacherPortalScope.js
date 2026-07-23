import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useTeacherHubsQuery } from "../../teachers/hooks/useTeacher";

const STORAGE_KEY = "teacherPortal.selectedHubId";

// Resolves the logged-in teacher, every hub they're assigned to, and which one the portal is
// currently scoped to — called once by TeacherPortalLayout and threaded to every page via
// <Outlet context={...}>/useOutletContext(), so no page repeats this boilerplate individually.
export function useTeacherPortalScope() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: teachersData, isLoading: teacherLoading } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: hubs = [], isLoading: hubsLoading } = useTeacherHubsQuery(teacher?.id);

  const urlHubId = searchParams.get("hub");
  const storedHubId = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  let selectedHubId;
  if (urlHubId && hubs.some((h) => h.id === urlHubId)) selectedHubId = urlHubId;
  else if (storedHubId && hubs.some((h) => h.id === storedHubId)) selectedHubId = storedHubId;
  else selectedHubId = hubs[0]?.id;

  const selectedHub = hubs.find((h) => h.id === selectedHubId) || null;

  const setSelectedHubId = (hubId) => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, hubId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("hub", hubId);
      return next;
    });
  };

  const hasNoHubs = !teacherLoading && !hubsLoading && !!teacher && hubs.length === 0;

  return { teacher, teacherLoading, hubs, hubsLoading, selectedHub, selectedHubId, setSelectedHubId, hasNoHubs };
}
