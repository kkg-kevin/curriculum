import { FiAward, FiBookOpen, FiCalendar, FiClock, FiLogIn, FiMail, FiMapPin, FiPhone, FiUser, FiUsers } from "react-icons/fi";
import { T, cardStyle, formatDate } from "../../claims/shared";

// An educator's details for their supervisor (17 Nov 2026), from GET /api/supervisor-portal/
// educators/:id (useSupervisorEducator). Read only — the admin edits these on the educator form;
// never pay or rates. Two parts on the educator's page:
//   EducatorAboutCard    the side column: contact, status, since when, schools, availability,
//                        what they're qualified to teach
//   EducatorClassesCard  the Teaching tab: the classes and courses they teach
const DAY_LABEL = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
export const EDUCATOR_STATUS = { active: "Active", inactive: "Inactive", on_leave: "On leave", in_training: "In training" };
const EMPLOYMENT = { part_time: "Part time", full_time: "Full time" };
const time = (t) => String(t || "").slice(0, 5);

function Heading({ icon: Icon, children }) {
  return <h3 style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted, display: "flex", alignItems: "center", gap: 6 }}><Icon size={13} /> {children}</h3>;
}

function Fact({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#374151", minWidth: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={13} /></span>
      <span style={{ paddingTop: 5, overflowWrap: "anywhere", minWidth: 0 }}>{children}</span>
    </div>
  );
}

export function EducatorAboutCard({ details: d }) {
  if (!d) return null;
  return (
    <section style={{ ...cardStyle, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>About {d.name.split(/\s+/)[0]}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Fact icon={FiMail}>{d.email ? <a href={`mailto:${d.email}`} style={{ color: T.accentMid, textDecoration: "none" }}>{d.email}</a> : "No email"}</Fact>
        <Fact icon={FiPhone}>{d.phone ? <a href={`tel:${d.phone.replace(/\s+/g, "")}`} style={{ color: T.accentMid, textDecoration: "none" }}>{d.phone}</a> : "No phone"}</Fact>
        <Fact icon={FiUser}>{[EDUCATOR_STATUS[d.status] || d.status, EMPLOYMENT[d.employmentType], d.teacherLevel != null ? `Level ${d.teacherLevel}` : null].filter(Boolean).join(" · ")}</Fact>
        <Fact icon={FiCalendar}>With us since {formatDate(d.joinedAt)}</Fact>
        <Fact icon={FiLogIn}>{d.hasLogin ? "Has a sign-in" : "No sign-in yet — messages won't reach them"}</Fact>
      </div>
      <div>
        <Heading icon={FiMapPin}>Schools</Heading>
        {d.hubs.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {d.hubs.map((h) => <span key={h.id} style={{ padding: "4px 10px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 12.5, fontWeight: 700 }}>{h.name}</span>)}
          </div>
        ) : <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Not linked to a school yet.</p>}
      </div>
      <div>
        <Heading icon={FiClock}>Weekly availability</Heading>
        {d.availability.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {d.availability.map((a) => (
              <span key={`${a.dayOfWeek}-${a.startTime}`} style={{ padding: "4px 9px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: "#374151" }}>
                <strong>{DAY_LABEL[a.dayOfWeek] || a.dayOfWeek}</strong> {time(a.startTime)}–{time(a.endTime)}
              </span>
            ))}
          </div>
        ) : <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>None set — they can be booked any time.</p>}
      </div>
      {d.qualifiedCourses.length > 0 && (
        <div>
          <Heading icon={FiAward}>Qualified to teach</Heading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {d.qualifiedCourses.map((c) => <span key={c.id} style={{ padding: "4px 10px", borderRadius: 999, background: "#F3F4F6", color: "#374151", fontSize: 12, fontWeight: 600 }}>{c.name}</span>)}
          </div>
        </div>
      )}
    </section>
  );
}

export function EducatorClassesCard({ details: d }) {
  if (!d) return null;
  const learners = d.classes.reduce((n, c) => n + (c.learners || 0), 0);
  return (
    <section style={{ ...cardStyle, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><FiBookOpen size={15} /> Classes they teach</h2>
        <span style={{ fontSize: 12.5, color: T.inkMuted }}>{d.classes.length} class{d.classes.length === 1 ? "" : "es"} · {learners} learner{learners === 1 ? "" : "s"}</span>
      </div>
      {d.classes.length ? d.classes.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #EEF1F5" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "#fff", border: `1px solid ${T.border}`, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><FiUsers size={15} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>
              {c.label}
              {c.status !== "active" && <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 999, background: "#F3F4F6", color: "#6B7280", fontSize: 11, fontWeight: 700 }}>{c.status}</span>}
            </p>
            <p style={{ margin: "2px 0 6px", fontSize: 12.5, color: T.inkMuted }}>{c.hubName || "—"} · {c.learners} learner{c.learners === 1 ? "" : "s"}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {c.courses.map((x) => (
                <span key={x.name} style={{ padding: "3px 9px", borderRadius: 999, background: x.primary ? T.tintBg : "#fff", border: `1px solid ${x.primary ? T.tintBorder : T.border}`, color: x.primary ? T.accent : "#374151", fontSize: 12, fontWeight: 700 }}>
                  {x.name}{x.primary ? "" : " · co-teaching"}
                </span>
              ))}
            </div>
          </div>
        </div>
      )) : <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Not teaching a class yet.</p>}
    </section>
  );
}
