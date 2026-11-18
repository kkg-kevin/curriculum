import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  FiAlertCircle, FiArrowRight, FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiClock, FiFileText,
  FiGrid, FiLogIn, FiPieChart, FiStar, FiTarget, FiTool, FiTrendingUp,
} from "react-icons/fi";
import { EmptyState, GLASS, KID, KidHeading, T, cardStyle, heroGradient } from "../../learner-portal/components/profile/theme";
import { formatDay, formatMonth, formatWeek, rankingsApi } from "../services/rankingsApi";
import { LayoutStyles } from "./layout";
import { PageSwitch, SkeletonPage } from "./kit";

// One learner's analytics — everything they do, this term or this year (server:
// rankings/learner-analytics.js). The learner's own (My analytics), a parent's view of a child
// (`childName`), and staff (`staff` + `learnerId`: percentages beside the level words). Families
// never see raw marks — bars are drawn from a 0–100 value and labelled with the level word.
// Laid out across the whole screen (19 Nov 2026): a hero with the period and the key figures, a
// tab bar, and each tab's cards side by side on a wide screen, stacked on a small one.

const TABS = [
  { key: "overview", label: "Overview", icon: FiGrid },
  { key: "assessments", label: "Assessments", icon: FiClipboard },
  { key: "attendance", label: "Attendance", icon: FiCalendar },
  { key: "competencies", label: "Competencies", icon: FiTarget },
  { key: "engagement", label: "Engagement", icon: FiLogIn },
  { key: "growth", label: "Growth", icon: FiTrendingUp },
  { key: "projects", label: "Projects", icon: FiTool },
  { key: "records", label: "Reports & certificates", icon: FiFileText },
];
const GOLD = "#feb139";
const colourOf = (v) => (v == null ? "#E8ECF4" : v >= 80 ? KID.navy.fill : v >= 60 ? KID.sky.fill : v >= 40 ? GOLD : "#F6C77E");
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const hours = (h) => (h == null ? "—" : h < 1 ? "Under an hour" : h < 48 ? `${Math.round(h)} hours` : `${Math.round(h / 24)} days`);
const box = (extra = {}) => cardStyle({ padding: 20, height: "100%", boxSizing: "border-box", ...extra });

// ---- Building blocks -----------------------------------------------------------------------------
function Stat({ icon: Icon, label, value, tone = KID.sky }) {
  return (
    <div style={cardStyle({ padding: "16px 18px", display: "flex", gap: 14, alignItems: "center", minWidth: 0 })}>
      <span style={{ width: 44, height: 44, borderRadius: 14, background: tone.soft, border: `1.5px solid ${tone.border}`, color: tone.color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={19} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: T.accentDeep, lineHeight: 1.15 }}>{value ?? "—"}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted }}>{label}</div>
      </div>
    </div>
  );
}

function LevelRow({ label, sub, value, level, percent }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.accentDeep }}>{label}{sub && <span style={{ fontWeight: 600, color: T.inkFaint, fontSize: 12 }}> · {sub}</span>}</span>
        <span style={{ fontSize: 13, fontWeight: 900, color: level ? T.accentMid : T.inkFaint }}>{level || "Not marked yet"}{percent != null ? ` · ${percent}%` : ""}</span>
      </div>
      <div style={{ height: 13, borderRadius: 999, background: "#EEF2F7" }}>
        {value != null && <div style={{ width: `${Math.max(3, value)}%`, height: "100%", borderRadius: 999, background: colourOf(value) }} />}
      </div>
    </div>
  );
}

function Card({ icon, tone, title, sub, children, extra }) {
  return (
    <section style={box(extra)}>
      <KidHeading icon={icon} tone={tone} sub={sub}>{title}</KidHeading>
      {children}
    </section>
  );
}

const rows = { display: "grid", gap: 14, gridTemplateColumns: "100%" };
const listItem = { display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 14, background: "#F7F9FC", border: `1px solid ${T.border}`, fontSize: 13.5, flexWrap: "wrap" };

function MonthBars({ points, staff, empty, height = 240 }) {
  if (!points?.length) return <EmptyState icon={FiBarChart2}>{empty}</EmptyState>;
  const data = points.map((p) => ({ month: formatMonth(p.month), value: p.value, level: p.level, percent: p.percent }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#EEF2F7" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: T.inkMuted }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: T.inkMuted }} />
          <Tooltip formatter={(v, n, item) => [staff ? `${item.payload.percent}% · ${item.payload.level}` : item.payload.level, "Marked work"]} />
          <Bar dataKey="value" fill={KID.sky.fill} radius={[10, 10, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Hero and tabs --------------------------------------------------------------------------------
function Hero({ d, name, period, setPeriod, staff }) {
  const f = d.overview.figures;
  const title = staff ? `How ${d.learner.firstName} is doing` : name ? `How ${name} is doing` : "How I'm doing";
  const tiles = [
    { icon: FiCalendar, label: "Attendance", value: f.attendance == null ? "Not yet" : `${f.attendance}%`, small: f.attendance == null },
    { icon: FiClock, label: "Work on time", value: f.onTime == null ? "Not yet" : `${f.onTime}%`, small: f.onTime == null },
    { icon: FiStar, label: "Marked work", value: f.average.level || "Not yet", small: true },
    { icon: FiCheckCircle, label: "Pieces marked", value: f.marked },
    { icon: FiAward, label: "Badges", value: f.badges, gold: true },
  ];
  return (
    <section style={{ background: heroGradient(), borderRadius: 26, padding: "24px 28px", color: "#fff", position: "relative", overflow: "hidden" }}>
      <span aria-hidden="true" style={{ position: "absolute", right: -70, top: -70, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start", position: "relative" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.14)", border: "1.5px solid rgba(255,255,255,0.25)", display: "grid", placeItems: "center", flexShrink: 0 }}><FiPieChart size={24} /></span>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(21px, 2.2vw, 28px)", fontWeight: 900, lineHeight: 1.15 }}>{title}</h1>
            <div style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.8, marginTop: 4 }}>Everything {name || staff ? "they do" : "you do"} — {d.period.label}{d.period.which === "term" ? ` (${formatDay(d.period.from)} – ${formatDay(d.period.to)})` : ""}</div>
          </div>
        </div>
        <div role="group" aria-label="Period" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: "rgba(10,30,55,0.3)", border: "1px solid rgba(255,255,255,0.2)" }}>
          {[["term", "This term"], ["year", "This year"]].map(([k, label]) => (
            <button key={k} type="button" className="rk-pill" aria-pressed={period === k} onClick={() => setPeriod(k)}
              style={{ padding: "7px 15px", borderRadius: 999, border: 0, background: period === k ? "#fff" : "transparent", color: period === k ? T.accentDeep : "#fff", fontWeight: 800, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="rk-kpis" style={{ marginTop: 20, position: "relative" }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ ...GLASS, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: t.gold ? GOLD : "rgba(255,255,255,0.16)", color: t.gold ? "#25476a" : "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><t.icon size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: t.small ? 16 : 22, fontWeight: 900, lineHeight: 1.15 }}>{t.value}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.85 }}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TabBar({ tab, setTab }) {
  return (
    <div role="tablist" aria-label="Analytics" className="rk-scroll rk-fade" style={{ display: "flex", gap: 6, padding: 6, background: "#fff", borderRadius: 18, border: `1.5px solid ${T.border}`, boxShadow: "0 6px 20px rgba(37,71,106,0.06)" }}>
      {TABS.map((t) => {
        const on = tab === t.key;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} className="rk-tab" onClick={() => setTab(t.key)}
            style={{ flex: "1 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", borderRadius: 13, border: 0, background: on ? T.accent : "transparent", color: on ? "#fff" : T.accentDeep, fontWeight: 800, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
            <t.icon size={15} />{t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Tabs -----------------------------------------------------------------------------------------
function Overview({ d, who, staff, go }) {
  const g = d.growth;
  const recent = d.assessments.list.slice(0, 5);
  return (
    <div className="rk-grid">
      <div className="rk-s7">
        <Card icon={FiAward} tone={KID.gold} title="Place in each class" sub={`${who.possessive} Learning Score and place — ${d.period.label}.`}>
          {!d.overview.positions.length ? <EmptyState icon={FiAward}>No class positions to show yet.</EmptyState> : (
            <div style={rows}>
              {d.overview.positions.map((p) => (
                <div key={p.classId} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "14px 16px", borderRadius: 18, background: "#F7F9FC", border: `1.5px solid ${T.border}` }}>
                  <span style={{ width: 56, height: 56, borderRadius: "50%", background: p.rank === 1 ? GOLD : p.rank ? KID.sky.fill : "#E8ECF4", color: p.rank === 1 ? "#25476a" : p.rank ? "#fff" : T.inkFaint, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16, flexShrink: 0 }}>
                    {p.rank ? ordinal(p.rank) : <FiTarget size={20} />}
                  </span>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 900, color: T.accentDeep }}>{p.className}{p.hiddenFromFamily ? <span style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint }}> · hidden from the family</span> : null}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted }}>
                      {p.rank ? `${ordinal(p.rank)} of ${p.rankedCount}` : p.band || (p.eligible ? "Places show once enough of the class is marked" : "Not ranked yet")}
                      {p.streaks.onTime ? ` · ${p.streaks.onTime} on time in a row` : ""}
                    </div>
                    {p.badges.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                        {p.badges.map((b) => <span key={b.key} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: KID.gold.soft, border: `1px solid ${KID.gold.border}`, color: KID.gold.color }}>{b.label}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.accentDeep, lineHeight: 1 }}>{p.score == null ? "—" : Math.round(p.score)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: T.inkMuted }}>{p.level || "out of 100"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="rk-s5" style={{ display: "grid", gap: 18, gridTemplateColumns: "100%", alignContent: "start" }}>
        <Card icon={FiTrendingUp} tone={KID.sky} title="Growth" sub="The first diagnostic against the last 90 days.">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, padding: 12, borderRadius: 14, background: "#F7F9FC", border: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.inkMuted }}>Started</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: g.start ? T.accentDeep : T.inkFaint }}>{g.start?.level || "No diagnostic"}</div>
            </div>
            <FiArrowRight color={T.inkFaint} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, padding: 12, borderRadius: 14, background: KID.sky.soft, border: `1px solid ${KID.sky.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.inkMuted }}>Now</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: g.now ? T.accentDeep : T.inkFaint }}>{g.now?.level || "Nothing lately"}</div>
            </div>
          </div>
          <button type="button" onClick={() => go("growth")} style={{ marginTop: 12, border: 0, background: "none", color: T.accentMid, fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>See growth →</button>
        </Card>
        <Card icon={FiTarget} tone={KID.navy} title="Strongest skills">
          {!d.competencies.length ? <EmptyState icon={FiTarget}>No competencies marked yet.</EmptyState> : (
            <div style={rows}>{d.competencies.slice(0, 3).map((c) => <LevelRow key={c.name} label={c.name} value={c.value} level={c.level} percent={staff ? c.percent : null} />)}</div>
          )}
        </Card>
      </div>
      <div className="rk-s12">
        <Card icon={FiClipboard} tone={KID.sky} title="Latest work" sub="The most recent pieces set.">
          {!recent.length ? <EmptyState icon={FiClipboard}>No work set in this period.</EmptyState> : (
            <div className="rk-cards-s">
              {recent.map((r) => (
                <div key={r.issueId} style={{ padding: "12px 14px", borderRadius: 16, background: "#F7F9FC", border: `1.5px solid ${T.border}`, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: T.accentDeep, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.inkFaint }}>{r.type}{r.course ? ` · ${r.course}` : ""}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, fontWeight: 800 }}>
                    <span style={{ color: r.timing === "missed" ? KID.gold.color : T.inkMuted }}>{r.status}</span>
                    <span style={{ color: T.accentMid }}>{r.level || ""}{staff && r.percent != null ? ` · ${r.percent}%` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => go("assessments")} style={{ marginTop: 12, border: 0, background: "none", color: T.accentMid, fontWeight: 800, fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>See every piece of work →</button>
        </Card>
      </div>
    </div>
  );
}

function Assessments({ d, staff }) {
  const a = d.assessments;
  return (
    <>
      <div className="rk-tiles">
        <Stat icon={FiClipboard} label="Pieces set" value={a.counts.issued} />
        <Stat icon={FiCheckCircle} label="Handed in" value={a.counts.handedIn} tone={KID.navy} />
        <Stat icon={FiClock} label="On time" value={a.counts.onTime} tone={KID.gold} />
        <Stat icon={FiAlertCircle} label="Late / missed" value={`${a.counts.late} / ${a.counts.missed}`} tone={KID.navy} />
        <Stat icon={FiBookOpen} label="Still open" value={a.counts.open} />
      </div>
      <div className="rk-grid">
        <div className="rk-s4">
          <Card icon={FiBarChart2} tone={KID.sky} title="By kind of work">
            <div style={rows}>{a.byType.length ? a.byType.map((t) => <LevelRow key={t.key} label={t.label} sub={`${t.count} set`} value={t.value} level={t.level} percent={staff ? t.percent : null} />) : <EmptyState icon={FiClipboard}>No work set in this period.</EmptyState>}</div>
          </Card>
        </div>
        <div className="rk-s4">
          <Card icon={FiBookOpen} tone={KID.navy} title="By course">
            <div style={rows}>{a.byCourse.length ? a.byCourse.map((t) => <LevelRow key={t.key} label={t.label} sub={`${t.count} set`} value={t.value} level={t.level} percent={staff ? t.percent : null} />) : <EmptyState icon={FiBookOpen}>No course work in this period.</EmptyState>}</div>
          </Card>
        </div>
        <div className="rk-s4">
          <Card icon={FiTrendingUp} tone={KID.sky} title="Month by month" sub="Marked work, averaged each month.">
            <MonthBars points={a.monthly} staff={staff} empty="Nothing marked yet in this period." height={220} />
          </Card>
        </div>
        <div className="rk-s12">
          <Card icon={FiClipboard} tone={KID.navy} title="Every piece of work" sub={`${a.list.length} ${a.list.length === 1 ? "piece" : "pieces"}, newest first.`}>
            {!a.list.length ? <EmptyState icon={FiClipboard}>No work set in this period.</EmptyState> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 640, fontFamily: "inherit" }}>
                  <thead><tr>{["Work", "Course", "Set", "Due", "What happened", "Result"].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 800, color: T.inkMuted, padding: "10px 12px", background: "#F7F9FC", borderBottom: `1.5px solid ${T.border}` }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {a.list.map((r) => (
                      <tr key={r.issueId}>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 800, color: T.accentDeep }}>{r.name}<div style={{ fontSize: 12, fontWeight: 600, color: T.inkFaint }}>{r.type}</div></td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.inkMuted }}>{r.course || "—"}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.inkMuted, whiteSpace: "nowrap" }}>{formatDay(r.issuedAt)}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.inkMuted, whiteSpace: "nowrap" }}>{r.dueDate ? formatDay(r.dueDate) : "—"}</td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", background: r.timing === "missed" ? KID.gold.soft : r.timing === "pending" ? "#F3F4F6" : KID.sky.soft, color: r.timing === "missed" ? KID.gold.color : r.timing === "pending" ? T.inkMuted : T.accentMid }}>{r.status}</span>
                        </td>
                        <td style={{ padding: "11px 12px", borderBottom: `1px solid ${T.border}`, fontSize: 13.5, fontWeight: 900, color: T.accentDeep, whiteSpace: "nowrap" }}>{r.level || "—"}{staff && r.percent != null ? ` · ${r.percent}%` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Attendance({ d }) {
  const a = d.attendance;
  const STATUS = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };
  return (
    <>
      <div className="rk-tiles">
        <Stat icon={FiCalendar} label="Attendance" value={a.rate == null ? "—" : `${a.rate}%`} />
        <Stat icon={FiCheckCircle} label={`Came to, of ${a.sessions}`} value={a.attended} tone={KID.navy} />
        <Stat icon={FiStar} label="Sessions in a row" value={a.streak} tone={KID.gold} />
        <Stat icon={FiAward} label="Perfect weeks" value={a.perfectWeeks} tone={KID.gold} />
        <Stat icon={FiClock} label="Late / absent" value={`${a.late} / ${a.absent}`} tone={KID.navy} />
      </div>
      <div className="rk-grid">
        <div className="rk-s7">
          <Card icon={FiBarChart2} tone={KID.sky} title="Month by month">
            {!a.byMonth.length ? <EmptyState icon={FiCalendar}>No attendance taken in this period yet.</EmptyState> : (
              <div style={rows}>{a.byMonth.map((m) => <LevelRow key={m.month} label={formatMonth(m.month)} sub={`${m.attended} of ${m.total} sessions`} value={m.rate} level={`${m.rate}%`} />)}</div>
            )}
          </Card>
        </div>
        <div className="rk-s5">
          <Card icon={FiCalendar} tone={KID.navy} title="Latest sessions">
            {!a.recent.length ? <EmptyState icon={FiCalendar}>No sessions yet.</EmptyState> : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
                {a.recent.map((r, i) => (
                  <li key={i} style={listItem}>
                    <span style={{ fontWeight: 800, color: T.accentDeep }}>{formatDay(r.date)} <span style={{ fontWeight: 600, color: T.inkFaint }}>· {r.className}</span></span>
                    <span style={{ fontWeight: 900, color: r.status === "absent" ? KID.gold.color : T.accentMid }}>{STATUS[r.status] || r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Competencies({ d, staff }) {
  return (
    <Card icon={FiTarget} tone={KID.sky} title="Competencies" sub="From the work marked in this period, strongest first.">
      {!d.competencies.length ? <EmptyState icon={FiTarget}>No competencies marked in this period yet.</EmptyState> : (
        <div className="rk-cols">
          {d.competencies.map((c) => <LevelRow key={c.name} label={c.name} value={c.value} level={c.level} percent={staff ? c.percent : null} />)}
        </div>
      )}
    </Card>
  );
}

function Engagement({ d, who }) {
  const e = d.engagement;
  const data = e.weekly.map((w) => ({ week: formatWeek(w.week), Learner: w.learner, Parent: w.parent }));
  return (
    <>
      <div className="rk-tiles">
        {e.hasOwnLogin && <Stat icon={FiLogIn} label={`${who.possessive} sign-ins`} value={e.learnerSignIns} />}
        <Stat icon={FiLogIn} label="Parent sign-ins" value={e.parentSignIns ?? "—"} tone={KID.navy} />
        <Stat icon={FiClock} label="Usually starts work after" value={hours(e.hoursToStart)} tone={KID.gold} />
        <Stat icon={FiCheckCircle} label="Hands in after starting" value={hours(e.hoursToHandIn)} />
      </div>
      <Card icon={FiLogIn} tone={KID.sky} title="Sign-ins week by week" sub={[e.lastLearnerSignIn && `${who.possessive} last: ${formatDay(e.lastLearnerSignIn)}`, e.lastParentSignIn && `Parent's last: ${formatDay(e.lastParentSignIn)}`].filter(Boolean).join(" · ") || null}>
        {!data.length ? <EmptyState icon={FiLogIn}>No sign-ins in this period.</EmptyState> : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: T.inkMuted }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: T.inkMuted }} />
                <Tooltip />
                <Legend />
                {e.hasOwnLogin && <Bar dataKey="Learner" stackId="s" fill={KID.sky.fill} maxBarSize={48} />}
                <Bar dataKey="Parent" stackId="s" fill={KID.navy.fill} radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}

function Growth({ d, staff }) {
  const g = d.growth;
  const tile = (title, x, empty, tone) => (
    <div style={{ flex: "1 1 160px", padding: 18, borderRadius: 20, background: tone.soft, border: `1.5px solid ${tone.border}`, textAlign: "center" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: x ? T.accentDeep : T.inkFaint, margin: "6px 0 2px" }}>{x ? x.level : empty}</div>
      {x && staff && <div style={{ fontSize: 12.5, color: T.inkMuted, fontWeight: 700 }}>{x.percent}%</div>}
    </div>
  );
  return (
    <div className="rk-grid">
      <div className="rk-s5">
        <Card icon={FiTrendingUp} tone={KID.gold} title="Where they started, where they are" sub="The first diagnostic against marked work in the last 90 days.">
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {tile(g.start ? `Started · ${formatDay(g.start.at)}` : "Started", g.start, "No diagnostic", { soft: "#F7F9FC", border: T.border })}
            <FiArrowRight size={22} color={T.inkFaint} style={{ flexShrink: 0 }} />
            {tile(g.now ? `Now · ${g.now.pieces} pieces` : "Now", g.now, "Nothing lately", KID.sky)}
          </div>
          {g.levelsMoved != null && (
            <p style={{ margin: "14px 0 0", fontSize: 14.5, fontWeight: 800, color: g.levelsMoved > 0 ? T.accentMid : T.inkMuted, lineHeight: 1.5 }}>
              {g.levelsMoved > 0 ? `Up ${g.levelsMoved} ${g.levelsMoved === 1 ? "level" : "levels"} since starting.` : g.levelsMoved === 0 ? "At the same level as when they started — keep going." : "A little below where they started — the next steps on the position page help."}
              {staff && g.change != null ? ` (${g.change > 0 ? "+" : ""}${g.change} points)` : ""}
            </p>
          )}
        </Card>
      </div>
      <div className="rk-s7">
        <Card icon={FiBarChart2} tone={KID.sky} title="This year, month by month">
          {!g.monthly.length ? <EmptyState icon={FiTrendingUp}>Nothing marked this year yet.</EmptyState> : (
            <div style={{ width: "100%", height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={g.monthly.map((m) => ({ month: formatMonth(m.month), value: m.value, level: m.level, percent: m.percent }))} margin={{ top: 10, right: 14, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="rkGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={KID.sky.fill} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={KID.sky.fill} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: T.inkMuted }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: T.inkMuted }} />
                  <Tooltip formatter={(v, n, item) => [staff ? `${item.payload.percent}% · ${item.payload.level}` : item.payload.level, "Marked work"]} />
                  <Area type="monotone" dataKey="value" stroke={KID.sky.fill} strokeWidth={3} fill="url(#rkGrowth)" dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Projects({ d, staff }) {
  return (
    <Card icon={FiTool} tone={KID.navy} title="Projects" sub="Projects set in this period and how far their milestones have got.">
      {!d.projects.length ? <EmptyState icon={FiTool}>No projects in this period.</EmptyState> : (
        <div className="rk-cards-m">
          {d.projects.map((p) => (
            <div key={p.issueId} style={{ padding: 16, borderRadius: 18, background: "#F7F9FC", border: `1.5px solid ${T.border}`, display: "grid", gap: 10, alignContent: "start" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 42, height: 42, borderRadius: 13, background: KID.navy.soft, border: `1.5px solid ${KID.navy.border}`, color: T.accentDeep, display: "grid", placeItems: "center", flexShrink: 0 }}><FiTool size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: T.accentDeep }}>{p.name}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.inkFaint }}>{p.course || "Project"}</div>
                </div>
              </div>
              <span style={{ justifySelf: "start", padding: "3px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, background: p.marked ? KID.sky.soft : "#F3F4F6", color: p.marked ? T.accentMid : T.inkMuted }}>
                {p.marked ? `${p.level}${staff && p.percent != null ? ` · ${p.percent}%` : ""}` : p.status}
              </span>
              {p.milestones > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted, marginBottom: 5 }}>Milestones marked: {Math.min(p.milestonesMarked, p.milestones)} of {p.milestones}</div>
                  <div style={{ height: 10, borderRadius: 999, background: "#E8ECF4" }}><div style={{ width: `${Math.min(100, (p.milestonesMarked / p.milestones) * 100)}%`, height: "100%", borderRadius: 999, background: GOLD }} /></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Records({ d }) {
  const r = d.records;
  return (
    <div className="rk-grid">
      <div className="rk-s6">
        <Card icon={FiFileText} tone={KID.sky} title="Reports" sub={`${r.reportsInPeriod} published in this period · ${r.reportsTotal} in all`}>
          {!r.reports.length ? <EmptyState icon={FiFileText}>No reports published yet.</EmptyState> : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
              {r.reports.map((x) => <li key={x.id} style={listItem}><span style={{ fontWeight: 800, color: T.accentDeep }}>{x.course} <span style={{ fontWeight: 600, color: T.inkFaint }}>· {x.kind}</span></span><span style={{ color: T.inkMuted, fontWeight: 700 }}>{formatDay(x.publishedAt)}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
      <div className="rk-s6">
        <Card icon={FiAward} tone={KID.gold} title="Certificates">
          {!r.certificates.length ? <EmptyState icon={FiAward}>No certificates yet — they come with a finished course.</EmptyState> : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
              {r.certificates.map((c) => <li key={c.id} style={{ ...listItem, background: KID.gold.soft, borderColor: KID.gold.border }}><span style={{ fontWeight: 800, color: T.accentDeep }}>{c.course}</span><span style={{ color: T.inkMuted, fontWeight: 700 }}>{formatDay(c.issuedAt)} · {c.number}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------------------------------
export default function LearnerAnalyticsView({ staff = false, learnerId = null, childName = null }) {
  const [period, setPeriod] = useState("term");
  const [tab, setTab] = useState("overview");
  const { data: d, isLoading, error } = useQuery({
    queryKey: ["rankings", "analytics", staff ? learnerId : "me", period],
    queryFn: () => (staff ? rankingsApi.learnerAnalytics(learnerId, period) : rankingsApi.myAnalytics(period)),
    enabled: !staff || !!learnerId,
  });
  const name = staff ? d?.learner?.firstName : childName;
  const who = { possessive: name ? `${name}'s` : "Your" };

  return (
    <div className="rk-page">
      <LayoutStyles />
      {!staff && !childName && <PageSwitch />}
      {isLoading && <SkeletonPage />}
      {error && <section style={cardStyle({ padding: 24 })}><EmptyState icon={FiAlertCircle}>The analytics can&apos;t be shown right now.</EmptyState></section>}
      {d && (
        <>
          <Hero d={d} name={childName} period={period} setPeriod={setPeriod} staff={staff} />
          <TabBar tab={tab} setTab={setTab} />
          {tab === "overview" && <Overview d={d} who={who} staff={staff} go={setTab} />}
          {tab === "assessments" && <Assessments d={d} staff={staff} />}
          {tab === "attendance" && <Attendance d={d} />}
          {tab === "competencies" && <Competencies d={d} staff={staff} />}
          {tab === "engagement" && <Engagement d={d} who={who} />}
          {tab === "growth" && <Growth d={d} staff={staff} />}
          {tab === "projects" && <Projects d={d} staff={staff} />}
          {tab === "records" && <Records d={d} />}
        </>
      )}
    </div>
  );
}
