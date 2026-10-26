import { useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";

// The learner-portal pages are also shown inside the parent portal, for one child
// (ParentChildLayout passes `portalBase`, e.g. /parent/children/<id>). This navigate sends their
// /learner-portal/… links to the same place under that base instead; in the learner portal itself
// it's plain navigate.
export function usePortalNavigate() {
  const navigate = useNavigate();
  const { portalBase } = useOutletContext() || {};
  return useCallback(
    (to, options) => navigate(typeof to === "string" && portalBase ? to.replace(/^\/learner-portal/, portalBase) : to, options),
    [navigate, portalBase]
  );
}
