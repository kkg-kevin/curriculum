import { useLayoutEffect, useState } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import HubSwitcher from "../../../components/ui/HubSwitcher";
import { T } from "../../learner-portal/components/profile/theme";
import { useLearnerPortalScope } from "../../learner-portal/hooks/useLearnerPortalScope";
import { setActiveLearnerId } from "../../learner-portal/utils/activeLearner";
import { childPath } from "../parentPaths";

// One child, seen by their parent (/parent/children/:childId): the child's learner profile, exactly
// as the learner portal shows it (the sidebar lists every child to move between). The
// learner-portal pages and data hooks are reused, scoped to this child the way the learner portal
// scopes them — the X-Active-Learner-Id header (activeLearner.js) — and given `viewOnly` and
// `portalBase` so they link within the parent portal and never offer to do the child's work.
export default function ParentChildLayout() {
  const { childId } = useParams();
  const parent = useOutletContext();
  const queryClient = useQueryClient();
  const [readyFor, setReadyFor] = useState(null);

  // Requests made from here on are about this child.
  setActiveLearnerId(childId);
  // The learner-portal queries aren't keyed by child, so moving to another child drops what was
  // cached for the last one (only once its pages are gone — nothing still shows it).
  useLayoutEffect(() => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "parent" && q.getObserversCount() === 0 });
    setReadyFor(childId);
  }, [childId, queryClient]);

  const scope = useLearnerPortalScope();
  const index = parent.children.findIndex((c) => c.id === childId);
  const child = parent.children[index] || null;

  if (!parent.overviewLoading && !child) {
    return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted }}>This child isn&apos;t linked to your account. <Link to="/parent">Back to your family</Link></p>;
  }
  if (!child || readyFor !== childId || scope.learner?.id !== childId) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }

  return (
    <>
      {/* The parent moves between children from the sidebar; a child at several hubs keeps the
          learner portal's hub switcher (it renders nothing for one hub). */}
      <HubSwitcher hubs={scope.hubs} selectedHubId={scope.selectedHubId} onChange={scope.setSelectedHubId} />
      <Outlet context={{ ...scope, child, childIndex: index, viewOnly: true, portalBase: childPath(childId) }} />
    </>
  );
}
