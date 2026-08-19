import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SchoolPortalSidebar from "../modules/school-portal/components/SchoolPortalSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import { useSchoolPortalScope } from "../modules/school-portal/hooks/useSchoolPortalScope";

const SIDEBAR_WIDTH = 260;
const MOBILE_BREAKPOINT = 900;

function SchoolPortalLayout() {
  const scope = useSchoolPortalScope();
  const { selectedHub: school, hubs, selectedHubId, setSelectedHubId } = scope;
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

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F5F7FA" }}>
      <SchoolPortalSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        style={{
          marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
          width: isMobile ? "100%" : `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} photo={school?.photo} />

        <main style={{ flex: 1, padding: isMobile ? "20px 16px 28px" : "28px 32px", minWidth: 0, overflowX: "hidden" }}>
          <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
          <Outlet context={scope} />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default SchoolPortalLayout;
