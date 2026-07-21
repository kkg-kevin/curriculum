import { NavLink } from "react-router-dom";
import logo from "../../../assets/Logo-image.png";
import LogoutButton from "../../../components/ui/LogoutButton";

const menuItems = [
  { name: "Dashboard",       path: "/teacher-portal" },
  { name: "Course Content",  path: "/teacher-portal/course-content" },
  { name: "Assessments",     path: "/teacher-portal/assessments" },
  { name: "Attendance",      path: "/teacher-portal/attendance" },
  { name: "My Profile",      path: "/teacher-portal/profile" },
];

function TeacherSidebar() {
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
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === "/teacher-portal"}
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
        ))}
      </nav>

      <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <LogoutButton />
      </div>

      <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
        © 2025 Digifunzi
      </div>
    </aside>
  );
}

export default TeacherSidebar;
