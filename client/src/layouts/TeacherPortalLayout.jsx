import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import TeacherSidebar from "../modules/teacher-portal/components/TeacherSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import { useTeacherPortalScope } from "../modules/teacher-portal/hooks/useTeacherPortalScope";

const MOBILE_BREAKPOINT = 900;

function TeacherPortalLayout() {
  const scope = useTeacherPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, hasNoHubs } = scope;
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
    <div className="teacher-shell">
      <TeacherSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="teacher-shell__content" style={{ marginLeft: isMobile ? 0 : 260, width: isMobile ? "100%" : "calc(100vw - 260px)" }}>
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} />

        <main className="teacher-shell__main" style={{ padding: isMobile ? "20px 16px 24px" : "28px 32px 36px" }}>
          <div className="teacher-shell__main-inner">
            {hasNoHubs ? (
              <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>You haven't been assigned to a learning hub yet</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Contact your administrator to get assigned to a learning hub.</p>
              </div>
            ) : (
              <>
                <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
                <Outlet context={scope} />
              </>
            )}
          </div>
        </main>

        <Footer />
      </div>

      <style>{`
        .teacher-shell {
          display: flex;
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(56,170,225,0.10), transparent 28%),
            linear-gradient(180deg, #F8FBFE 0%, #F5F7FA 100%);
        }
        .teacher-shell__content {
          margin-left: 260px;
          width: calc(100vw - 260px);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .teacher-shell__main {
          flex: 1;
          min-width: 0;
        }
        .teacher-shell__main-inner {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}

export default TeacherPortalLayout;
