import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCalendar, FiStar } from "react-icons/fi";
import { useQaVisits } from "../hooks/useQa";
import VisitDialog from "./VisitDialog";
import { T, VisitTypePill, card, font, formatDate } from "../shared";

function Row({ visit, due }) {
  return (
    <Link to={`/supervisor-portal/qa/visits/${visit.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, textDecoration: "none", background: due ? "#FFFBEB" : "transparent" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{visit.teacherName}</span>
        <span style={{ display: "block", fontSize: 11.5, color: due ? "#B45309" : T.inkMuted }}>{due ? `Review due · ${formatDate(visit.scheduledDate, { day: "numeric", month: "short" })}` : formatDate(visit.scheduledDate)}</span>
      </span>
      <VisitTypePill type={visit.visitType} />
    </Link>
  );
}

// The supervisor dashboard's QA card: check-ins whose review is due, the next ones coming up, and
// scheduling a new one (the educator is picked, with search, in the dialog).
export default function SupervisorQaCard() {
  const [scheduling, setScheduling] = useState(false);
  const { data: due } = useQaVisits({ view: "due", page: 1, limit: 5 });
  const { data: upcoming } = useQaVisits({ view: "upcoming", page: 1, limit: 3 });
  const dueList = due?.visits || [];
  const upcomingList = upcoming?.visits || [];

  return (
    <div style={{ ...card, padding: 18, fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "inline-flex", alignItems: "center", gap: 7 }}><FiStar size={15} /> QA check-ins</h2>
        <Link to="/supervisor-portal/qa" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>All <FiArrowRight size={14} /></Link>
      </div>
      {dueList.length === 0 && upcomingList.length === 0 && due && upcoming && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>No check-ins planned. Schedule one — announced, or a surprise — to see how an educator&apos;s classes are going.</p>
      )}
      {dueList.length > 0 && <div style={{ display: "grid", gap: 2, marginBottom: 6 }}>{dueList.map((v) => <Row key={v.id} visit={v} due />)}</div>}
      {upcomingList.length > 0 && (
        <>
          <p style={{ margin: "6px 10px 2px", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkFaint }}>Coming up</p>
          <div style={{ display: "grid", gap: 2 }}>{upcomingList.map((v) => <Row key={v.id} visit={v} />)}</div>
        </>
      )}
      <button type="button" onClick={() => setScheduling(true)} style={{ marginTop: 12, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", borderRadius: 11, border: "none", background: T.accent, color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: font, cursor: "pointer" }}>
        <FiCalendar size={14} /> Schedule a check-in
      </button>
      {scheduling && <VisitDialog title="Schedule a QA check-in" onClose={() => setScheduling(false)} />}
    </div>
  );
}
