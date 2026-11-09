import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AffiliateSidebar from "../modules/affiliates/components/AffiliateSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarHover";

const MOBILE_BREAKPOINT = 900;

// The affiliate portal's shell (/affiliate-portal) — for someone signed in as Affiliate: an
// affiliate who isn't a parent or educator here (server: modules/affiliates/, account-roles.js's
// AFFILIATE_ROLE). Sidebar, header and footer as in the supervisor portal; Refer & earn and My
// account render inside it.
export default function AffiliatePortalLayout() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="affiliate-shell">
      <AffiliateSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="affiliate-shell__content" style={{ marginLeft: isMobile ? 0 : reservedWidth, width: isMobile ? "100%" : `calc(100vw - ${reservedWidth}px)`, transition: "margin-left 0.2s ease, width 0.2s ease" }}>
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} />
        <main className="affiliate-shell__main" style={{ padding: isMobile ? "20px 16px 24px" : "28px 32px 36px" }}>
          <Outlet />
        </main>
        <Footer />
      </div>

      <style>{`
        .affiliate-shell {
          display: flex;
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(56,170,225,0.10), transparent 28%),
            linear-gradient(180deg, #F8FBFE 0%, #F5F7FA 100%);
        }
        .affiliate-shell__content { min-height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
        .affiliate-shell__main { flex: 1; min-width: 0; }
      `}</style>
    </div>
  );
}
