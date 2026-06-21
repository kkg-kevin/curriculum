import { NavLink } from "react-router-dom";

function Sidebar() {
  const menuItems = [
    { name: "Dashboard", path: "/" },
    { name: "Schools", path: "/schools" },
    { name: "Curriculum", path: "/curriculum" },
    { name: "Supplementary", path: "/supplementary" },
    { name: "Learners", path: "/learners" },
    { name: "Teachers", path: "/teachers" },
    { name: "Classes", path: "/classes" },
    { name: "Assessments", path: "/assessments" },
    { name: "Reports", path: "/reports" },
    { name: "Settings", path: "/settings" },
  ];

  return (
    <aside
      style={{
        width: "260px",
        height: "100vh",
        backgroundColor: "#0D47A1",
        color: "#fff",
        position: "fixed",
        left: 0,
        top: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "28px 24px",
          fontSize: "22px",
          fontWeight: "700",
          letterSpacing: "-0.5px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        Digifunzi
      </div>

      {/* Menu */}
      <nav
        style={{
          flex: 1,
          padding: "20px 12px",
        }}
      >
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              display: "block",
              padding: "12px 18px",
              marginBottom: "8px",
              borderRadius: "12px",
              textDecoration: "none",
              color: "#fff",
              fontSize: "15px",
              fontWeight: isActive ? "600" : "500",
              backgroundColor: isActive
                ? "rgba(255,255,255,0.15)"
                : "transparent",
              transition: "all 0.2s ease",
            })}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* Help Card */}
      <div
        style={{
          margin: "16px",
          padding: "18px",
          backgroundColor: "#1565C0",
          borderRadius: "14px",
        }}
      >
        <h4
          style={{
            margin: "0 0 10px 0",
            fontWeight: "600",
          }}
        >
          Need Help?
        </h4>

        <p
          style={{
            fontSize: "13px",
            lineHeight: "1.6",
            marginBottom: "14px",
          }}
        >
          Visit our help center or contact support.
        </p>

        <button
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid white",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontWeight: "600",
          }}
        >
          Get Help
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "18px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: "12px",
          color: "rgba(255,255,255,0.8)",
        }}
      >
        © 2025 Digifunzi
      </div>
    </aside>
  );
}

export default Sidebar;