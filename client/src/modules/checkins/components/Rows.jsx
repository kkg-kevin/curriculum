import { Link } from "react-router-dom";
import { FiAlertTriangle, FiArrowUpRight, FiMapPin, FiVideo } from "react-icons/fi";
import {
  ACTION_STATUS, CATEGORY_LABEL, FORMAT_LABEL, FREQUENCY_LABEL, KIND_LABEL, OVERALL_STATUS, PRIORITY, Pill, SESSION_STATUS, T, formatDate,
} from "../shared";

// One check-in in a list — opens its page.
export function SessionRow({ session, showHub = true }) {
  const look = SESSION_STATUS[session.status];
  return (
    <Link to={`/checkins/sessions/${session.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit", background: session.isOverdue ? "#FFFBFA" : "transparent" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {showHub && <strong style={{ fontSize: 14, color: T.ink }}>{session.hubName || "Hub"}</strong>}
          <Pill look={look} />
          {session.isToday && session.status !== "completed" && <Pill look={{ bg: "#25476a", color: "#fff" }}>Today</Pill>}
          {session.overallStatus && <Pill look={OVERALL_STATUS[session.overallStatus]} />}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 12.5, color: T.inkMuted }}>
          <span>{formatDate(session.scheduledDate)} · {session.startTime}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{session.format === "online" ? <FiVideo size={12} /> : <FiMapPin size={12} />}{FORMAT_LABEL[session.format]}</span>
          {session.frequency && <span>{FREQUENCY_LABEL[session.frequency]}</span>}
          <span>{[session.accountManagerName, session.trainingLeadName].filter(Boolean).join(" & ") || "Nobody assigned"}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12, color: T.inkMuted, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        {session.openActions > 0 && <span style={{ color: "#B45309", fontWeight: 700 }}>{session.openActions} open action{session.openActions === 1 ? "" : "s"}</span>}
        <FiArrowUpRight size={15} color={T.accentMid} />
      </div>
    </Link>
  );
}

// One issue or follow-up in a list. `onOpen` opens its details.
export function ActionRow({ action, onOpen, showHub = true }) {
  return (
    <button type="button" onClick={() => onOpen(action.id)} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, width: "100%", alignItems: "center", padding: "12px 18px", border: 0, borderTop: "1px solid #F3F4F6", background: action.isOverdue ? "#FFFBFA" : "#fff", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13.5, color: T.ink }}>{action.title}</strong>
          <Pill look={ACTION_STATUS[action.status]} />
          {action.escalatedAt && <Pill look={{ bg: "#FEF2F2", color: "#B91C1C" }}>Escalated</Pill>}
          {action.isOverdue && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 700, color: "#B91C1C" }}><FiAlertTriangle size={12} /> Overdue</span>}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 12, color: T.inkMuted }}>
          <span>{KIND_LABEL[action.kind]} · {CATEGORY_LABEL[action.category]}</span>
          {showHub && <span>{action.hubName}</span>}
          <span>{action.assigneeName ? `With ${action.assigneeName}` : "Not assigned"}</span>
          {action.dueDate && <span>Due {formatDate(action.dueDate, { day: "numeric", month: "short", year: "numeric" })}</span>}
        </div>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: PRIORITY[action.priority]?.color }}>{PRIORITY[action.priority]?.label}</span>
    </button>
  );
}
