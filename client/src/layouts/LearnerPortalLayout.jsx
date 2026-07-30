import { Outlet } from "react-router-dom";
import LearnerSidebar from "../modules/learner-portal/components/LearnerSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import FirstLoginDiagnosticGate from "../modules/learner-portal/components/FirstLoginDiagnosticGate";
import { useLearnerPortalScope } from "../modules/learner-portal/hooks/useLearnerPortalScope";

const SIDEBAR_WIDTH = 260;

function LearnerPortalLayout() {
  const scope = useLearnerPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, learners, selectedLearnerId, setSelectedLearnerId, learner, selectedHub, cls, isLoading } = scope;
  // HubSwitcher only needs {id, name} shaped items and renders nothing for a single entry — the
  // same generic component doubles as a child switcher for a guardian with more than one
  // linked learner, no separate component needed.
  const childOptions = learners.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}` }));

  // The first-login diagnostic gate — see FirstLoginDiagnosticGate's own comment for the full
  // rationale. Never true until the learner record has actually loaded, so a fresh mount doesn't
  // flash the gate open on an undefined learner. Sidebar/switchers are hidden while it's active
  // so it's genuinely the only thing reachable; Header stays so the learner can still sign out.
  const gateActive = !isLoading && !!learner && !learner.portalOnboardingCompletedAt;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!gateActive && <LearnerSidebar />}

      <div
        style={{
          marginLeft: gateActive ? 0 : SIDEBAR_WIDTH,
          width: gateActive ? "100vw" : `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header />

        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
          {gateActive ? (
            <FirstLoginDiagnosticGate learner={learner} hub={selectedHub} cls={cls} />
          ) : (
            <>
              <HubSwitcher hubs={childOptions} selectedHubId={selectedLearnerId} onChange={setSelectedLearnerId} />
              <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
              <Outlet context={scope} />
            </>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default LearnerPortalLayout;
