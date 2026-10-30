import { useLayoutEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FiBookOpen } from "react-icons/fi";
import HubSwitcher from "../../../components/ui/HubSwitcher";
import { EducatorLearningAuth } from "../../../context/AuthContext";
import { useLearnerPortalScope } from "../../learner-portal/hooks/useLearnerPortalScope";

export const LEARNING_BASE = "/teacher-portal/learning";

// Inside "My learning": the learner-portal pages, scoped to the educator's own learner record.
function Learning() {
  const scope = useLearnerPortalScope();
  if (scope.isLoading) return <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading your learning…</div>;
  if (!scope.learner) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "56px 20px", background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, background: "#e8f5fb", color: "#25476a", display: "grid", placeItems: "center" }}><FiBookOpen size={24} /></div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>You&apos;re not in training yet</p>
        <p style={{ margin: "6px auto 0", maxWidth: 440, fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>Your TOT courses appear here once you join a TOT bootcamp or the admin enrols you.</p>
      </div>
    );
  }
  return (
    <>
      <HubSwitcher hubs={scope.hubs} selectedHubId={scope.selectedHubId} onChange={scope.setSelectedHubId} />
      <Outlet context={{ ...scope, portalBase: LEARNING_BASE, learningAsEducator: true }} />
    </>
  );
}

// The teacher portal's "My learning" (/teacher-portal/learning) — training of trainers: the
// educator's own courses, assessments, reports and certificates, as a learner. Their requests run
// as their own learner record (services/api.js → scope.middleware.js); here the educator counts
// as a learner (EducatorLearningAuth) so the learner-portal and course pages work as they are, and
// their /learner-portal/… links come back here (RoleRoute). What's cached while teaching and while
// learning differs for the same queries, so it's dropped on the way in and out.
export default function TeacherLearningLayout() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const drop = () => queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "tot" && q.getObserversCount() === 0 });
    drop();
    setReady(true);
    return drop;
  }, [queryClient]);
  if (!ready) return null;
  return (
    <EducatorLearningAuth>
      <Learning />
    </EducatorLearningAuth>
  );
}
