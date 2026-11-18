import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowDown, FiArrowRight, FiArrowUp, FiAward, FiCalendar, FiCheckCircle, FiClock, FiFlag, FiStar, FiTarget, FiTrendingUp, FiZap } from "react-icons/fi";
import { KID, KidHeading, T, cardStyle } from "../../learner-portal/components/profile/theme";
import { rankingsApi } from "../services/rankingsApi";

// The profile Overview's "This term" strip (19 Nov 2026) — only the key things: the badges earned
// this term, and the place in each class (families: exact in the top half, a band below; staff:
// every place). On the learner's own profile, a parent's view of a child (`linkTo` their position
// page) and the staff learner page (`learnerId`, no link). Shows nothing until there is something.

const GOLD = "#feb139";
const ICONS = { flag: FiFlag, award: FiAward, star: FiStar, trending: FiTrendingUp, calendar: FiCalendar, clock: FiClock, check: FiCheckCircle, zap: FiZap, target: FiTarget };
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

function placeText(c) {
  if (c.rank) return `${ordinal(c.rank)} of ${c.rankedCount}`;
  if (c.band) return c.band;
  if (!c.eligible) return `${Math.max(0, c.minMarked - c.markedCount)} more marked to get a place`;
  return "Places on their way";
}

export default function ThisTermStrip({ learnerId = null, linkTo = null }) {
  const staff = Boolean(learnerId);
  const { data } = useQuery({
    queryKey: ["rankings", "summary", learnerId || "me"],
    queryFn: () => (staff ? rankingsApi.learnerSummary(learnerId) : rankingsApi.summary()),
    staleTime: 60 * 1000,
  });
  if (!data?.classes?.length) return null;
  const period = data.classes[0].period;

  return (
    <section style={cardStyle({ padding: 20 })}>
      <KidHeading icon={FiAward} tone={KID.gold} sub={`${period} — badges and place in each class.`}
        action={linkTo ? <Link to={linkTo} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.accentMid, fontWeight: 800, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>Class position <FiArrowRight /></Link> : null}>
        This term
      </KidHeading>
      <div className="tt-strip" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted, marginBottom: 8 }}>Badges earned · {data.badges.length} of {data.badgeCount}</div>
          {!data.badges.length ? (
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T.inkMuted, lineHeight: 1.5 }}>No badges yet this term — coming to every session for a week earns the first one.</p>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.badges.map((b) => {
                const Icon = ICONS[b.icon] || FiAward;
                const gold = b.key === "top_of_class";
                return (
                  <span key={b.key} title={b.detail || b.className} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 999, background: gold ? KID.gold.soft : KID.sky.soft, border: `1.5px solid ${gold ? KID.gold.border : KID.sky.border}`, fontSize: 13, fontWeight: 800, color: T.accentDeep }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: gold ? GOLD : KID.sky.fill, color: gold ? "#25476a" : "#fff", display: "grid", placeItems: "center" }}><Icon size={13} /></span>
                    {b.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.inkMuted }}>Place in each class</div>
          {data.classes.map((c) => {
            const Arrow = c.movement > 0 ? FiArrowUp : c.movement < 0 ? FiArrowDown : null;
            return (
              <div key={c.classId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 14, background: "#F7F9FC", border: `1.5px solid ${T.border}` }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: c.rank === 1 ? GOLD : c.rank ? KID.sky.fill : "#E8ECF4", color: c.rank === 1 ? "#25476a" : c.rank ? "#fff" : T.inkFaint, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                  {c.rank ? ordinal(c.rank) : <FiTarget size={15} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: T.accentDeep, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.className}{staff && c.hiddenFromFamily ? <span style={{ fontWeight: 600, color: T.inkFaint, fontSize: 11.5 }}> · hidden from the family</span> : null}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    {placeText(c)}
                    {Arrow && <span style={{ display: "inline-flex", alignItems: "center", color: c.movement > 0 ? T.accentMid : KID.gold.color }}>· <Arrow size={12} />{Math.abs(c.movement)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: T.accentDeep, lineHeight: 1 }}>{c.score == null ? "—" : Math.round(c.score)}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.inkMuted }}>{c.level || "score"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
