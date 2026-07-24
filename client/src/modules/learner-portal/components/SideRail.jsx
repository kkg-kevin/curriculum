import { FiHome, FiMapPin, FiUser, FiMessageCircle } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle } from "./profile/theme";

const HUB_ICONS = [FiHome, FiMapPin, FiHome, FiMapPin];

function RailSection({ title, action, children }) {
  return (
    <div style={{ ...cardStyle(), padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={sectionHeaderStyle()}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "6px 0" }}>{children}</p>;
}

export default function SideRail({ hubs, mentors, hubsLoading, mentorsLoading }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
      <RailSection title="My Learning Hubs">
        {hubsLoading ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : hubs.length === 0 ? (
          <EmptyNote>Not yet enrolled at any learning hub.</EmptyNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hubs.map((hub, i) => {
              const Icon = HUB_ICONS[i % HUB_ICONS.length];
              return (
                <div key={hub.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T.accent }}>
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 1px", fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hub.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{hub.class?.gradeName || hub.code || "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RailSection>

      <RailSection title="My Teachers & Mentors">
        {mentorsLoading ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : mentors.length === 0 ? (
          <EmptyNote>No teacher assigned to your class yet.</EmptyNote>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mentors.map((m) => (
              <div key={`${m.teacher.id}-${m.hubName}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${T.accent}, ${T.accentMid})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  <FiUser size={14} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.teacher.firstName} {m.teacher.lastName}
                  </p>
                  <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: T.tintBg, color: T.accent, border: `1px solid ${T.tintBorder}` }}>
                    {m.hubName}
                  </span>
                </div>
                <FiMessageCircle size={15} color={T.inkFaint} style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </RailSection>
    </div>
  );
}
