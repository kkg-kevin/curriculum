import { NavLink, useLocation } from "react-router-dom";
import { FiGrid, FiBook, FiClipboard, FiBarChart2, FiCheckSquare, FiCalendar, FiUser, FiHome, FiCreditCard } from "react-icons/fi";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";
import LogoutButton from "../../../components/ui/LogoutButton";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../../hooks/useSidebarHover";

const menuItems = [
  { name: "Dashboard",       path: "/teacher-portal", icon: FiGrid },
  { name: "Course Content",  path: "/teacher-portal/course-content", icon: FiBook },
  { name: "Home Learning",   path: "/teacher-portal/home-learning", icon: FiHome },
  { name: "Assessments",     path: "/teacher-portal/assessments", icon: FiClipboard },
  { name: "Reports",         path: "/teacher-portal/reports", icon: FiBarChart2 },
  { name: "Attendance",      path: "/teacher-portal/attendance", icon: FiCheckSquare },
  { name: "Timetable",       path: "/teacher-portal/timetable", icon: FiCalendar },
  // Claims and Invoices — two tabs of one page (PaymentsPage), so either address lights it up.
  { name: "Payments",        path: "/teacher-portal/claims", icon: FiCreditCard, also: ["/teacher-portal/invoices"] },
  { name: "My Profile",      path: "/teacher-portal/profile", icon: FiUser },
];

function TeacherSidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const { expanded, handlers } = useSidebarHover(!isMobile);
  const isCollapsed = !isMobile && !expanded;
  const { pathname } = useLocation();

  return (
    <>
      {isMobile && isMobileOpen ? (
        <div
          role="presentation"
          onClick={onClose}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.45)", zIndex: 1200 }}
        />
      ) : null}

      <aside
        {...handlers}
        style={{
          width: isMobile ? "min(86vw, 300px)" : isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          height: "100vh",
          backgroundColor: "#25476a",
          color: "#fff",
          position: "fixed",
          left: isMobile ? (isMobileOpen ? 0 : "-100%") : 0,
          top: 0,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, sans-serif",
          zIndex: 1300,
          transition: "left 0.25s ease, width 0.2s ease",
          boxShadow: isMobile ? "0 18px 60px rgba(0,0,0,0.28)" : expanded ? "8px 0 32px rgba(0,0,0,0.22)" : "none",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div style={{ padding: isCollapsed ? "20px 12px" : "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: isMobile || isCollapsed ? "center" : "flex-start", gap: "8px" }}>
          {!isCollapsed && (
            <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: "40px", width: "auto", objectFit: "contain", filter: BRAND_LOGO_DARK_BG_FILTER }} />
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              style={{ width: "36px", height: "36px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}
            >
              ×
            </button>
          ) : null}
        </div>

        <nav style={{ flex: 1, padding: isCollapsed ? "20px 8px" : "20px 12px" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const alsoActive = (item.also || []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === "/teacher-portal"}
                onClick={isMobile ? onClose : undefined}
                title={isCollapsed ? item.name : undefined}
                style={({ isActive: routeActive }) => {
                  const isActive = routeActive || alsoActive;
                  return {
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  padding: isCollapsed ? "12px" : "12px 18px",
                  marginBottom: "8px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  color: isActive ? "#25476a" : "#fff",
                  fontSize: "15px",
                  fontWeight: isActive ? "700" : "500",
                  backgroundColor: isActive ? "#feb139" : "transparent",
                  transition: "all 0.2s ease",
                  };
                }}
              >
                {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
                {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: isCollapsed ? "8px" : "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <LogoutButton collapsed={isCollapsed} />
        </div>

        {!isCollapsed && (
          <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
            © {new Date().getFullYear()} {BRAND_NAME}
          </div>
        )}
      </aside>
    </>
  );
}

export default TeacherSidebar;
