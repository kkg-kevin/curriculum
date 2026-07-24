import { Outlet } from "react-router-dom";
import TeacherSidebar from "../modules/teacher-portal/components/TeacherSidebar";
import Header from "../components/ui/Header";
import Footer from "../components/ui/Footer";
import HubSwitcher from "../components/ui/HubSwitcher";
import { useTeacherPortalScope } from "../modules/teacher-portal/hooks/useTeacherPortalScope";

function TeacherPortalLayout() {
  const scope = useTeacherPortalScope();
  const { hubs, selectedHubId, setSelectedHubId, hasNoHubs } = scope;

  return (
    <div className="teacher-shell">
      <TeacherSidebar />

      <div className="teacher-shell__content">
        <Header />

        <main className="teacher-shell__main">
          <div className="teacher-shell__main-inner">
            {hasNoHubs ? (
              <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>You haven't been assigned to a learning hub yet</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Contact your administrator to get assigned to a learning hub.</p>
              </div>
            ) : (
              <>
                <HubSwitcher hubs={hubs} selectedHubId={selectedHubId} onChange={setSelectedHubId} />
                <Outlet context={scope} />
              </>
            )}
          </div>
        </main>

        <Footer />
      </div>

      <style>{`
        .teacher-shell {
          display: flex;
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(56,170,225,0.10), transparent 28%),
            linear-gradient(180deg, #F8FBFE 0%, #F5F7FA 100%);
        }
        .teacher-shell__content {
          margin-left: 260px;
          width: calc(100vw - 260px);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .teacher-shell__main {
          flex: 1;
          padding: 28px 32px 36px;
          min-width: 0;
        }
        .teacher-shell__main-inner {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
        }
        @media (max-width: 960px) {
          .teacher-shell {
            flex-direction: column;
          }
          .teacher-shell__content {
            margin-left: 0;
            width: 100%;
          }
          .teacher-shell__main {
            padding: 20px 16px 24px;
          }
        }
      `}</style>
    </div>
  );
}

export default TeacherPortalLayout;
