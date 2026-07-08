import { Link } from "react-router-dom";
import { FiLifeBuoy } from "react-icons/fi";

export default function ForgotPasswordPage() {
  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "22px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            backgroundColor: "#FFF7E8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <FiLifeBuoy size={22} color="#feb139" />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#111827" }}>
          Password resets aren't self-service yet
        </h2>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.6 }}>
          Please contact your school administrator and ask them to reset your account password.
        </p>
      </div>

      <Link to="/login" className="df-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
        Back to login
      </Link>
    </>
  );
}
