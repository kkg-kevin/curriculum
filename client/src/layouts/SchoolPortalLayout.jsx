import { Outlet } from "react-router-dom";
import SchoolPortalSidebar from "../modules/school-portal/components/SchoolPortalSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";

const SIDEBAR_WIDTH = 260;

function SchoolPortalLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <SchoolPortalSidebar />

      <div
        style={{
          marginLeft: SIDEBAR_WIDTH,
          width: `calc(100vw - ${SIDEBAR_WIDTH}px)`,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#F5F7FA",
          overflow: "hidden",
        }}
      >
        <Header />

        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default SchoolPortalLayout;
