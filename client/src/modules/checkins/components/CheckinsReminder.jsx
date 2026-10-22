import { Link } from "react-router-dom";
import { FiCheckSquare } from "react-icons/fi";
import { usePermissions } from "../../../hooks/usePermissions";
import { useCheckinSessions } from "../hooks/useCheckins";
import { T, font } from "../shared";

// The dashboard's reminder: my check-ins today, and reports overdue or missed. Shows nothing when
// there's nothing to do, or for someone who doesn't take part in check-ins.
export default function CheckinsReminder() {
  const { can } = usePermissions();
  const allowed = can("checkins", "view") || can("checkins-manage", "view");
  if (!allowed) return null;
  return <Reminder />;
}

function Reminder() {
  const { data } = useCheckinSessions({ scope: "mine", view: "today", page: 1, limit: 5 });
  const today = data?.counts?.today || 0;
  const overdue = data?.counts?.overdue || 0;
  if (!today && !overdue) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px", marginBottom: 20, borderRadius: 14, background: overdue ? "#FFFBEB" : "#F1F9FD", border: `1px solid ${overdue ? "#FDE68A" : "#CFE6F5"}`, fontFamily: font }}>
      <FiCheckSquare size={20} color={overdue ? "#B45309" : T.accent} />
      <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: T.ink }}>
        {today > 0 && <><strong>{today} hub check-in{today === 1 ? "" : "s"} today</strong>{data.sessions.length ? `: ${data.sessions.map((s) => `${s.hubName} at ${s.startTime}`).join(", ")}` : ""}. </>}
        {overdue > 0 && <span style={{ color: "#B45309", fontWeight: 700 }}>{overdue} report{overdue === 1 ? "" : "s"} overdue or missed.</span>}
      </div>
      <Link to="/checkins" style={{ fontSize: 13, fontWeight: 700, color: T.accentMid }}>Open My Check-ins</Link>
    </div>
  );
}
