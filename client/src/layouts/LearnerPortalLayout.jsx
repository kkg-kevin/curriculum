import { Outlet } from "react-router-dom";
import LearnerSidebar from "../modules/learner-portal/components/LearnerSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";

const SIDEBAR_WIDTH = 260;

function LearnerPortalLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <LearnerSidebar />

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

export default LearnerPortalLayout;
