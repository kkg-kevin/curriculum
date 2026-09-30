import { useEffect, useRef, useState } from "react";
import { FiClock } from "react-icons/fi";
import { getLastActivity, noteUserActivity } from "../../context/session";

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "wheel", "touchstart", "scroll"];
const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// Mounted by AuthProvider while someone is signed in. Watches for real user activity (clicks,
// typing, scrolling, touch, mouse movement) in this tab, shares it with the other tabs through
// the idle clock in context/session.js, warns two minutes before the limit, and signs out when
// it's reached. The clock is a timestamp, not a running timer, so a laptop that slept through
// the limit signs out the moment it wakes. The server enforces the same limit independently.
//
// Only this component re-renders on the countdown — never the app underneath.
export default function SessionTimeoutGuard({ idleTimeoutMs = DEFAULT_IDLE_MS, onTimeout, onSignOut }) {
  const [secondsLeft, setSecondsLeft] = useState(null); // null → no warning showing
  const onTimeoutRef = useRef(onTimeout);
  const timedOutRef = useRef(false);
  const stayButtonRef = useRef(null);
  const warningRef = useRef(false);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  // Activity in this tab. Throttled — only "the user is here" matters, not every event. Ignored
  // while the warning is up: moving the mouse to reach "Sign out" mustn't dismiss the warning —
  // only an explicit choice (or activity in another tab) does.
  useEffect(() => {
    let lastSeen = 0;
    const onActivity = () => {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastSeen < 5000) return;
      lastSeen = now;
      noteUserActivity();
    };
    noteUserActivity(); // opening/reloading a page is activity too
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }));
    return () => ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true }));
  }, []);

  // The countdown, re-checked every second and whenever the tab becomes visible again.
  useEffect(() => {
    const check = () => {
      if (timedOutRef.current) return;
      const idleMs = Date.now() - (getLastActivity() || Date.now());
      const leftMs = idleTimeoutMs - idleMs;
      if (leftMs <= 0) {
        timedOutRef.current = true;
        setSecondsLeft(null);
        onTimeoutRef.current?.(Math.round(idleTimeoutMs / 60000));
        return;
      }
      setSecondsLeft(leftMs <= WARNING_MS ? Math.ceil(leftMs / 1000) : null);
    };
    check();
    const interval = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [idleTimeoutMs]);

  const warning = secondsLeft !== null;
  useEffect(() => {
    warningRef.current = warning;
    if (warning) stayButtonRef.current?.focus();
  }, [warning]);

  if (!warning) return null;

  const staySignedIn = () => {
    warningRef.current = false;
    noteUserActivity({ force: true });
    setSecondsLeft(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, backgroundColor: "rgba(15,38,69,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "Inter, sans-serif" }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-body"
        style={{ width: "100%", maxWidth: "400px", backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 20px 50px rgba(15,38,69,0.25)", padding: "26px 24px 22px", textAlign: "center" }}
      >
        <div style={{ width: "48px", height: "48px", margin: "0 auto 14px", borderRadius: "50%", backgroundColor: "#FFF7E8", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FiClock size={22} />
        </div>
        <h2 id="session-timeout-title" style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800, color: "#0F2645" }}>Are you still there?</h2>
        <p id="session-timeout-body" style={{ margin: "0 0 20px", fontSize: "13.5px", lineHeight: 1.55, color: "#4B5563" }}>
          For your security you&rsquo;ll be signed out in{" "}
          <strong style={{ color: "#0F2645", fontVariantNumeric: "tabular-nums" }}>{formatCountdown(secondsLeft)}</strong>{" "}
          because you&rsquo;ve been inactive.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSignOut}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#374151", fontSize: "13.5px", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
          >
            Sign out
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            onClick={staySignedIn}
            style={{ padding: "10px 20px", borderRadius: "10px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "13.5px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
