import { Link } from "react-router-dom";
import { FiArrowUpRight, FiMapPin, FiVideo } from "react-icons/fi";
import { FORMAT_LABEL, FREQUENCY_LABEL, Pill, STATE, T, formatDate, useCheckinsBase } from "../shared";

// One check-in in a list — opens its page.
export function SessionRow({ session, showHub = true }) {
  const base = useCheckinsBase();
  return (
    <Link to={`${base}/sessions/${session.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit", background: session.state === "due" ? "#FFFDF7" : "transparent" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {showHub && <strong style={{ fontSize: 14, color: T.ink }}>{session.hubName || "Hub"}</strong>}
          <Pill look={STATE[session.state]} />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 12.5, color: T.inkMuted }}>
          <span>{formatDate(session.scheduledDate)}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{session.format === "online" ? <FiVideo size={12} /> : <FiMapPin size={12} />}{FORMAT_LABEL[session.format]}</span>
          {session.frequency && <span>{FREQUENCY_LABEL[session.frequency]}</span>}
          <span>{[session.accountManagerName, session.trainingLeadName].filter(Boolean).join(" & ") || "Nobody assigned"}</span>
        </div>
      </div>
      <FiArrowUpRight size={15} color={T.accentMid} />
    </Link>
  );
}
