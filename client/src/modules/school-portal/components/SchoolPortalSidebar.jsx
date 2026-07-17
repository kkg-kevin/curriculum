import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import logo from "../../../assets/Logo-image.png";

function SchoolPortalSidebar() {
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
    { name: "Classes",   path: `/school-portal/classes/${schoolId}`,  end: false, enabled: !!schoolId },
    { name: "Teachers",  path: `/school-portal/teachers/${schoolId}`, end: false, enabled: !!schoolId },
    { name: "Learners",  path: `/school-portal/learners/${schoolId}`, end: false, enabled: !!schoolId },
    { name: "Reports",   path: "/school-portal/reports", end: false, enabled: true },
    { name: "Profile",   path: "/school-portal/profile", end: false, enabled: true },
  ];

  return (
    <aside
      style={{
        width: "260px",
        height: "100vh",
        backgroundColor: "#25476a",
        color: "#fff",
        position: "fixed",
        left: 0,
        top: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center" }}>
        <img src={logo} alt="Digifunzi" style={{ height: "40px", width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
      </div>

      <nav style={{ flex: 1, padding: "20px 12px" }}>
        {menuItems.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
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

      <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
        © 2025 Digifunzi
      </div>
    </aside>
  );
}

export default SchoolPortalSidebar;
