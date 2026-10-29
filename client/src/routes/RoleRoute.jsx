import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AUTH_ENABLED } from "../config/authConfig";

// A collaborator (see server/src/db/migrations/20260914090000_add_collaborator_role.js) works
// inside the SAME admin shell as the admin who invited them — the server aliases their role to
// "admin" for every non-delete request (scope.middleware.js's attachOwnRecords), scoped to that
// admin's own tenant, so they land on the same home and see the same routes.
export const ROLE_HOME = { admin: "/", collaborator: "/", school: "/school-portal", hubLead: "/school-portal/checkins", teacher: "/teacher-portal", learner: "/learner-portal", curriculumAdmin: "/curriculum", supervisor: "/supervisor-portal" };

// Nests inside ProtectedRoute — runs only once a user is known, and bounces
// a role that doesn't belong on this branch back to its own portal home.
export default function RoleRoute({ allow }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!AUTH_ENABLED) {
    return <Outlet />;
  }

  if (!allow.includes(user?.role)) {
    // An educator's own learning lives in the teacher portal (/teacher-portal/learning): the
    // learner-portal pages it reuses link to /learner-portal/…, which lands there instead.
    if (user?.role === "teacher" && location.pathname.startsWith("/learner-portal")) {
      return <Navigate to={`${location.pathname.replace(/^\/learner-portal/, "/teacher-portal/learning")}${location.search}`} replace />;
    }
    return <Navigate to={ROLE_HOME[user?.role] || "/login"} replace />;
  }

  return <Outlet />;
}
