import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiCheckCircle, FiClock, FiHome, FiLifeBuoy, FiMapPin, FiMonitor, FiShield, FiUsers } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { BRAND as C, FONT } from "../../../theme/brand";

// "Today across your hubs" on the admin dashboard (GET /api/dashboard → day): every class meeting
// today — from the calendar engine, so term breaks, finished courses and sessions shifted, merged
// or moved are right — with its hub, time, course, session, class, room and educator, whether it's
// on now, done or still to come, and whether attendance is in. Two views: by hub, and who's where
// (each educator's stops today: classes, mentor sessions, QA visits). Refreshes the "now" every
// minute.
const kenyaClock = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(11, 16);
const stateOf = (c, now) => (!c.startTime ? "later" : c.endTime && c.endTime <= now ? "done" : c.startTime <= now ? "now" : "later");
const STATE = {
  now: { label: "On now", bg: C.gold, fg: C.navy },
  later: { label: "Later", bg: C.skyTint, fg: C.skyText },
  done: { label: "Done", bg: C.greyTint, fg: C.greyText },
};
const STOP_ICON = { class: FiBookOpen, booking: FiLifeBuoy, qa: FiShield };
const nameParts = (name) => { const [f, ...l] = String(name || "").trim().split(/\s+/); return { firstName: f || "", lastName: l.join(" ") }; };
const sessionsText = (c) => (c.sessions?.length ? `Session ${c.sessions.map((s) => s.order).filter((o) => o != null).join(" & ")}${c.sessions.length === 1 && c.sessions[0].title ? ` · ${c.sessions[0].title}` : ""}` : null);

function Stat({ icon: Icon, value, label, tone = C.mid }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}`, minWidth: 0 }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, background: `${tone}18`, color: tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 18, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{value}</span>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted }}>{label}</span>
      </span>
    </div>
  );
}

function ClassRow({ c, now, onOpen, onPerson }) {
  const st = STATE[stateOf(c, now)];
  const started = stateOf(c, now) !== "later";
  return (
    <div className="tah-row" style={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr)", gap: 12, padding: "10px 4px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>{c.startTime || "—"}</div>
        <div style={{ fontSize: 11, color: C.faint }}>{c.endTime ? `to ${c.endTime}` : ""}</div>
        <span style={{ display: "inline-block", marginTop: 4, padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: st.bg, color: st.fg }}>{st.label}</span>
      </div>
      <div style={{ minWidth: 0, display: "grid", gridTemplateColumns: "100%", gap: 4 }}>
        <button type="button" onClick={onOpen} style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", fontFamily: FONT, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: C.ink }}>{c.courseName} <span style={{ fontWeight: 600, color: C.muted }}>· {c.className}</span></span>
          {sessionsText(c) && <span style={{ display: "block", fontSize: 12, color: C.mid, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionsText(c)}{c.moved ? " (moved here)" : ""}</span>}
        </button>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {c.educators.length ? c.educators.map((p) => (
            <button key={p.id} type="button" onClick={() => onPerson(p)} title="Open the educator" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.navy }}>
              <Avatar {...nameParts(p.name)} photo={p.photo} size={22} /> {p.name}
            </button>
          )) : <span style={{ fontSize: 12, color: C.goldText, fontWeight: 700 }}>No educator on it</span>}
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          {[
            c.room && <span key="room">{c.room}</span>,
            c.online === "only" && <span key="on" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><FiMonitor size={12} /> Online</span>,
            c.online === "also" && <span key="on" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><FiMonitor size={12} /> Also online</span>,
            <span key="l">{c.learners} {c.learners === 1 ? "learner" : "learners"}</span>,
            c.attendance
              ? <span key="a" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.mid, fontWeight: 700 }}><FiCheckCircle size={12} /> Attendance in · {c.attendance.present} present</span>
              : started && <span key="a" style={{ color: C.goldText, fontWeight: 700 }}>Attendance not in yet</span>,
          ].filter(Boolean).map((node, i, all) => <span key={i}><span style={{ whiteSpace: "nowrap" }}>{node}{i < all.length - 1 && <span aria-hidden style={{ margin: "0 0 0 6px", color: C.faint }}>·</span>}</span>{i < all.length - 1 ? " " : ""}</span>)}
        </div>
      </div>
    </div>
  );
}

export default function TodayAcrossHubs({ day }) {
  const navigate = useNavigate();
  const [view, setView] = useState("hubs");
  const [now, setNow] = useState(kenyaClock);
  useEffect(() => {
    const t = setInterval(() => setNow(kenyaClock()), 60000);
    return () => clearInterval(t);
  }, []);
  const classes = day?.classes || [];
  const people = day?.people || [];
  const byHub = useMemo(() => {
    const map = new Map();
    for (const c of classes) {
      const key = c.hubId || "none";
      const h = map.get(key) || { id: c.hubId, name: c.hubName || "No hub", classes: [] };
      h.classes.push(c);
      map.set(key, h);
    }
    return [...map.values()].sort((a, b) => String(a.classes[0]?.startTime).localeCompare(String(b.classes[0]?.startTime)) || a.name.localeCompare(b.name));
  }, [classes]);
  if (!day) return null;

  const onNow = classes.filter((c) => stateOf(c, now) === "now").length;
  const started = classes.filter((c) => stateOf(c, now) !== "later");
  const attendanceIn = started.filter((c) => c.attendance).length;
  const openClass = (c) => navigate(`/classes/${c.classId}/view`);
  const openPerson = (p) => navigate(`/teachers/${p.id}/view`);
  const tab = (key, label, count) => (
    <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
      style={{ padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${view === key ? C.navy : C.border}`, background: view === key ? C.navy : "#fff", color: view === key ? "#fff" : C.inkSoft, fontSize: 12.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>
      {label} <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );

  return (
    <section style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 1px 3px rgba(17,24,39,0.04), 0 6px 18px rgba(37,71,106,0.05)", padding: "18px 20px", fontFamily: FONT, minWidth: 0 }}>
      <style>{`
        .tah-stats { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px; }
        .tah-hubs { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); align-items: start; }
        .tah-people { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); align-items: start; }
        @media (max-width: 760px) { .tah-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 9 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: `${C.mid}14`, color: C.mid, display: "grid", placeItems: "center" }}><FiMapPin size={15} /></span>
          Today across your hubs
        </h2>
        {classes.length > 0 && <div role="tablist" style={{ display: "flex", gap: 6 }}>{tab("hubs", "By hub", byHub.length)}{tab("people", "Who's where", people.length)}</div>}
      </div>

      {classes.length === 0 && people.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No classes on the timetable today — a term break, a weekend, or courses that have finished.</p>
      ) : (
        <>
          <div className="tah-stats">
            <Stat icon={FiBookOpen} value={classes.length} label={classes.length === 1 ? "class today" : "classes today"} />
            <Stat icon={FiClock} value={onNow} label="on now" tone={C.goldText} />
            <Stat icon={FiUsers} value={people.length} label={people.length === 1 ? "educator out" : "educators out"} tone={C.navy} />
            <Stat icon={FiCheckCircle} value={started.length ? `${attendanceIn}/${started.length}` : "—"} label="attendance in (started)" tone={C.sky} />
          </div>

          {view === "hubs" ? (
            <div className="tah-hubs">
              {byHub.map((h) => (
                <div key={h.id || "none"} style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px 6px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <button type="button" onClick={() => h.id && navigate(`/learning-hubs/${h.id}/view`)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: 0, padding: 0, cursor: h.id ? "pointer" : "default", fontFamily: FONT, minWidth: 0 }}>
                      <FiHome size={14} color={C.mid} />
                      <strong style={{ fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</strong>
                    </button>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>
                      {h.classes.length} {h.classes.length === 1 ? "class" : "classes"} · {new Set(h.classes.flatMap((c) => c.educators.map((p) => p.id))).size} educators
                    </span>
                  </div>
                  {h.classes.map((c) => <ClassRow key={c.key} c={c} now={now} onOpen={() => openClass(c)} onPerson={openPerson} />)}
                </div>
              ))}
            </div>
          ) : (
            <div className="tah-people">
              {people.map((p) => (
                <div key={p.id} style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, display: "grid", gap: 8, minWidth: 0 }}>
                  <button type="button" onClick={() => openPerson(p)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                    <Avatar {...nameParts(p.name)} photo={p.photo} size={36} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 14, color: C.ink }}>{p.name}</strong>
                      <span style={{ fontSize: 12, color: C.muted }}>{[...new Set(p.stops.map((s) => s.hubName).filter(Boolean))].join(" · ") || "—"}</span>
                    </span>
                  </button>
                  {p.stops.map((s, i) => {
                    const Icon = STOP_ICON[s.kind] || FiBookOpen;
                    return (
                      <button key={i} type="button" onClick={() => navigate(s.path)} className="db-row" style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", padding: "6px 8px", borderRadius: 9, border: 0, background: C.canvas, cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                        <Icon size={13} color={C.mid} style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ minWidth: 0, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>
                          <strong>{s.time ? `${s.time}${s.end ? `–${s.end}` : ""}` : "Today"}</strong> · {s.title}
                          {(s.hubName || s.room) && <span style={{ display: "block", color: C.muted }}>{[s.hubName, s.room].filter(Boolean).join(" · ")}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
