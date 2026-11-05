import { FiAward, FiBookOpen, FiCheckCircle, FiClock, FiGlobe, FiMapPin, FiShield, FiStar, FiUsers } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { StarsShown } from "../../mentor-reviews/components/Stars";
import { BRAND, HERO_GRADIENT } from "../../../theme/brand";

// An educator's profile as families see it — the share page (/public/educators/:slug), Find a mentor
// in the parent portal, and the educator's / admin's preview. Only the public shape the server sends
// (educator-profile.service.js's publicView): their approved About, verified evidence, earned badges,
// the parent rating (from 5 reviews, else "New"), a QA band, comments parents agreed to share.

// System colours only (theme/brand.js).
const C = { ...BRAND, deep: BRAND.navyDeep };
const BADGE_ICON = { top_rated: FiStar, qa_excellent: FiShield, reliable: FiCheckCircle, fast_feedback: FiClock, hours: FiAward, tot_certified: FiBookOpen };
const BAND = { Excellent: { bg: BRAND.navyTint, color: BRAND.navy }, Strong: { bg: BRAND.skyTint, color: BRAND.skyText }, Developing: { bg: BRAND.goldTint, color: BRAND.goldText } };
const card = { background: "#fff", borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "18px 20px", minWidth: 0 };
const h2 = { margin: "0 0 12px", fontSize: 12, fontWeight: 800, color: C.sky, textTransform: "uppercase", letterSpacing: "0.07em" };
const fmtNum = (n) => Number(n || 0).toLocaleString("en-KE");
const experience = (m) => (m >= 24 ? `${Math.floor(m / 12)} years` : m >= 12 ? "1 year" : m > 0 ? `${m} month${m === 1 ? "" : "s"}` : "New");
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "long", year: "numeric" });

function Stat({ value, label }) {
  return (
    <div style={{ flex: "1 1 120px", minWidth: 0, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{label}</p>
    </div>
  );
}

export default function PublicProfileView({ profile: p, actions = null, note = null }) {
  const [first, ...rest] = (p.name || "").split(" ");
  const teaches = [p.teaches?.online && "Online", p.teaches?.inPerson && "In person", p.teaches?.atHome && "At home"].filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "Inter, sans-serif", color: C.ink }}>
      {note}
      {/* Header */}
      <div style={{ background: HERO_GRADIENT, borderRadius: 22, padding: "24px 26px", color: "#fff", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar firstName={first} lastName={rest.join(" ")} photo={p.photo} size={84} borderColor="rgba(255,255,255,0.35)" />
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: "-0.4px", overflowWrap: "anywhere" }}>{p.name}</h1>
            {p.headline && <p style={{ margin: "4px 0 0", fontSize: 15, color: "rgba(255,255,255,0.88)" }}>{p.headline}</p>}
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.75)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              {p.places?.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiMapPin size={13} /> {p.places.slice(0, 3).join(" · ")}</span>}
              {teaches.length > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiGlobe size={13} /> {teaches.join(" & ")}</span>}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiCheckCircle size={13} /> Verified educator · {experience(p.experienceMonths)}</span>
            </p>
          </div>
          <div style={{ textAlign: "right", minWidth: 140 }}>
            {p.rating?.isNew ? (
              <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.14)", fontSize: 12.5, fontWeight: 800 }}>New educator</span>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{p.rating.average.toFixed(1)} <span style={{ fontSize: 15, color: C.gold }}>★</span></p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{p.rating.count} parent reviews</p>
              </>
            )}
          </div>
        </div>
        {p.badges?.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.badges.map((b) => {
              const Icon = BADGE_ICON[b.key] || FiAward;
              return (
                <span key={b.key} title={b.rule} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "rgba(254,177,57,0.18)", border: "1px solid rgba(254,177,57,0.45)", color: "#FFE2AE", fontSize: 12, fontWeight: 800 }}>
                  <Icon size={13} /> {b.label}
                </span>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Stat value={fmtNum(p.hours)} label="hours taught (verified)" />
          <Stat value={fmtNum(p.sessions)} label="sessions held" />
          <Stat value={fmtNum(p.learnersTaught)} label="learners taught" />
          <Stat value={fmtNum(p.courses?.length)} label={p.courses?.length === 1 ? "course" : "courses"} />
          {p.qa && <Stat value={p.qa.band} label={`quality review${p.qa.reviews === 1 ? "" : "s"} (${p.qa.reviews})`} />}
        </div>
        {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", alignItems: "start" }}>
        {/* What parents say */}
        <section style={card}>
          <h2 style={h2}>What parents say</h2>
          {p.rating?.isNew ? (
            <p style={{ margin: 0, fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              {p.rating.count ? `${p.rating.count} parent review${p.rating.count === 1 ? "" : "s"} so far — ratings show from 5, so they're fair.` : "No parent reviews yet."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 9, gridTemplateColumns: "100%" }}>
              {p.rating.aspects.map((a) => (
                <div key={a.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{a.label}</span><span style={{ fontWeight: 800, color: C.navy }}>{a.average.toFixed(1)}</span></div>
                  <div style={{ height: 7, borderRadius: 999, background: C.track, overflow: "hidden" }}><div style={{ width: `${(a.average / 5) * 100}%`, height: "100%", background: C.mid, borderRadius: 999 }} /></div>
                </div>
              ))}
            </div>
          )}
          {p.comments?.length > 0 && (
            <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
              {p.comments.map((c, i) => (
                <figure key={i} style={{ margin: 0, padding: "12px 14px", borderRadius: 12, background: C.canvas, border: `1px solid ${C.line}` }}>
                  <StarsShown value={c.overall} showNumber={false} size={12} />
                  <blockquote style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>&ldquo;{c.comment}&rdquo;</blockquote>
                  <figcaption style={{ marginTop: 4, fontSize: 11.5, color: C.faint }}>A parent · {monthLabel(c.month)}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* Courses taught */}
        <section style={card}>
          <h2 style={h2}>Courses taught</h2>
          {p.courses?.length ? (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
              {p.courses.map((c) => (
                <div key={c.course} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, background: C.canvas, border: `1px solid ${C.line}`, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>{c.course}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{c.sessions} session{c.sessions === 1 ? "" : "s"} · {c.learners} learner{c.learners === 1 ? "" : "s"}{c.finished ? ` · ${c.finished} finished` : ""}</span>
                </div>
              ))}
              {(p.learnersFinished > 0 || p.certificatesEarned > 0) && (
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}><FiAward color={C.gold} /> {fmtNum(p.learnersFinished)} {p.learnersFinished === 1 ? "learner" : "learners"} finished a course · {fmtNum(p.certificatesEarned)} {p.certificatesEarned === 1 ? "certificate" : "certificates"} earned</p>
              )}
            </div>
          ) : <p style={{ margin: 0, fontSize: 13.5, color: C.muted }}>No courses yet.</p>}
        </section>

        {/* About */}
        <section style={card}>
          <h2 style={h2}>About {first}</h2>
          {p.bio ? <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-line" }}>{p.bio}</p> : <p style={{ margin: "0 0 12px", fontSize: 13.5, color: C.muted }}>No introduction yet.</p>}
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%", fontSize: 13 }}>
            {p.specialties?.length > 0 && <div><strong>Teaches:</strong> {p.specialties.join(", ")}</div>}
            {p.ageRange && <div><strong>Ages:</strong> {p.ageRange}</div>}
            {p.languages?.length > 0 && <div><strong>Languages:</strong> {p.languages.join(", ")}</div>}
            {p.availability?.length > 0 && <div><strong>Usually available:</strong> {p.availability.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ")}</div>}
            {p.totLevel && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><FiShield color={C.mid} /> Educator level {p.totLevel}</div>}
          </div>
        </section>

        {/* Quality */}
        {p.qa && (
          <section style={card}>
            <h2 style={h2}>Quality reviews</h2>
            <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, fontSize: 13, fontWeight: 800, ...(BAND[p.qa.band] || {}) }}>{p.qa.band}</span>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {first} is observed teaching by a supervisor, against a set standard — {p.qa.reviews} review{p.qa.reviews === 1 ? "" : "s"} so far.
            </p>
          </section>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11.5, color: C.faint, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <FiUsers size={12} /> Hours, sessions, learners and courses come from the records of each session taught; ratings from parents of learners {first} has taught.
        {p.updatedAt && <span>Updated {new Date(p.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.</span>}
      </p>
    </div>
  );
}
