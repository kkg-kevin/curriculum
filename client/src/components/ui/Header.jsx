import { FiBell } from "react-icons/fi";
import { useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();

  const pageTitles = {
    "/": "Dashboard",
    "/schools": "Schools",
    "/curriculum": "Curriculum",
    "/curriculum/create": "Create Curriculum",
    "/learners": "Learners",
    "/teachers": "Teachers",
    "/classes": "Classes",
    "/assessments": "Assessments",
    "/reports": "Reports",
    "/settings": "Settings",
  };

  const getPageTitle = (pathname) => {
    if (pageTitles[pathname]) return pageTitles[pathname];
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/structure"))
      return "Structure Builder";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/edit"))
      return "Edit Curriculum";
    if (pathname.startsWith("/curriculum/") && pathname.endsWith("/view"))
      return "Curriculum View";
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
        padding: "0 24px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Dynamic Page Title */}
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: "600",
            color: "#111827",
          }}
        >
          {pageTitle}
        </h2>
      </div>

      {/* Right Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            color: "#374151",
          }}
        >
          <FiBell size={22} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#0D47A1",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "600",
            }}
          >
            A
          </div>

          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#111827",
              }}
            >
              Admin User
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#6B7280",
              }}
            >
              Administrator
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;