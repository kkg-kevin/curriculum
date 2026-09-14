import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AUTH_ENABLED } from "../config/authConfig";

// A collaborator (see server/src/db/migrations/20260914090000_add_collaborator_role.js) works
// inside the SAME admin shell as the admin who invited them — the server aliases their role to
// "admin" for every non-delete request (scope.middleware.js's attachOwnRecords), scoped to that
// admin's own tenant, so they land on the same home and see the same routes.
export const ROLE_HOME = { admin: "/", collaborator: "/", school: "/school-portal", teacher: "/teacher-portal", learner: "/learner-portal", curriculumAdmin: "/curriculum" };

// Nests inside ProtectedRoute — runs only once a user is known, and bounces
// a role that doesn't belong on this branch back to its own portal home.
export default function RoleRoute({ allow }) {
  const { user } = useAuth();

  if (!AUTH_ENABLED) {
    return <Outlet />;
  }

  if (!allow.includes(user?.role)) {
    return <Navigate to={ROLE_HOME[user?.role] || "/login"} replace />;
  }

  return <Outlet />;
}
