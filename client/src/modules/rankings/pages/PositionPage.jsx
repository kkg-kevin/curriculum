import { useOutletContext } from "react-router-dom";
import PositionView from "../components/PositionView";

// "My position" in the learner portal (/learner-portal/position), and a child's "Class position"
// in the parent portal (/parent/children/:childId/position — the outlet gives `child`).
export default function PositionPage() {
  const ctx = useOutletContext() || {};
  const childName = ctx.viewOnly && ctx.child ? ctx.child.firstName || "Your child" : null;
  return <PositionView childName={childName} />;
}
