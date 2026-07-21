import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          padding: "12px 18px",
          borderRadius: "12px",
          border: "none",
          backgroundColor: hovered ? "rgba(255,255,255,0.1)" : "transparent",
          color: "#fff",
          fontSize: "15px",
          fontWeight: "500",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
          textAlign: "left",
          transition: "background-color 0.2s ease",
        }}
      >
        <FiLogOut size={17} style={{ flexShrink: 0 }} />
        Log Out
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
