import { NavLink } from "react-router-dom";
import logo from "../../../assets/Logo-image.png";

const menuItems = [
  { name: "Dashboard",    path: "/learner-portal" },
  { name: "My Courses",   path: "/learner-portal/courses" },
  { name: "Assessments",  path: "/learner-portal/assessments" },
  { name: "Progress",     path: "/learner-portal/progress" },
];

function LearnerSidebar() {
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
            end={item.path === "/learner-portal"}
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

      <div style={{ padding: "18px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
        © 2025 Digifunzi
      </div>
    </aside>
  );
}

export default LearnerSidebar;
