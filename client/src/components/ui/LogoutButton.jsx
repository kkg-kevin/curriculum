import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

// variant "sidebar" (default) assumes the dark sidebar background every portal's Sidebar already
// renders this against. variant "light" is for the rare screen with no sidebar at all — e.g. the
// learner-portal's FirstLoginDiagnosticGate, which hides the sidebar entirely while active but
// still needs to let a learner sign out instead of being stuck with no way out. `collapsed`
// shrinks a "sidebar"-variant button to icon-only, centered — for when the sidebar itself is
// collapsed to a narrow icon rail; irrelevant to "light" (never rendered in a collapsed sidebar).
function LogoutButton({ variant = "sidebar", collapsed = false }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const style = variant === "light"
    ? {
        display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "8px 16px", borderRadius: "20px",
        border: `1.5px solid ${hovered ? "#D1D5DB" : "#E5E7EB"}`,
        backgroundColor: hovered ? "#F9FAFB" : "#fff",
        color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif",
        cursor: "pointer", transition: "background-color 0.2s ease",
      }
    : {
        display: "flex", alignItems: "center", gap: "10px", width: "100%",
        padding: collapsed ? "12px" : "12px 18px", borderRadius: "12px", border: "none",
        justifyContent: collapsed ? "center" : "flex-start",
        backgroundColor: hovered ? "rgba(255,255,255,0.1)" : "transparent",
        color: "#fff", fontSize: "15px", fontWeight: "500", fontFamily: "Inter, sans-serif",
        cursor: "pointer", textAlign: "left", transition: "background-color 0.2s ease",
      };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={collapsed ? "Log Out" : undefined}
        style={style}
      >
        <FiLogOut size={variant === "light" ? 14 : 17} style={{ flexShrink: 0 }} />
        {!collapsed && "Log Out"}
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Log out?"
        message="Are you sure you want to log out? You'll need to sign in again to continue."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

export default LogoutButton;
