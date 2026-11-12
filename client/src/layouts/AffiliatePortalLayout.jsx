import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AffiliateSidebar from "../modules/affiliates/components/AffiliateSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import { SIDEBAR_COLLAPSED_WIDTH } from "../hooks/useSidebarHover";
import GeneralEventPopup from "../modules/general-events/components/GeneralEventPopup";

const MOBILE_BREAKPOINT = 900;

// The affiliate portal's shell (/affiliate-portal) — for someone signed in as Affiliate: an
// affiliate who isn't a parent or educator here (server: modules/affiliates/, account-roles.js's
// AFFILIATE_ROLE). Sidebar, header and footer as in the supervisor portal; Refer & earn and My
// account render inside it.
//
// It fills the device edge to edge: the content takes whatever the sidebar rail leaves (flex, never
// `100vw`, which runs under a desktop scrollbar), the shell is the VISIBLE screen's height (`dvh`,
// so a phone's browser toolbar never hides the bottom), and the phone menu stops the page behind
// it scrolling while it's open.
export default function AffiliatePortalLayout() {
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

  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return undefined;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = before; window.removeEventListener("keydown", onKey); };
  }, [isMobile, sidebarOpen]);

  return (
    <div className="affiliate-shell">
      <AffiliateSidebar isMobile={isMobile} isMobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="affiliate-shell__content" style={{ marginLeft: isMobile ? 0 : SIDEBAR_COLLAPSED_WIDTH }}>
        <Header isMobile={isMobile} onMenuClick={() => setSidebarOpen(true)} />
        <main className="affiliate-shell__main">
          <Outlet />
        </main>
        <Footer />
      </div>
      {/* General events: the sign-in pop-up. */}
      <GeneralEventPopup />

      <style>{`
        .affiliate-shell {
          display: flex;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          background:
            radial-gradient(circle at top right, rgba(56,170,225,0.10), transparent 28%),
            linear-gradient(180deg, #F8FBFE 0%, #F5F7FA 100%);
        }
        .affiliate-shell__content {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          transition: margin-left 0.2s ease;
        }
        .affiliate-shell__main { flex: 1; min-width: 0; padding: 28px 32px 36px; }
        @media (max-width: ${MOBILE_BREAKPOINT - 1}px) {
          .affiliate-shell__main { padding: 18px 16px 28px; }
        }
        @media (max-width: 380px) {
          .affiliate-shell__main { padding: 14px 12px 24px; }
        }
      `}</style>
    </div>
  );
}
