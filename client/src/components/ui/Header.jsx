import { FiSearch, FiBell } from "react-icons/fi";
import { useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();

  const pageTitles = {
    "/": "Dashboard",
    "/schools": "Schools",
    "/curriculum": "Curriculum",
    "/curriculum/create": "Create Curriculum",
    "/supplementary": "Supplementary",
    "/supplementary/create": "Create Supplementary",
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
    if (pathname.startsWith("/supplementary/") && pathname.endsWith("/view"))
      return "Supplementary View";
    if (pathname.startsWith("/supplementary/") && pathname.endsWith("/edit"))
      return "Edit Supplementary";
    if (pathname.startsWith("/supplementary/") && pathname.endsWith("/editor"))
      return "Edit Courses";
    if (pathname.startsWith("/supplementary/") && pathname.endsWith("/map"))
      return "Map to Base";
    if (pathname.startsWith("/supplementary/") && pathname.endsWith("/assign"))
      return "Assign Schools";
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

      {/* Search */}
      <div
        style={{
          width: "200px",
          position: "relative",
        }}
      >
        <FiSearch
          size={18}
          style={{
            position: "absolute",
            left: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#6B7280",
          }}
        />

        <input
          type="text"
          placeholder="Search..."
          style={{
            width: "100%",
            padding: "12px 16px 12px 42px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            outline: "none",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            backgroundColor: "#F9FAFB",
          }}
        />
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