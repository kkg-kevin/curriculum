import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import LearnerSidebar from "../modules/learner-portal/components/LearnerSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import FirstLoginDiagnosticGate from "../modules/learner-portal/components/FirstLoginDiagnosticGate";
import { useLearnerPortalScope } from "../modules/learner-portal/hooks/useLearnerPortalScope";

const SIDEBAR_WIDTH = 260;
const MOBILE_BREAKPOINT = 900;

function LearnerPortalLayout() {
  const scope = useLearnerPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, learners, selectedLearnerId, setSelectedLearnerId, learner, selectedHub, cls, isLoading } = scope;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // HubSwitcher only needs {id, name} shaped items and renders nothing for a single entry — the
  // same generic component doubles as a child switcher for a guardian with more than one
  // linked learner, no separate component needed.
  const childOptions = learners.map((l) => ({ id: l.id, name: `${l.firstName} ${l.lastName}` }));

  // The first-login diagnostic gate — see FirstLoginDiagnosticGate's own comment for the full
  // rationale. Gated off the CURRENTLY SELECTED hub's own onboardingCompletedAt (not a
  // learner-level flag) so a learner enrolled at several hubs gets gated again on a hub they
  // haven't cleared yet, even after clearing another one. Never true until the learner record
  // and hub list have actually loaded, so a fresh mount doesn't flash the gate open on
  // undefined data. Sidebar/switchers are hidden while it's active so it's genuinely the only
  // thing reachable; Header stays so the learner can still sign out.
  const gateActive = !isLoading && !!learner && !!selectedHub && !selectedHub.onboardingCompletedAt;

  const sidebarReserved = !gateActive && !isMobile;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!gateActive && <LearnerSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div
        style={{
          marginLeft: sidebarReserved ? SIDEBAR_WIDTH : 0,
          width: sidebarReserved ? `calc(100vw - ${SIDEBAR_WIDTH}px)` : "100vw",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header isMobile={isMobile && !gateActive} onMenuClick={() => setSidebarOpen(true)} photo={learner?.photo} />

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 28px" : "28px 32px", minWidth: 0, overflowX: "hidden" }}>
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
