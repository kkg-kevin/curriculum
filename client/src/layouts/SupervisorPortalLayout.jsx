import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import SupervisorSidebar from "../modules/claims/components/SupervisorSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { useSupervisorClaims } from "../modules/claims/hooks/useClaims";
import { useSidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarCollapse";

const MOBILE_BREAKPOINT = 900;

// The supervisor portal's shell — sidebar, header and footer, the same as the teacher, school and
// learner portals (see TeacherPortalLayout.jsx). A supervisor's pages (dashboard, claims,
// educators, profile) render inside it and use the full width of the content area.
function SupervisorPortalLayout() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Same storage key ("supervisor") as SupervisorSidebar.jsx — both must agree on the collapsed
  // state so the content area's reserved margin matches the sidebar's actual width.
  const [collapsed] = useSidebarCollapse("supervisor");
  const reservedWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  // The pages read the same claims (one cached request); here it only feeds the sidebar's badge.
  const { data } = useSupervisorClaims();
  const waiting = data?.counts?.pending_supervisor || 0;

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
    <div className="supervisor-shell">
      <SupervisorSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} waiting={waiting} />

      <div className="supervisor-shell__content" style={{ marginLeft: isMobile ? 0 : reservedWidth, width: isMobile ? "100%" : `calc(100vw - ${reservedWidth}px)`, transition: "margin-left 0.2s ease, width 0.2s ease" }}>
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} />

        <main className="supervisor-shell__main" style={{ padding: isMobile ? "20px 16px 24px" : "28px 32px 36px" }}>
          <Outlet />
        </main>

        <Footer />
      </div>

      <style>{`
        .supervisor-shell {
          display: flex;
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(56,170,225,0.10), transparent 28%),
            linear-gradient(180deg, #F8FBFE 0%, #F5F7FA 100%);
        }
        .supervisor-shell__content {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .supervisor-shell__main {
          flex: 1;
          min-width: 0;
        }
      `}</style>
    </div>
  );
}

export default SupervisorPortalLayout;
