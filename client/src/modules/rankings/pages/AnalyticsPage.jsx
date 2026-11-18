import { useOutletContext } from "react-router-dom";
import LearnerAnalyticsView from "../components/LearnerAnalyticsView";

// "My analytics" in the learner portal (/learner-portal/analytics), and a child's "Analytics" in
// the parent portal (/parent/children/:childId/analytics — the outlet gives `child`).
export default function AnalyticsPage() {
  const ctx = useOutletContext() || {};
  const childName = ctx.viewOnly && ctx.child ? ctx.child.firstName || "Your child" : null;
  return <LearnerAnalyticsView childName={childName} />;
}
