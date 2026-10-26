import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiCalendar, FiCreditCard, FiHome, FiPackage, FiUser } from "react-icons/fi";
import { homeLearningApi } from "../../home-learning/services/homeLearningApi";
import { techClubApi } from "../../tech-clubs/services/techClubApi";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";
import LogoutButton from "../../../components/ui/LogoutButton";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../../hooks/useSidebarHover";
import { childPath } from "../parentPaths";
import { childColor } from "./childColors";

const linkStyle = (isCollapsed) => ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: isCollapsed ? "center" : "flex-start",
  padding: isCollapsed ? "11px" : "11px 16px",
  marginBottom: 6,
  borderRadius: 12,
  textDecoration: "none",
  color: isActive ? "#25476a" : "#fff",
  fontSize: 15,
  fontWeight: isActive ? 700 : 500,
  backgroundColor: isActive ? "#feb139" : "transparent",
  transition: "all 0.2s ease",
});

function SectionLabel({ children, collapsed }) {
  if (collapsed) return <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "10px 6px" }} />;
  return <p style={{ margin: "14px 16px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{children}</p>;
}

// The parent portal's menu: the family first, then each child, then the things only a parent
// deals with (payments, packages, their own account).
export default function ParentSidebar({ children = [], isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  // My Family (packages) only matters to a parent with a Home Learning package or a Tech Club membership.
  const { data: family = [] } = useQuery({ queryKey: ["home-learning", "family"], queryFn: homeLearningApi.getFamily, staleTime: 5 * 60 * 1000 });
  const { data: clubFamily = [] } = useQuery({ queryKey: ["tech-clubs", "family"], queryFn: techClubApi.getFamily, staleTime: 5 * 60 * 1000 });
  const { expanded, handlers } = useSidebarHover(!isMobile);
  const isCollapsed = !isMobile && !expanded;
  const close = isMobile ? onClose : undefined;

  return (
    <>
      {isMobile && isMobileOpen ? (
        <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.45)", zIndex: 1200 }} />
      ) : null}

      <aside
        className="no-print"
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
        <div style={{ padding: isCollapsed ? "20px 12px" : "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: isMobile || isCollapsed ? "center" : "flex-start", gap: 8 }}>
          {!isCollapsed && <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: 40, width: "auto", objectFit: "contain", filter: BRAND_LOGO_DARK_BG_FILTER }} />}
          {isMobile ? (
            <button type="button" onClick={onClose} aria-label="Close menu" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>
          ) : null}
        </div>

        <nav style={{ flex: 1, padding: isCollapsed ? "16px 8px" : "16px 12px" }}>
          <NavLink to="/parent" end onClick={close} title={isCollapsed ? "My family" : undefined} style={linkStyle(isCollapsed)}>
            <FiHome size={18} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>My family</span>}
          </NavLink>

          {children.length > 0 && <SectionLabel collapsed={isCollapsed}>Children</SectionLabel>}
          {children.map((child, index) => (
            <NavLink key={child.id} to={childPath(child.id)} onClick={close} title={isCollapsed ? child.firstName : undefined} style={linkStyle(isCollapsed)}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: childColor(index), color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "2px solid rgba(255,255,255,0.7)" }}>
                {(child.firstName || "?").charAt(0).toUpperCase()}
              </span>
              {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{child.firstName || "Child"}</span>}
            </NavLink>
          ))}

          <SectionLabel collapsed={isCollapsed}>Family</SectionLabel>
          <NavLink to="/parent/timetable" onClick={close} title={isCollapsed ? "Timetable" : undefined} style={linkStyle(isCollapsed)}>
            <FiCalendar size={18} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>Timetable</span>}
          </NavLink>
          <NavLink to="/parent/invoices" onClick={close} title={isCollapsed ? "Payments" : undefined} style={linkStyle(isCollapsed)}>
            <FiCreditCard size={18} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>Payments</span>}
          </NavLink>
          {(family.length > 0 || clubFamily.length > 0) && (
            <NavLink to="/parent/family" onClick={close} title={isCollapsed ? "Packages" : undefined} style={linkStyle(isCollapsed)}>
              <FiPackage size={18} style={{ flexShrink: 0 }} />
              {!isCollapsed && <span>Packages</span>}
            </NavLink>
          )}
          <NavLink to="/parent/account" onClick={close} title={isCollapsed ? "My account" : undefined} style={linkStyle(isCollapsed)}>
            <FiUser size={18} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>My account</span>}
          </NavLink>
        </nav>

        <div style={{ padding: isCollapsed ? 8 : 12, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <LogoutButton collapsed={isCollapsed} />
        </div>
        {!isCollapsed && (
          <div style={{ padding: 18, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            © {new Date().getFullYear()} {BRAND_NAME}
          </div>
        )}
      </aside>
    </>
  );
}
