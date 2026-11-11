import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  FiActivity, FiAlertTriangle, FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiAward, FiBookOpen, FiCalendar, FiCheckCircle,
  FiChevronDown, FiChevronUp, FiClipboard, FiClock, FiCpu, FiCreditCard, FiDollarSign, FiEdit3, FiEyeOff, FiFileText, FiFlag,
  FiHeart, FiHome, FiInbox, FiLayers, FiLifeBuoy, FiMessageCircle, FiMinus, FiRepeat, FiShield, FiTarget, FiTrendingUp,
  FiUserCheck, FiUserPlus, FiUsers,
} from "react-icons/fi";
import api from "../../../services/api";
import { analyticsApi } from "../../reports/services/analyticsApi";
import ActivityEntry from "../../activity/components/ActivityEntry";
import CheckinsReminder from "../../checkins/components/CheckinsReminder";
import Avatar from "../../../components/ui/Avatar";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";

// The admin dashboard (12 Nov 2026) — a dashboard, not a report: a bento grid of widgets in the
// system's colours (navy, mid blue, sky, gold — theme/brand.js), numbers and charts first, words
// second.
//   hero          greeting, the day, three glance chips (need you · on today · money in), actions
//   KPI cards     active learners, money in this month, owed, attendance — big number, change
//                 against last month, a sparkline of the year
//   money chart   collected month by month (12 months)        needs you   short labels, count badges
//   today         a timeline of the day                         learning health   attendance and
//   programmes    icon tiles                                    on-time work, 12 months
//   hubs          learners per hub (bars, the weakest attendance flagged)   growth   enquiry → paid
//   recent activity                                             your workspace   icon tiles
//   getting started   a checklist while a new workspace is still missing something
// Data: GET /api/dashboard (dashboard.service.js — counts, to-dos, today, programmes, setup) and
// Reports' own figures (/api/analytics attention, trends, enrolment, hubs) so both always agree.
// Staff see only what their role allows.

const C = BRAND;
const ksh = (n) => `KSh ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const kshShort = (n) => { const v = Number(n) || 0; return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(Math.round(v)); };
const greeting = () => { const h = (new Date().getUTCHours() + 3) % 24; return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const dayLine = () => new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Nairobi" });
const kenyaDay = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const monthStart = () => `${kenyaDay().slice(0, 7)}-01`;

// The widget card: white, rounded, a soft shadow and a thin border — the system's card look.
const widget = { background: "#fff", borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 1px 3px rgba(17,24,39,0.04), 0 6px 18px rgba(37,71,106,0.05)", padding: "18px 20px", minWidth: 0, fontFamily: FONT, height: "100%", boxSizing: "border-box" };

// Short names for what needs doing (the server's long sentence shows on hover).
const SHORT = {
  marking: "Marking overdue", atRisk: "At-risk learners", absences: "Repeated absences", unread: "Reports not opened",
  standards: "Below standard", concerns: "Parent concerns", unpaid: "Paused — unpaid", enquiries: "New enquiries",
  notices: "Payments to confirm", mpesa: "Unmatched M-Pesa", claims: "Claims to approve", claimsToPay: "Claims to pay",
  refunds: "Refunds due", hubsOwed: "Hubs owed fees", profiles: "Profiles to publish", inTraining: "In training", checkins: "Check-in reports",
};
const ATTN_ICON = { edit: FiEdit3, alert: FiAlertTriangle, calendar: FiCalendar, eye: FiEyeOff, target: FiTarget, flag: FiFlag, card: FiCreditCard, inbox: FiInbox };
const TODO_ICON = { notices: FiCreditCard, mpesa: FiDollarSign, claims: FiFileText, claimsToPay: FiFileText, refunds: FiRepeat, hubsOwed: FiHome, profiles: FiUserCheck, inTraining: FiBookOpen, checkins: FiClipboard };
const TONE = {
  danger: { color: C.danger, bg: C.dangerTint, rank: 0 },
  waiting: { color: C.goldText, bg: C.goldTint, rank: 1 },
  info: { color: C.skyText, bg: C.skyTint, rank: 2 },
};
const TODAY_ICON = { class: FiBookOpen, booking: FiLifeBuoy, checkin: FiClipboard, meeting: FiMessageCircle, qa: FiShield, bootcamp: FiAward };
const PROGRAMME = {
  "home-learning": { icon: FiHeart, color: C.mid }, "tech-clubs": { icon: FiCpu, color: C.sky }, pathways: { icon: FiRepeat, color: C.navy },
  bootcamps: { icon: FiAward, color: C.gold }, bookings: { icon: FiLifeBuoy, color: C.mid },
};

function Head({ icon: Icon, title, color = C.mid, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: C.ink, display: "flex", alignItems: "center", gap: 9 }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: `${color}14`, color, display: "grid", placeItems: "center" }}><Icon size={15} /></span>
        {title}
      </h2>
      {action}
    </div>
  );
}
function More({ to, label = "View all" }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, padding: 0, color: C.mid, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>{label} <FiArrowRight size={12} /></button>;
}

// A change against last month, as a pill — arrow and number, never colour alone.
function DeltaPill({ value, suffix = "", onDark = false }) {
  if (value == null || Number.isNaN(value)) return null;
  const Icon = value > 0 ? FiArrowUpRight : value < 0 ? FiArrowDownRight : FiMinus;
  const look = onDark ? { background: "rgba(255,255,255,0.18)", color: "#fff" }
    : value > 0 ? { background: C.skyTint, color: C.navy } : value < 0 ? { background: C.goldTint, color: C.goldText } : { background: C.greyTint, color: C.greyText };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, ...look }}><Icon size={12} /> {value > 0 ? "+" : ""}{value}{suffix}</span>;
}

// A KPI card: a coloured icon, the big number, the change, and a sparkline of the year.
function Kpi({ icon: Icon, label, value, delta, sub, spark = [], color, featured = false, onOpen }) {
  const id = `sp-${label.replace(/\W/g, "")}`;
  const dark = featured;
  return (
    <button type="button" onClick={onOpen} className="db-kpi"
      style={{ ...widget, padding: "16px 18px 10px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, border: dark ? "none" : widget.border, background: dark ? `linear-gradient(135deg, ${C.navyDeep} 0%, ${C.navy} 55%, ${C.mid} 100%)` : "#fff", color: dark ? "#fff" : C.ink, overflow: "hidden" }}>
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: dark ? "rgba(255,255,255,0.8)" : C.muted }}>{label}</span>
        <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: dark ? "rgba(255,255,255,0.14)" : `${color}17`, color: dark ? "#fff" : color }}><Icon size={16} /></span>
      </span>
      <span style={{ fontSize: 27, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.05 }}>{value}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: dark ? "rgba(255,255,255,0.75)" : C.faint, minHeight: 20 }}>{delta}{sub}</span>
      <div style={{ height: 38, margin: "0 -6px" }} aria-hidden>
        {spark.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={dark ? "#fff" : color} stopOpacity={dark ? 0.35 : 0.28} /><stop offset="100%" stopColor={dark ? "#fff" : color} stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="v" stroke={dark ? "#fff" : color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </button>
  );
}

function ChartTip({ active, payload, label, money = false, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.ink, color: "#fff", borderRadius: 10, padding: "8px 11px", fontSize: 12, fontFamily: FONT, boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
      <strong style={{ display: "block", marginBottom: 2 }}>{label}</strong>
      {payload.map((p) => <span key={p.dataKey} style={{ display: "block" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />{p.name}: {money ? ksh(p.value) : `${p.value ?? "—"}${suffix}`}</span>)}
    </div>
  );
}

function MoneyChart({ income }) {
  const data = (income?.months || []).map((m, i, all) => ({ label: String(m.label).split(" ")[0], total: m.total, now: i === all.length - 1 }));
  const total = data.reduce((n, m) => n + m.total, 0);
  return (
    <section style={widget}>
      <Head icon={FiDollarSign} title="Money collected" action={<More to="/billing?tab=payments" label="Billing" />} />
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 6 }}>
        <div><p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.muted }}>This month</p><p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.ink }}>{ksh(income.inPeriod)}</p></div>
        <div><p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.muted }}>Last 12 months</p><p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.ink }}>{ksh(total)}</p></div>
        <div><p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.muted }}>Owed</p><p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.goldText }}>{ksh(income.owed)}</p></div>
      </div>
      {/* Sized to sit level with "Needs you" beside it. */}
      <div style={{ height: 268 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.faint }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.faint }} tickFormatter={kshShort} width={44} />
            <Tooltip cursor={{ fill: `${C.sky}14` }} content={<ChartTip money />} />
            <Bar dataKey="total" name="Collected" radius={[6, 6, 2, 2]} maxBarSize={34} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.label} fill={d.now ? C.gold : C.mid} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function NeedsYou({ items, loading }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 6);
  const urgent = items.filter((i) => i.tone === "danger").length;
  return (
    <section style={{ ...widget, display: "flex", flexDirection: "column" }}>
      <Head icon={FiFlag} title="Needs you" color={urgent ? C.danger : C.mid} action={items.length > 0 && <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", background: urgent ? C.danger : C.mid, borderRadius: 999, padding: "2px 10px" }}>{items.length}</span>} />
      {loading && !items.length ? <p style={{ margin: 0, fontSize: 13, color: C.faint }}>Checking…</p>
        : !items.length ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "20px 0" }}>
            <div><span style={{ width: 52, height: 52, borderRadius: 999, background: C.skyTint, color: C.mid, display: "inline-grid", placeItems: "center" }}><FiCheckCircle size={24} /></span><p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 800, color: C.navy }}>All clear</p><p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted }}>Nothing needs you right now.</p></div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
            {shown.map((it) => {
              const tone = TONE[it.tone] || TONE.info;
              const Icon = it.Icon || FiFlag;
              return (
                <button key={it.key} type="button" onClick={() => navigate(it.path)} title={`${it.count} ${it.label}`} className="db-row"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 11, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: FONT, minWidth: 0 }}>
                  <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, background: tone.bg, color: tone.color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={15} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SHORT[it.key] || it.label}</span>
                  <span style={{ minWidth: 30, textAlign: "center", fontSize: 12.5, fontWeight: 900, color: tone.color, background: tone.bg, borderRadius: 999, padding: "2px 9px" }}>{it.count}</span>
                </button>
              );
            })}
            {items.length > 6 && (
              <button type="button" onClick={() => setAll((v) => !v)} style={{ marginTop: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", color: C.mid, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
                {all ? <><FiChevronUp size={13} /> Show fewer</> : <><FiChevronDown size={13} /> {items.length - 6} more</>}
              </button>
            )}
          </div>
        )}
    </section>
  );
}

function TodayTimeline({ items: raw }) {
  const navigate = useNavigate();
  const bootcamps = raw.filter((i) => i.kind === "bootcamp");
  const items = bootcamps.length > 2
    ? [...raw.filter((i) => i.kind !== "bootcamp"), { kind: "bootcamp", time: null, title: `${bootcamps.length} bootcamps running`, sub: bootcamps.map((b) => b.title.replace(/^Bootcamp running · /, "")).slice(0, 2).join(" · ") + (bootcamps.length > 2 ? "…" : ""), path: "/events" }]
    : raw;
  const shown = items.slice(0, 6);
  return (
    <section style={widget}>
      <Head icon={FiCalendar} title="Today" action={<span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{items.length} item{items.length === 1 ? "" : "s"}</span>} />
      {!items.length ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>A quiet day — nothing on the timetable.</p> : (
        <div style={{ position: "relative", paddingLeft: 4 }}>
          <span aria-hidden style={{ position: "absolute", left: 15, top: 8, bottom: 8, width: 2, background: C.line, borderRadius: 2 }} />
          {shown.map((it, i) => {
            const Icon = TODAY_ICON[it.kind] || FiCalendar;
            return (
              <button key={`${it.path}-${i}`} type="button" onClick={() => navigate(it.path)} className="db-row"
                style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "7px 6px", borderRadius: 10, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: FONT, minWidth: 0 }}>
                <span aria-hidden style={{ position: "relative", zIndex: 1, width: 24, height: 24, borderRadius: 999, background: it.time ? C.mid : C.gold, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 0 0 3px #fff" }}><Icon size={12} /></span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: it.time ? C.mid : C.goldText }}>{it.time ? `${it.time}${it.end ? `–${it.end}` : ""}` : "All day"}</span>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  {it.sub && <span style={{ display: "block", fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sub}</span>}
                </span>
              </button>
            );
          })}
          {items.length > shown.length && <p style={{ margin: "4px 0 0 40px", fontSize: 12, color: C.faint }}>+{items.length - shown.length} more today</p>}
        </div>
      )}
    </section>
  );
}

function HealthChart({ trends }) {
  const data = (trends?.months || []).map((m) => ({ label: String(m.label).split(" ")[0], attendance: m.attendance, onTime: m.onTime }));
  if (!data.some((d) => d.attendance != null || d.onTime != null)) return null;
  return (
    <section style={widget}>
      <Head icon={FiActivity} title="Learning health" color={C.navy} action={<More to="/reports?tab=trends" label="Trends" />} />
      <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: C.muted, marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: C.mid }} /> Attendance</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 3, borderRadius: 2, background: C.gold }} /> On-time work</span>
      </div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={C.line} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.faint }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.faint }} width={42} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<ChartTip suffix="%" />} />
            <Line type="monotone" dataKey="attendance" name="Attendance" stroke={C.mid} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="onTime" name="On-time work" stroke={C.gold} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ProgrammeTiles({ items }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <section style={widget}>
      <Head icon={FiLayers} title="Programmes" />
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%" }}>
        {items.map((p) => {
          const look = PROGRAMME[p.key] || { icon: FiLayers, color: C.mid };
          return (
            <button key={p.key} type="button" onClick={() => navigate(p.path)} className="db-row" title={p.sub}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 11, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: FONT, minWidth: 0 }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: look.color, color: look.color === C.gold ? C.navy : "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><look.icon size={15} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
                <span style={{ display: "block", fontSize: 11, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.sub}</span>
              </span>
              <span style={{ fontSize: 19, fontWeight: 900, color: C.ink }}>{p.value}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HubsChart({ data }) {
  const navigate = useNavigate();
  const hubs = (data?.hubs || []).filter((h) => h.learners > 0).slice(0, 7);
  if (!hubs.length) return null;
  const att = hubs.map((h) => h.attendance).filter((v) => v != null);
  const weakest = att.length > 1 ? Math.min(...att) : null;
  const rows = hubs.map((h) => ({ id: h.hubId, name: h.name.length > 18 ? `${h.name.slice(0, 17)}…` : h.name, learners: h.learners, weak: weakest != null && h.attendance === weakest }));
  return (
    <section style={widget}>
      <Head icon={FiHome} title="Learners by hub" action={<More to="/reports?tab=hubs" label="Compare hubs" />} />
      <div style={{ height: Math.max(150, rows.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} onClick={(e) => { const id = e?.activePayload?.[0]?.payload?.id; if (id) navigate(`/learning-hubs/${id}/view`); }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={130} tick={{ fontSize: 12, fill: C.inkSoft }} />
            <Tooltip cursor={{ fill: `${C.sky}10` }} content={<ChartTip />} />
            <Bar dataKey="learners" name="Learners" radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false} label={{ position: "right", fontSize: 11.5, fill: C.inkSoft, fontWeight: 700 }} style={{ cursor: "pointer" }}>
              {rows.map((r) => <Cell key={r.id} fill={r.weak ? C.gold : C.sky} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {weakest != null && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.faint }}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: C.gold, marginRight: 6 }} />Lowest attendance this month</p>}
    </section>
  );
}

function GrowthFunnel({ enrolment }) {
  const t = enrolment?.funnelTotal;
  if (!t) return null;
  const stages = [["Enquiries", t.enquiries, C.navy], ["Signed up", t.signedUp, C.mid], ["Paid", t.paid, C.sky], ["Still learning", t.learning, C.gold]];
  const top = Math.max(1, t.enquiries || 0);
  return (
    <section style={widget}>
      <Head icon={FiTrendingUp} title="Growth this month" color={C.navy} action={<More to="/reports?tab=enrolment" label="Enrolment" />} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.map(([label, n, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, height: 34, borderRadius: 10, background: C.canvas, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, width: `${Math.max(6, ((n || 0) / top) * 100)}%`, background: color, borderRadius: 10, opacity: 0.92 }} />
              <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", height: "100%", padding: "0 12px", fontSize: 12.5, fontWeight: 800, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            <strong style={{ width: 34, textAlign: "right", fontSize: 15, color: C.ink }}>{n || 0}</strong>
          </div>
        ))}
      </div>
      {t.conversion != null && <p style={{ margin: "12px 0 0", fontSize: 12.5, color: C.muted }}><strong style={{ color: C.navy }}>{t.conversion}%</strong> of enquiries paid</p>}
    </section>
  );
}

function ActivityFeed({ entries }) {
  if (!entries) return null;
  return (
    <section style={widget}>
      <Head icon={FiActivity} title="Recent activity" action={<More to="/activity" label="Activity log" />} />
      {!entries.length ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Nothing recorded yet.</p> : entries.map((e) => (
        <div key={e.id} style={{ position: "relative" }}>
          <ActivityEntry entry={e} compact />
          {e.repeats > 1 && <span style={{ position: "absolute", right: 34, top: 14, fontSize: 11, fontWeight: 800, color: C.muted, background: C.canvas, border: `1px solid ${C.line}`, borderRadius: 999, padding: "1px 8px" }}>×{e.repeats}</span>}
        </div>
      ))}
    </section>
  );
}

function WorkspaceTiles({ items }) {
  const navigate = useNavigate();
  if (!items.length) return null;
  return (
    <section style={widget}>
      <Head icon={FiLayers} title="Your workspace" />
      <div className="db-tiles db-tiles-2">
        {items.map((w) => (
          <button key={w.label} type="button" onClick={() => navigate(w.path)} className="db-tile"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 13, border: `1px solid ${C.line}`, background: C.canvas, cursor: "pointer", fontFamily: FONT, textAlign: "left", minWidth: 0 }}>
            <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, background: `${w.color}17`, color: w.color, display: "grid", placeItems: "center", flexShrink: 0 }}><w.icon size={15} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 18, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{w.value}</span>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.muted }}>{w.label}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GettingStarted({ steps }) {
  const navigate = useNavigate();
  if (!steps) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <section style={{ ...widget, border: `1.5px solid ${C.skyBorder}` }}>
      <Head icon={FiCheckCircle} title={`Getting started · ${done} of ${steps.length}`} />
      <div style={{ height: 6, borderRadius: 999, background: C.track, overflow: "hidden", marginBottom: 12 }}><div style={{ width: `${(done / steps.length) * 100}%`, height: "100%", background: C.mid }} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {steps.map((s) => (
          <button key={s.key} type="button" onClick={() => navigate(s.path)} disabled={s.done}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999, border: `1.5px solid ${s.done ? C.skyBorder : C.border}`, background: s.done ? C.skyTint : "#fff", color: s.done ? C.navy : C.inkSoft, fontSize: 13, fontWeight: 700, cursor: s.done ? "default" : "pointer", fontFamily: FONT }}>
            {s.done ? <FiCheckCircle size={14} /> : <FiArrowRight size={14} />} {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: d, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/api/dashboard").then((r) => r.data.data), staleTime: 30 * 1000 });
  const reports = !!d?.sees?.reports;
  const month = useMemo(() => ({ from: monthStart(), to: kenyaDay() }), []);
  const attention = useQuery({ queryKey: ["analytics", "attention", {}], queryFn: () => analyticsApi.view("attention", {}), enabled: reports, staleTime: 60 * 1000 });
  const trends = useQuery({ queryKey: ["analytics", "trends", {}], queryFn: () => analyticsApi.view("trends", {}), enabled: reports, staleTime: 5 * 60 * 1000 });
  const enrolment = useQuery({ queryKey: ["analytics", "enrolment", month], queryFn: () => analyticsApi.view("enrolment", month), enabled: reports, staleTime: 5 * 60 * 1000 });
  const hubs = useQuery({ queryKey: ["analytics", "hubs", {}], queryFn: () => analyticsApi.view("hubs", {}), enabled: reports, staleTime: 5 * 60 * 1000 });
  const activity = useQuery({
    queryKey: ["activity", "dashboard"],
    // The same action repeated (one person doing one thing several times) reads as one line.
    queryFn: () => api.get("/api/audit", { params: { pageSize: 60 } }).then((r) => {
      const out = [];
      for (const e of (r.data.data?.items || []).filter((x) => x.module !== "account")) {
        const prev = out[out.length - 1];
        if (prev && prev.actorUserId === e.actorUserId && prev.summary === e.summary) { prev.repeats += 1; continue; }
        out.push({ ...e, repeats: 1 });
        if (out.length >= 5) break;
      }
      return out;
    }),
    enabled: !!d?.sees?.activity, staleTime: 30 * 1000,
  });

  // One list of what needs doing: Reports' items (to their tab) and the admin to-dos.
  const needs = useMemo(() => {
    const fromReports = (attention.data?.items || []).map((i) => ({ ...i, Icon: ATTN_ICON[i.icon], path: i.path || `/reports?tab=${i.tab || "overview"}` }));
    const todos = (d?.todo || []).map((t) => ({ ...t, Icon: TODO_ICON[t.key] }));
    return [...fromReports, ...todos].sort((a, b) => (TONE[a.tone]?.rank ?? 3) - (TONE[b.tone]?.rank ?? 3) || b.count - a.count);
  }, [attention.data, d]);

  const counts = d?.counts || {};
  const t = trends.data;
  const inc = enrolment.data?.income;
  const moneyChange = inc && inc.previous > 0 ? Math.round(((inc.inPeriod - inc.previous) / inc.previous) * 100) : null;
  const newL = counts.newLearners;
  const months = t?.months || [];
  const spark = (key) => months.map((m) => ({ v: m[key] ?? null })).filter((p) => p.v != null);
  const moneySpark = (inc?.months || []).map((m) => ({ v: m.total }));
  const [fn, ...ln] = (d?.person?.name || "Admin").split(" ");
  const onToday = d?.today?.length || 0;

  const kpis = [
    counts.learners != null && { key: "learners", icon: FiUsers, label: "Active learners", value: counts.learners.toLocaleString("en-KE"), color: C.mid, featured: true, spark: spark("active"), delta: newL ? <DeltaPill value={newL.thisMonth - newL.lastMonth} onDark /> : null, sub: newL ? `${newL.thisMonth} new this month` : null, onOpen: () => navigate("/learners") },
    inc && { key: "money", icon: FiDollarSign, label: "Money in this month", value: ksh(inc.inPeriod), color: C.mid, spark: moneySpark, delta: moneyChange != null ? <DeltaPill value={moneyChange} suffix="%" /> : null, sub: "vs last month", onOpen: () => navigate("/billing?tab=payments") },
    inc && { key: "owed", icon: FiCreditCard, label: "Owed to you", value: ksh(inc.owed), color: C.goldText, spark: [], delta: inc.overdue ? <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: C.goldTint, color: C.goldText }}>{inc.overdue} overdue</span> : null, sub: "unpaid invoices", onOpen: () => navigate("/billing?tab=invoices") },
    t?.latest?.attendance != null && { key: "attendance", icon: FiCalendar, label: "Attendance", value: `${t.latest.attendance}%`, color: C.sky, spark: spark("attendance"), delta: <DeltaPill value={t.change.attendance} suffix=" pts" />, sub: "this month", onOpen: () => navigate("/reports?tab=attendance") },
  ].filter(Boolean);
  // Without Reports access, the workspace counts fill the KPI row instead.
  const fallbackKpis = !kpis.length || (kpis.length === 1 && !reports) ? [
    counts.courses != null && { key: "courses", icon: FiBookOpen, label: "Courses", value: counts.courses, color: C.mid, onOpen: () => navigate("/courses") },
    counts.curricula != null && { key: "curricula", icon: FiLayers, label: "Curricula", value: counts.curricula, color: C.navy, onOpen: () => navigate("/curriculum") },
    counts.classes != null && { key: "classes", icon: FiUsers, label: "Classes", value: counts.classes, color: C.sky, onOpen: () => navigate("/classes") },
  ].filter(Boolean) : [];

  const workspace = [
    counts.curricula != null && { label: "Curricula", value: counts.curricula, path: "/curriculum", icon: FiLayers, color: C.navy },
    counts.courses != null && { label: "Courses", value: counts.courses, path: "/courses", icon: FiBookOpen, color: C.mid },
    counts.hubs != null && { label: "Learning hubs", value: counts.hubs, path: "/learning-hubs", icon: FiHome, color: C.sky },
    counts.classes != null && { label: "Classes", value: counts.classes, path: "/classes", icon: FiUsers, color: C.mid },
    counts.educators != null && { label: "Educators", value: counts.educators, path: "/teachers", icon: FiUserCheck, color: C.navy },
    t?.showMentors && t.latest.mentors != null && { label: "Mentors at standard", value: `${t.latest.mentors}%`, path: "/reports?tab=educators", icon: FiTarget, color: C.goldText },
  ].filter(Boolean);

  const actions = [
    counts.learners != null && { label: "Add learner", icon: FiUserPlus, path: "/learners/create" },
    counts.courses != null && { label: "New course", icon: FiBookOpen, path: "/courses/create" },
    d?.sees?.billing && { label: "Invoices", icon: FiFileText, path: "/billing?tab=invoices" },
    reports && { label: "Reports", icon: FiTrendingUp, path: "/reports" },
  ].filter(Boolean);
  const chips = [
    { icon: FiFlag, text: `${needs.length} need${needs.length === 1 ? "s" : ""} you` },
    { icon: FiClock, text: `${onToday} on today` },
    inc && { icon: FiDollarSign, text: `${ksh(inc.inPeriod)} this month` },
  ].filter(Boolean);
  const rowKpis = kpis.length ? kpis : fallbackKpis;

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .db-kpi, .db-tile { transition: transform 150ms ease, box-shadow 150ms ease; }
        .db-kpi:hover, .db-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(37,71,106,0.12); }
        .db-kpi:focus-visible, .db-tile:focus-visible, .db-row:focus-visible { outline: 2px solid ${C.sky}; outline-offset: 2px; }
        .db-row:hover { background: ${C.canvas} !important; }
        .db-kpis { display: grid; gap: 16px; grid-template-columns: repeat(${Math.max(1, rowKpis.length)}, minmax(0, 1fr)); }
        .db-grid { display: grid; gap: 16px; grid-template-columns: repeat(12, minmax(0, 1fr)); align-items: stretch; }
        .db-8 { grid-column: span 8; } .db-4 { grid-column: span 4; } .db-6 { grid-column: span 6; } .db-5 { grid-column: span 5; } .db-3 { grid-column: span 3; }
        .db-tiles { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 1180px) { .db-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .db-5, .db-3 { grid-column: span 6; } .db-4.db-today { grid-column: span 12; } }
        @media (max-width: 860px) { .db-8, .db-4, .db-6, .db-5, .db-3 { grid-column: span 12; } }
        @media (max-width: 560px) { .db-kpis { grid-template-columns: 100%; } .db-grid { display: flex; flex-direction: column; } }
      `}</style>

      {/* Hero */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 22, padding: "22px 26px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -70, right: 180, width: 140, height: 140, borderRadius: "50%", background: "rgba(254,177,57,0.12)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 340px" }}>
            <Avatar firstName={fn} lastName={ln.join(" ")} photo={d?.person?.photo} size={60} borderColor="rgba(255,255,255,0.35)" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>{dayLine()}</p>
              <h1 style={{ margin: "2px 0 10px", fontSize: 25, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>{greeting()}, {fn}</h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(isLoading ? [{ icon: FiClock, text: "Getting today ready…" }] : chips).map((c) => (
                  <span key={c.text} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff", fontSize: 12.5, fontWeight: 700 }}><c.icon size={13} /> {c.text}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions.map((a, i) => (
              <button key={a.label} type="button" onClick={() => navigate(a.path)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 11, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", ...(i === 0 ? { background: C.gold, color: C.navy, border: "none", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" } : { background: "rgba(255,255,255,0.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)" }) }}>
                <a.icon size={14} /> {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CheckinsReminder />
      <GettingStarted steps={d?.setup} />

      {/* KPI cards */}
      {rowKpis.length > 0 && <div className="db-kpis">{rowKpis.map(({ key, ...k }) => <Kpi key={key} {...k} />)}</div>}

      {/* Bento grid */}
      <div className="db-grid">
        {inc ? <div className="db-8"><MoneyChart income={inc} /></div> : null}
        <div className={inc ? "db-4" : "db-6"}><NeedsYou items={needs} loading={isLoading || attention.isLoading} /></div>

        <div className={inc ? "db-4 db-today" : "db-6"}><TodayTimeline items={d?.today || []} /></div>
        {t && <div className="db-5"><HealthChart trends={t} /></div>}
        {(d?.programmes || []).length > 0 && <div className={t ? "db-3" : "db-8"}><ProgrammeTiles items={d.programmes} /></div>}

        {hubs.data?.hubs?.some((h) => h.learners > 0) && <div className="db-6"><HubsChart data={hubs.data} /></div>}
        {enrolment.data?.funnelTotal && <div className="db-6"><GrowthFunnel enrolment={enrolment.data} /></div>}

        {activity.data && <div className="db-8"><ActivityFeed entries={activity.data} /></div>}
        {workspace.length > 0 && <div className={activity.data ? "db-4" : "db-12"} style={activity.data ? undefined : { gridColumn: "span 12" }}><WorkspaceTiles items={workspace} /></div>}
      </div>
    </div>
  );
}
