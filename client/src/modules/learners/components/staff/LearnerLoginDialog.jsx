import { useState } from "react";
import toast from "react-hot-toast";
import { FiCopy, FiEye, FiEyeOff, FiKey, FiX } from "react-icons/fi";
import { learnerApi } from "../../services/learnerApi";
import { T } from "../../../learner-portal/components/profile/theme";

const box = { padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, backgroundColor: "#F9FAFB", fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: T.ink, wordBreak: "break-all", flex: 1, minWidth: 0 };
const smallButton = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${T.tintBorder}`, backgroundColor: "#fff", color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const label = { margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em" };

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy — your browser blocked it");
  }
};

// The learner page's Login window: the child's own username, their password (asked for only when
// Show is clicked — every look is recorded in the Activity log), and setting a new one. Passwords
// are kept for children's logins only, from 2 Nov 2026 (server: auth/learner-password-vault.js);
// one set before then can't be shown — setting a new one here makes it showable from then on.
export default function LearnerLoginDialog({ learner, onClose }) {
  const [shown, setShown] = useState(null); // { password, hasLogin, setAt } once Show is clicked
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const reveal = async () => {
    setLoading(true);
    try {
      setShown(await learnerApi.loginPassword(learner.id));
      setVisible(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't load the password");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (newPassword.length < 6) { toast.error("Use at least 6 characters"); return; }
    setSaving(true);
    try {
      await learnerApi.update(learner.id, { learnerPassword: newPassword });
      setShown({ password: newPassword, hasLogin: true, setAt: new Date().toISOString() });
      setVisible(true);
      setNewPassword("");
      toast.success("New password saved");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't save the password");
    } finally {
      setSaving(false);
    }
  };

  const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "this learner";
  return (
    <div role="dialog" aria-modal="true" aria-label="Learner login" onClick={onClose}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1300 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, backgroundColor: "#fff", borderRadius: 16, padding: 22, fontFamily: "Inter, sans-serif", boxShadow: "0 20px 50px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><FiKey size={16} /> {name}&rsquo;s login</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: T.inkMuted, display: "flex" }}><FiX size={18} /></button>
        </div>

        {!learner.username ? (
          <p style={{ margin: 0, fontSize: 13.5, color: T.inkMuted }}>
            {name} has no username yet. Add one on the Full form (Set up a separate learner login), then come back to set a password.
          </p>
        ) : (
          <>
            <div>
              <p style={label}>Username</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={box}>{learner.username}</div>
                <button type="button" onClick={() => copy(learner.username, "Username")} style={smallButton}><FiCopy size={13} /> Copy</button>
              </div>
            </div>

            <div>
              <p style={label}>Password</p>
              {!shown ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ ...box, color: T.inkFaint }}>••••••••</div>
                  <button type="button" onClick={reveal} disabled={loading} style={smallButton}><FiEye size={13} /> {loading ? "Loading…" : "Show"}</button>
                </div>
              ) : shown.password ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={box}>{visible ? shown.password : "••••••••"}</div>
                  <button type="button" onClick={() => setVisible((v) => !v)} style={smallButton}>{visible ? <><FiEyeOff size={13} /> Hide</> : <><FiEye size={13} /> Show</>}</button>
                  <button type="button" onClick={() => copy(shown.password, "Password")} style={smallButton}><FiCopy size={13} /></button>
                </div>
              ) : (
                <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", fontSize: 13 }}>
                  {shown.hasLogin
                    ? "This password was set before passwords were kept, so it can't be shown. Set a new one below — it can be shown from then on."
                    : `${name} has no login of their own yet — set a password below to create it.`}
                </p>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.inkFaint }}>Each time a password is shown it&rsquo;s recorded in the Activity log.</p>
            </div>

            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
              <p style={label}>Set a new password</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                  <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters"
                    style={{ width: "100%", boxSizing: "border-box", padding: "10px 38px 10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none" }} />
                  <button type="button" onClick={() => setShowNew((v) => !v)} aria-label={showNew ? "Hide password" : "Show password"}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.inkMuted, display: "flex" }}>
                    {showNew ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
                <button type="button" onClick={save} disabled={saving || !newPassword} style={{ ...smallButton, backgroundColor: T.accent, color: "#fff", border: "none", opacity: saving || !newPassword ? 0.6 : 1, cursor: saving || !newPassword ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.inkFaint }}>Their old password stops working at once. The parent&rsquo;s own login isn&rsquo;t touched.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
