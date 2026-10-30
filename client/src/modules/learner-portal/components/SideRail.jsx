import { FiHome, FiMapPin, FiMessageCircle, FiUser, FiUsers } from "react-icons/fi";
import { T, KID, tintCardStyle, KidHeading, EmptyState } from "./profile/theme";
import { OnlineTag } from "../../timetable/components/OnlineClass";

const HUB_ICONS = [FiHome, FiMapPin, FiHome, FiMapPin];

// Tinted rather than plain white — this rail is supporting/reference info (which hubs, who's
// teaching), not this learner's own profile data, so it deliberately sits a half-step quieter
// than the Guardian Profile / Portfolio Snapshot cards next to it.
function RailSection({ title, icon, tone, action, children }) {
  return (
    <div style={{ ...tintCardStyle(), padding: 20 }}>
      <KidHeading icon={icon} tone={tone} action={action}>{title}</KidHeading>
      {children}
    </div>
  );
}

function EmptyNote({ children }) {
  return <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, textAlign: "center", padding: "6px 0" }}>{children}</p>;
}

// `staff` — the staff learner page: headings drop the "My", and `hubsContent` (the hub
// enrollment controls) replaces the plain hub list.
export default function SideRail({ hubs, mentors, hubsLoading, mentorsLoading, homeLearning = false, homeCurriculumName = "", staff = false, hubsContent = null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
      <RailSection icon={FiHome} tone={KID.sky} title={staff ? "Learning Hubs" : homeLearning && hubs.length === 0 ? "My Learning Setup" : "My Learning Hubs"}>
        {hubsLoading ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : hubsContent ? (
          hubsContent
        ) : hubs.length === 0 ? (
          <EmptyState icon={FiHome}>{homeLearning ? `Home Learning${homeCurriculumName ? ` · ${homeCurriculumName}` : ""}` : "Not yet enrolled at any learning hub."}</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hubs.map((hub, i) => {
              const Icon = HUB_ICONS[i % HUB_ICONS.length];
              return (
                <div key={hub.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {hub.photo ? (
                    <img src={hub.photo} alt={hub.name} style={{ width: 42, height: 42, borderRadius: 14, objectFit: "cover", flexShrink: 0, border: `1px solid ${T.tintBorder}` }} />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", border: `1px solid ${T.tintBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T.accent }}>
                      <Icon size={16} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 1px", fontSize: 15, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hub.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: T.inkMuted, fontWeight: 600 }}>{hub.class?.gradeName || hub.code || "—"}<OnlineTag hub={hub} /></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RailSection>

      <RailSection icon={FiUsers} tone={KID.sky} title={staff ? "Teachers & Mentors" : "My Teachers & Mentors"}>
        {mentorsLoading ? (
          <EmptyNote>Loading…</EmptyNote>
        ) : mentors.length === 0 ? (
          <EmptyState icon={FiUsers}>{homeLearning ? "No educator assigned to your Home Learning plan yet." : staff ? "No teacher assigned to this learner's class yet." : "No teacher assigned to your class yet."}</EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mentors.map((m) => {
              const initials = `${m.teacher.firstName?.[0] ?? ""}${m.teacher.lastName?.[0] ?? ""}`.toUpperCase();
              return (
                <div key={`${m.teacher.id}-${m.hubName}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {m.teacher.photo ? (
                    <img src={m.teacher.photo} alt={`${m.teacher.firstName} ${m.teacher.lastName}`} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid #fff" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${KID.sky.color}, ${T.accentLight})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, border: "2px solid #fff" }}>
                      {initials || <FiUser size={14} />}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 14.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.teacher.firstName} {m.teacher.lastName}
                    </p>
                    <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: "#fff", color: T.accent, border: `1px solid ${T.tintBorder}` }}>
                      {m.hubName}
                    </span>
                  </div>
                  <FiMessageCircle size={15} color={T.inkFaint} style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </RailSection>
    </div>
  );
}
