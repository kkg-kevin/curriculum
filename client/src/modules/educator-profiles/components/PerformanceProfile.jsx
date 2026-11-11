import { useState } from "react";
import { FiAlertCircle, FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiAward, FiBookOpen, FiCalendar, FiCheck, FiCheckCircle, FiChevronDown, FiChevronUp, FiClock, FiInfo, FiMinus, FiRefreshCw, FiShield, FiStar, FiTarget, FiTrendingUp, FiUserCheck, FiUsers, FiZap } from "react-icons/fi";
import FeedbackSummary from "../../mentor-reviews/components/FeedbackSummary";
import StandardsCard from "../../mentor-standards/StandardsCard";
import { OVERALL, formatValue, iconOf, targetText } from "../../mentor-standards/standards";
import { useRefreshEducatorProfile } from "../hooks/useEducatorProfile";
import { BRAND as C, FONT, card, cardHeading, pill } from "../../../theme/brand";

// An educator's performance profile, inside the system — the educator page (admins, staff, the hub,
// the supervisor) and the educator's own My profile. In panels, so each page puts them on its own
// tabs (11 Nov 2026 — one long page was hard to read):
//   ProfileKpis    the five figures that matter, as a strip under the page's header — each opens its tab.
//   OverviewPanel  in short (a plain-language summary), what needs attention (standards not met, with
//                  what helps; else growth tips) and badges.
//   StandardsCard  (mentor-standards/) against the workspace's mentor standards.
//   QualityPanel   every QA visit compounded (average, running average, by area, latest strengths /
//                  to improve, every visit) and what parents say.
//   TeachingPanel  sessions, learners, feedback speed, outcomes, hours month by month, courses taught,
//                  hub leadership.
// The default export stacks them all (the supervisor's educator page).
// Every figure comes from the records (educator-profile.stats.js); the hub's version leaves out growth
// tips, and parent ratings until 3 reviews. Pay is never shown. System colours only (theme/brand.js).

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("en-KE", { maximumFractionDigits: d }));
const plural = (n, word, many = `${word}s`) => `${fmt(n)} ${n === 1 ? word : many}`;
const monthShort = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short" });
const dayShort = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
const dayLong = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const QA_BAND_COLOR = { Excellent: C.navy, Strong: C.mid, Developing: C.goldText };
export const box = { ...card, padding: "18px 20px" };

export function SectionTitle({ icon: Icon, title, note, action }) {
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

// Verified hours over the last 12 months — every month shown, empty ones too, so one busy month
// still reads in context.
function HourBars({ byMonth = [] }) {
  const have = new Map(byMonth.map((m) => [m.month, m.hours]));
  const now = new Date(Date.now() + 3 * 3600 * 1000);
  const rows = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return { key, label: monthShort(key), value: have.get(key) || 0 };
  });
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 128 }}>
      {rows.map((r) => (
        <div key={r.key} title={`${r.label}: ${fmt(r.value, 1)} h`} style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10.5, color: r.value ? C.inkSoft : "transparent", fontWeight: 700 }}>{fmt(r.value, 1)}</span>
          <div style={{ width: "100%", maxWidth: 28, height: r.value ? Math.max(6, (r.value / top) * 84) : 3, background: r.value ? C.mid : C.track, borderRadius: "5px 5px 2px 2px" }} />
          <span style={{ fontSize: 10.5, color: C.faint }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

// A soft, iconed "nothing yet" — one short line, never a paragraph.
export function EmptyState({ icon: Icon, title, line }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 0" }}>
      <span aria-hidden style={{ width: 46, height: 46, borderRadius: 14, background: C.skyTint, color: C.mid, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={21} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.ink }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{line}</p>
      </div>
    </div>
  );
}

// A small figure tile with its icon.
export function IconFigure({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderRadius: 14, background: C.canvas, border: `1px solid ${C.line}`, minWidth: 0 }}>
      <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: C.surface, border: `1px solid ${C.line}`, color: C.mid, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{value}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</p>
        {sub && <p style={{ margin: "1px 0 0", fontSize: 11.5, color: C.faint }}>{sub}</p>}
      </div>
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

// The five figures that matter, as a strip — each a button to the tab with its detail (`onOpen(tab)`).
export function ProfileKpis({ profile, onOpen = null }) {
  const s = profile.stats;
  const hub = profile.view === "hub";
  const r = s.rating || {};
  const q = s.qa || {};
  const rel = s.reliability || {};
  const st = !hub ? profile.standards : null;
  const overall = st ? OVERALL[st.overall] || OVERALL.not_enough : null;
  const tiles = [
    st && { key: "standards", tab: "standards", icon: FiTarget, label: "Mentor standards", value: `${st.met} / ${st.counted}`, sub: overall.label, tone: overall.tone },
    { key: "rating", tab: "quality", icon: FiStar, label: "Parent rating", value: !r.hidden && r.average != null ? `${r.average.toFixed(1)} ★` : "—", sub: r.hidden ? `Shows from 3 reviews (${r.count || 0} so far)` : `${plural(r.count || 0, "review")} · 12 months` },
    { key: "qa", tab: "quality", icon: FiShield, label: "Quality reviews", value: q.average != null ? `${q.average}%` : "—", sub: q.count ? `${q.band} · ${plural(q.count, "visit")}` : "Not reviewed yet" },
    { key: "held", tab: "teaching", icon: FiCheckCircle, label: "Sessions held", value: rel.rate != null ? `${rel.rate}%` : "—", sub: rel.planned ? `${rel.given} of ${rel.planned} timetabled · 90 days` : "No timetabled sessions yet" },
    { key: "hours", tab: "teaching", icon: FiClock, label: "Verified hours", value: fmt(s.hours?.total, 1), sub: `${fmt(s.hours?.last90Days, 1)} in the last 90 days` },
  ].filter(Boolean);
  return <KpiStrip tiles={tiles} onOpen={onOpen} />;
}

// The strip itself — tiles of { key, tab, icon, label, value, sub, tone? }. Shared with the families'
// view of a profile (PublicProfileView), so every side sees an educator laid out the same way.
export function KpiStrip({ tiles, onOpen = null }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: FONT }}>
      {tiles.map((t) => {
        const Tag = onOpen ? "button" : "div";
        return (
          <Tag
            key={t.key}
            type={onOpen ? "button" : undefined}
            onClick={onOpen ? () => onOpen(t.tab) : undefined}
            aria-label={onOpen ? `${t.label}: ${t.value}. Open the details` : undefined}
            className={onOpen ? "pp-kpi" : undefined}
            style={{ ...card, flex: "1 1 170px", minWidth: 0, padding: "14px 16px", textAlign: "left", fontFamily: FONT, cursor: onOpen ? "pointer" : "default", display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}><t.icon size={14} color={C.mid} /> {t.label}</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{t.value}</span>
            {t.tone ? <span style={{ ...pill(t.tone), alignSelf: "flex-start" }}>{t.sub}</span> : <span style={{ fontSize: 12, color: C.faint }}>{t.sub}</span>}
          </Tag>
        );
      })}
      <style>{".pp-kpi { transition: border-color 150ms ease, box-shadow 150ms ease; } .pp-kpi:hover { border-color: #A9BCD2; box-shadow: 0 4px 14px rgba(37,71,106,0.08); } .pp-kpi:focus-visible { outline: 2px solid #38aae1; outline-offset: 2px; }"}</style>
    </div>
  );
}

// The standards met as a ring, with how many stand where.
function StandardsRing({ standing }) {
  const counted = standing.counted || 0;
  const share = counted ? standing.met / counted : 0;
  const r = 34;
  const len = 2 * Math.PI * r;
  const count = (st) => standing.items.filter((i) => i.status === st).length;
  const legend = [
    ["Meeting", count("meets"), C.mid],
    ["Close", count("close"), C.gold],
    ["Below", count("below"), C.danger],
    ["Waiting for data", count("not_enough"), C.border],
  ].filter(([, n]) => n > 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${standing.met} of ${counted} standards met`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke={C.track} strokeWidth="10" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={standing.overall === "below" ? C.danger : standing.overall === "close" ? C.gold : C.mid} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${share * len} ${len}`} transform="rotate(-90 44 44)" />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 20, fontWeight: 900, fill: C.ink, fontFamily: FONT }}>{standing.met}/{counted}</text>
      </svg>
      <div style={{ display: "grid", gap: 5 }}>
        {legend.map(([label, n, color]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.inkSoft }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> <strong style={{ color: C.ink }}>{n}</strong> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// One thing to work on: the standard, the figure against it on a small bar, and what helps.
function WorkOnRow({ item }) {
  const top = item.unit === "★" ? 5 : 100;
  const bar = item.value != null && item.higherIsBetter !== false;
  const color = item.status === "below" ? C.danger : item.status === "close" ? C.gold : C.sky;
  const Icon = iconOf(item.key);
  return (
    <div style={{ padding: "12px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 180px", fontSize: 14, fontWeight: 800, color: C.ink, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: C.canvas, border: `1.5px solid ${color}`, color: C.navy, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
          {item.label}
        </span>
        {bar && (
          <div aria-hidden style={{ flex: "0 1 160px", minWidth: 100, position: "relative", height: 7, borderRadius: 999, background: C.track }}>
            <div style={{ width: `${Math.min(100, (Number(item.value) / top) * 100)}%`, height: "100%", borderRadius: 999, background: color }} />
            <div style={{ position: "absolute", top: -3, left: `calc(${Math.min(100, (Number(item.target) / top) * 100)}% - 1px)`, width: 2, height: 13, background: C.navy, borderRadius: 1 }} />
          </div>
        )}
        <span style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}><strong style={{ fontSize: 15, color: C.ink }}>{formatValue(item.value, item.unit)}</strong> / {formatValue(item.target, item.unit)}</span>
      </div>
      {item.tip && <p style={{ margin: "4px 0 0 40px", fontSize: 12.5, color: C.muted, lineHeight: 1.45, display: "flex", gap: 6 }}><FiZap size={13} color={C.gold} style={{ flexShrink: 0, marginTop: 2 }} /> {item.tip}</p>}
    </div>
  );
}

// Each badge's own icon.
export const BADGE_ICON = { top_rated: FiStar, qa_excellent: FiShield, reliable: FiCalendar, fast_feedback: FiZap, hours: FiClock, tot_certified: FiBookOpen };

// A badge: earned ones in colour, the rest grey with how far along they are. The rule is on hover.
export function BadgeTile({ badge }) {
  const earned = badge.earned;
  const Icon = BADGE_ICON[badge.key] || FiAward;
  return (
    <div title={badge.rule} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 12px", borderRadius: 14, background: earned ? C.goldTint : C.canvas, border: `1px solid ${earned ? C.goldBorder : C.line}`, minWidth: 0 }}>
      <span aria-hidden style={{ width: 38, height: 38, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", background: earned ? C.gold : C.track, color: earned ? "#3d2a00" : C.faint }}>
        <Icon size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: earned ? C.ink : C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{badge.label}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11.5, color: earned ? C.goldText : C.faint, display: "flex", alignItems: "center", gap: 4 }}>
          {earned ? <><FiCheck size={12} /> Earned</> : badge.progress}
        </p>
      </div>
    </div>
  );
}

// Overview: where they stand on the standards (a ring), what to work on, and badges.
export function OverviewPanel({ profile, teacherId = null, onOpen = null }) {
  const refresh = useRefreshEducatorProfile(teacherId);
  const s = profile.stats;
  const hub = profile.view === "hub";
  const own = profile.view === "own";
  const badges = s.badges || [];
  const earned = badges.filter((b) => b.earned).length;
  const standing = !hub ? profile.standards : null;
  const attention = standing ? standing.items.filter((i) => ["below", "close", "grace"].includes(i.status)) : [];
  const tips = !hub ? s.tips || [] : [];
  const link = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: 0, padding: 0, color: C.mid, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };
  const updated = s.computedAt ? new Date(s.computedAt).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%", fontFamily: FONT }}>
      {/* A hub has no standards or tips — it gets the summary in words. */}
      {hub && (
        <section style={box}>
          <SectionTitle icon={FiTrendingUp} title="In short" />
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5, fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>
            {summaryLines({ s, own, first: (profile.teacher?.name || "").split(" ")[0] }).map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      )}
      {!hub && (
        <section style={box}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            {standing && (
              <div style={{ flex: "0 0 auto", display: "grid", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}><FiTarget size={16} color={C.mid} /> Standards</h3>
                <StandardsRing standing={standing} />
                {onOpen && <button type="button" onClick={() => onOpen("standards")} style={link}>See all <FiArrowRight size={13} /></button>}
              </div>
            )}
            <div style={{ flex: "1 1 340px", minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 8 }}>
                {attention.length ? <FiAlertCircle size={16} color={C.danger} /> : <FiCheckCircle size={16} color={C.mid} />} {own ? "What to work on" : "What needs attention"}
              </h3>
              <div style={{ marginTop: 8 }}>
                {attention.length > 0 ? attention.map((i) => <WorkOnRow key={i.key} item={i} />)
                  : tips.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
                      {tips.map((t, i) => <li key={i} style={{ display: "flex", gap: 8, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}><FiZap size={14} color={C.gold} style={{ flexShrink: 0, marginTop: 3 }} /> {t}</li>)}
                    </ul>
                  ) : <p style={{ margin: 0, fontSize: 13.5, color: C.mid, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><FiCheckCircle /> All clear. Every standard with enough data is met.</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={box}>
        <SectionTitle
          icon={FiAward}
          title={`Badges · ${earned} of ${badges.length}`}
          action={(
            <button type="button" onClick={() => refresh.mutate()} disabled={refresh.isPending} title={updated ? `Figures updated ${updated}` : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.surface, color: C.navy, fontSize: 12, fontWeight: 700, cursor: refresh.isPending ? "wait" : "pointer", fontFamily: "inherit" }}>
              <FiRefreshCw size={12} /> {refresh.isPending ? "Counting…" : "Refresh figures"}
            </button>
          )}
        />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}>
          {[...badges].sort((x, y) => Number(y.earned) - Number(x.earned)).map((b) => <BadgeTile key={b.key} badge={b} />)}
        </div>
        {updated && <p style={{ margin: "12px 0 0", fontSize: 11.5, color: C.faint }}>Figures updated {updated}</p>}
      </section>
    </div>
  );
}

// Quality & feedback: QA visits compounded, and what parents say.
export function QualityPanel({ profile, showVisits = true }) {
  const [allVisits, setAllVisits] = useState(false);
  const s = profile.stats;
  const r = s.rating || {};
  const q = s.qa || {};
  const history = q.history || [];
  const visits = [...history].reverse();

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%", fontFamily: FONT }}>
      {!q.count && !r.count && !r.hidden ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
          <section style={box}><EmptyState icon={FiShield} title="No quality review yet" line="Your score shows here after your first supervisor visit." /></section>
          <section style={box}><EmptyState icon={FiStar} title="No parent reviews yet" line="Families' ratings from the last 12 months show here." /></section>
        </div>
      ) : (<>
      <section style={box}>
        <SectionTitle icon={FiShield} title="Quality reviews" />
        {!q.count ? <EmptyState icon={FiShield} title="No quality review yet" line="Your score shows here after your first supervisor visit." /> : (
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

            {showVisits && visits.length > 0 && (
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

      <section style={box}>
        <SectionTitle icon={FiStar} title="What parents say" note="Last 12 months" />
        {r.hidden ? <EmptyState icon={FiStar} title={`${r.count || 0} review${r.count === 1 ? "" : "s"} so far`} line="Averages show from 3 reviews, so no family can be picked out." />
          : r.count ? <FeedbackSummary summary={r} /> : <EmptyState icon={FiStar} title="No parent reviews yet" line="Families' ratings from the last 12 months show here." />}
      </section>
      </>)}
    </div>
  );
}

// Teaching: the figures, hours over 12 months, courses taught, hub leadership.
export function TeachingPanel({ profile, showCourses = true }) {
  const s = profile.stats;
  const fb = s.feedback || {};
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%", fontFamily: FONT }}>
      <section style={box}>
        <SectionTitle
          icon={FiUsers}
          title="Teaching"
          action={<span title="A session counts once its attendance is taken; hours use its timetable slot's length." style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.faint, cursor: "help" }}><FiInfo size={13} /> How it's counted</span>}
        />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))", marginBottom: 20 }}>
          <IconFigure icon={FiCheckCircle} label="Sessions held" value={fmt(s.sessions?.total)} sub={s.sessions?.untimed ? `${s.sessions.untimed} untimed` : null} />
          <IconFigure icon={FiUsers} label="Learners taught" value={fmt(s.learnersTaught)} sub={plural(s.coursesCount || 0, "course")} />
          <IconFigure icon={FiClock} label="Marks work within" value={fb.medianHours != null ? (fb.medianHours < 1 ? "1 h" : `${Math.round(fb.medianHours)} h`) : "—"} sub={fb.count ? `typically · ${plural(fb.count, "piece")}` : "nothing marked yet"} />
          <IconFigure icon={FiUserCheck} label="Learners finished" value={fmt(s.outcomes?.learnersFinished)} sub={`${plural(s.outcomes?.certificatesEarned || 0, "certificate")}${s.outcomes?.averageScore != null ? ` · avg ${s.outcomes.averageScore}%` : ""}`} />
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: C.ink }}>Verified hours · last 12 months</p>
        <HourBars byMonth={s.hours?.byMonth || []} />
      </section>

      {showCourses && <CoursesTaught courses={s.courses} />}

      {s.leadership && (
        <section style={box}>
          <SectionTitle icon={FiUsers} title="Hub leadership" note="As Account Manager / Training Lead" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))" }}>
            <IconFigure icon={FiCheckCircle} label="Check-ins reported" value={`${s.leadership.checkinsReported} / ${s.leadership.checkinsDue}`} />
            <IconFigure icon={FiClock} label="On time" value={fmt(s.leadership.reportedOnTime)} sub="within 2 days" />
            <IconFigure icon={FiCheck} label="Tasks done" value={`${s.leadership.tasksDone} / ${s.leadership.tasks}`} />
          </div>
        </section>
      )}
    </div>
  );
}

// Everything, stacked — for a page with no tabs of its own (the supervisor's educator page).
export default function PerformanceProfile({ profile, teacherId = null, showCourses = true }) {
  const hub = profile.view === "hub";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <ProfileKpis profile={profile} />
      <OverviewPanel profile={profile} teacherId={teacherId} />
      {!hub && profile.standards && <StandardsCard standing={profile.standards} own={profile.view === "own"} />}
      <QualityPanel profile={profile} />
      <TeachingPanel profile={profile} showCourses={showCourses} />
    </div>
  );
}
