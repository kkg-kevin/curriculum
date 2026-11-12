import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight, FiCalendar, FiCheck, FiCheckCircle, FiClock, FiEdit3, FiFileText, FiMapPin, FiMessageCircle,
  FiMove, FiThumbsUp, FiVideo, FiX,
} from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { isParentUser } from "../../parent/parentPaths";
import { useDueCheckins } from "../../checkins/hooks/useCheckins";
import { useMentorDue, useMentorMutation } from "../hooks/useMentorCheckins";
import { mentorCheckinsApi } from "../services/mentorCheckinsApi";
import TimePickerDialog from "./TimePickerDialog";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import { childNames, kenyaToday, safeMeetingLink } from "../shared";

// The sign-in pop-up for parent–mentor check-ins (GET /api/mentor-checkins/due), in the parent
// portal and the teacher portal. It leads with ONE thing — the most pressing check-in, large, with
// its actions right there — then the rest, small:
//   attend   a check-in in the next 3 days or today. A parent confirms it or picks another time
//            without leaving the pop-up; Join on the day of an online one.
//   approve  (parents) a report waiting for them to read and approve.
//   write    (educators) a check-in whose day has passed with no report.
// Parents also see the three steps (confirm → meet → approve) with theirs lit up.
// It waits while the hub check-ins pop-up is showing (one at a time); "Remind me later" hides it
// until they next sign in (this browser tab).

const dismissedKey = (userId) => `mentorCheckins.popup.dismissed:${userId}`;
const hubPopupKey = (userId) => `checkins.duePopup.dismissed:${userId}`;
const read = (key) => { try { return sessionStorage.getItem(key) === "1"; } catch { return false; } };

const AVATAR_COLOURS = [BRAND.navy, BRAND.mid, BRAND.sky, "#c98a1c"];
const daysUntil = (date) => Math.round((new Date(`${date}T00:00:00Z`) - new Date(`${kenyaToday()}T00:00:00Z`)) / 86400000);
const longDay = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

// How soon, in words — gold when it needs them now.
function soon(m) {
  if (m.kind === "approve") return { text: "Waiting for your approval", urgent: true };
  if (m.kind === "write") {
    const late = -daysUntil(m.date);
    return { text: late <= 1 ? "Write it up today" : `Held ${late} days ago`, urgent: true };
  }
  const days = daysUntil(m.date);
  if (days <= 0) return { text: `Today at ${m.startTime}`, urgent: true };
  if (days === 1) return { text: `Tomorrow at ${m.startTime}`, urgent: true };
  return { text: `In ${days} days`, urgent: false };
}

const CSS = `
  @keyframes mcpFade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes mcpIn { from { opacity: 0; transform: translateY(18px) scale(0.97) } to { opacity: 1; transform: none } }
  @keyframes mcpPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(254,177,57,0.55) } 70% { box-shadow: 0 0 0 9px rgba(254,177,57,0) } }
  .mcp-backdrop { animation: mcpFade 200ms ease-out }
  .mcp-card { animation: mcpIn 320ms cubic-bezier(.2,.8,.2,1) }
  .mcp-dot { animation: mcpPulse 1.8s ease-out infinite }
  .mcp-btn { transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease }
  .mcp-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(26,53,80,0.18) }
  .mcp-btn:focus-visible, .mcp-row:focus-visible { outline: 3px solid ${BRAND.sky}; outline-offset: 2px }
  .mcp-row { transition: border-color 150ms ease, background 150ms ease, transform 150ms ease }
  .mcp-row:hover { border-color: ${BRAND.skyBorder}; background: #fff; transform: translateX(2px) }
  .mcp-hero-date { display: flex }
  @media (max-width: 600px) {
    .mcp-hero-date, .mcp-deco { display: none }
    .mcp-actions > * { flex: 1 1 100% }
    .mcp-steps { display: none !important }
  }
  @media (prefers-reduced-motion: reduce) { .mcp-backdrop, .mcp-card, .mcp-dot { animation: none } .mcp-btn, .mcp-row { transition: none } }
`;

// A big calendar page: weekday, day, month.
function CalendarTile({ date, size = "lg" }) {
  const d = new Date(`${date}T00:00:00`);
  const big = size === "lg";
  return (
    <div aria-hidden="true" style={{ width: big ? 92 : 50, flexShrink: 0, borderRadius: big ? 18 : 12, overflow: "hidden", background: "#fff", boxShadow: big ? "0 12px 30px rgba(10,25,45,0.35)" : "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center", border: big ? "none" : `1px solid ${BRAND.border}` }}>
      <div style={{ background: BRAND.gold, color: "#3d2a00", fontSize: big ? 12 : 9.5, fontWeight: 900, padding: big ? "5px 0" : "3px 0", textTransform: "uppercase", letterSpacing: "0.1em" }}>{d.toLocaleDateString("en-GB", { month: "short" })}</div>
      <div style={{ fontSize: big ? 38 : 19, fontWeight: 900, color: BRAND.navyDeep, lineHeight: 1.05, paddingTop: big ? 6 : 3 }}>{d.getDate()}</div>
      <div style={{ fontSize: big ? 12 : 9.5, fontWeight: 800, color: BRAND.muted, paddingBottom: big ? 8 : 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{d.toLocaleDateString("en-GB", { weekday: "short" })}</div>
    </div>
  );
}

function Avatar({ name, index = 0, size = 34, ring = "#fff" }) {
  const initials = String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  return (
    <span title={name} style={{ width: size, height: size, borderRadius: "50%", background: AVATAR_COLOURS[index % AVATAR_COLOURS.length], color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, border: `2.5px solid ${ring}`, flexShrink: 0, marginLeft: index ? -8 : 0 }}>
      {initials}
    </span>
  );
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, background: BRAND.skyTint, color: BRAND.mid, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: BRAND.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
        <div style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 700, color: BRAND.ink, lineHeight: 1.35 }}>{children}</div>
      </div>
    </div>
  );
}

const button = (variant, extra = {}) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, padding: "0 20px", borderRadius: 14,
  fontSize: 14.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", boxSizing: "border-box",
  ...(variant === "primary" ? { background: BRAND.navy, color: "#fff", border: `2px solid ${BRAND.navy}` }
    : variant === "gold" ? { background: BRAND.gold, color: "#3d2a00", border: `2px solid ${BRAND.gold}` }
    : variant === "join" ? { background: BRAND.mid, color: "#fff", border: `2px solid ${BRAND.mid}` }
    : { background: "#fff", color: BRAND.navy, border: `2px solid ${BRAND.navyBorder}` }),
  ...extra,
});

// Confirm → Meet → Approve, with the parent's current step lit.
function Steps({ m }) {
  const current = m.kind === "approve" ? 2 : m.confirmed ? 1 : 0;
  const steps = [
    { icon: FiCheck, text: "Confirm your time" },
    { icon: FiMessageCircle, text: "Meet the mentor" },
    { icon: FiThumbsUp, text: "Approve the report" },
  ];
  return (
    <div className="mcp-steps" style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 14px", borderRadius: 14, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <div key={s.text} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: done ? BRAND.mid : now ? BRAND.gold : "#fff", color: done ? "#fff" : now ? "#3d2a00" : BRAND.faint, border: `2px solid ${done ? BRAND.mid : now ? BRAND.gold : BRAND.border}` }}>
              {done ? <FiCheck size={13} /> : <s.icon size={12} />}
            </span>
            <span style={{ fontSize: 12, fontWeight: now ? 800 : 600, color: now ? BRAND.ink : BRAND.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.text}</span>
            {i < steps.length - 1 && <span aria-hidden="true" style={{ flex: 1, minWidth: 8, height: 2, borderRadius: 2, background: done ? BRAND.mid : BRAND.border }} />}
          </div>
        );
      })}
    </div>
  );
}

export default function MentorCheckinsPopup() {
  const { user } = useAuth();
  const parent = isParentUser(user);
  const educator = user?.role === "teacher" && !user?.hubLead;
  const allowed = !!user && (parent || educator);
  const base = parent ? "/parent/mentor-checkins" : "/teacher-portal/mentor-checkins";
  const [dismissed, setDismissed] = useState(() => (user ? read(dismissedKey(user.id)) : false));
  // The hub check-ins pop-up goes first; this one waits until it's closed (or has nothing).
  const [hubClosed, setHubClosed] = useState(() => (user ? read(hubPopupKey(user.id)) : false));
  useEffect(() => {
    const onClosed = () => setHubClosed(true);
    window.addEventListener("checkins-popup-closed", onClosed);
    return () => window.removeEventListener("checkins-popup-closed", onClosed);
  }, []);
  const { data: hubDue = [], isFetched: hubFetched } = useDueCheckins({ enabled: allowed && !hubClosed });
  const hubShowing = !hubClosed && (!hubFetched || hubDue.length > 0);
  const { data: due = [] } = useMentorDue({ enabled: allowed && !dismissed });
  const confirm = useMentorMutation((id) => mentorCheckinsApi.confirm(id), "Thanks — your time is confirmed");
  const [picking, setPicking] = useState(null);
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const visible = allowed && !dismissed && !hubShowing && due.length > 0;

  const close = () => {
    try { sessionStorage.setItem(dismissedKey(user.id), "1"); } catch { /* private mode: shows again next page load */ }
    setDismissed(true);
  };
  const open = (path) => { close(); navigate(path); };

  useEffect(() => {
    if (!visible) return undefined;
    dialogRef.current?.focus();
    // Escape closes the pop-up — unless the time picker is open over it (that closes first).
    const onKey = (e) => { if (e.key === "Escape" && !picking) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, picking]);

  if (!visible) return null;

  // The most pressing first: a report waiting on them, then the nearest check-in.
  const order = { approve: 0, write: 0, attend: 1 };
  const sorted = [...due].sort((a, b) => order[a.kind] - order[b.kind] || `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const [lead, ...rest] = sorted;
  const firstName = String(user.name || "").trim().split(/\s+/)[0];
  const when = soon(lead);
  const kids = childNames(lead) || "your child";
  const join = lead.kind === "attend" && lead.format === "online" && lead.date === kenyaToday() ? safeMeetingLink(lead.meetingLink) : null;

  const heading = parent
    ? lead.kind === "approve" ? `Your mentor has written up your check-in about ${kids}` : `You have a check-in about ${kids} with their mentor`
    : lead.kind === "write" ? `Time to write up your check-in with ${lead.parentName}` : `You're meeting ${lead.parentName} about ${kids}`;
  const subheading = parent
    ? lead.kind === "approve" ? "Read what was discussed and agreed, then approve it — it only takes a minute." : "A one-to-one about how they're doing — their progress, what they enjoy and what's next."
    : lead.kind === "write" ? "Share how the child is doing and what you agreed — the parent reads it and approves it." : "One family at a time. Have the child's latest report to hand.";

  return createPortal(
    <div role="presentation" data-signin-popup="" className="mcp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !picking) close(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(10,22,40,0.62)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT }}>
      <style>{CSS}</style>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mcp-title" className="mcp-card" style={{ width: "100%", maxWidth: 760, maxHeight: "94vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 26, overflow: "hidden", boxShadow: "0 40px 90px rgba(10,22,40,0.45)", outline: "none" }}>

        {/* Header */}
        <div style={{ position: "relative", padding: "30px 32px 30px", background: HERO_GRADIENT, color: "#fff", overflow: "hidden", flexShrink: 0 }}>
          <div aria-hidden="true" style={{ position: "absolute", top: -90, right: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div aria-hidden="true" style={{ position: "absolute", bottom: -70, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(56,170,225,0.18)" }} />
          <div aria-hidden="true" className="mcp-deco" style={{ position: "absolute", top: 26, right: 190, width: 10, height: 10, borderRadius: "50%", background: BRAND.gold, opacity: 0.85 }} />
          <button type="button" onClick={close} aria-label="Close" className="mcp-btn" style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 12, border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            <FiX size={18} />
          </button>
          <div style={{ position: "relative", display: "flex", gap: 24, alignItems: "center", paddingRight: 30 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                <span className="mcp-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND.gold }} />
                {parent ? "Mentor check-in" : "Parent check-in"}
              </span>
              <p style={{ margin: "14px 0 4px", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>{firstName ? `Hi ${firstName},` : "Hello,"}</p>
              <h2 id="mcp-title" style={{ margin: 0, fontSize: 27, fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.5px" }}>{heading}</h2>
              <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, maxWidth: 480 }}>{subheading}</p>
            </div>
            <div className="mcp-hero-date" style={{ flexDirection: "column", alignItems: "center", gap: 10 }}>
              <CalendarTile date={lead.date} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.18)", padding: "4px 10px", borderRadius: 999 }}>{lead.startTime}–{lead.endTime}</span>
            </div>
          </div>
        </div>

        <div style={{ overflowY: "auto", background: BRAND.canvas }}>
          {/* The one that matters most */}
          <div style={{ margin: "20px 20px 0", position: "relative", background: "#fff", borderRadius: 20, border: `1.5px solid ${when.urgent ? BRAND.goldBorder : BRAND.border}`, boxShadow: "0 10px 30px rgba(26,53,80,0.10)", padding: "20px 22px", display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: when.urgent ? BRAND.goldTint : BRAND.skyTint, color: when.urgent ? BRAND.goldText : BRAND.skyText, border: `1px solid ${when.urgent ? BRAND.goldBorder : BRAND.skyBorder}`, fontSize: 13, fontWeight: 800 }}>
                <FiClock size={14} /> {when.text}
              </span>
              {lead.kind === "attend" && (lead.confirmed
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: BRAND.mid }}><FiCheckCircle size={15} /> {parent ? "You've confirmed" : "Parent confirmed"}</span>
                : <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.muted }}>{parent ? "Not confirmed yet" : "Parent hasn't confirmed yet"}</span>)}
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))" }}>
              <Fact icon={FiCalendar} label="When">{longDay(lead.date)}<br /><span style={{ color: BRAND.mid }}>{lead.startTime} – {lead.endTime}</span></Fact>
              <Fact icon={lead.format === "online" ? FiVideo : FiMapPin} label="Where">
                {lead.format === "online" ? "Online — join from the link" : lead.location || "In person"}
                <br /><span style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.muted }}>{lead.className}{lead.hubName ? ` · ${lead.hubName}` : ""}</span>
              </Fact>
              <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                <span style={{ display: "inline-flex" }}>
                  {(parent ? lead.educatorNames : [lead.parentName]).slice(0, 3).map((n, i) => <Avatar key={n} name={n} index={i} />)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, color: BRAND.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{parent ? "With" : "Family"}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 700, color: BRAND.ink, lineHeight: 1.35 }}>
                    {parent ? lead.educatorNames.join(", ") || "Your child's mentor" : lead.parentName}
                    <br /><span style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.muted }}>About {kids}</span>
                  </p>
                </div>
              </div>
            </div>

            {lead.kind === "approve" && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}` }}>
                <FiFileText size={20} color={BRAND.mid} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.5 }}>
                  <strong>{lead.writtenBy || "The mentor"}</strong> wrote up how {kids} is doing and what you agreed together.
                </p>
              </div>
            )}

            {parent && <Steps m={lead} />}

            <div className="mcp-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {join && <a href={join} target="_blank" rel="noopener noreferrer" onClick={close} className="mcp-btn" style={button("join")}><FiVideo size={17} /> Join now</a>}
              {parent && lead.kind === "attend" && !lead.confirmed && (
                <button type="button" className="mcp-btn" disabled={confirm.isPending} onClick={() => confirm.mutate(lead.id)} style={button("gold", { opacity: confirm.isPending ? 0.7 : 1 })}>
                  <FiCheckCircle size={17} /> {confirm.isPending ? "Confirming…" : "Confirm this time"}
                </button>
              )}
              {parent && lead.kind === "attend" && lead.state === "upcoming" && (
                <button type="button" className="mcp-btn" onClick={() => setPicking(lead)} style={button("secondary")}><FiMove size={16} /> Pick another time</button>
              )}
              {lead.kind === "approve" && <button type="button" className="mcp-btn" onClick={() => open(`${base}/meetings/${lead.id}`)} style={button("gold")}><FiThumbsUp size={17} /> Read &amp; approve</button>}
              {lead.kind === "write" && <button type="button" className="mcp-btn" onClick={() => open(`${base}/meetings/${lead.id}`)} style={button("gold")}><FiEdit3 size={17} /> Write the report</button>}
              {lead.kind === "attend" && <button type="button" className="mcp-btn" onClick={() => open(`${base}/meetings/${lead.id}`)} style={button(parent && !lead.confirmed ? "secondary" : "primary")}>See the details <FiArrowRight size={16} /></button>}
            </div>
          </div>

          {/* Everything else */}
          {rest.length > 0 && (
            <div style={{ padding: "22px 20px 4px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 11.5, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Also waiting for you · {rest.length}</p>
              <div style={{ display: "grid", gap: 8 }}>
                {rest.slice(0, 3).map((m) => {
                  const s = soon(m);
                  return (
                    <button key={m.id} type="button" className="mcp-row" onClick={() => open(`${base}/meetings/${m.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", borderRadius: 14, border: `1.5px solid ${BRAND.border}`, background: "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                      <CalendarTile date={m.date} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: BRAND.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parent ? `About ${childNames(m) || "your child"}` : `${m.parentName} · ${childNames(m)}`}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: s.urgent ? BRAND.goldText : BRAND.muted, fontWeight: 700 }}>{s.text} · {m.startTime} · {m.format === "online" ? "Online" : m.location || "In person"}</p>
                      </div>
                      <FiArrowRight size={17} color={BRAND.mid} style={{ flexShrink: 0 }} />
                    </button>
                  );
                })}
                {rest.length > 3 && (
                  <button type="button" onClick={() => open(base)} style={{ border: "none", background: "none", color: BRAND.mid, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, padding: 4 }}>
                    + {rest.length - 3} more — see them all
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "18px 22px 22px" }}>
            <button type="button" onClick={close} className="mcp-btn" style={{ border: "none", background: "none", color: BRAND.muted, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT, padding: "8px 4px" }}>Remind me later</button>
            <button type="button" onClick={() => open(base)} className="mcp-btn" style={{ ...button("secondary"), minHeight: 40, fontSize: 13.5 }}>
              {parent ? "All my mentor check-ins" : "All my parent check-ins"} <FiArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
      {picking && <TimePickerDialog meeting={picking} asParent onClose={() => setPicking(null)} />}
    </div>,
    document.body,
  );
}
