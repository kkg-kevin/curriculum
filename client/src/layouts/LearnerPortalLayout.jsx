import { Outlet } from "react-router-dom";
import LearnerSidebar from "../modules/learner-portal/components/LearnerSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import { useLearnerPortalScope } from "../modules/learner-portal/hooks/useLearnerPortalScope";

const SIDEBAR_WIDTH = 260;

function LearnerPortalLayout() {
  const scope = useLearnerPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, learners, selectedLearnerId, setSelectedLearnerId } = scope;
  // HubSwitcher only needs {id, name} shaped items and renders nothing for a single entry — the
  // same generic component doubles as a child switcher for a guardian with more than one
  // linked learner, no separate component needed.
  const childOptions = learners.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}` }));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LearnerSidebar />

      <div
        style={{
          marginLeft: SIDEBAR_WIDTH,
          width: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header />

        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
          <HubSwitcher hubs={childOptions} selectedHubId={selectedLearnerId} onChange={setSelectedLearnerId} />
          <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
          <Outlet context={scope} />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default LearnerPortalLayout;
