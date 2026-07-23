import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learningHubApi as schoolApi } from "../../learning-hubs/services/learningHubApi";
import logo from "../../../assets/Logo-image.png";
import LogoutButton from "../../../components/ui/LogoutButton";

function SchoolPortalSidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const { user } = useAuth();

  const { data: schoolsData } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const schoolId = schoolsData?.data?.[0]?.id || null;

  const menuItems = [
    { name: "Dashboard",   path: "/school-portal", end: true, enabled: true },
    { name: "Curriculum",  path: "/school-portal/curriculum", end: false, enabled: true },
    { name: "Classes",     path: `/school-portal/classes/${schoolId}`,    end: false, enabled: !!schoolId },
    { name: "Tech Educators", path: `/school-portal/teachers/${schoolId}`, end: false, enabled: !!schoolId },
    { name: "Learners",    path: `/school-portal/learners/${schoolId}`,   end: false, enabled: !!schoolId },
    { name: "Attendance",  path: "/school-portal/attendance",             end: false, enabled: !!schoolId },
    { name: "Reports",     path: "/school-portal/reports", end: false, enabled: true },
    { name: "Profile",     path: "/school-portal/profile", end: false, enabled: true },
  ];

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
        style={{
          width: isMobile ? "min(86vw, 300px)" : "260px",
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
          transition: "left 0.25s ease",
          boxShadow: isMobile ? "0 18px 60px rgba(0,0,0,0.28)" : "none",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "space-between" : "flex-start",
          }}
        >
          <img src={logo} alt="Digifunzi" style={{ height: "40px", width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />

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
              }}
              aria-label="Close menu"
            >
              ×
            </button>
          ) : null}
        </div>

        <nav style={{ flex: 1, padding: "20px 12px" }}>
          {menuItems.map((item) =>
            item.enabled ? (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.end}
                onClick={() => isMobile && onClose()}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "12px 18px",
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
                {item.name}
              </NavLink>
            ) : (
              <span
                key={item.name}
                title="Available once your school profile is linked"
                style={{ display: "block", padding: "12px 18px", marginBottom: "8px", borderRadius: "12px", color: "rgba(255,255,255,0.4)", fontSize: "15px", fontWeight: "500", cursor: "not-allowed" }}
              >
                {item.name}
              </span>
            )
          )}
        </nav>

        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <LogoutButton />
        </div>

        <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
          © 2025 Digifunzi
        </div>
      </aside>
    </>
  );
}

export default SchoolPortalSidebar;
