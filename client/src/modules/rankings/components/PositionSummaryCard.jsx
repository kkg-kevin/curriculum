import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowDown, FiArrowRight, FiArrowUp, FiAward, FiClock, FiFlag, FiMinus, FiTarget, FiTrendingUp } from "react-icons/fi";
import { KID, T, cardStyle } from "../../learner-portal/components/profile/theme";
import { rankingsApi } from "../services/rankingsApi";

// The learner dashboard's "My class position" card — only the key things: their place (or band,
// or how close they are to getting one), score and level, movement since last week, points to the
// next place, the one next step, their on-time streak and newest badge. Everything else is on My
// class position. Shows nothing when rankings are off for their class or they have no class.
// UX pass (19 Nov 2026): a light card with one gold accent — the dashboard already opens with two
// banners (welcome, Progress Arc), so this one doesn't add a third. Same query as My class position.

const GOLD = "#feb139";
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function Movement({ movement }) {
  if (movement == null) return null;
  const up = movement > 0;
  const Icon = movement === 0 ? FiMinus : up ? FiArrowUp : FiArrowDown;
  const text = movement === 0 ? "Same place as last week" : `${up ? "Up" : "Down"} ${Math.abs(movement)} since last week`;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, background: up ? KID.gold.soft : "#F3F4F6", border: `1px solid ${up ? KID.gold.border : T.border}`, color: up ? KID.gold.color : T.inkMuted, fontSize: 12.5, fontWeight: 800 }}><Icon size={13} />{text}</span>;
}

function Chip({ icon: Icon, gold = false, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: gold ? KID.gold.soft : KID.sky.soft, border: `1.5px solid ${gold ? KID.gold.border : KID.sky.border}`, color: T.accentDeep, fontSize: 13, fontWeight: 800 }}>
      <Icon size={14} color={gold ? KID.gold.color : KID.sky.color} />{children}
    </span>
  );
}

export default function PositionSummaryCard({ classId = null }) {
  const { data } = useQuery({ queryKey: ["rankings", "me", classId], queryFn: () => rankingsApi.mine(classId), staleTime: 60 * 1000 });
  if (!data?.me || data.disabled || data.notInClass) return null;
  const { me } = data;
  const s = me.standing;
  const podium = s?.exact && s.rank <= 3;
  const step = data.nextSteps?.[0];
  const newest = (data.badges || []).filter((b) => b.earned).sort((a, b) => new Date(b.earnedAt || 0) - new Date(a.earnedAt || 0))[0];
  const others = (data.classes?.length || 1) - 1;
  const headline = s?.exact ? (s.rank === 1 ? "You're top of the class!" : `You're ${ordinal(s.rank)} of ${data.rankedCount}`)
    : s ? s.band : me.eligible ? "Places are on their way" : "Getting on the board";
  const toBoard = Math.min(me.markedCount, data.minMarked);

  return (
    <section aria-label="My class position" style={{ ...cardStyle({ padding: 0, overflow: "hidden" }), borderColor: podium ? KID.gold.border : T.border }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${GOLD}, #38aae1)` }} />
      <div style={{ padding: "18px 22px", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ width: 66, height: 66, borderRadius: "50%", background: s?.exact ? (s.rank === 1 ? GOLD : podium ? KID.sky.fill : KID.navy.fill) : KID.sky.soft, border: s?.exact ? 0 : `2px solid ${KID.sky.border}`, color: s?.exact ? (s.rank === 1 ? "#25476a" : "#fff") : KID.sky.color, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 20, flexShrink: 0, boxShadow: podium ? "0 8px 20px rgba(254,177,57,0.3)" : "none" }}>
          {s?.exact ? ordinal(s.rank) : s ? <FiTrendingUp size={26} /> : <FiTarget size={26} />}
        </span>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted }}>My class position · {data.className}{others > 0 ? ` · +${others} more` : ""}</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: T.accentDeep, lineHeight: 1.2, margin: "2px 0 6px" }}>{headline}</div>
          {me.movement != null ? <Movement movement={me.movement} /> : !me.eligible ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 320 }}>
              <span style={{ flex: 1, height: 8, borderRadius: 999, background: "#EEF2F7" }}><span style={{ display: "block", width: `${(toBoard / data.minMarked) * 100}%`, height: "100%", borderRadius: 999, background: KID.sky.fill }} /></span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted, whiteSpace: "nowrap" }}>{toBoard} of {data.minMarked} marked</span>
            </div>
          ) : null}
        </div>
        <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: 16, background: KID.navy.soft, border: `1.5px solid ${KID.navy.border}`, minWidth: 82 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.06em", color: T.inkMuted }}>SCORE</div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, color: T.accentDeep }}>{me.score == null ? "—" : Math.round(me.score)}</div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.accentMid }}>{me.level || "out of 100"}</div>
        </div>
      </div>
      <div style={{ padding: "0 22px 18px", display: "grid", gap: 12, gridTemplateColumns: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {me.isTop ? <Chip icon={FiAward} gold>Top of the class — keep it up</Chip>
            : me.next ? <Chip icon={FiFlag} gold>{me.next.points} points to {me.next.toPlace ? `reach ${me.next.toPlace}` : "move up a place"}</Chip>
              : null}
          {me.streaks?.onTime > 0 && <Chip icon={FiClock}>{me.streaks.onTime} on time in a row</Chip>}
          {newest && <Chip icon={FiAward}>Latest badge: {newest.label}</Chip>}
        </div>
        {step && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 14, background: "#F7F9FC", border: `1.5px solid ${T.border}` }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: GOLD, color: "#25476a", display: "grid", placeItems: "center", flexShrink: 0 }}><FiTarget size={14} /></span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.5 }}><strong>Next step:</strong> {step.text}</span>
          </div>
        )}
        <Link to="/learner-portal/position" className="rk-pill" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: T.accent, color: "#fff", fontWeight: 800, fontSize: 13.5, textDecoration: "none" }}>
          See my class position <FiArrowRight />
        </Link>
      </div>
    </section>
  );
}
