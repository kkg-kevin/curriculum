import { FiAward, FiTrendingUp, FiUsers, FiStar } from "react-icons/fi";
import { Card, DataTable, Empty, LevelLegend, LevelStack, Note, Stat, T, fmtNum } from "./ui";

// Rankings (18 Nov 2026; server rankings/ranking.reports.js): every class in the view ranked in its
// current period — how many are ranked, the class average Learning Score, how scores spread over
// the four level words, each class's top three and most improved — and the top learners and most
// improved across them. Staff see full names; families only ever see their own child's place.

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export default function RankingsTab({ data, links }) {
  if (!data.classes?.length) {
    return <Card><Empty>No class in this view has learners yet.</Empty></Card>;
  }
  const name = (r) => (links.learner ? <button type="button" onClick={() => links.learner(r.learnerId)} style={{ border: 0, background: "none", padding: 0, color: T.navy, fontWeight: 700, cursor: "pointer", font: "inherit" }}>{r.name}</button> : r.name);
  const s = data.stats;

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiUsers} label="Classes ranked" value={`${fmtNum(s.rankedClasses)} of ${fmtNum(s.classes)}`} sub="A class ranks once enough learners have marked work" />
        <Stat icon={FiAward} label="Learners ranked" value={fmtNum(s.learnersRanked)} sub={`${fmtNum(s.learnersScored)} with a score so far`} tone="mid" />
        <Stat icon={FiStar} label="Average Learning Score" value={s.averageScore == null ? "–" : Math.round(s.averageScore)} sub="Of ranked learners, out of 100" />
        <Stat icon={FiTrendingUp} label="Badges earned" value={fmtNum(s.badges)} sub="This period, all classes" tone="gold" />
      </div>
      <Note>Scores are worked out per class for its current period (Settings → Rankings): marked work, attendance, work on time, growth and competencies. A filter on dates doesn&apos;t change them.</Note>

      <Card title="How scores spread, class by class" subtitle={`Learners with a score, in the four level words.${data.classes.some((c) => !Object.values(c.levels).some(Boolean)) ? " Classes with no scores yet are left out." : ""}`}>
        <LevelLegend />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {!data.classes.some((c) => Object.values(c.levels).some(Boolean)) && <Empty>No learner has a score yet.</Empty>}
          {data.classes.filter((c) => Object.values(c.levels).some(Boolean)).map((c) => (
            <div key={c.classId}>
              <p style={{ margin: "0 0 5px", fontSize: 12.5, fontWeight: 800, color: T.muted }}>
                {[c.className, c.hubName].filter(Boolean).join(" · ")}{!c.enabled ? " · hidden from families" : ""}
              </p>
              <LevelStack levels={c.levels} height={14} showCounts />
            </div>
          ))}
        </div>
      </Card>

      <DataTable
        title="Classes"
        columns={[
          { key: "className", label: "Class", render: (r) => [r.className, r.hubName].filter(Boolean).join(" · "), csv: (r) => [r.className, r.hubName].filter(Boolean).join(" · ") },
          { key: "learners", label: "Learners", align: "num" },
          { key: "rankedCount", label: "Ranked", align: "num", render: (r) => (r.ranked ? r.rankedCount : `${r.rankedCount} (not yet)`), csv: (r) => r.rankedCount },
          { key: "averageScore", label: "Average score", align: "num", render: (r) => (r.averageScore == null ? "—" : Math.round(r.averageScore)) },
          { key: "top", label: "Top three", sort: (r) => r.top.length, render: (r) => (r.top.length ? r.top.map((t) => `${ordinal(t.rank)} ${t.name}`).join(", ") : "—"), csv: (r) => r.top.map((t) => `${t.rank}. ${t.name}`).join("; ") },
          { key: "mostImproved", label: "Most improved", sort: (r) => r.mostImproved?.change ?? null, render: (r) => (r.mostImproved ? `${r.mostImproved.name} (+${Math.round(r.mostImproved.change)} pts)` : "—"), csv: (r) => (r.mostImproved ? `${r.mostImproved.name} +${r.mostImproved.change}` : "") },
          { key: "period", label: "Period" },
        ]}
        rows={data.classes.map((c) => ({ ...c, key: c.classId }))}
        filename="rankings-by-class.csv"
        initialSort={{ key: "averageScore", dir: "desc" }}
      />

      <div className="an-two">
        <DataTable
          title="Top learners"
          subtitle="Highest Learning Scores across these classes."
          columns={[
            { key: "name", label: "Learner", render: name, csv: (r) => r.name },
            { key: "className", label: "Class" },
            { key: "rank", label: "Place", align: "num", render: (r) => (r.rank ? `${ordinal(r.rank)} of ${r.rankedCount}` : "—"), csv: (r) => r.rank },
            { key: "score", label: "Score", align: "num", render: (r) => Math.round(r.score) },
          ]}
          rows={data.topLearners.map((r) => ({ ...r, key: `${r.learnerId}-${r.className}` }))}
          filename="top-learners.csv"
          empty="Nobody is ranked yet."
          limit={10}
        />
        <DataTable
          title="Most improved"
          subtitle="Their later marked work against their earlier work this period."
          columns={[
            { key: "name", label: "Learner", render: name, csv: (r) => r.name },
            { key: "className", label: "Class" },
            { key: "growth", label: "Change", align: "num", render: (r) => `+${Math.round(r.growth)} pts` },
            { key: "level", label: "Now" },
          ]}
          rows={data.mostImproved.map((r) => ({ ...r, key: `${r.learnerId}-${r.className}` }))}
          filename="most-improved.csv"
          empty="Improvement shows once learners have 4 marked pieces."
          limit={10}
        />
      </div>
    </>
  );
}
