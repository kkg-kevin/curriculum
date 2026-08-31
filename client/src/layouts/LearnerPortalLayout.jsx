import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import LearnerSidebar from "../modules/learner-portal/components/LearnerSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import ConfirmPasswordModal from "../components/ui/ConfirmPasswordModal";
import FirstLoginDiagnosticGate from "../modules/learner-portal/components/FirstLoginDiagnosticGate";
import { useLearnerPortalScope } from "../modules/learner-portal/hooks/useLearnerPortalScope";
import { authApi } from "../modules/auth/services/authApi";
import { useSidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarCollapse";

const MOBILE_BREAKPOINT = 900;

function LearnerPortalLayout() {
  const scope = useLearnerPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, learners, selectedLearnerId, setSelectedLearnerId, learner, selectedHub, cls, isLoading } = scope;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Same storage key ("learner") as LearnerSidebar.jsx — both must agree on the current
  // collapsed state so the content area's reserved margin matches the sidebar's actual width.
  const [collapsed] = useSidebarCollapse("learner");
  // A guardian-mediated login sees every sibling under their email and could otherwise switch
  // between them with no further check — the account's own password (re-verified via
  // authApi.verifyPassword) is the only real gate available, since server-side scoping can't
  // tell "the guardian is switching" apart from "the learner is switching" when it's the same
  // JWT either way. A learner's own dedicated username login never reaches this: LearnerModel
  // only ever resolves to that one learner for it, so `learners` never has more than one entry
  // and the switcher below renders nothing.
  const [pendingChildId, setPendingChildId] = useState(null);

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
  // undefined data. The sidebar stays hidden while it's active (nothing in the portal should be
  // reachable yet for this hub), but the hub switcher is kept visible below — a learner enrolled
  // at several hubs must be able to switch back to one they've already onboarded rather than
  // being trapped on the gate of a hub they haven't started, with only "do the diagnostic" or
  // "log out" as options. Header stays too, so they can still sign out.
  const gateActive = !isLoading && !!learner && !!selectedHub && !selectedHub.onboardingCompletedAt;

  const sidebarReserved = !gateActive && !isMobile;
  const reservedWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {!gateActive && <LearnerSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      <div
        style={{
          marginLeft: sidebarReserved ? reservedWidth : 0,
          width: sidebarReserved ? `calc(100vw - ${reservedWidth}px)` : "100vw",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
          transition: "margin-left 0.2s ease, width 0.2s ease",
        }}
      >
        <Header isMobile={isMobile && !gateActive} onMenuClick={() => setSidebarOpen(true)} photo={learner?.photo} />

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 28px" : "28px 32px", minWidth: 0, overflowX: "hidden" }}>
          {/* Switchers render above everything, gate or not — so a multi-hub learner sitting on
              an un-onboarded hub's diagnostic can still switch back to a hub they've completed
              (or to another child), instead of being stuck with only "take the diagnostic" or
              "log out". Each renders nothing when there's only one option (see HubSwitcher). */}
          <HubSwitcher hubs={childOptions} selectedHubId={selectedLearnerId} onChange={setPendingChildId} />
          <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
          {gateActive ? (
            <FirstLoginDiagnosticGate learner={learner} hub={selectedHub} cls={cls} />
          ) : (
            <Outlet context={scope} />
          )}
        </main>

        <Footer />
      </div>

      <ConfirmPasswordModal
        isOpen={!!pendingChildId}
        title="Confirm it's you"
        message="Enter your portal password to switch to a different child's profile."
        confirmLabel="Switch"
        onConfirm={async (password) => {
          await authApi.verifyPassword(password);
          setSelectedLearnerId(pendingChildId);
          setPendingChildId(null);
        }}
        onCancel={() => setPendingChildId(null)}
      />
    </div>
  );
}

export default LearnerPortalLayout;
