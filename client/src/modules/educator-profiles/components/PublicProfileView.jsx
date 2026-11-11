import { useState } from "react";
import { FiAward, FiBookOpen, FiCheckCircle, FiClock, FiGlobe, FiHome, FiInfo, FiMessageCircle, FiShield, FiStar, FiTrendingUp, FiUser, FiUserCheck, FiUsers } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { Tabs } from "../../../components/ui/TabBar";
import FeedbackSummary from "../../mentor-reviews/components/FeedbackSummary";
import { StarsShown } from "../../mentor-reviews/components/Stars";
import { BRAND as C, FONT, HERO_GRADIENT, pill } from "../../../theme/brand";
import { BadgeTile, EmptyState, IconFigure, KpiStrip, QA_BAND_COLOR, SectionTitle, box } from "./PerformanceProfile";

// An educator's profile as families see it — Find a mentor in the parent portal, the share page
// (/public/educators/:slug), and the educator's / admin's "How families will see this" preview.
// Laid out like the educator page inside the system (11 Nov 2026 — the admin's and the educator's
// own My profile): a header, the figures that matter as a strip (each opens its tab), and tabs —
//   Overview            in short, about them, badges earned.
//   Quality & feedback  their quality-review band, what parents say, comments parents agreed to share.
//   Teaching            sessions, learners, hours, outcomes, courses taught.
// Only the public shape the server sends (educator-profile.service.js's publicView): their approved
// About, verified evidence, earned badges, the parent rating (from 5 reviews, else "New"), a QA band
// (never the score), shared comments. Never contact details, pay, standards or QA detail.

const TABS = [
  { key: "overview", label: "Overview", icon: FiTrendingUp },
  { key: "quality", label: "Quality & feedback", icon: FiShield },
  { key: "teaching", label: "Teaching", icon: FiBookOpen },
];
const fmt = (n) => Number(n || 0).toLocaleString("en-KE");
const plural = (n, word, many = `${word}s`) => `${fmt(n)} ${n === 1 ? word : many}`;
const experience = (m) => (m >= 24 ? `${Math.floor(m / 12)} years` : m >= 12 ? "1 year" : m > 0 ? `${m} month${m === 1 ? "" : "s"}` : "New");
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
const dayName = (d) => d.charAt(0).toUpperCase() + d.slice(1, 3);

// The summary in words, for a family.
function summaryLines(p, first) {
  const lines = [];
  lines.push(p.sessions
    ? `${first} has taught ${plural(p.learnersTaught, "learner")} across ${plural(p.sessions, "session")}${p.hours ? ` (${fmt(p.hours)} verified hours)` : ""} on ${plural(p.courses?.length || 0, "course")}.`
    : `${first} has no sessions on record yet.`);
  if (p.qa) lines.push(`Quality reviews: ${p.qa.band}, from ${plural(p.qa.reviews, "supervisor visit")}.`);
  else lines.push("No quality review yet.");
  if (!p.rating?.isNew) lines.push(`Parents rate ${first} ${p.rating.average.toFixed(1)}★ from ${plural(p.rating.count, "review")}.`);
  else lines.push(p.rating?.count ? `${plural(p.rating.count, "parent review")} so far — the rating shows from 5.` : "No parent reviews yet.");
  if (p.learnersFinished) lines.push(`${plural(p.learnersFinished, "learner")} finished a course with ${first}, earning ${plural(p.certificatesEarned, "certificate")}.`);
  return lines;
}

function Fact({ label, children }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}`, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 13.5, color: C.ink, overflowWrap: "anywhere" }}>{children}</p>
    </div>
  );
}

function OverviewTab({ p, first }) {
  const facts = [
    p.specialties?.length > 0 && ["Teaches", p.specialties.join(", ")],
    p.ageRange && ["Ages", p.ageRange],
    p.languages?.length > 0 && ["Languages", p.languages.join(", ")],
    p.availability?.length > 0 && ["Usually available", p.availability.map(dayName).join(", ")],
    p.totLevel && ["Educator level", p.totLevel],
  ].filter(Boolean);
  const badges = p.badges || [];
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <section style={box}>
        <SectionTitle icon={FiTrendingUp} title="In short" />
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5, fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>
          {summaryLines(p, first).map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section style={box}>
        <SectionTitle icon={FiUser} title={`About ${first}`} />
        {p.bio ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: C.ink, whiteSpace: "pre-line" }}>{p.bio}</p>
          : <p style={{ margin: 0, fontSize: 13.5, color: C.muted }}>No introduction yet.</p>}
        {facts.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}>
            {facts.map(([label, value]) => <Fact key={label} label={label}>{value}</Fact>)}
          </div>
        )}
      </section>

      <section style={box}>
        <SectionTitle icon={FiAward} title={`Badges · ${badges.length} earned`} />
        {badges.length ? (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))" }}>
            {badges.map((b) => <BadgeTile key={b.key} badge={{ ...b, earned: true }} />)}
          </div>
        ) : <EmptyState icon={FiAward} title="No badges yet" line="Badges are earned from the records — ratings, quality reviews, sessions held and more." />}
      </section>
    </div>
  );
}

function QualityTab({ p, first }) {
  const r = p.rating || {};
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <section style={box}>
        <SectionTitle icon={FiShield} title="Quality reviews" />
        {p.qa ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: QA_BAND_COLOR[p.qa.band] || C.navy, lineHeight: 1 }}>{p.qa.band}</span>
            <p style={{ margin: 0, flex: "1 1 260px", fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
              {first} is observed teaching by a supervisor, against a set standard — {plural(p.qa.reviews, "review")} so far.
            </p>
          </div>
        ) : <EmptyState icon={FiShield} title="No quality review yet" line={`${first}'s band shows here after their first supervisor visit.`} />}
      </section>

      <section style={box}>
        <SectionTitle icon={FiStar} title="What parents say" note="Last 12 months" />
        {r.isNew
          ? <EmptyState icon={FiStar} title={r.count ? `${plural(r.count, "review")} so far` : "No parent reviews yet"} line="The rating shows from 5 reviews, so it's fair." />
          : <FeedbackSummary summary={{ average: r.average, count: r.count, aspects: (r.aspects || []).map((a) => ({ ...a, key: a.label })) }} />}
      </section>

      {p.comments?.length > 0 && (
        <section style={box}>
          <SectionTitle icon={FiMessageCircle} title="In parents' words" note="Shared with their permission" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
            {p.comments.map((c, i) => (
              <figure key={i} style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}` }}>
                <StarsShown value={c.overall} showNumber={false} size={12} />
                <blockquote style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>&ldquo;{c.comment}&rdquo;</blockquote>
                <figcaption style={{ marginTop: 4, fontSize: 11.5, color: C.faint }}>A parent · {monthLabel(c.month)}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeachingTab({ p }) {
  const courses = p.courses || [];
  const cell = { padding: 8, borderBottom: `1px solid ${C.line}` };
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
      <section style={box}>
        <SectionTitle
          icon={FiUsers}
          title="Teaching"
          action={<span title="A session counts once its attendance is taken; hours use its timetable slot's length." style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.faint, cursor: "help" }}><FiInfo size={13} /> How it's counted</span>}
        />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 190px), 1fr))" }}>
          <IconFigure icon={FiCheckCircle} label="Sessions held" value={fmt(p.sessions)} />
          <IconFigure icon={FiUsers} label="Learners taught" value={fmt(p.learnersTaught)} sub={plural(courses.length, "course")} />
          <IconFigure icon={FiClock} label="Verified hours" value={fmt(p.hours)} />
          <IconFigure icon={FiUserCheck} label="Learners finished" value={fmt(p.learnersFinished)} sub={plural(p.certificatesEarned || 0, "certificate")} />
        </div>
      </section>

      <section style={box}>
        <SectionTitle icon={FiBookOpen} title="Courses taught" />
        {!courses.length ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Not teaching a course yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 380 }}>
              <thead>
                <tr style={{ textAlign: "left", color: C.muted, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {["Course", "Sessions", "Learners", "Finished"].map((x) => <th key={x} style={{ ...cell, padding: "6px 8px", fontWeight: 800 }}>{x}</th>)}
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.course}>
                    <td style={{ ...cell, fontWeight: 700, color: C.ink }}>{c.course}</td>
                    <td style={cell}>{c.sessions}</td>
                    <td style={cell}>{c.learners}</td>
                    <td style={cell}>{c.finished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// `crumb` ({ label, onClick }) puts a way back in the header, as the educator page does;
// `tab` / `onTab` let a page keep the open tab in its address (else it's kept here).
export default function PublicProfileView({ profile: p, actions = null, note = null, crumb = null, tab: tabProp, onTab }) {
  const [ownTab, setOwnTab] = useState("overview");
  const tab = TABS.some((t) => t.key === tabProp) ? tabProp : onTab ? "overview" : ownTab;
  const setTab = onTab || setOwnTab;
  const [first, ...rest] = (p.name || "").split(" ");
  const teaches = [p.teaches?.online && "Online", p.teaches?.inPerson && "In person", p.teaches?.atHome && "At home"].filter(Boolean);
  const r = p.rating || {};

  const tiles = [
    { key: "rating", tab: "quality", icon: FiStar, label: "Parent rating", value: r.isNew ? "New" : `${r.average.toFixed(1)} ★`, sub: r.isNew ? `Shows from 5 reviews (${r.count || 0} so far)` : `${plural(r.count, "review")} · 12 months` },
    { key: "qa", tab: "quality", icon: FiShield, label: "Quality reviews", value: p.qa?.band || "—", sub: p.qa ? plural(p.qa.reviews, "visit") : "Not reviewed yet" },
    { key: "sessions", tab: "teaching", icon: FiCheckCircle, label: "Sessions held", value: fmt(p.sessions), sub: "Attendance taken" },
    { key: "hours", tab: "teaching", icon: FiClock, label: "Verified hours", value: fmt(p.hours), sub: plural(p.courses?.length || 0, "course") },
    { key: "learners", tab: "teaching", icon: FiUsers, label: "Learners taught", value: fmt(p.learnersTaught), sub: p.learnersFinished ? `${fmt(p.learnersFinished)} finished a course` : "Across every class" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT, color: C.ink }}>
      {note}
      {/* Header — as on the educator page */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {crumb && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <button type="button" onClick={crumb.onClick} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer", fontFamily: FONT, padding: 0 }}>{crumb.label}</button>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>/</span>
              <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 500 }}>{p.name}</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 340px" }}>
              <Avatar firstName={first} lastName={rest.join(" ")} photo={p.photo} size={68} borderColor="rgba(255,255,255,0.3)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px", overflowWrap: "anywhere" }}>{p.name}</h1>
                  <span style={pill("good")}><FiCheckCircle size={11} /> Verified educator</span>
                </div>
                {p.headline && <p style={{ margin: "4px 0 0", fontSize: 14, color: "rgba(255,255,255,0.88)" }}>{p.headline}</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                  {p.places?.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiHome size={13} /> {p.places.slice(0, 3).join(" · ")}</span>}
                  {teaches.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiGlobe size={13} /> {teaches.join(" & ")}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiAward size={13} /> {p.experienceMonths ? `${experience(p.experienceMonths)} teaching` : "New educator"}</span>
                </div>
              </div>
            </div>
            {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>{actions}</div>}
          </div>
        </div>
      </div>

      {/* The figures that matter — each opens its tab */}
      <KpiStrip tiles={tiles} onOpen={setTab} />

      {/* On a phone the tabs wrap onto a second line rather than scroll out of sight. */}
      <div className="pp-tabs"><style>{"@media (max-width: 640px) { .pp-tabs .ui-tab-scroll { flex-wrap: wrap; overflow-x: visible !important; width: 100% !important; } }"}</style><Tabs label="Educator" tabs={TABS} value={tab} onChange={setTab} /></div>

      {tab === "quality" ? <QualityTab p={p} first={first} />
        : tab === "teaching" ? <TeachingTab p={p} />
          : <OverviewTab p={p} first={first} />}

      <p style={{ margin: 0, fontSize: 11.5, color: C.faint, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <FiUsers size={12} /> Hours, sessions, learners and courses come from the records of each session taught; ratings from parents of learners {first} has taught.
        {p.updatedAt && <span>Updated {new Date(p.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.</span>}
      </p>
    </div>
  );
}
