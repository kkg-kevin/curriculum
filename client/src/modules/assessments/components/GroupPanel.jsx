import { FiUsers } from "react-icons/fi";

const T = { accent: "#25476a", accentMid: "#2e7db5", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

function MemberChip({ member }) {
  const initials = `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 20 }}>
      {member.photo ? (
        <img src={member.photo} alt={`${member.firstName} ${member.lastName}`} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg, ${T.accent}, ${T.accentMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {initials || "?"}
        </span>
      )}
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{member.firstName} {member.lastName}</span>
    </span>
  );
}

// Reusable "which group is this?" display. `group` is the resolved {id, name, members} shape
// from class-group.service.js's getGroup, or null/undefined if this learner hasn't been placed
// in one yet — shown as a notice, not a hard block, since a group-mode assessment still falls
// back to an individual submission for an ungrouped learner (see getOrCreateSubmission).
export default function GroupPanel({ group, emptyMessage = "You haven't been placed in a group yet — you can still complete this individually." }) {
  if (!group) {
    return (
      <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, backgroundColor: "#FFFBEB", border: "1.5px solid #FDE68A" }}>
        <FiUsers style={{ fontSize: 20, color: "#B45309", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: "#92400E" }}>{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FiUsers style={{ fontSize: 18, color: T.accent }} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: T.accent }}>Group: {group.name}</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {group.members.map((m) => <MemberChip key={m.id} member={m} />)}
      </div>
    </div>
  );
}
