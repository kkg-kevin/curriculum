import { NavLink } from "react-router-dom";
import {
  FiGrid, FiBook, FiClipboard, FiBarChart2, FiTrendingUp, FiCalendar, FiFileText, FiUser, FiChevronLeft,
} from "react-icons/fi";
import logo from "../../../assets/Logo-image.png";
import LogoutButton from "../../../components/ui/LogoutButton";
import { useAuth } from "../../../context/AuthContext";
import { useSidebarCollapse, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../../hooks/useSidebarCollapse";

const menuItems = [
  { name: "Dashboard",    path: "/learner-portal", icon: FiGrid },
  { name: "My Courses",   path: "/learner-portal/courses", icon: FiBook },
  { name: "Assessments",  path: "/learner-portal/assessments", icon: FiClipboard },
  { name: "Reports",      path: "/learner-portal/reports", icon: FiBarChart2 },
  { name: "Progress",     path: "/learner-portal/progress", icon: FiTrendingUp },
  { name: "Timetable",    path: "/learner-portal/timetable", icon: FiCalendar },
  { name: "Invoices",     path: "/learner-portal/invoices", icon: FiFileText },
  { name: "Profile",      path: "/learner-portal/profile", icon: FiUser },
];

function LearnerSidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const visibleMenuItems = user?.username ? menuItems.filter((item) => item.name !== "Invoices") : menuItems;
  const [collapsed, setCollapsed] = useSidebarCollapse("learner");
  const isCollapsed = !isMobile && collapsed;

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
        className="no-print"
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
          boxShadow: isMobile ? "0 18px 60px rgba(0,0,0,0.28)" : "none",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div style={{ padding: isCollapsed ? "20px 12px" : "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: isMobile || isCollapsed ? "center" : "flex-start", gap: "8px" }}>
          {!isCollapsed && (
            <img src={logo} alt="Digifunzi" style={{ height: "40px", width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
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
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === "/learner-portal"}
                onClick={() => { if (isMobile) onClose(); else setCollapsed(true); }}
                title={isCollapsed ? item.name : undefined}
                style={({ isActive }) => ({
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
                {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
                {!isCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {!isMobile && (
          <div style={{ padding: isCollapsed ? "8px" : "8px 12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: isCollapsed ? "center" : "flex-start", gap: "10px",
                padding: "10px 12px", borderRadius: "10px", border: "none",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)",
                cursor: "pointer", fontSize: "13px", fontFamily: "Inter, sans-serif", fontWeight: 500,
              }}
            >
              <FiChevronLeft size={16} style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: isCollapsed ? "rotate(180deg)" : "none" }} />
              {!isCollapsed && <span>Collapse</span>}
            </button>
          </div>
        )}

        <div style={{ padding: isCollapsed ? "8px" : "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <LogoutButton collapsed={isCollapsed} />
        </div>

        {!isCollapsed && (
          <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
            © 2025 Digifunzi
          </div>
        )}
      </aside>
    </>
  );
}

export default LearnerSidebar;
