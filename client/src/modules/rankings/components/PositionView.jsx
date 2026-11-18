import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  FiArrowDown, FiArrowUp, FiAward, FiBarChart2, FiCalendar, FiCheckCircle, FiClipboard, FiClock, FiFlag, FiLock, FiMinus, FiStar,
  FiTarget, FiTrendingUp, FiUsers, FiZap,
} from "react-icons/fi";
import { EmptyState, GLASS, KID, KidHeading, T, cardStyle, heroGradient } from "../../learner-portal/components/profile/theme";
import { formatWeek, rankingsApi } from "../services/rankingsApi";
import { LayoutStyles } from "./layout";
import { Celebrate, HowItWorks, PageSwitch, ScoreExplainer, SkeletonPage, timeAgo, useNews } from "./kit";

// A learner's place in their class this term — the learner portal's "My position" and, for a
// parent, their child's (`childName` set: worded about the child, never "you").
// Laid out across the whole screen (19 Nov 2026): the hero (class switch, place, quick stats,
// score), then side by side — the goal and the next steps, the leaderboards and how the score is
// made — then badges and the term so far, each full width. Stacks on smaller screens.
// The place shows exactly in the top half of the class and as a band below it — never the bottom
// of the list; other children by first name and initial; no raw marks.

const GOLD = "#feb139";
const card = (extra = {}) => cardStyle({ padding: 20, height: "100%", boxSizing: "border-box", ...extra });

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// Words for the learner themself, or for a parent about their child.
function wordsFor(childName) {
  if (!childName) return { subject: "You're", possessive: "Your", possessiveLower: "your", objectLower: "you", have: "have", nextStepsTitle: "Your next steps", around: "you" };
  return { subject: `${childName} is`, possessive: `${childName}'s`, possessiveLower: `${childName}'s`, objectLower: childName, have: "has", nextStepsTitle: `How ${childName} can move up`, around: childName };
}

// ---- Hero ---------------------------------------------------------------------------------------
function ScoreRing({ score, level, size = 148 }) {
  const r = (size - 18) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, justifySelf: "center" }}>
      <svg width={size} height={size} role="img" aria-label={`Learning score ${score ?? "not yet"} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(10,30,55,0.25)" stroke="rgba(255,255,255,0.18)" strokeWidth={13} />
        {score != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GOLD} strokeWidth={13} strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", color: "#fff" }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 900, opacity: 0.8, letterSpacing: "0.06em" }}>SCORE</div>
          <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.05 }}>{score == null ? "—" : Math.round(score)}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.8 }}>out of 100</div>
          {level && <div style={{ fontSize: 12, fontWeight: 900, marginTop: 3, color: GOLD }}>{level}</div>}
        </div>
      </div>
    </div>
  );
}

function Movement({ movement }) {
  if (movement == null) return null;
  const up = movement > 0;
  const same = movement === 0;
  const Icon = same ? FiMinus : up ? FiArrowUp : FiArrowDown;
  const text = same ? "Same place as last week" : `${up ? "Up" : "Down"} ${Math.abs(movement)} ${Math.abs(movement) === 1 ? "place" : "places"} since last week`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, background: up ? GOLD : "rgba(255,255,255,0.16)", color: up ? "#25476a" : "#fff", fontSize: 13, fontWeight: 800 }}>
      <Icon size={14} /> {text}
    </span>
  );
}

function GlassTile({ icon: Icon, value, label, sub, accent }) {
  return (
    <div style={{ ...GLASS, padding: "14px 16px", display: "grid", gap: 8, minWidth: 0, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="rk-gt-icon" style={{ width: 34, height: 34, borderRadius: 11, background: accent ? GOLD : "rgba(255,255,255,0.16)", color: accent ? "#25476a" : "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} /></span>
        <span className="rk-gt-value" style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{value}</span>
      </div>
      <div className="rk-gt-label" style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.88, lineHeight: 1.3 }}>{label}{sub ? <span style={{ display: "block", opacity: 0.75, fontSize: 11.5 }}>{sub}</span> : null}</div>
    </div>
  );
}

function ClassSwitch({ classes, classId, onChange }) {
  if (classes.length < 2) return null;
  return (
    <div role="group" aria-label="Class" className="rk-scroll" style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {classes.map((c) => {
        const on = c.id === classId;
        return (
          <button key={c.id} type="button" className="rk-pill" aria-pressed={on} onClick={() => onChange(c.id)}
            style={{ padding: "7px 15px", borderRadius: 999, border: `1.5px solid ${on ? "#fff" : "rgba(255,255,255,0.3)"}`, background: on ? "#fff" : "rgba(255,255,255,0.1)", color: on ? T.accentDeep : "#fff", fontWeight: 800, fontSize: 13, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function Hero({ data, who, onClass }) {
  const { me, rankedCount, className, term } = data;
  const s = me.standing;
  const podium = s?.exact && s.rank <= 3;
  const medal = s?.exact ? (s.rank === 1 ? GOLD : s.rank <= 3 ? "#38aae1" : "rgba(255,255,255,0.16)") : "rgba(255,255,255,0.16)";
  const headline = s?.exact
    ? s.rank === 1 ? `${who.subject} top of the class!` : `${who.subject} ${ordinal(s.rank)} of ${rankedCount}`
    : s ? s.band : me.eligible ? "Positions are on their way" : `${who.subject} getting started`;
  const nextValue = me.isTop ? "1st" : me.next ? `${me.next.points} pts` : !me.eligible ? `${Math.min(me.markedCount, data.minMarked)} / ${data.minMarked}` : "Soon";
  const nextLabel = me.isTop ? "Top of the class" : me.next ? `To move up${me.next.toPlace ? ` to ${me.next.toPlace}` : ""}` : !me.eligible ? "Marked pieces to get a place" : "Places show when the class is ready";
  return (
    <section style={{ background: heroGradient(), borderRadius: 26, padding: "24px 28px", color: "#fff", position: "relative", overflow: "hidden" }}>
      <span aria-hidden="true" style={{ position: "absolute", right: -60, top: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <ClassSwitch classes={data.classes} classId={data.classId} onChange={onClass} />
      <div className="rk-hero" style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", minWidth: 0 }}>
          <div style={{ width: 104, height: 104, borderRadius: "50%", background: medal, border: "4px solid rgba(255,255,255,0.35)", display: "grid", placeItems: "center", flexShrink: 0, color: podium ? "#25476a" : "#fff", boxShadow: podium ? "0 8px 24px rgba(254,177,57,0.35)" : "none" }}>
            {s?.exact ? (
              <div style={{ textAlign: "center", lineHeight: 1 }}>
                {podium && <FiAward size={20} style={{ display: "block", margin: "0 auto 3px" }} />}
                <span style={{ fontSize: podium ? 27 : 31, fontWeight: 900 }}>{ordinal(s.rank)}</span>
              </div>
            ) : s ? <FiTrendingUp size={36} /> : <FiTarget size={36} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.8, letterSpacing: "0.02em" }}>{className} · {term.label}</div>
            <h1 style={{ margin: "4px 0 10px", fontSize: "clamp(22px, 2.4vw, 30px)", fontWeight: 900, lineHeight: 1.15 }}>{headline}</h1>
            <Movement movement={me.movement} />
          </div>
        </div>
        <div className="rk-glass-tiles rk-hero-tiles">
          <GlassTile icon={FiFlag} value={nextValue} label={nextLabel} accent={Boolean(me.next || me.isTop || !me.eligible)} />
          <GlassTile icon={FiClock} value={me.streaks?.onTime ?? 0} label="On time in a row" sub={me.streaks?.onTimeBest > (me.streaks?.onTime || 0) ? `Best ${me.streaks.onTimeBest}` : null} />
          <GlassTile icon={FiCalendar} value={me.streaks?.attendance ?? 0} label="Sessions in a row" sub={me.streaks?.attendanceBest > (me.streaks?.attendance || 0) ? `Best ${me.streaks.attendanceBest}` : null} />
        </div>
        <ScoreRing score={me.score} level={me.level} />
      </div>
    </section>
  );
}

// ---- Goal and next steps ----------------------------------------------------------------------
// The learner's score beside the class average — two bars, no other child's number.
function Compare({ me, average, who }) {
  if (me == null || average == null) return null;
  const row = (label, value, colour, bold) => (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 42px", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 900 : 700, color: bold ? T.accentDeep : T.inkMuted }}>{label}</span>
      <span style={{ height: 12, borderRadius: 999, background: "#EEF2F7" }}><span style={{ display: "block", width: `${Math.max(3, value)}%`, height: "100%", borderRadius: 999, background: colour }} /></span>
      <span style={{ fontSize: 14, fontWeight: 900, color: T.accentDeep, textAlign: "right" }}>{Math.round(value)}</span>
    </div>
  );
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1.5px dashed ${T.border}`, display: "grid", gap: 10 }}>
      {row(who.subject === "You're" ? "Your score" : `${who.possessive.replace(/'s$/, "")}'s score`, me, KID.sky.fill, true)}
      {row("Class average", average, KID.navy.border, false)}
    </div>
  );
}

function Goal({ data, who }) {
  const { me, minMarked, minClass, ranked } = data;
  if (!me.standing) {
    const needed = Math.max(0, minMarked - me.markedCount);
    const text = !me.eligible
      ? `${who.possessive} place shows once ${who.objectLower} ${who.have} ${minMarked} pieces of marked work this term — ${needed} more to go.`
      : !ranked ? `Places show once ${minClass} learners in the class have ${minMarked} pieces of marked work. ${who.possessive} score is already counting.` : "";
    return (
      <section style={card()}>
        <KidHeading icon={FiFlag} tone={KID.gold} sub="What it takes to get a place.">Getting on the board</KidHeading>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Array.from({ length: minMarked }, (_, i) => (
            <span key={i} style={{ flex: "1 1 0", height: 40, borderRadius: 12, background: i < me.markedCount ? KID.sky.fill : KID.sky.soft, border: `2px solid ${KID.sky.border}`, display: "grid", placeItems: "center", color: i < me.markedCount ? "#fff" : T.inkFaint, fontWeight: 900 }}>
              {i < me.markedCount ? <FiCheckCircle size={16} /> : i + 1}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.inkMuted, lineHeight: 1.5 }}>{text}</p>
        <Compare me={me.score} average={data.classAverageScore} who={who} />
      </section>
    );
  }
  if (me.isTop) {
    return (
      <section style={card({ background: KID.gold.soft, borderColor: KID.gold.border })}>
        <KidHeading icon={FiStar} tone={KID.gold} sub="Stay there by coming to every session and handing work in on time.">Top of the class</KidHeading>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.accentDeep, lineHeight: 1.5 }}>{who.subject} leading {data.className} this term. Brilliant work!</p>
        <Compare me={me.score} average={data.classAverageScore} who={who} />
      </section>
    );
  }
  if (!me.next) return null;
  const pct = Math.max(6, Math.min(96, 100 - me.next.points * 4));
  return (
    <section style={card()}>
      <KidHeading icon={FiFlag} tone={KID.gold} sub={me.next.toPlace ? `Pass the learner in ${me.next.toPlace} place.` : "Pass the next learner up."}>Next place</KidHeading>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: T.accentDeep, lineHeight: 1 }}>{me.next.points}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: T.inkMuted }}>points to move up{me.next.toPlace ? ` to ${me.next.toPlace}` : ""}</span>
      </div>
      <div style={{ height: 16, borderRadius: 999, background: KID.gold.soft, border: `1.5px solid ${KID.gold.border}`, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: GOLD }} />
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 13, color: T.inkMuted, fontWeight: 600 }}>{who.subject} close — the next steps show how.</p>
      <Compare me={me.score} average={data.classAverageScore} who={who} />
    </section>
  );
}

function NextSteps({ steps, who }) {
  const ICON = { hand_in: FiClipboard, catch_up: FiClock, improve: FiTrendingUp, keep_going: FiStar };
  return (
    <section style={card()}>
      <KidHeading icon={FiTarget} tone={KID.gold} sub="Small things that move the score up.">{who.nextStepsTitle}</KidHeading>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {steps.map((s, i) => {
          const Icon = ICON[s.kind] || FiTarget;
          return (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 16, background: i === 0 ? KID.gold.soft : "#F7F9FC", border: `1.5px solid ${i === 0 ? KID.gold.border : T.border}` }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, background: i === 0 ? GOLD : "#fff", border: `1.5px solid ${i === 0 ? GOLD : T.border}`, color: i === 0 ? "#25476a" : T.accentMid, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={16} /></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.5, paddingTop: 5 }}>{s.text}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---- Leaderboards -------------------------------------------------------------------------------
function podiumOf(rows) {
  const podium = rows.filter((r) => r.rank <= 3);
  const order = [podium.find((r) => r.rank === 2), podium.find((r) => r.rank === 1), podium.find((r) => r.rank === 3)].filter(Boolean);
  // Ties share a place: show everyone in the top three places as they come.
  const tops = podium.length > 3 || order.length !== podium.length ? podium : order;
  const height = { 1: 118, 2: 90, 3: 72 };
  return {
    tops,
    node: (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", justifyContent: "center", padding: "6px 0 0" }}>
        {tops.map((r) => (
          <div key={`${r.rank}-${r.name}`} style={{ flex: "1 1 0", maxWidth: 170, textAlign: "center", minWidth: 0 }}>
            <div style={{ width: 44, height: 44, margin: "0 auto 6px", borderRadius: "50%", background: r.isMe ? GOLD : KID.navy.soft, border: `2px solid ${r.isMe ? GOLD : KID.navy.border}`, color: T.accentDeep, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16 }}>
              {String(r.name || "?").slice(0, 1)}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: r.isMe ? KID.gold.color : T.accentDeep, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
            <div style={{ height: height[r.rank] || 64, borderRadius: "16px 16px 6px 6px", background: r.rank === 1 ? GOLD : r.rank === 2 ? KID.sky.fill : KID.navy.fill, color: r.rank === 1 ? "#25476a" : "#fff", display: "grid", placeItems: "center", fontSize: 21, fontWeight: 900, boxShadow: r.isMe ? `0 0 0 3px ${GOLD}` : "none" }}>
              <span>{r.rank === 1 && <FiAward size={17} style={{ display: "block", margin: "0 auto" }} />}{r.place}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  };
}

function Boards({ overall, boards = [], childName, who }) {
  const all = [...(overall?.length ? [{ key: "overall", label: "Overall", rows: overall }] : []), ...boards.filter((b) => b.rows.length)];
  const [key, setKey] = useState(null);
  if (!all.length) return <HowItWorks childName={childName} />;
  const board = all.find((b) => b.key === key) || all[0];
  const rows = board.rows.map((r) => (r.isMe && childName ? { ...r, name: childName } : r));
  const { tops, node } = podiumOf(rows);
  const rest = rows.filter((r) => !tops.includes(r));
  const mine = rows.some((r) => r.isMe);
  const note = board.key === "overall" || mine ? null
    : board.standing?.band ? `${who.subject} ${board.standing.band.toLowerCase().replace(" of the class", "")} on this board.`
      : `${childName ? `${childName} isn't` : "You aren't"} on this board yet.`;
  return (
    <section style={card()}>
      <KidHeading icon={FiUsers} tone={KID.navy} sub={`The top three, and the learners around ${who.around}.`}>Leaderboards</KidHeading>
      {all.length > 1 && (
        <div role="tablist" aria-label="Leaderboards" className="rk-scroll" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {all.map((b) => {
            const on = b.key === board.key;
            return <button key={b.key} type="button" role="tab" aria-selected={on} className="rk-tab" onClick={() => setKey(b.key)} style={{ padding: "7px 13px", borderRadius: 999, border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "#fff", color: on ? "#fff" : T.accentDeep, fontWeight: 800, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{b.label}</button>;
          })}
        </div>
      )}
      {node}
      {rest.length > 0 && (
        <ol style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 6 }}>
          {rest.map((r) => (
            <li key={`${r.rank}-${r.name}`}>
              {r.gapBefore && <div style={{ textAlign: "center", color: T.inkFaint, fontWeight: 900, letterSpacing: 3, margin: "2px 0 6px" }}>· · ·</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 14, background: r.isMe ? KID.gold.soft : "#F7F9FC", border: `1.5px solid ${r.isMe ? KID.gold.border : T.border}` }}>
                <span style={{ width: 44, fontSize: 15, fontWeight: 900, color: T.accentMid }}>{r.place}</span>
                <span style={{ fontSize: 14, fontWeight: r.isMe ? 900 : 700, color: T.accentDeep }}>{r.name}</span>
                {r.isMe && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 900, color: KID.gold.color }}>{childName ? "YOUR CHILD" : "YOU"}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {note && <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 700, color: T.inkMuted }}>{note}</p>}
    </section>
  );
}

// ---- How the score is made ------------------------------------------------------------------------
function Parts({ parts, who }) {
  return (
    <section style={card()}>
      <KidHeading icon={FiBarChart2} tone={KID.sky} sub={`What makes up ${who.possessiveLower} score. The dark line on each bar is the class average.`}>How the score is made</KidHeading>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "100%" }}>
        {parts.map((p) => (
          <div key={p.key}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: T.accentDeep }}>{p.label} <span style={{ fontWeight: 700, color: T.inkFaint, fontSize: 12 }}>· {p.weight}%</span></span>
              <span style={{ fontSize: 13, fontWeight: 900, color: p.level ? T.accentMid : T.inkFaint }}>{p.level || "Nothing yet"}</span>
            </div>
            <div style={{ position: "relative", height: 16, borderRadius: 999, background: "#EEF2F7" }}>
              {p.value != null && <div style={{ width: `${Math.max(3, p.value)}%`, height: "100%", borderRadius: 999, background: p.value >= 80 ? KID.navy.fill : p.value >= 60 ? KID.sky.fill : GOLD }} />}
              {p.classAverage != null && (
                <span title="Class average" style={{ position: "absolute", top: -4, left: `calc(${p.classAverage}% - 1.5px)`, width: 3, height: 24, borderRadius: 2, background: T.accentDeep, opacity: 0.6 }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- Badges ---------------------------------------------------------------------------------------
const BADGE_ICONS = { flag: FiFlag, award: FiAward, star: FiStar, trending: FiTrendingUp, calendar: FiCalendar, clock: FiClock, check: FiCheckCircle, zap: FiZap, target: FiTarget };

function Badges({ badges = [], childName }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section style={card()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <KidHeading icon={FiAward} tone={KID.gold} sub={earned ? "Earned this term — the rest show how to earn them." : "Badges are earned this term — here's how."}>Badges</KidHeading>
        {badges.length > 0 && <div style={{ minWidth: 200, flex: "0 1 300px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: T.accentDeep, marginBottom: 6 }}><span>{earned} of {badges.length} earned</span></div>
          <div style={{ height: 10, borderRadius: 999, background: "#EEF2F7" }}><div style={{ width: `${(earned / badges.length) * 100}%`, height: "100%", borderRadius: 999, background: GOLD }} /></div>
        </div>}
      </div>
      <div className="rk-badges">
        {badges.map((b) => {
          const Icon = BADGE_ICONS[b.icon] || FiAward;
          const gold = b.key === "top_of_class";
          return (
            <div key={b.key} title={b.description} style={{ padding: "16px 10px 14px", borderRadius: 18, textAlign: "center", background: b.earned ? (gold ? KID.gold.soft : KID.sky.soft) : "#F7F9FC", border: `1.5px solid ${b.earned ? (gold ? KID.gold.border : KID.sky.border) : T.border}` }}>
              <span style={{ width: 52, height: 52, margin: "0 auto 10px", borderRadius: "50%", display: "grid", placeItems: "center", background: b.earned ? (gold ? GOLD : KID.sky.fill) : "#E8ECF4", color: b.earned ? (gold ? "#25476a" : "#fff") : T.inkFaint, boxShadow: b.earned ? "0 6px 16px rgba(46,125,181,0.25)" : "none" }}>
                {b.earned ? <Icon size={22} /> : <FiLock size={17} />}
              </span>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: b.earned ? T.accentDeep : T.inkMuted }}>{b.label}</div>
              <div style={{ fontSize: 11.5, color: T.inkMuted, marginTop: 4, lineHeight: 1.35, fontWeight: 600 }}>{b.earned ? (b.detail || "Earned") : b.description}</div>
            </div>
          );
        })}
      </div>
      {!earned && <p style={{ margin: "14px 0 0", fontSize: 13, color: T.inkMuted, fontWeight: 600 }}>{childName ? `${childName}'s` : "Your"} first badge is closer than it looks — coming to every session for a week earns one.</p>}
    </section>
  );
}

// ---- The term so far --------------------------------------------------------------------------------
function Trend({ trend, classAverageScore, termLabel }) {
  const points = trend.filter((t) => t.score != null).map((t) => ({ week: formatWeek(t.week), score: Math.round(t.score), place: t.rank }));
  return (
    <section style={card()}>
      <KidHeading icon={FiTrendingUp} tone={KID.sky} sub={`Week by week, ${termLabel}.${classAverageScore != null ? ` The dashed line is the class average (${Math.round(classAverageScore)}).` : ""}`}>The term so far</KidHeading>
      {points.length < 2 ? (
        <EmptyState icon={FiTrendingUp}>The line appears after a second week — check back next week.</EmptyState>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 10, right: 16, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="rkScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={KID.sky.fill} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={KID.sky.fill} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: T.inkMuted }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: T.inkMuted }} />
              <Tooltip formatter={(v, name) => [name === "score" ? `${v} / 100` : ordinal(v), name === "score" ? "Score" : "Place"]} />
              {classAverageScore != null && <ReferenceLine y={Math.round(classAverageScore)} stroke={T.accentDeep} strokeDasharray="5 5" strokeOpacity={0.5} />}
              <Area type="monotone" dataKey="score" stroke={KID.sky.fill} strokeWidth={3} fill="url(#rkScore)" dot={{ r: 4, fill: "#fff", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

// ---- Page -------------------------------------------------------------------------------------------
export default function PositionView({ childName = null }) {
  const [classId, setClassId] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["rankings", "me", classId], queryFn: () => rankingsApi.mine(classId) });
  const who = wordsFor(childName);
  const news = useNews(data?.learnerId, data?.classId, data?.badges || [], data?.me?.movement ?? null);
  const wrap = (children) => <div className="rk-page"><LayoutStyles />{!childName && <PageSwitch />}{children}</div>;
  const notice = (icon, text) => wrap(<section style={cardStyle({ padding: 24 })}><EmptyState icon={icon}>{text}</EmptyState></section>);

  if (isLoading) return wrap(<SkeletonPage />);
  if (error) return notice(FiClipboard, "The class position can't be shown right now.");
  if (!data?.classes?.length) return notice(FiUsers, `${childName ? `${childName} isn't` : "You aren't"} in a class yet. The class position shows here once ${childName ? "they join" : "you join"} one.`);
  if (data.disabled) return notice(FiUsers, `Class positions aren't shown for ${data.className}.`);
  if (data.notInClass || !data.me) return notice(FiUsers, "Nothing to show for this class yet.");

  const showGoal = !data.me.standing || data.me.isTop || Boolean(data.me.next);
  return wrap(
    <>
      <Hero data={data} who={who} onClass={setClassId} />
      <Celebrate fresh={news.fresh} movedUp={news.movedUp} onClose={news.dismiss} childName={childName} />
      <ScoreExplainer parts={data.me.parts} minMarked={data.minMarked} minClass={data.minClass} forChild={childName} />
      <div className="rk-grid">
        {showGoal && <div className="rk-s5"><Goal data={data} who={who} /></div>}
        <div className={showGoal ? "rk-s7" : "rk-s12"}><NextSteps steps={data.nextSteps} who={who} /></div>
        <div className="rk-s5"><Boards overall={data.leaderboard} boards={data.boards} childName={childName} who={who} /></div>
        <div className="rk-s7"><Parts parts={data.me.parts} who={who} /></div>
        <div className="rk-s12"><Badges badges={data.badges} childName={childName} /></div>
        {data.trend.filter((t) => t.score != null).length >= 2 && <div className="rk-s12"><Trend trend={data.trend} classAverageScore={data.classAverageScore} termLabel={data.term.label} /></div>}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, lineHeight: 1.5 }}>
        Updated {timeAgo(data.computedAt)}.{data.trend.filter((t) => t.score != null).length < 2 ? " The week-by-week line appears from next week." : ""} Other learners are shown by first name only, and never the bottom of the class.
      </p>
    </>,
  );
}
