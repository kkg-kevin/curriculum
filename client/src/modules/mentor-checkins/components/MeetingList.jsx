import { Link } from "react-router-dom";
import { FiCheckCircle, FiMapPin, FiVideo } from "react-icons/fi";
import { Empty, FORMAT_LABEL, Pill, T, btn, childNames, kenyaToday, safeMeetingLink, stateFor } from "../shared";

// A date block: weekday, day, month.
function DateBlock({ date }) {
  const d = new Date(`${date}T00:00:00`);
  return (
    <div aria-hidden="true" style={{ width: 52, flexShrink: 0, textAlign: "center", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden", background: "#fff" }}>
      <div style={{ background: T.accent, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "3px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color: T.ink, lineHeight: 1.1, paddingTop: 4 }}>{d.getDate()}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkMuted, paddingBottom: 4 }}>{d.toLocaleDateString("en-GB", { month: "short" })}</div>
    </div>
  );
}

// Check-ins as rows: when, who (the family for staff, the child for a parent), the class and
// educators, online / in person, where it stands — each opening its own page. Join on the day of
// an online one.
export default function MeetingList({ meetings = [], viewer, base, emptyTitle = "Nothing here", emptyText = null, showClass = true }) {
  if (!meetings.length) return <Empty title={emptyTitle}>{emptyText}</Empty>;
  const today = kenyaToday();
  return (
    <div>
      {meetings.map((m) => {
        const join = m.format === "online" && m.date === today && ["today", "upcoming"].includes(m.state) ? safeMeetingLink(m.meetingLink) : null;
        const title = viewer === "parent" ? `About ${childNames(m) || "your child"}` : m.parentName;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
            <Link to={`${base}/meetings/${m.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 280px", minWidth: 0, textDecoration: "none", color: "inherit" }}>
              <DateBlock date={m.date} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14, color: T.ink }}>{title}</strong>
                  <Pill look={stateFor(m.state, viewer)} />
                  {m.confirmed && ["upcoming", "today"].includes(m.state) && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#047857" }}><FiCheckCircle size={12} /> Confirmed</span>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#374151" }}>{m.startTime}–{m.endTime}</span>
                  {viewer !== "parent" && <span>{childNames(m)}</span>}
                  {showClass && <span>{m.className}{m.hubName ? ` · ${m.hubName}` : ""}</span>}
                  {viewer === "parent" && m.educatorNames?.length > 0 && <span>With {m.educatorNames.join(", ")}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {m.format === "online" ? <FiVideo size={12} /> : <FiMapPin size={12} />}
                    {m.format === "online" ? FORMAT_LABEL.online : m.location || FORMAT_LABEL.in_person}
                  </span>
                </div>
              </div>
            </Link>
            {join && (
              <a href={join} target="_blank" rel="noopener noreferrer" className="ci-btn" style={{ ...btn("primary", { size: "sm" }), background: "#047857", borderColor: "#047857", textDecoration: "none" }}>
                <FiVideo size={13} /> Join
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
