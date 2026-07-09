import { Outlet, useLocation } from "react-router-dom";
import { FiCheck, FiLogIn, FiUserPlus } from "react-icons/fi";
import logo from "../assets/Logo-image.png";

const HERO_CONTENT = {
  "/signup": {
    badge: "Guided Signup",
    badgeIcon: FiUserPlus,
    title: "Choose how you want to use Digifunzii.",
    subtitle: "A short two-step registration so your account starts in the right place.",
    points: [
      "Teachers deliver sessions, grade assessments, and track learners.",
      "Learners access courses, complete assessments, and see their progress.",
      "Everything stays organized against your school's curriculum.",
    ],
  },
  "/login": {
    badge: "Welcome Back",
    badgeIcon: FiLogIn,
    title: "Sign in and pick up where you left off.",
    subtitle: "Access your curriculum, classes, and learners with one account.",
    points: [
      "Track curriculum delivery and learner progress in one place.",
      "Jump back into your role-specific dashboard instantly.",
      "Your session stays secure with encrypted sign-in.",
    ],
  },
  "/forgot-password": {
    badge: "Account Recovery",
    badgeIcon: FiLogIn,
    title: "We'll help you get back in.",
    subtitle: "For now, account recovery goes through your school administrator.",
    points: [
      "Your school administrator can update your account credentials directly.",
      "Once it's reset, sign in again with your new password.",
      "Self-service reset via email is coming soon.",
    ],
  },
};

function AuthLayout() {
  const location = useLocation();
  const hero = HERO_CONTENT[location.pathname] || HERO_CONTENT["/login"];
  const BadgeIcon = hero.badgeIcon;

  return (
    <div className="df-auth-outer">
      <style>{`
        .df-auth-outer {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 20% 10%, #eef5fa 0%, #F5F7FA 45%, #eef7f4 100%);
          font-family: 'Inter', sans-serif;
          padding: 32px 20px;
        }
        .df-auth-card {
          width: 100%;
          max-width: 960px;
          min-height: 600px;
          display: flex;
          background-color: #ffffff;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(17, 24, 39, 0.12);
          overflow: hidden;
        }
        .df-auth-hero {
          flex: 1 1 45%;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 44px;
          color: #ffffff;
          background: linear-gradient(135deg, #16324f 0%, #1d4f63 55%, #1c6e63 100%);
          overflow: hidden;
        }
        .df-auth-hero::before {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border-radius: 50%;
          background: rgba(56, 170, 225, 0.25);
          filter: blur(46px);
          bottom: -90px;
          left: -90px;
        }
        .df-auth-hero::after {
          content: "";
          position: absolute;
          width: 170px;
          height: 170px;
          border-radius: 50%;
          background: rgba(254, 177, 57, 0.22);
          filter: blur(34px);
          bottom: -30px;
          left: 60px;
        }
        .df-auth-hero > * { position: relative; z-index: 1; }
        .df-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 999px;
          background-color: rgba(255,255,255,0.14);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.2px;
          width: fit-content;
          margin-bottom: 22px;
        }
        .df-hero-points { display: flex; flex-direction: column; gap: 14px; margin-top: 28px; }
        .df-hero-point { display: flex; align-items: flex-start; gap: 10px; }
        .df-hero-tick {
          width: 20px;
          height: 20px;
          min-width: 20px;
          border-radius: 50%;
          background-color: #feb139;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
        }

        .df-auth-form-col {
          flex: 1 1 55%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 44px;
          overflow-y: auto;
        }
        .df-auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 26px;
        }
        .df-auth-logo img { height: 34px; width: auto; }
        .df-auth-form-inner { width: 100%; max-width: 380px; }

        @media (max-width: 900px) {
          .df-auth-hero { display: none; }
          .df-auth-card { max-width: 440px; min-height: 0; }
        }

        .df-input-group { position: relative; }
        .df-input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9CA3AF;
          pointer-events: none;
          display: flex;
        }
        .df-input {
          width: 100%;
          padding: 13px 14px 13px 40px;
          border-radius: 12px;
          border: 1.5px solid #E5E7EB;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: #111827;
          background-color: #F9FAFB;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
        }
        .df-input:focus {
          border-color: #38aae1;
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(56,170,225,0.15);
        }
        .df-input.has-error {
          border-color: #FCA5A5;
          background-color: #FFF5F5;
        }
        .df-input--with-toggle { padding-right: 40px; }
        .df-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9CA3AF;
          cursor: pointer;
          display: flex;
          padding: 4px;
        }
        .df-toggle-btn:hover { color: #6B7280; }

        .df-btn-primary {
          width: 100%;
          padding: 13px 20px;
          background-color: #feb139;
          color: #16324f;
          border: none;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background-color 0.15s, transform 0.05s;
        }
        .df-btn-primary:hover:not(:disabled) { background-color: #f5a423; }
        .df-btn-primary:active:not(:disabled) { transform: translateY(1px); }
        .df-btn-primary:disabled { background-color: #fce8c2; color: #a9863f; cursor: not-allowed; }

        .df-btn-secondary {
          padding: 11px 20px;
          background-color: #ffffff;
          color: #25476a;
          border: 1.5px solid #E5E7EB;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
        }
        .df-btn-secondary:hover { background-color: #F9FAFB; }

        .df-link { color: #25476a; font-weight: 600; text-decoration: none; }
        .df-link:hover { text-decoration: underline; }

        .df-step-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
        .df-step-tab {
          flex: 1;
          padding: 9px 10px;
          border-radius: 999px;
          border: none;
          background-color: #F3F4F6;
          color: #9CA3AF;
          font-size: 12.5px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
        }
        .df-step-tab.active { background-color: #16324f; color: #ffffff; }
        .df-step-tab:disabled { cursor: not-allowed; opacity: 0.6; }

        .df-role-grid { display: flex; flex-direction: column; gap: 12px; }
        .df-role-tile {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          text-align: left;
          padding: 16px;
          border-radius: 14px;
          border: 1.5px solid #E5E7EB;
          background-color: #F9FAFB;
          cursor: pointer;
          transition: all 0.15s;
        }
        .df-role-tile:hover { border-color: #b8d9ee; }
        .df-role-tile.selected { border-color: #25476a; background-color: #EFF6FB; }
        .df-role-tile-icon {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 10px;
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #25476a;
          border: 1px solid #E5E7EB;
        }
      `}</style>

      <div className="df-auth-card">
        <div className="df-auth-hero">
          <div className="df-hero-badge"><BadgeIcon size={14} />{hero.badge}</div>
          <h1 style={{ fontSize: "30px", fontWeight: "700", margin: "0 0 12px", lineHeight: 1.25 }}>
            {hero.title}
          </h1>
          <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.78)", margin: 0, lineHeight: 1.6, maxWidth: "360px" }}>
            {hero.subtitle}
          </p>
          <div className="df-hero-points">
            {hero.points.map((point) => (
              <div key={point} className="df-hero-point">
                <span className="df-hero-tick"><FiCheck size={13} color="#16324f" /></span>
                <span style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.88)", lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="df-auth-form-col">
          <div className="df-auth-logo"><img src={logo} alt="Digifunzi" /></div>
          <div className="df-auth-form-inner">
            <Outlet />
          </div>
        </div>
      </div>

      <p style={{ marginTop: "20px", fontSize: "12px", color: "#9CA3AF" }}>
        © {new Date().getFullYear()} Digifunzii Curriculum
      </p>
    </div>
  );
}

export default AuthLayout;
