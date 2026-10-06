import { useState } from "react";
import toast from "react-hot-toast";
import { FiLock, FiMail, FiShield, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../auth/services/authApi";
import { useSupervisorClaims } from "../hooks/useClaims";
import { T, cardStyle, formatDate, inputStyle, primaryButton } from "../shared";
import { Avatar } from "../components/supervisorParts";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";

const label = { display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink };

function Detail({ icon: Icon, name, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid #F1F5F9` }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>{name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: T.ink, overflowWrap: "anywhere" }}>{value}</p>
      </div>
    </div>
  );
}

// The supervisor's own account: who they are signed in as, and changing their password. Their
// name and email are set by the admin who created the account.
export default function SupervisorProfilePage() {
  const { user } = useAuth();
  const { data } = useSupervisorClaims();
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [saving, setSaving] = useState(false);

  const mismatch = form.again.length > 0 && form.next !== form.again;
  const valid = form.current && form.next.length >= 8 && form.next === form.again;
  const educators = data?.educators?.length;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      toast.success("Password changed");
      setForm({ current: "", next: "", again: "" });
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not change the password");
    } finally {
      setSaving(false);
    }
  };

  const field = (key, name, autoComplete, hint) => (
    <div>
      <label htmlFor={`password-${key}`} style={label}>{name}</label>
      <input id={`password-${key}`} type="password" autoComplete={autoComplete} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={{ ...inputStyle, borderColor: key === "again" && mismatch ? "#FCA5A5" : T.border }} />
      {hint && <p style={{ margin: "5px 0 0", fontSize: 11.5, color: key === "again" && mismatch ? "#B91C1C" : T.inkMuted }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>My Profile</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>Your supervisor account and password.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <Avatar name={user?.name} photo={user?.photo} size={60} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.ink, overflowWrap: "anywhere" }}>{user?.name}</p>
              <span style={{ display: "inline-block", marginTop: 4, padding: "3px 10px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 12, fontWeight: 700 }}>Supervisor</span>
            </div>
          </div>
          <Detail icon={FiMail} name="Email (you sign in with this)" value={user?.email || "—"} />
          <Detail icon={FiUsers} name="Educators you supervise" value={educators == null ? "—" : educators} />
          <Detail icon={FiShield} name="Account created" value={formatDate(user?.createdAt)} />
          <p style={{ margin: "14px 0 0", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.6 }}>Your name, email and the educators assigned to you are managed by the admin. Ask them if any of it needs changing.</p>
        </div>

        <form onSubmit={submit} style={{ ...cardStyle, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FFF4DC", color: "#B45309", display: "grid", placeItems: "center" }}><FiLock size={15} /></span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Change password</h2>
          </div>
          {field("current", "Current password", "current-password")}
          {field("next", "New password", "new-password", "8 characters or more.")}
          {field("again", "New password again", "new-password", mismatch ? "The two new passwords don't match." : undefined)}
          <button type="submit" disabled={!valid || saving} style={{ ...primaryButton(!valid || saving), alignSelf: "flex-start" }}>{saving ? "Saving…" : "Change password"}</button>
        </form>

        <div style={{ ...cardStyle, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><FiMail size={15} /></span>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Email notifications</h2>
          </div>
          <EmailNotificationSettings padding={0} />
        </div>
      </div>
    </div>
  );
}
