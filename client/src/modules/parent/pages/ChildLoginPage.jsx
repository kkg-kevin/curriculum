import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { FiArrowLeft, FiKey, FiUser } from "react-icons/fi";
import { T, cardStyle } from "../../learner-portal/components/profile/theme";
import { useChildLogin, useSetChildLogin } from "../hooks/useParent";

const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "Inter, sans-serif" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink };

// The child's own login: how they sign in, and a new password when they've forgotten theirs (or
// a first login, username included, when they've never had one).
export default function ChildLoginPage() {
  const { child, portalBase } = useOutletContext();
  const { data: login, isLoading } = useChildLogin(child.id);
  const save = useSetChildLogin(child.id);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;

  const needsUsername = !login?.username;
  const mismatch = confirm && password !== confirm;
  const valid = password.length >= 8 && password === confirm && (!needsUsername || /^[a-zA-Z0-9._-]{3,30}$/.test(username.trim()));
  const signInAt = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

  const submit = (event) => {
    event.preventDefault();
    save.mutate(needsUsername ? { username: username.trim(), password } : { password }, {
      onSuccess: () => { setPassword(""); setConfirm(""); setUsername(""); },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "Inter, sans-serif" }}>
    <Link to={portalBase} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
      <FiArrowLeft size={15} /> {child.firstName}&apos;s profile
    </Link>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16, alignItems: "start" }}>
      <div style={{ ...cardStyle({ padding: "18px 20px" }) }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><FiUser style={{ color: T.accentMid }} /> How {child.firstName} signs in</h2>
        {needsUsername ? (
          <p style={{ margin: 0, fontSize: 13.5, color: T.inkMuted }}>{child.firstName} doesn&apos;t have a login yet. Choose a username and password to set one up.</p>
        ) : (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 13.5, color: T.inkMuted }}>Username</p>
            <p style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 800, color: T.accent, letterSpacing: "0.02em" }}>{login.username}</p>
            <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, lineHeight: 1.55 }}>
              {child.firstName} signs in at <strong>{signInAt}</strong> with this username and their own password. Their login only ever shows their own work — not yours, and not their brothers&apos; or sisters&apos;.
            </p>
          </>
        )}
      </div>

      <form onSubmit={submit} style={{ ...cardStyle({ padding: "18px 20px" }), display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><FiKey style={{ color: T.accentMid }} /> {needsUsername ? "Set up a login" : "Set a new password"}</h2>
        {needsUsername && (
          <label style={label}>
            Username
            <input style={input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. amani.k" autoComplete="off" />
            <span style={{ fontWeight: 400, color: T.inkFaint, fontSize: 11.5 }}>3–30 letters, numbers, dots, underscores or hyphens.</span>
          </label>
        )}
        <label style={label}>
          New password
          <input type="password" style={input} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <label style={label}>
          Type it again
          <input type="password" style={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          {mismatch && <span style={{ fontWeight: 500, color: "#B91C1C", fontSize: 12 }}>The two passwords don&apos;t match.</span>}
        </label>
        <p style={{ margin: 0, fontSize: 12, color: T.inkFaint }}>At least 8 characters. {child.firstName}&apos;s old password stops working straight away.</p>
        <button type="submit" disabled={!valid || save.isPending} style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 10, border: "none", background: !valid || save.isPending ? "#9CB4C9" : T.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: !valid || save.isPending ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
          {save.isPending ? "Saving…" : needsUsername ? "Create login" : "Save password"}
        </button>
      </form>
    </div>
    </div>
  );
}
