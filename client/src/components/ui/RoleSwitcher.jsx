import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiChevronDown, FiCheck, FiRepeat } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { ROLE_HOME } from "../../routes/RoleRoute";
import { roleMeta } from "../../modules/auth/roles";

// The header's role switcher, for a login that holds more than one role (an admin who also
// teaches — see the server's modules/auth/account-roles.js). `label` is how the current role
// already reads in the header; `compact` (phones, where the name is hidden) shows just an icon.
// Renders the plain label when there's nothing to switch to.
//
// The menu is portalled into document.body with fixed positioning from the trigger's
// getBoundingClientRect — the layouts wrap Header in an `overflow: hidden` container, which clips
// anything positioned inside it (same reason as Header's AdminAvatarPopover).
export default function RoleSwitcher({ label, compact = false }) {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const roles = user?.roles || [];
  const open = !!pos;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (roles.length < 2) {
    return compact ? null : <div style={{ fontSize: "12px", color: "#6B7280" }}>{label}</div>;
  }

  const toggle = () => {
    if (open) { setPos(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  };

  const choose = async (role) => {
    if (role === (user.sessionRole || user.role)) { setPos(null); return; }
    setBusy(role);
    try {
      await switchRole(role);
      setPos(null);
      navigate(ROLE_HOME[role] || "/", { replace: true });
      toast.success(`Now signed in as ${roleMeta(role).label}`);
    } catch (err) {
      toast.error(err.message || "Couldn't switch role. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `Switch role (now ${label})` : undefined}
        title="Switch role"
        style={compact ? {
          width: "34px", height: "34px", borderRadius: "50%", border: "1px solid #E5E7EB", background: "#fff",
          display: "grid", placeItems: "center", cursor: "pointer", color: "#25476a", flexShrink: 0,
        } : {
          display: "inline-flex", alignItems: "center", gap: "4px", padding: 0, border: "none", background: "none",
          fontSize: "12px", color: "#25476a", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {compact ? <FiRepeat size={15} /> : <>{label}<FiChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} /></>}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: "260px", maxWidth: "calc(100vw - 16px)",
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(15, 38, 69, 0.16)", padding: "6px", fontFamily: "Inter, sans-serif",
          }}
        >
          <p style={{ margin: "6px 10px 6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9CA3AF" }}>
            Signed in as
          </p>
          {roles.map((role) => {
            const meta = roleMeta(role);
            const Icon = meta.icon;
            // An Account Manager / Training Lead session shows as "school" (the hub portal).
            const current = role === (user.sessionRole || user.role);
            return (
              <button
                key={role}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => choose(role)}
                disabled={!!busy}
                style={{
                  display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 10px",
                  border: "none", borderRadius: "8px", background: current ? "#F1F7FC" : "transparent",
                  cursor: busy ? "default" : "pointer", textAlign: "left", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { if (!current) e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = current ? "#F1F7FC" : "transparent"; }}
              >
                <span style={{ width: "30px", height: "30px", borderRadius: "8px", display: "grid", placeItems: "center", flexShrink: 0, background: current ? "#25476a" : "#EEF4FA", color: current ? "#fff" : "#25476a" }}>
                  <Icon size={15} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "13.5px", fontWeight: 700, color: "#111827" }}>{meta.label}</span>
                  <span style={{ display: "block", fontSize: "11.5px", color: "#6B7280" }}>{busy === role ? "Switching…" : meta.hint}</span>
                </span>
                {current && <FiCheck size={15} color="#25476a" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
