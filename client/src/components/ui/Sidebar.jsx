import { NavLink } from "react-router-dom";
import {
  FiGrid, FiHome, FiBookOpen, FiUsers, FiUserCheck, FiLayers, FiAward,
  FiBook, FiClipboard, FiBarChart2, FiDollarSign, FiSettings, FiMail, FiHeart, FiActivity, FiCpu, FiCheckSquare, FiStar,
} from "react-icons/fi";
import LogoutButton from "./LogoutButton";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../branding";
import { useAuth } from "../../context/AuthContext";
import { canViewAny, isStaff } from "../../hooks/usePermissions";
import { useSidebarHover, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "../../hooks/useSidebarHover";

// `module` is the staff-role permission key that gates an item (see
// server/src/modules/access/access.registry.js — keep the keys identical): a staff account sees it
// only if their role can view that module. Absent (e.g. Dashboard) means always shown. An array
// (Events) means "shown if ANY of these can be viewed". `ownerOnly` items are never shown to
// staff whatever their role says — Enquiries (lead triage) and Reports (the admin reports page is
// the owner-only platform analytics).
const ADMIN_MENU_ITEMS = [
  { name: "Dashboard", path: "/", icon: FiGrid },
  { name: "Learning Hubs", path: "/learning-hubs", icon: FiHome, module: "learning-hubs" },
  { name: "Curriculum", path: "/curriculum", icon: FiBookOpen, module: "curriculum" },
  { name: "Learners", path: "/learners", icon: FiUsers, module: "learners" },
  { name: "Home Learning", path: "/home-learning", icon: FiHeart, module: "home-learning" },
  { name: "Tech Clubs", path: "/tech-clubs", icon: FiCpu, module: "tech-clubs" },
  { name: "Educators", path: "/teachers", icon: FiUserCheck, module: "teachers" },
  { name: "Classes", path: "/classes", icon: FiLayers, module: "classes" },
  { name: "Events", path: "/events", icon: FiAward, module: ["competitions", "bootcamps"] },
  { name: "Courses", path: "/courses", icon: FiBook, module: "courses" },
  { name: "Enquiries", path: "/enquiries", icon: FiMail, ownerOnly: true },
  { name: "Assessments", path: "/assessments", icon: FiClipboard, module: "assessments" },
  { name: "Reports", path: "/reports", icon: FiBarChart2, module: "reports", ownerOnly: true },
  // Educator claims live inside Billing (its "Educator Claims" tab), so a staff member who only
  // reviews claims still needs this item to get there.
  { name: "Billing", path: "/billing", icon: FiDollarSign, module: ["billing", "claims", "claims-approval"] },
  // Hub check-ins: taking part (Account Managers, Training Leads) or overseeing them.
  { name: "Hub Check-ins", path: "/checkins", icon: FiCheckSquare, module: "checkins-manage" },
  // Quality assurance: visits to educators, their reviews, schedules and templates.
  { name: "Quality Assurance", path: "/qa", icon: FiStar, module: "qa" },
  { name: "Activity", path: "/activity", icon: FiActivity, module: "activity" },
  { name: "Settings", path: "/settings", icon: FiSettings, module: "settings" },
];

// A curriculumAdmin only ever has access to the curriculum-authoring routes (scoped server-side
// to their own curriculum) — every other admin nav item would just 403 for them, so it's hidden
// rather than shown and broken.
const CURRICULUM_ADMIN_MENU_ITEMS = [
  { name: "Curriculum", path: "/curriculum", icon: FiBookOpen },
];

// A staff account's menu: the owner's, minus owner-only items and modules their role can't view.
function staffMenu(user) {
  return ADMIN_MENU_ITEMS.filter((item) => !item.ownerOnly && (!item.module || canViewAny(user, item.module)));
}

function Sidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const { user } = useAuth();
  const menuItems = user?.role === "curriculumAdmin"
    ? CURRICULUM_ADMIN_MENU_ITEMS
    : isStaff(user) ? staffMenu(user) : ADMIN_MENU_ITEMS;
  // Desktop: an icon rail that opens while hovered. Never collapsed on mobile — the drawer
  // already fully hides/shows, collapsing it too would just be a narrow drawer with no labels.
  const { expanded, handlers } = useSidebarHover(!isMobile);
  const isCollapsed = !isMobile && !expanded;

  return (
    <>
      {isMobile && isMobileOpen ? (
        <div
          role="presentation"
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            zIndex: 1200,
          }}
        />
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
        <div
          style={{
            padding: isCollapsed ? "20px 12px" : "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile || isCollapsed ? "center" : "flex-start",
            gap: "8px",
          }}
        >
          {!isCollapsed && (
            <img
              src={BRAND_LOGO_DARK_BG}
              alt={BRAND_NAME}
              style={{
                height: "40px",
                width: "auto",
                objectFit: "contain",
                filter: BRAND_LOGO_DARK_BG_FILTER,
              }}
            />
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.25)",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: "18px",
                flexShrink: 0,
              }}
              aria-label="Close menu"
            >
              ×
            </button>
          ) : null}
        </div>

        <nav style={{ flex: 1, padding: isCollapsed ? "20px 8px" : "20px 12px" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={isMobile ? onClose : undefined}
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

        <div
          style={{
            padding: isCollapsed ? "8px" : "12px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <LogoutButton collapsed={isCollapsed} />
        </div>

        {!isCollapsed && (
          <div
            style={{
              padding: "18px",
              textAlign: "center",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            © {new Date().getFullYear()} {BRAND_NAME}
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
