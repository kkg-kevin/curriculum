import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { useEducatorProfile } from "../hooks/useEducatorProfile";
import PerformanceProfile from "./PerformanceProfile";
import PublishingCard from "./PublishingCard";

// The performance profile on an educator's page (admins, staff with Educators, the hub, the
// supervisor). `part`: "performance" (the figures — the page's main column) or "publishing" (the
// public profile card — its side column; admins and the supervisor only).
export default function EducatorProfileSection({ teacherId, part = "performance" }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const staff = user?.role === "admin" || user?.role === "collaborator";
  const allowed = user?.role === "supervisor" || user?.role === "school" || (staff && can("teachers", "view"));
  const { data, isLoading, isError } = useEducatorProfile(teacherId, { enabled: allowed });
  if (!allowed) return null;
  if (isLoading) return part === "performance" ? <div style={{ padding: "26px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, background: "#fff", borderRadius: 16, fontFamily: "Inter, sans-serif" }}>Working out their performance…</div> : null;
  if (isError || !data) return null;
  if (part === "publishing") {
    if (data.view !== "manager") return null;
    return <PublishingCard profile={data} teacherId={teacherId} canPublish={user?.role === "admin" || (user?.role === "collaborator" && can("teachers", "edit"))} />;
  }
  return <PerformanceProfile profile={data} teacherId={teacherId} />;
}
