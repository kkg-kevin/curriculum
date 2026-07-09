import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ROLE_HOME = { admin: "/", school: "/school-portal", teacher: "/teacher-portal", learner: "/learner-portal" };

// Nests inside ProtectedRoute — runs only once a user is known, and bounces
// a role that doesn't belong on this branch back to its own portal home.
export default function RoleRoute({ allow }) {
  const { user } = useAuth();

  if (!allow.includes(user?.role)) {
    return <Navigate to={ROLE_HOME[user?.role] || "/login"} replace />;
  }

  return <Outlet />;
}
