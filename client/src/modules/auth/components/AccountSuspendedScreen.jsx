import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiShield, FiClock, FiLifeBuoy, FiRefreshCw } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import logo from "../../../assets/Logo-image.png";

// Shown IN-APP (behind a real, logged-in session) when the account is suspended. Rendered by
// ProtectedRoute in place of the whole authenticated app, so it's the only route a suspended
// user can reach. Carries its own minimal header + sign-out; no sidebar, no navigation.

const COPY_BY_REASON = {
  learner: {
    who: "your learner account",
    dataBody: "Your courses, assessments, progress, and reports are all untouched.",
    contactTitle: "Contact your school administrator",
    contactBody: "Your school administrator manages account access. Reach out to them to have your account reactivated.",
  },
  teacher: {
    who: "your educator account",
    dataBody: "Your classes, learners, assessments, and reports are all untouched.",
    contactTitle: "Contact your school administrator",
    contactBody: "Your school administrator manages educator access. Reach out to them to have your account reactivated.",
  },
  hub: {
    who: "this learning hub",
    dataBody: "Every class, learner, assessment, and report at this hub is untouched.",
    contactTitle: "Contact Digifunzi support",
    contactBody: "This learning hub's access is managed by Digifunzi. Get in touch with the Digifunzi team to have it reactivated.",
  },
};

/* Brand-palette illustration — a shield "on hold" with an orbiting pause glyph. Inline SVG so it
 * scales crisp at any size, needs no asset pipeline, and themes with the surrounding panel. */
function SuspendedArt() {
  return (
    <svg viewBox="0 0 320 320" width="100%" height="100%" role="img" aria-label="Account on hold" style={{ maxWidth: 360 }}>
      <defs>
        <linearGradient id="sa-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#feb139" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="sa-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {/* soft concentric rings */}
      <circle cx="160" cy="160" r="140" fill="none" stroke="url(#sa-ring)" strokeWidth="1.5" />
      <circle cx="160" cy="160" r="108" fill="none" stroke="url(#sa-ring)" strokeWidth="1.5" strokeDasharray="4 8" />
      <circle cx="160" cy="160" r="150" fill="#ffffff" fillOpacity="0.05" />

      {/* shield */}
      <path
        d="M160 66c22 16 44 22 66 22v58c0 46-28 78-66 92-38-14-66-46-66-92V88c22 0 44-6 66-22z"
        fill="url(#sa-shield)"
      />
      <path
        d="M160 66c22 16 44 22 66 22v58c0 46-28 78-66 92-38-14-66-46-66-92V88c22 0 44-6 66-22z"
        fill="#ffffff" fillOpacity="0.12"
      />

      {/* pause glyph inside the shield */}
      <rect x="142" y="128" width="12" height="52" rx="6" fill="#ffffff" />
      <rect x="166" y="128" width="12" height="52" rx="6" fill="#ffffff" />

      {/* orbiting badge */}
      <g>
        <circle cx="238" cy="92" r="22" fill="#25476a" />
        <circle cx="238" cy="92" r="22" fill="#ffffff" fillOpacity="0.06" />
        <rect x="231" y="83" width="5" height="18" rx="2.5" fill="#ffffff" />
        <rect x="240" y="83" width="5" height="18" rx="2.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

function AssuranceItem({ icon, title, body }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: "#EFF6FB", border: "1px solid #d7ecf7",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a",
        }}
      >
        {icon}
      </span>
      <div>
        <p style={{ margin: "1px 0 2px", fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}

export default function AccountSuspendedScreen({ reason }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const copy = COPY_BY_REASON[reason] || COPY_BY_REASON.learner;
  // Greet a person by first name — but a "hub" suspension is an organisation, not a person,
  // so don't address it by a chopped-up hub name.
  const firstName =
    reason === "hub" ? null : user?.name?.trim()?.split(/\s+/)?.[0] || null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F5F7FA", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .as-shell { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .as-card {
          width: 100%; max-width: 980px; display: flex; background: #fff; border-radius: 28px;
          overflow: hidden; box-shadow: 0 24px 70px rgba(17,24,39,0.14);
        }
        .as-visual {
          flex: 0 0 42%; position: relative; display: flex; flex-direction: column;
          justify-content: space-between; padding: 40px 36px; color: #fff;
          background: linear-gradient(150deg, #16324f 0%, #1d4f63 55%, #1c6e63 100%);
          overflow: hidden;
        }
        .as-visual::before {
          content: ""; position: absolute; width: 260px; height: 260px; border-radius: 50%;
          background: rgba(56,170,225,0.28); filter: blur(52px); top: -70px; right: -80px;
        }
        .as-visual::after {
          content: ""; position: absolute; width: 200px; height: 200px; border-radius: 50%;
          background: rgba(254,177,57,0.22); filter: blur(46px); bottom: -60px; left: -50px;
        }
        .as-visual > * { position: relative; z-index: 1; }
        .as-art-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px 0 20px; }
        .as-body { flex: 1; padding: 44px 48px; display: flex; flex-direction: column; }
        @media (max-width: 860px) {
          .as-card { flex-direction: column; max-width: 460px; }
          .as-visual { flex: none; padding: 28px 28px 8px; }
          .as-art-wrap { padding: 8px 0 0; }
          .as-art-wrap svg { max-width: 200px; }
          .as-body { padding: 32px 28px; }
        }
      `}</style>

      {/* Minimal branded header — no navigation, just the mark and a way out */}
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px", background: "#fff", borderBottom: "1px solid #E5E7EB",
        }}
      >
        <img src={logo} alt="Digifunzi" style={{ height: 26, width: "auto", objectFit: "contain" }} />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px",
            borderRadius: 999, border: "1.5px solid #E5E7EB", background: "#fff",
            color: "#25476a", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
            cursor: signingOut ? "default" : "pointer", opacity: signingOut ? 0.6 : 1,
          }}
        >
          <FiLogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <div className="as-shell">
        <div className="as-card">
          {/* Visual panel */}
          <div className="as-visual">
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 13px",
                borderRadius: 999, background: "rgba(255,255,255,0.14)", fontSize: 12,
                fontWeight: 700, letterSpacing: "0.3px", width: "fit-content",
              }}
            >
              <FiClock size={13} /> Access paused
            </span>

            <div className="as-art-wrap">
              <SuspendedArt />
            </div>

            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
              Nothing has been deleted. Your account and everything in it stay exactly as they are
              until access is restored.
            </p>
          </div>

          {/* Message + actions */}
          <div className="as-body">
            <h1 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.4px" }}>
              {firstName ? `${firstName}, your account is suspended` : "Account suspended"}
            </h1>
            <p style={{ margin: 0, fontSize: 14.5, color: "#6B7280", lineHeight: 1.65 }}>
              Access to {copy.who} on Digifunzi has been temporarily suspended. You can sign back in
              as soon as it's reactivated.
            </p>

            <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
              <AssuranceItem
                icon={<FiShield size={16} />}
                title="Your data is safe"
                body={copy.dataBody}
              />
              <AssuranceItem
                icon={<FiRefreshCw size={16} />}
                title="This is usually temporary"
                body="Suspensions are typically resolved quickly once you get in touch."
              />
            </div>

            <div
              style={{
                marginTop: 26, padding: "18px 20px", borderRadius: 16,
                background: "#FFFBEB", border: "1.5px solid #FDE68A",
              }}
            >
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "#FEF3C7",
                    border: "1px solid #FDE68A", display: "flex", alignItems: "center",
                    justifyContent: "center", color: "#B45309",
                  }}
                >
                  <FiLifeBuoy size={17} />
                </span>
                <div>
                  <p style={{ margin: "1px 0 3px", fontSize: 13.5, fontWeight: 800, color: "#92400E" }}>
                    {copy.contactTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#92400E", opacity: 0.9, lineHeight: 1.55 }}>
                    {copy.contactBody}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "auto", paddingTop: 26 }}>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "13px 20px", borderRadius: 999, border: "none",
                  background: "#25476a", color: "#fff", fontSize: 14, fontWeight: 700,
                  fontFamily: "Inter, sans-serif", cursor: signingOut ? "default" : "pointer",
                  opacity: signingOut ? 0.7 : 1,
                }}
              >
                <FiLogOut size={15} /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
              <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#9CA3AF", textAlign: "center" }}>
                Signed in as {user?.email || user?.name || "your account"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
