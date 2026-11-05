import { Navigate, Outlet, useLocation } from "react-router-dom";
import { justSwitchedRole, useAuth } from "../context/AuthContext";
import { AUTH_ENABLED } from "../config/authConfig";
import TotLearnerHandoff, { learnerPortalPathFor } from "../modules/tot/components/TotLearnerHandoff";

// A collaborator (see server/src/db/migrations/20260914090000_add_collaborator_role.js) works
// inside the SAME admin shell as the admin who invited them — the server aliases their role to
// "admin" for every non-delete request (scope.middleware.js's attachOwnRecords), scoped to that
// admin's own tenant, so they land on the same home and see the same routes.
export const ROLE_HOME = { admin: "/", collaborator: "/", school: "/school-portal", hubLead: "/school-portal/checkins", totLearner: "/learner-portal", teacher: "/teacher-portal", learner: "/learner-portal", curriculumAdmin: "/curriculum", supervisor: "/supervisor-portal" };

// Nests inside ProtectedRoute — runs only once a user is known, and bounces
// a role that doesn't belong on this branch back to its own portal home.
export default function RoleRoute({ allow }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!AUTH_ENABLED) {
    return <Outlet />;
  }

  if (!allow.includes(user?.role)) {
    // An educator in training signed in as Educator, following a link into their own learning
    // (/learner-portal/…): their TOT learner sign-in opens it (TotLearnerHandoff).
    // (Not for a moment after switching role in this tab — the old role's page is still on screen.)
    if (user?.role === "teacher" && location.pathname.startsWith("/learner-portal") && (user.roles || []).includes("totLearner") && !justSwitchedRole()) {
      return <TotLearnerHandoff />;
    }
    // Already a TOT learner: an old "My learning" address opens the same page here.
    if (user?.totLearner && location.pathname.startsWith("/teacher-portal/learning")) {
      return <Navigate to={learnerPortalPathFor(location.pathname, location.search)} replace />;
    }
    return <Navigate to={ROLE_HOME[user?.role] || "/login"} replace />;
  }

  return <Outlet />;
}
