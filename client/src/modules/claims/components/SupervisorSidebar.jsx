import { NavLink } from "react-router-dom";
import { FiGrid, FiFileText, FiUsers, FiUser, FiStar, FiEdit3 } from "react-icons/fi";
import { useTotMarking } from "../../tot/hooks/useTot";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";
import LogoutButton from "../../../components/ui/LogoutButton";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../../hooks/useSidebarHover";

const menuItems = [
  { name: "Dashboard",    path: "/supervisor-portal", icon: FiGrid },
  { name: "Claims",       path: "/supervisor-portal/claims", icon: FiFileText, badge: "claims" },
  { name: "My Educators", path: "/supervisor-portal/educators", icon: FiUsers },
  // Training of trainers: their educators' TOT work waiting to be marked.
  { name: "Work to mark", path: "/supervisor-portal/marking", icon: FiEdit3, badge: "marking" },
  { name: "QA Visits",    path: "/supervisor-portal/qa", icon: FiStar },
  { name: "My Profile",   path: "/supervisor-portal/profile", icon: FiUser },
];

// The supervisor portal's sidebar — the same shell as the teacher/school/learner portals'
// (TeacherSidebar.jsx), with the supervisor's own pages. `waiting` is how many claims need their
// review, shown against Claims.
function SupervisorSidebar({ isMobile = false, isMobileOpen = false, onClose = () => {}, waiting = 0 }) {
  const { expanded, handlers } = useSidebarHover(!isMobile);
  const isCollapsed = !isMobile && !expanded;
  const { data: marking = [] } = useTotMarking();
  const counts = { claims: waiting, marking: marking.length };

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
            const count = item.badge ? counts[item.badge] : 0;
            const showBadge = count > 0;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === "/supervisor-portal"}
                onClick={isMobile ? onClose : undefined}
                title={isCollapsed ? `${item.name}${showBadge ? ` (${count} waiting)` : ""}` : undefined}
                style={({ isActive }) => ({
                  position: "relative",
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
                })}
              >
                {({ isActive }) => (
                  <>
                    {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
                    {!isCollapsed && <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
                    {showBadge && (
                      isCollapsed
                        ? <span style={{ position: "absolute", top: 6, right: 6, width: 9, height: 9, borderRadius: "50%", background: isActive ? "#25476a" : "#feb139" }} />
                        : <span style={{ minWidth: 22, padding: "1px 7px", borderRadius: 999, textAlign: "center", fontSize: 12, fontWeight: 800, background: isActive ? "#25476a" : "#feb139", color: isActive ? "#fff" : "#17304B" }}>{count}</span>
                    )}
                  </>
                )}
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

export default SupervisorSidebar;
