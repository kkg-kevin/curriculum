import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiCalendar, FiChevronRight, FiX } from "react-icons/fi";
import { readLocal, writeLocal } from "../../../utils/safeStorage";
import { BRAND, FONT, card } from "../../../theme/brand";
import { useAvailabilityStatus } from "../hooks/useAvailability";

// On the educator's dashboard: sessions a class has landed on, or, where mentor booking is on and
// they've set no hours, the way to set them. "Not now" hides the second for two weeks.

const QUIET_DAYS = 14;

export default function AvailabilityPrompt({ teacherId }) {
  const { data: status } = useAvailabilityStatus(teacherId);
  const key = `availability.promptHidden.${teacherId}`;
  const [hidden, setHidden] = useState(() => Number(readLocal(key) || 0) > Date.now());
  if (!status) return null;

  const row = { ...card, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, fontFamily: FONT, textDecoration: "none" };
  if (status.needsNewTime > 0) {
    return (
      <Link to="/teacher-portal/bookings" style={{ ...row, border: `1px solid ${BRAND.goldBorder}`, background: BRAND.goldTint, color: BRAND.goldText }}>
        <FiAlertCircle size={18} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{status.needsNewTime} mentor session{status.needsNewTime === 1 ? " needs" : "s need"} a new time because of a class.</span>
        <FiChevronRight style={{ flexShrink: 0 }} />
      </Link>
    );
  }
  if (hidden || status.checks.hours || !status.checks.open || !status.checks.active) return null;
  return (
    <div style={{ ...row, border: `1px solid ${BRAND.skyBorder}`, background: BRAND.skyTint, flexWrap: "wrap" }}>
      <FiCalendar size={18} color={BRAND.navy} style={{ flexShrink: 0 }} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: BRAND.navy }}>Let families book you</p>
        <p style={{ margin: "1px 0 0", fontSize: 12.5, color: BRAND.inkSoft }}>Set the hours you can take mentor sessions. Your classes always come first.</p>
      </div>
      <Link to="/teacher-portal/availability" style={{ padding: "8px 14px", borderRadius: 9, background: BRAND.navy, color: "#fff", fontSize: 13, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>Set my availability</Link>
      <button type="button" aria-label="Not now" title="Not now" onClick={() => { writeLocal(key, Date.now() + QUIET_DAYS * 86400000); setHidden(true); }} style={{ border: "none", background: "transparent", color: BRAND.muted, cursor: "pointer", padding: 6, display: "flex" }}><FiX /></button>
    </div>
  );
}
