// Single switch for whether login/role enforcement is active.
// Everything else (LoginPage, SignupPage, AuthContext, ProtectedRoute, RoleRoute)
// stays fully wired up — flip this back to false to bypass the gate for local work.
export const AUTH_ENABLED = true;
