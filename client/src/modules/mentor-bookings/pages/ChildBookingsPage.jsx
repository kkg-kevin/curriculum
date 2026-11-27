import { Link } from "react-router-dom";
import { FiAlertCircle, FiDollarSign, FiPlus } from "react-icons/fi";
import { useBookings, useChildCredits, useHelpRequests } from "../hooks/useMentorBookings";
import { BookingRow, EmptyNote, RowStyles, SectionHead, splitBookings } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card } from "../../../theme/brand";

// A child's own Mentor sessions (/learner-portal/bookings, 27 Nov 2026): the family's credits they
// can use, "Book a mentor" (booked straight away with credits — /learner-portal/bookings/new),
// what they asked for help with, and their sessions. Their parent hears about every booking.

const credit = (n) => `${Number(n || 0).toLocaleString("en-KE")} credits`;
const goldBtn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 18px", minHeight: 44, boxSizing: "border-box", borderRadius: 12, background: BRAND.gold, color: BRAND.navy, fontSize: 14, fontWeight: 800, textDecoration: "none", fontFamily: FONT };

export default function ChildBookingsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: help = [] } = useHelpRequests();
  const { data: wallets = [] } = useChildCredits();
  const open = help.filter((h) => h.status === "open");
  const { coming, past } = splitBookings(bookings);
  const usable = wallets.find((w) => w.enabled) || wallets[0] || null;
  const canBook = !!usable?.enabled && usable.allowed && usable.hasParentLogin && usable.balance > 0;

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14 }}>
      <RowStyles />
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 300px" }}>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Mentor sessions</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.85)", maxWidth: 620, lineHeight: 1.6 }}>Stuck on a session? Book a mentor to take you through it, online or at a hub. It&apos;s paid with your family&apos;s credits.</p>
          {usable && (
            <p style={{ margin: "12px 0 0", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.16)", fontSize: 14, fontWeight: 800 }}>
              <FiDollarSign size={14} /> {credit(usable.balance)}{usable.left != null ? ` · ${credit(usable.left)} left for you this month` : ""}
            </p>
          )}
        </div>
        <Link to="/learner-portal/bookings/new" style={goldBtn}><FiPlus /> Book a mentor</Link>
      </div>

      {usable && !canBook && (
        <div role="status" style={{ ...card, padding: "14px 18px", display: "flex", gap: 10, alignItems: "flex-start", background: BRAND.goldTint, borderColor: BRAND.goldBorder, color: BRAND.goldText, fontSize: 14, lineHeight: 1.5 }}>
          <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{!usable.enabled ? "Booking a mentor yourself isn't on at your learning centre yet. Ask your parent to book for you."
            : !usable.hasParentLogin ? "Your parent needs a Digifunzi login before you can book. Ask them."
              : !usable.allowed ? "Your parent hasn't switched on booking with credits for you yet. Ask them."
                : "Your family has no credits left. Ask your parent to add some, or to book for you."}</span>
        </div>
      )}

      {open.length > 0 && (
        <>
          <SectionHead title="You asked for help with" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
            {open.map((h) => (
              <div key={h.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{h.sessionTitle || h.courseName || "A session"}</p>
                  {h.message && <p style={{ margin: "2px 0 0", fontSize: 13, color: BRAND.muted }}>&ldquo;{h.message}&rdquo;</p>}
                </div>
                <Link to={`/learner-portal/bookings/new?help=${h.id}`} style={{ ...goldBtn, padding: "8px 14px", minHeight: 40, fontSize: 13 }}>Book a mentor</Link>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHead title="Coming up" />
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p>
        : coming.length ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{coming.map((b) => <BookingRow key={b.id} booking={b} base="/learner-portal/bookings" show="mentor" />)}</div>
          : <EmptyNote title="No sessions booked" line="Book a mentor whenever you need a hand." action={<Link to="/learner-portal/bookings/new" style={{ ...goldBtn, padding: "8px 14px", minHeight: 40, fontSize: 13 }}><FiPlus /> Book a mentor</Link>} />}

      {past.length > 0 && (
        <>
          <SectionHead title="Past" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{past.map((b) => <BookingRow key={b.id} booking={b} base="/learner-portal/bookings" show="mentor" />)}</div>
        </>
      )}
    </div>
  );
}
