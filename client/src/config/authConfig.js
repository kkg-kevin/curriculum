// Single switch for whether login/role enforcement is active.
// Everything else (LoginPage, SignupPage, AuthContext, ProtectedRoute, RoleRoute)
// stays fully wired up — flipping this back to true re-enables the gate with no
// further changes needed.
export const AUTH_ENABLED = false;
