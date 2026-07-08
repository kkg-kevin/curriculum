import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F7FA",
        fontFamily: "Inter, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #E5E7EB",
          boxShadow: "0 4px 24px rgba(17, 24, 39, 0.06)",
          padding: "36px 32px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#25476a",
              color: "#feb139",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              fontSize: "20px",
              margin: "0 auto 14px",
            }}
          >
            D
          </div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#111827" }}>
            Digifunzii Curriculum
          </h1>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;
