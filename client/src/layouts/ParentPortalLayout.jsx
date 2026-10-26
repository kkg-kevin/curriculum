import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import ParentSidebar from "../modules/parent/components/ParentSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { useAuth } from "../context/AuthContext";
import { useParentOverview } from "../modules/parent/hooks/useParent";
import { isParentUser } from "../modules/parent/parentPaths";
import { SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarHover";

const MOBILE_BREAKPOINT = 900;

// The parent portal (/parent): a parent's family view across all their children. A child's own
// login (username) keeps the learner portal; a parent never sees it (LearnerPortalLayout sends
// them here). The family overview loads once here and every page reads it from the outlet.
export default function ParentPortalLayout() {
  const { user } = useAuth();
  const isParent = isParentUser(user);
  const { data: overview, isLoading, isError } = useParentOverview();
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

  if (!isParent) return <Navigate to="/learner-portal" replace />;

  const children = overview?.children || [];
  const reservedWidth = isMobile ? 0 : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ParentSidebar children={children} isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        style={{
          marginLeft: reservedWidth,
          width: `calc(100vw - ${reservedWidth}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} photo={user?.photo} />
        <main style={{ flex: 1, padding: isMobile ? "20px 16px 28px" : "28px 32px", minWidth: 0, overflowX: "hidden" }}>
          {isError ? (
            <p style={{ fontFamily: "Inter, sans-serif", color: "#B91C1C", fontSize: 14 }}>Couldn&apos;t load your family — try refreshing the page.</p>
          ) : (
            <Outlet context={{ overview, children, overviewLoading: isLoading, isMobile }} />
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
