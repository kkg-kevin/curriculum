import { Link, useLocation } from "react-router-dom";
import { FiArrowRight, FiClock, FiMapPin, FiVideo } from "react-icons/fi";
import Avatar from "../../components/ui/Avatar";
import { BRAND, FONT, card, pill } from "../../theme/brand";

// Mentor bookings — the small pieces every booking screen shares. Server: modules/mentor-bookings/.
// System colours only (theme/brand.js).

// Where each portal keeps its bookings.
export function bookingsBaseFor(pathname) {
  if (pathname.startsWith("/parent")) return "/parent/bookings";
  if (pathname.startsWith("/teacher-portal")) return "/teacher-portal/bookings";
  if (pathname.startsWith("/school-portal")) return "/school-portal/mentor-bookings";
  return "/mentor-bookings";
}
export const useBookingsBase = () => bookingsBaseFor(useLocation().pathname);

// A booking's state (the server's bookingState), as a word and a tone.
export const STATE = {
  held: { label: "Waiting for payment", tone: "waiting" },
  confirmed: { label: "Booked", tone: "good" },
  today: { label: "Today", tone: "strong" },
  to_mark: { label: "To mark", tone: "waiting" },
  completed: { label: "Held", tone: "good" },
  no_show: { label: "Didn't join", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export function StatePill({ state }) {
  const look = STATE[state] || STATE.confirmed;
  return <span style={pill(look.tone)}>{look.label}</span>;
}

export const ksh = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
export const dayLabel = (date, opts = { weekday: "short", day: "numeric", month: "short" }) => (date ? new Date(`${String(date).slice(0, 10)}T00:00:00`).toLocaleDateString("en-KE", opts) : "—");
export const whenLabel = (b) => `${dayLabel(b.date)} · ${b.startTime}–${b.endTime}`;
export const whereLabel = (b) => (b.mode === "online" ? "Online" : [b.hubName, b.spaceName].filter(Boolean).join(" · ") || "At a hub");
export const lengthLabel = (minutes) => (minutes >= 60 ? `${minutes / 60 === Math.floor(minutes / 60) ? minutes / 60 : (minutes / 60).toFixed(1)} h` : `${minutes} min`);

// One booking as a row: the mentor (or learner), what it's about, when and where, its state.
export function BookingRow({ booking: b, base, show = "mentor" }) {
  const person = show === "learner" ? { name: b.learner?.name || "Learner", photo: null } : { name: b.mentor?.name || "Mentor", photo: b.mentor?.photo };
  const [first, ...rest] = person.name.split(" ");
  return (
    <Link to={`${base}/${b.id}`} className="mb-row" style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", textDecoration: "none", color: BRAND.ink, fontFamily: FONT, minWidth: 0 }}>
      <Avatar firstName={first} lastName={rest.join(" ")} photo={person.photo} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{person.name}</span>
          {show === "both" && b.learner && <span style={{ fontSize: 12.5, color: BRAND.muted }}>with {b.learner.name}</span>}
          <StatePill state={b.state} />
          {b.refundStatus === "due" && <span style={pill("danger")}>Refund due</span>}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: BRAND.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[b.sessionTitle, b.courseName].filter(Boolean).join(" · ") || b.topic || "Help with their course"}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: BRAND.faint, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiClock size={12} /> {whenLabel(b)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{b.mode === "online" ? <FiVideo size={12} /> : <FiMapPin size={12} />} {whereLabel(b)}</span>
        </p>
      </div>
      <FiArrowRight color={BRAND.mid} style={{ flexShrink: 0 }} />
    </Link>
  );
}

// Bookings split into what's coming and what's past.
export function splitBookings(list = []) {
  const coming = list.filter((b) => ["held", "confirmed", "today", "to_mark"].includes(b.state)).sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  const past = list.filter((b) => !["held", "confirmed", "today", "to_mark"].includes(b.state));
  return { coming, past };
}

export const RowStyles = () => <style>{`.mb-row { transition: box-shadow 150ms ease; } .mb-row:hover { box-shadow: 0 4px 14px rgba(37,71,106,0.10), 0 0 0 1px ${BRAND.skyBorder}; } .mb-row:focus-visible { outline: 2px solid ${BRAND.sky}; outline-offset: 2px; }`}</style>;

export function SectionHead({ title, note, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "4px 0 2px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{title}</h2>
        {note && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>{note}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyNote({ title, line, action }) {
  return (
    <div style={{ ...card, padding: "28px 20px", textAlign: "center", fontFamily: FONT }}>
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.inkSoft }}>{title}</p>
      {line && <p style={{ margin: "5px 0 0", fontSize: 13, color: BRAND.muted }}>{line}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
