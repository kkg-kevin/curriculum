import { useOutletContext } from "react-router-dom";
import HubStatement from "../components/HubStatement";
import { useBookings } from "../hooks/useMentorBookings";
import { BookingRow, EmptyNote, RowStyles, SectionHead, splitBookings } from "../shared";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";

// The hub portal's Mentor sessions (/school-portal/mentor-bookings): families' mentor sessions at
// this hub's spaces — when and which space — and, for a partner hub, its desk-fee statement: what
// it's owed and what has been settled (read only; the workspace settles it).

export default function HubBookingsPage() {
  const { selectedHubId } = useOutletContext() || {};
  const { data = [], isLoading } = useBookings(selectedHubId ? { hubId: selectedHubId } : {});
  const { coming, past } = splitBookings(data.filter((b) => b.state !== "held"));
  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14 }}>
      <RowStyles />
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "22px 26px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Mentor sessions</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 640, lineHeight: 1.6 }}>Families who book a mentor to meet at your spaces. Keep the space free at these times.</p>
      </div>
      <SectionHead title="Coming up" />
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p>
        : coming.length ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{coming.map((b) => <BookingRow key={b.id} booking={b} base="/school-portal/mentor-bookings" show="both" />)}</div>
          : <EmptyNote title="No sessions booked at your spaces" />}
      {past.length > 0 && (
        <>
          <SectionHead title="Past" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{past.slice(0, 30).map((b) => <BookingRow key={b.id} booking={b} base="/school-portal/mentor-bookings" show="both" />)}</div>
        </>
      )}
      {selectedHubId && (
        <>
          <SectionHead title="Desk fees" note="What you're owed from mentor sessions at your spaces." />
          <HubStatement hubId={selectedHubId} />
        </>
      )}
    </div>
  );
}
