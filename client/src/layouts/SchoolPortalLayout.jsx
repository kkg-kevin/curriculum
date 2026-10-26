import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SchoolPortalSidebar from "../modules/school-portal/components/SchoolPortalSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import { useSchoolPortalScope } from "../modules/school-portal/hooks/useSchoolPortalScope";
import { SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarHover";
import { useAuth } from "../context/AuthContext";
import CheckinsDuePopup from "../modules/checkins/components/CheckinsDuePopup";

const MOBILE_BREAKPOINT = 900;

function SchoolPortalLayout() {
  const scope = useSchoolPortalScope();
  const { selectedHub: school, hubs, selectedHubId, setSelectedHubId } = scope;
  // A hub's Account Manager / Training Lead: every hub, view only (the server refuses changes).
  const { user } = useAuth();
  const hubLead = !!user?.hubLead;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Only the sidebar's icon rail is reserved — when hovered it opens over the page (useSidebarHover).
  const reservedWidth = SIDEBAR_COLLAPSED_WIDTH;

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F5F7FA" }}>
      <SchoolPortalSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        style={{
          marginLeft: isMobile ? 0 : reservedWidth,
          width: isMobile ? "100%" : `calc(100vw - ${reservedWidth}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
          transition: "margin-left 0.2s ease, width 0.2s ease",
        }}
      >
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} photo={school?.photo} />

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 28px" : "28px 32px", minWidth: 0, overflowX: "hidden" }}>
          {hubLead && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 14, borderRadius: 12, background: "#F1F9FD", border: "1px solid #CFE6F5", color: "#25476a", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <strong>View only.</strong> As an Account Manager / Training Lead you can look at every hub; the only thing you write here is your check-in reports.
            </div>
          )}
          <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
          <Outlet context={scope} />
        </main>

        <Footer />
      </div>

      {hubLead && <CheckinsDuePopup />}
    </div>
  );
}

export default SchoolPortalLayout;
