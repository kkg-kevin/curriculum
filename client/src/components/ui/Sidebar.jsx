import { NavLink } from "react-router-dom";
import logo from "../../assets/Logo-image.png";

function Sidebar({ isMobile = false, isMobileOpen = false, onClose = () => {} }) {
  const menuItems = [
    { name: "Dashboard", path: "/" },
    { name: "Locations", path: "/locations" },
    { name: "Curriculum", path: "/curriculum" },
    { name: "Learners", path: "/learners" },
    { name: "Teachers", path: "/teachers" },
    { name: "Classes", path: "/classes" },
    { name: "Courses", path: "/courses" },
    { name: "Assessments", path: "/assessments" },
    { name: "Reports", path: "/reports" },
    { name: "Settings", path: "/settings" },
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
          <img
            src={logo}
            alt="Digifunzi"
            style={{
              height: "40px",
              width: "auto",
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
            }}
          />

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
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
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
          ))}
        </nav>

        <div
          style={{
            margin: "16px",
            padding: "18px",
            backgroundColor: "#2e7db5",
            borderRadius: "14px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontWeight: "600" }}>Need Help?</h4>

          <p style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "14px" }}>
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
    </>
  );
}

export default Sidebar;