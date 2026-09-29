import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";

// Staff roles (Settings → Roles & access). A staff account (role "collaborator") carries
// `permissions` — { moduleKey: ["view","create","edit","delete"] } — on the user from login and
// GET /api/auth/me; the server enforces the same permissions on every request
// (scope.middleware.js), so this only shapes what the UI offers.
//
// Everyone else (the workspace owner, and the portal roles whose access is decided elsewhere)
// is unaffected: can() is always true for them.
export function can(user, module, action = "view") {
  if (!user || user.role !== "collaborator") return true;
  return Boolean(user.permissions?.[module]?.includes(action));
}

// True when the user can view at least one of the modules (e.g. Events = competitions or bootcamps).
export function canViewAny(user, modules) {
  return (Array.isArray(modules) ? modules : [modules]).some((m) => can(user, m, "view"));
}

export const isStaff = (user) => user?.role === "collaborator";

export function usePermissions() {
  const { user } = useAuth();
  const check = useCallback((module, action = "view") => can(user, module, action), [user]);
  return { can: check, isStaff: isStaff(user) };
}
