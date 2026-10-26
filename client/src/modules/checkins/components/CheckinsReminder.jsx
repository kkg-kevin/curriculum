import { Link } from "react-router-dom";
import { FiCheckSquare } from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useDueCheckins } from "../hooks/useCheckins";
import { T, font } from "../shared";

// The admin dashboard's reminder: my check-ins with a report due (an admin can be a hub's Account
// Manager or Training Lead). Shows nothing when there's nothing to do.
export default function CheckinsReminder() {
  const { can } = usePermissions();
  const allowed = can("checkins-manage", "view");
  if (!allowed) return null;
  return <Reminder />;
}

function Reminder() {
  const { data: due = [] } = useDueCheckins();
  if (!due.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px", marginBottom: 20, borderRadius: 14, background: "#FFFBEB", border: "1px solid #FDE68A", fontFamily: font }}>
      <FiCheckSquare size={20} color="#B45309" />
      <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: T.ink }}>
        <strong>{due.length} check-in report{due.length === 1 ? "" : "s"} due</strong>: {due.slice(0, 4).map((s) => s.hubName).join(", ")}{due.length > 4 ? "…" : ""}.
      </div>
      <Link to="/checkins" style={{ fontSize: 13, fontWeight: 700, color: T.accentMid }}>Open My check-ins</Link>
    </div>
  );
}
