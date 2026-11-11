import { Link } from "react-router-dom";
import { FiAlertCircle, FiPlus, FiX } from "react-icons/fi";
import { useBookings, useCloseHelp, useHelpRequests } from "../hooks/useMentorBookings";
import { BookingRow, EmptyNote, RowStyles, SectionHead, splitBookings } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card } from "../../../theme/brand";

// The parent portal's Mentor sessions (/parent/bookings): what their children have asked for help
// with (each one a "Book a mentor"), the sessions coming up (pay, join) and the ones past (the
// mentor's note). Booking itself is /parent/bookings/new.

const goldBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, background: BRAND.gold, color: BRAND.navy, fontSize: 13.5, fontWeight: 800, textDecoration: "none", fontFamily: FONT };

export default function ParentBookingsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: help = [] } = useHelpRequests();
  const close = useCloseHelp();
  const open = help.filter((h) => h.status === "open");
  const { coming, past } = splitBookings(bookings);

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14 }}>
      <RowStyles />
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Mentor sessions</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 620, lineHeight: 1.6 }}>When your child is stuck on a session, book a mentor to take them through it — online or at a hub.</p>
        </div>
        <Link to="/parent/bookings/new" style={goldBtn}><FiPlus /> Book a mentor</Link>
      </div>

      {open.length > 0 && (
        <>
          <SectionHead title="Asked for help" note="Your children asked for help with these." />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
            {open.map((h) => (
              <div key={h.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", flexWrap: "wrap", border: `1px solid ${BRAND.goldBorder}`, background: BRAND.goldTint }}>
                <FiAlertCircle color={BRAND.goldText} style={{ flexShrink: 0 }} />
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{h.learnerName || "Your child"} — {h.sessionTitle || h.courseName || "a session"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>{[h.courseName && h.sessionTitle ? h.courseName : null, h.message ? `"${h.message}"` : null, new Date(h.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</p>
                </div>
                <Link to={`/parent/bookings/new?learnerId=${h.learnerId}&help=${h.id}`} style={{ ...goldBtn, padding: "8px 14px", fontSize: 13 }}>Book a mentor</Link>
                <button type="button" onClick={() => close.mutate(h.id)} aria-label="Not needed" title="Not needed any more" style={{ border: "none", background: "transparent", color: BRAND.muted, cursor: "pointer", padding: 6 }}><FiX /></button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHead title="Coming up" />
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p>
        : coming.length ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{coming.map((b) => <BookingRow key={b.id} booking={b} base="/parent/bookings" show="both" />)}</div>
          : <EmptyNote title="No sessions booked" line="Book a mentor whenever your child needs a hand." action={<Link to="/parent/bookings/new" style={{ ...goldBtn, padding: "8px 14px", fontSize: 13 }}><FiPlus /> Book a mentor</Link>} />}

      {past.length > 0 && (
        <>
          <SectionHead title="Past" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{past.map((b) => <BookingRow key={b.id} booking={b} base="/parent/bookings" show="both" />)}</div>
        </>
      )}
    </div>
  );
}
