import { useState } from "react";
import toast from "react-hot-toast";
import { authApi } from "../services/authApi";

// Self-service password change — most immediately useful for a learner auto-provisioned with a
// temporary password (see bootcamp-enrollment.service.js) who wants to set their own. Reachable
// even while the account is suspended/pending-payment: auth.routes.js's change-password route
// uses the bare `protect` (not app.js's protect+blockIfSuspended chain), so this keeps working
// regardless of account status — being able to set your own password shouldn't require the
// account to be unlocked first.
export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    setIsSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Could not change password");
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px",
    border: "1.5px solid #E5E7EB", fontSize: "13.5px", fontFamily: "Inter, sans-serif",
    color: "#111827", outline: "none",
  };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "5px" };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Change Password</h2>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: 400 }}>
        <div>
          <label style={labelStyle}>Current password</label>
          <input type="password" required style={inputStyle} value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setError(""); }} />
        </div>
        <div>
          <label style={labelStyle}>New password</label>
          <input type="password" required minLength={8} style={inputStyle} value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(""); }} />
        </div>
        <div>
          <label style={labelStyle}>Confirm new password</label>
          <input type="password" required style={inputStyle} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} />
        </div>
        {error && <p style={{ margin: 0, fontSize: "12.5px", color: "#DC2626", fontWeight: 600 }}>{error}</p>}
        <div>
          <button
            type="submit"
            disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
            style={{
              padding: "9px 18px", backgroundColor: isSaving ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none",
              borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif",
              cursor: isSaving ? "default" : "pointer",
            }}
          >
            {isSaving ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </div>
  );
}
