import { useOutletContext } from "react-router-dom";
import TimetablePlannerPage from "../../timetable/pages/TimetablePlannerPage";

// The hub portal's Timetable: the Timetable Planner, locked to the hub this login is working in
// (the header's hub switcher changes it).
export default function TimetablePage() {
  const { school, hubsLoading } = useOutletContext() || {};
  if (hubsLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (!school) {
    return (
      <div style={{ backgroundColor: "#fff", borderRadius: 16, textAlign: "center", padding: "60px 24px", fontFamily: "Inter, sans-serif" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No hub profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Ask an admin to link this login to a Learning Hub.</p>
      </div>
    );
  }
  return <TimetablePlannerPage key={school.id} fixedHub={school} />;
}
