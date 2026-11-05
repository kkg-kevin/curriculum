import { useState } from "react";
import { FiAlertCircle, FiArrowDownRight, FiArrowUpRight, FiAward, FiBookOpen, FiCheckCircle, FiChevronDown, FiChevronUp, FiClock, FiMinus, FiRefreshCw, FiShield, FiStar, FiTrendingUp, FiUsers } from "react-icons/fi";
import FeedbackSummary from "../../mentor-reviews/components/FeedbackSummary";
import { useRefreshEducatorProfile } from "../hooks/useEducatorProfile";
import { BRAND as C, FONT, card, cardHeading, pill } from "../../../theme/brand";

// An educator's performance profile, inside the system — the educator page (admins, staff, the hub,
// the supervisor) and the educator's own My profile. Read top to bottom:
//   1. At a glance   a plain-language summary and the four core scores (quality, parents,
//                    reliability, hours).
//   2. Quality       every QA visit compounded — all-time average, running average after each visit,
//                    each area across all visits, the latest strengths / to improve, every visit.
//   3. Parents       ratings by aspect.
//   4. Teaching      sessions, learners, feedback speed, outcomes, hours month by month.
//   5. Badges and what to work on next; courses taught; hub leadership.
// Every figure comes from the records (educator-profile.stats.js); the hub's version leaves out growth
// tips, and parent ratings until 3 reviews. Pay is never shown. System colours only (theme/brand.js).

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("en-KE", { maximumFractionDigits: d }));
const plural = (n, word, many = `${word}s`) => `${fmt(n)} ${n === 1 ? word : many}`;
const monthShort = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short" });
const dayShort = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
const dayLong = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const QA_BAND_COLOR = { Excellent: C.navy, Strong: C.mid, Developing: C.goldText };
const BAND_TONE = { Excellent: "strong", Strong: "good", Developing: "waiting" };
const box = { ...card, padding: "18px 20px" };

function SectionTitle({ icon: Icon, title, note, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><Icon size={16} color={C.mid} /> {title}</h3>
        {note && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: C.muted }}>{note}</p>}
      </div>
      {action}
    </div>
  );
}

// A change in points: up navy, down gold, with an arrow and words — never colour alone.
function Delta({ value, suffix = "", size = 12 }) {
  if (value == null) return null;
  const Icon = value > 0 ? FiArrowUpRight : value < 0 ? FiArrowDownRight : FiMinus;
  const color = value > 0 ? C.navy : value < 0 ? C.goldText : C.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: size, fontWeight: 800, color, whiteSpace: "nowrap" }}>
      <Icon size={size + 1} /> {value > 0 ? "+" : ""}{value}{suffix}
    </span>
  );
}

// One of the four core scores at the top.
function CoreScore({ icon: Icon, label, value, unit, badge, detail, meaning }) {
  return (
    <div style={{ ...card, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}><Icon size={14} color={C.mid} /> {label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: C.ink, lineHeight: 1 }}>{value}{unit && value !== "—" && <span style={{ fontSize: 15, fontWeight: 700, color: C.muted }}>{unit}</span>}</span>
        {badge}
      </div>
      {detail && <span style={{ fontSize: 12.5, color: C.inkSoft }}>{detail}</span>}
      {meaning && <span style={{ fontSize: 11.5, color: C.faint, marginTop: "auto", paddingTop: 4 }}>{meaning}</span>}
    </div>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div style={{ padding: "11px 13px", borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}`, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.muted }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 900, color: C.ink, lineHeight: 1.15 }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.faint }}>{sub}</p>}
    </div>
  );
}

// Each visit's score (bars) and the running average after it (line) — one 0–100% axis.
function QaProgress({ history }) {
  const [hover, setHover] = useState(null);
  const rows = history.slice(-12);
  const n = rows.length;
  const H = 150;
  const shown = hover != null ? rows[hover] : null;
  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.sky }} /> Visit score</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 2, background: C.navy, borderRadius: 2 }} /><span style={{ width: 8, height: 8, borderRadius: 999, background: C.navy, marginLeft: -12, boxShadow: `0 0 0 2px ${C.surface}` }} /> Running average</span>
        {history.length > n && <span style={{ color: C.faint }}>Last {n} of {history.length} visits</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: H, fontSize: 10.5, color: C.faint, textAlign: "right", width: 30, flexShrink: 0 }}>
          <span>100%</span><span>50%</span><span>0%</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: "relative" }} onMouseLeave={() => setHover(null)}>
          <div style={{ position: "relative", height: H, borderBottom: `1px solid ${C.border}`, backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px)`, backgroundSize: `100% ${H / 2}px` }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
              {rows.map((h, i) => (
                <div key={`${h.date}-${i}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${dayLong(h.date)}: ${h.score}%, running average ${h.runningAverage}%`}
                  style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default", outline: "none", background: hover === i ? "rgba(56,170,225,0.08)" : "transparent", borderRadius: 4 }}>
                  <div style={{ width: "62%", maxWidth: 40, height: `${Math.max(2, h.score)}%`, background: C.sky, borderRadius: "4px 4px 0 0", opacity: hover == null || hover === i ? 1 : 0.55 }} />
                </div>
              ))}
            </div>
            {n > 1 && (
              <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }} aria-hidden="true">
                <polyline points={rows.map((h, i) => `${i + 0.5},${100 - h.runningAverage}`).join(" ")} fill="none" stroke={C.surface} strokeWidth="6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <polyline points={rows.map((h, i) => `${i + 0.5},${100 - h.runningAverage}`).join(" ")} fill="none" stroke={C.navy} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            )}
            {rows.map((h, i) => (
              <span key={`dot-${i}`} style={{ position: "absolute", left: `calc(${((i + 0.5) / n) * 100}% - 5px)`, bottom: `calc(${h.runningAverage}% - 5px)`, width: 10, height: 10, borderRadius: 999, background: C.navy, boxShadow: `0 0 0 2px ${C.surface}`, pointerEvents: "none" }} />
            ))}
            {shown && (
              <div style={{ position: "absolute", top: 6, left: `${Math.min(Math.max(((hover + 0.5) / n) * 100, 18), 82)}%`, transform: "translateX(-50%)", background: C.ink, color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 2, boxShadow: "0 4px 14px rgba(17,24,39,0.18)" }}>
                <strong>{dayLong(shown.date)}</strong>{shown.visitType === "surprise" ? " · surprise" : ""}<br />
                Visit {shown.score}% · average then {shown.runningAverage}%
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
            {rows.map((h, i) => <span key={`l-${i}`} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: hover === i ? C.ink : C.faint, fontWeight: hover === i ? 800 : 500, whiteSpace: "nowrap", overflow: "hidden" }}>{n <= 8 || i % 2 === n % 2 ? dayShort(h.date) : ""}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HourBars({ rows }) {
  const top = Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 112, overflowX: "auto" }}>
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${fmt(r.value, 1)} h`} style={{ flex: "1 0 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>{fmt(r.value, 1)}</span>
          <div style={{ width: "100%", maxWidth: 32, height: Math.max(3, ((r.value || 0) / top) * 80), background: C.mid, borderRadius: "4px 4px 0 0" }} />
          <span style={{ fontSize: 10.5, color: C.faint }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// The courses an educator has taught — shared by the profile and the teacher portal's Teaching tab.
export function CoursesTaught({ courses = [] }) {
  return (
    <div style={box}>
      <h3 style={{ ...cardHeading, marginBottom: 12 }}><FiBookOpen size={12} /> Courses taught</h3>
      {!courses.length ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Not teaching a course yet.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {["Course", "Class · Hub", "Sessions", "Hours", "Learners", "Finished", "Certificates"].map((x) => <th key={x} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}`, fontWeight: 800 }}>{x}</th>)}
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={`${c.classId}:${c.courseId}`} style={{ opacity: c.active ? 1 : 0.6 }}>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}`, fontWeight: 700, color: C.ink }}>{c.course}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}`, color: C.muted }}>{[c.className, c.hub].filter(Boolean).join(" · ")}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{c.sessions}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{fmt(c.hours, 1)}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{c.learners}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{c.finished}</td>
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{c.certificates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// The summary in words, for whoever is reading (the educator: "You…").
function summaryLines({ s, own, first }) {
  const who = own ? "You" : first || "This educator";
  const has = own ? "have" : "has";
  const q = s.qa || {};
  const r = s.rating || {};
  const rel = s.reliability || {};
  const lines = [];
  lines.push(s.sessions?.total
    ? `${who} ${has} taught ${plural(s.learnersTaught || 0, "learner")} across ${plural(s.sessions.total, "session")}${s.hours?.total ? ` (${fmt(s.hours.total, 1)} verified hours)` : ""} on ${plural(s.coursesCount || 0, "course")}.`
    : `${who} ${has} no sessions with attendance taken yet.`);
  if (q.count) {
    const move = q.change != null && q.change !== 0 ? `, ${q.change > 0 ? "up" : "down"} ${Math.abs(q.change)} points since the first` : "";
    lines.push(`Quality reviews average ${q.average}% (${q.band}) across ${plural(q.count, "visit")}${move}.`);
  } else lines.push("No quality review yet.");
  if (r.hidden) lines.push("Parent ratings show once there are 3 reviews.");
  else if (r.count) lines.push(`Parents rate ${own ? "you" : "them"} ${r.average.toFixed(1)}★ from ${plural(r.count, "review")} in the last 12 months.`);
  else lines.push("No parent reviews in the last 12 months.");
  if (rel.rate != null) lines.push(`${rel.rate}% of timetabled sessions were held in the last 90 days.`);
  return lines;
}

export default function PerformanceProfile({ profile, teacherId = null, showCourses = true, showHeading = true }) {
  const refresh = useRefreshEducatorProfile(teacherId);
  const [allVisits, setAllVisits] = useState(false);
  const s = profile.stats;
  const hub = profile.view === "hub";
  const own = profile.view === "own";
  const r = s.rating || {};
  const q = s.qa || {};
  const rel = s.reliability || {};
  const fb = s.feedback || {};
  const first = (profile.teacher?.name || "").split(" ")[0];
  const earned = (s.badges || []).filter((b) => b.earned);
  const toEarn = (s.badges || []).filter((b) => !b.earned);
  const history = q.history || [];
  const visits = [...history].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      {/* 1. At a glance */}
      <section style={{ ...box, background: `linear-gradient(180deg, ${C.canvas}, ${C.surface})` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: showHeading ? 17 : 15.5, fontWeight: 900, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><FiTrendingUp color={C.mid} /> {showHeading ? (own ? "Your performance" : "Performance profile") : "At a glance"}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.faint }}>Worked out from the records{s.computedAt ? ` · updated ${new Date(s.computedAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
          </div>
          <button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.surface, color: C.navy, fontSize: 12, fontWeight: 700, cursor: refresh.isPending ? "wait" : "pointer", fontFamily: "inherit" }}>
            <FiRefreshCw size={12} /> {refresh.isPending ? "Counting…" : "Refresh"}
          </button>
        </div>
        <ul style={{ margin: "0 0 16px", paddingLeft: 18, display: "grid", gap: 4, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55 }}>
          {summaryLines({ s, own, first }).map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 180px), 1fr))" }}>
          <CoreScore icon={FiShield} label="Quality reviews" value={q.average != null ? q.average : "—"} unit="%"
            badge={q.band && <span style={pill(BAND_TONE[q.band])}>{q.band}</span>}
            detail={q.count ? <>{plural(q.count, "visit")} {q.change != null && <> · <Delta value={q.change} suffix=" since first" /></>}</> : "Not reviewed yet"}
            meaning="Average of every visit by a supervisor" />
          <CoreScore icon={FiStar} label="Parent rating" value={!r.hidden && r.average != null ? r.average.toFixed(1) : "—"} unit=" / 5"
            detail={r.hidden ? `Shows from 3 reviews (${r.count || 0} so far)` : plural(r.count || 0, "review")}
            meaning="Last 12 months" />
          <CoreScore icon={FiCheckCircle} label="Reliability" value={rel.rate != null ? rel.rate : "—"} unit="%"
            detail={rel.planned ? `${rel.given} of ${rel.planned} timetabled sessions held` : "No timetabled sessions yet"}
            meaning="Last 90 days · held = attendance taken" />
          <CoreScore icon={FiClock} label="Verified hours" value={fmt(s.hours?.total, 1)}
            detail={`${fmt(s.hours?.last90Days, 1)} in the last 90 days`}
            meaning="Sessions with attendance, at the timetable's length" />
        </div>
      </section>

      {/* 2. Quality reviews — compounded */}
      <section style={box}>
        <SectionTitle icon={FiShield} title="Quality reviews" note="Every visit counts — each new review moves the totals below." />
        {!q.count ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No quality review yet. Once a supervisor sends a review, its score appears here and adds to the totals with every visit after it.</p> : (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "100%" }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 118px), 1fr))" }}>
              <Figure label="All-time average" value={`${q.average}%`} sub={q.band} />
              <Figure label="Visits" value={fmt(q.count)} sub={[q.announced ? `${q.announced} announced` : null, q.surprise ? `${q.surprise} surprise` : null].filter(Boolean).join(" · ") || null} />
              <Figure label="Latest" value={`${q.latestScore}%`} sub={<>{dayLong(q.latestAt)} {q.sinceLast != null && <Delta value={q.sinceLast} size={11} />}</>} />
              <Figure label="Since the first" value={q.change != null ? <Delta value={q.change} suffix=" pts" size={18} /> : "—"} sub={q.change != null ? `${q.firstScore}% → ${q.latestScore}%` : "After a second visit"} />
              <Figure label="Best" value={`${q.best}%`} sub={`lowest ${q.lowest}%`} />
              <Figure label="Items checked" value={fmt(q.itemsChecked)} sub="across all visits" />
            </div>

            {history.length > 0 && <QaProgress history={history} />}

            {q.sections?.length > 0 && (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: C.ink }}>By area, across all visits</p>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
                  {q.sections.map((x) => (
                    <div key={x.title} style={{ display: "grid", gridTemplateColumns: "100%", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: C.ink }}>{x.title}</span>
                        <span style={{ display: "inline-flex", gap: 10, alignItems: "baseline", fontSize: 12, color: C.muted }}>
                          {x.visits > 1 && <span>latest {x.latest}%</span>}
                          {x.change != null && <Delta value={x.change} size={11.5} />}
                          <strong style={{ fontSize: 14, color: C.ink }}>{x.score}%</strong>
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: C.track, overflow: "hidden" }}><div style={{ width: `${x.score}%`, height: "100%", background: x.score >= 70 ? C.mid : C.gold, borderRadius: 999 }} /></div>
                      <span style={{ fontSize: 11, color: C.faint }}>{plural(x.visits, "visit")} · {plural(x.items, "item")} scored</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(q.strengths || q.improvements) && (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
                {q.strengths && <div style={{ padding: "12px 14px", borderRadius: 12, background: C.skyTint, border: `1px solid ${C.skyBorder}` }}><p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 800, color: C.navy, textTransform: "uppercase", letterSpacing: "0.05em" }}>Strengths · latest visit</p><p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>{q.strengths}</p></div>}
                {q.improvements && <div style={{ padding: "12px 14px", borderRadius: 12, background: C.goldTint, border: `1px solid ${C.goldBorder}` }}><p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 800, color: C.goldText, textTransform: "uppercase", letterSpacing: "0.05em" }}>To improve · latest visit</p><p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.55 }}>{q.improvements}</p></div>}
              </div>
            )}

            {visits.length > 0 && (
              <div>
                <button type="button" onClick={() => setAllVisits((v) => !v)} aria-expanded={allVisits} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: 0, padding: 0, color: C.mid, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {allVisits ? <FiChevronUp /> : <FiChevronDown />} {allVisits ? "Hide" : "Show"} every visit ({visits.length})
                </button>
                {allVisits && (
                  <div style={{ overflowX: "auto", marginTop: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: C.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {["Visit", "Kind", "Score", "Average after it"].map((x) => <th key={x} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}`, fontWeight: 800 }}>{x}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {visits.map((v, i) => (
                          <tr key={`${v.date}-${i}`}>
                            <td style={{ padding: 8, borderBottom: `1px solid ${C.line}`, fontWeight: 700, color: C.ink }}>{dayLong(v.date)}</td>
                            <td style={{ padding: 8, borderBottom: `1px solid ${C.line}`, color: C.muted }}>{v.visitType === "surprise" ? "Surprise" : "Announced"}</td>
                            <td style={{ padding: 8, borderBottom: `1px solid ${C.line}` }}>{v.score}%</td>
                            <td style={{ padding: 8, borderBottom: `1px solid ${C.line}`, fontWeight: 700 }}>{v.runningAverage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Parents */}
      <section style={box}>
        <SectionTitle icon={FiStar} title="What parents say" note="Ratings from families of the learners taught · last 12 months" />
        {r.hidden ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Averages show from 3 reviews, so no one family can be picked out ({r.count || 0} so far).</p>
          : r.count ? <FeedbackSummary summary={r} /> : <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No parent reviews in the last 12 months.</p>}
      </section>

      {/* 4. Teaching activity */}
      <section style={box}>
        <SectionTitle icon={FiUsers} title="Teaching" note="Sessions count when attendance is taken" />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 160px), 1fr))", marginBottom: 18 }}>
          <Figure label="Sessions held" value={fmt(s.sessions?.total)} sub={s.sessions?.untimed ? `${s.sessions.untimed} without a set time` : null} />
          <Figure label="Learners taught" value={fmt(s.learnersTaught)} sub={plural(s.coursesCount || 0, "course")} />
          <Figure label="Feedback speed" value={fb.medianHours != null ? (fb.medianHours < 1 ? "< 1 h" : `${Math.round(fb.medianHours)} h`) : "—"} sub={fb.count ? `typical · ${plural(fb.count, "piece")} marked` : "Nothing hand-marked yet"} />
          <Figure label="Learners finished" value={fmt(s.outcomes?.learnersFinished)} sub={`${plural(s.outcomes?.certificatesEarned || 0, "certificate")}${s.outcomes?.averageScore != null ? ` · avg ${s.outcomes.averageScore}%` : ""}`} />
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: C.ink }}>Verified hours, month by month</p>
        {s.hours?.byMonth?.length ? <HourBars rows={s.hours.byMonth.map((m) => ({ label: monthShort(m.month), value: m.hours }))} />
          : <p style={{ margin: 0, fontSize: 13, color: C.muted }}>No timed sessions in the last 12 months. Hours count each session with attendance taken, at its timetable slot&apos;s length.</p>}
        {rel.rate != null && rel.rate < 80 && !hub && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "flex-start" }}><FiAlertCircle style={{ flexShrink: 0, marginTop: 2 }} /> A timetabled session counts as held when its attendance was taken — sessions taught without attendance don&apos;t count.</p>
        )}
      </section>

      {/* 5. Badges and next steps */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", alignItems: "start" }}>
        <section style={box}>
          <SectionTitle icon={FiAward} title="Badges" note={`${earned.length} of ${(s.badges || []).length} earned — each has a published rule`} />
          {earned.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: toEarn.length ? 14 : 0 }}>
              {earned.map((b) => <span key={b.key} title={b.rule} style={{ ...pill("waiting", { fontSize: 12.5, padding: "5px 12px" }) }}><FiAward size={13} /> {b.label}</span>)}
            </div>
          )}
          {toEarn.length > 0 && (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
              {toEarn.map((b) => (
                <div key={b.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12.5, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                  <span style={{ color: C.inkSoft, fontWeight: 700 }}>{b.label} <span style={{ fontWeight: 500, color: C.faint }}>— {b.rule}</span></span>
                  <span style={{ color: C.muted }}>{b.progress}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        {!hub && s.tips?.length > 0 && (
          <section style={{ ...box, background: C.skyTint, borderColor: C.skyBorder }}>
            <SectionTitle icon={FiTrendingUp} title={own ? "What to work on next" : "Growth areas"} />
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8, fontSize: 13.5, color: C.ink, lineHeight: 1.55 }}>
              {s.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          </section>
        )}
      </div>

      {showCourses && <CoursesTaught courses={s.courses} />}

      {s.leadership && (
        <section style={box}>
          <SectionTitle icon={FiUsers} title="Hub leadership" note="As Account Manager / Training Lead" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 160px), 1fr))" }}>
            <Figure label="Check-ins reported" value={`${s.leadership.checkinsReported} of ${s.leadership.checkinsDue}`} />
            <Figure label="Reported on time" value={fmt(s.leadership.reportedOnTime)} sub="within 2 days" />
            <Figure label="Tasks done" value={`${s.leadership.tasksDone} of ${s.leadership.tasks}`} />
          </div>
        </section>
      )}
    </div>
  );
}
