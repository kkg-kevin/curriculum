import { FiBell, FiLogOut, FiMenu } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function Header({ isMobile = false, onMenuClick = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || "?";
  const roleLabel = user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "";

  const pageTitles = {
    "/": "Dashboard",
    "/locations": "Locations",
    "/locations/create": "Add Location",
    "/curriculum": "Curriculum",
    "/curriculum/create": "Create Curriculum",
    "/learners": "Learners",
    "/teachers": "Teachers",
    "/classes": "Classes",
    "/assessments": "Assessments",
    "/reports": "Reports",
    "/settings": "Settings",
    "/teacher-portal": "My Dashboard",
    "/teacher-portal/course-content": "Course Content",
    "/teacher-portal/assessments": "Assessments",
    "/teacher-portal/attendance": "Attendance",
    "/teacher-portal/profile": "My Profile",
    "/school-portal": "My Dashboard",
    "/school-portal/curriculum": "Curriculum",
    "/school-portal/reports": "Reports",
    "/school-portal/profile": "My Profile",
    "/learner-portal": "My Dashboard",
    "/learner-portal/courses": "My Courses",
    "/learner-portal/assessments": "Assessments",
    "/learner-portal/progress": "Progress",
  };

  const getPageTitle = (pathname) => {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/structure"))
      return "Structure Builder";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/edit"))
      return "Edit Curriculum";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/view"))
      return "Curriculum View";
    if (pathname.startsWith("/teacher-portal/classes/"))
      return "My Class";
    if (pathname.startsWith("/teacher-portal/course-content/") || pathname.startsWith("/learner-portal/courses/"))
      return "Course Content";
    if (pathname.startsWith("/school-portal/classes/"))
      return "Classes";
    if (pathname.startsWith("/school-portal/teachers/"))
      return "Teachers";
    if (pathname.startsWith("/school-portal/learners/"))
      return "Learners";
    if (pathname.startsWith("/school-portal/curriculum/"))
      return "Curriculum";
    if (pathname.startsWith("/locations/") && pathname.endsWith("/edit"))
      return "Edit Location";
    if (pathname.startsWith("/locations/") && pathname.endsWith("/view"))
      return "Location View";
    return "Dashboard";
  };

  const pageTitle = getPageTitle(location.pathname);

  return (
    <header
      style={{
        height: "70px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 14px 0 16px" : "0 24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 12 }}>
        {isMobile ? (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "none",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <FiMenu size={18} />
          </button>
        ) : null}

        <h2
          style={{
            margin: 0,
            fontSize: isMobile ? "18px" : "22px",
            fontWeight: "600",
            color: "#111827",
          }}
        >
          {pageTitle}
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? "10px" : "20px",
        }}
      >
        {!isMobile ? (
          <div
            style={{
              cursor: "pointer",
              color: "#374151",
            }}
          >
            <FiBell size={22} />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#25476a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>

          {!isMobile ? (
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{user?.name || "..."}</div>
              <div style={{ fontSize: "12px", color: "#6B7280" }}>{roleLabel}</div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            background: "none",
            color: "#374151",
            cursor: "pointer",
          }}
        >
          <FiLogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;