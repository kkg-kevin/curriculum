import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AUTH_ENABLED } from "../config/authConfig";
import AccountSuspendedScreen from "../modules/auth/components/AccountSuspendedScreen";

export default function ProtectedRoute() {
  const { isAuthenticated, loading, suspended } = useAuth();
  const location = useLocation();

  if (!AUTH_ENABLED) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "Inter, sans-serif", color: "#6B7280" }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A logged-in but suspended account: it has a real session, but the entire authenticated app
  // is replaced by one in-app "Account Suspended" screen (with sign-out). Every route below
  // ProtectedRoute — admin, every portal — is short-circuited here, so there's nothing to reach
  // and nothing per-layout to wire up.
  if (suspended) {
    return <AccountSuspendedScreen reason={suspended} />;
  }

  return <Outlet />;
}
