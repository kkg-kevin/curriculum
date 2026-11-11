import { FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiTrendingUp, FiUsers } from "react-icons/fi";
import { Card, DataTable, Empty, LEVELS, LevelLegend, LevelStack, Note, Stat, T, fmtNum } from "./ui";

// Learner growth (10 Nov 2026; server analytics.growth.js): where each learner started (their first
// marked diagnostic) against where their marked work is now (the last 90 days of the period), in
// the report's four level words. The strongest number to show schools and families.

const labelOf = (key) => LEVELS.find((l) => l.key === key)?.label || key;
const fillOf = (key) => LEVELS.find((l) => l.key === key)?.fill || T.track;
const darkText = (key) => key === "track" || key === "strong";

function LevelChip({ level }) {
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: fillOf(level), color: darkText(level) ? "#fff" : T.ink, whiteSpace: "nowrap" }}>{labelOf(level)}</span>;
}

function Move({ n }) {
  const Icon = n > 0 ? FiArrowUpRight : n < 0 ? FiArrowDownRight : FiArrowRight;
  const color = n > 0 ? T.mid : n < 0 ? "#B87708" : T.faint;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 800, color }}><Icon size={14} aria-hidden />{n > 0 ? `+${n}` : n} pts</span>;
}

export default function GrowthTab({ data, links }) {
  if (!data.learners) {
    return (
      <Card>
        <Empty>
          No learner has both a marked diagnostic and marked work since in this view.
          {data.startOnly ? ` ${data.startOnly} took a diagnostic but have no marked work in the last ${data.windowDays} days yet.` : ""}
        </Empty>
      </Card>
    );
  }
  const max = Math.max(1, ...data.matrix.flatMap((r) => Object.values(r.to)));

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiUsers} label="Learners measured" value={fmtNum(data.learners)} sub={data.startOnly ? `${data.startOnly} more with no work since` : null} />
        <Stat icon={FiArrowUpRight} label="Moved up a level" value={`${Math.round((data.movedUp / data.learners) * 100)}%`} sub={`${data.movedUp} of ${data.learners}`} tone="mid" />
        <Stat icon={FiTrendingUp} label="Average change" value={data.averageChange == null ? "–" : `${data.averageChange > 0 ? "+" : ""}${data.averageChange} pts`} sub={`${data.averageStart}% → ${data.averageNow}%`} tone={data.averageChange >= 0 ? "mid" : "gold"} />
        <Stat icon={FiArrowDownRight} label="Moved down" value={fmtNum(data.movedDown)} tone="gold" />
      </div>

      <div className="an-two">
        <Card title="Where they started, where they are">
          <LevelLegend />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
            <div>
              <p style={{ margin: "0 0 5px", fontSize: 12.5, fontWeight: 800, color: T.muted }}>Start (diagnostic)</p>
              <LevelStack levels={data.startLevels} height={18} showCounts />
            </div>
            <div>
              <p style={{ margin: "0 0 5px", fontSize: 12.5, fontWeight: 800, color: T.muted }}>Now (last {data.windowDays} days)</p>
              <LevelStack levels={data.nowLevels} height={18} showCounts />
            </div>
          </div>
        </Card>
        <Card title="Moves between levels">
          <div className="an-table-wrap">
            <table style={{ borderCollapse: "separate", borderSpacing: 4, fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", color: T.faint, fontWeight: 700 }}>Start ↓ / Now →</th>
                  {LEVELS.map((l) => <th key={l.key} style={{ color: T.muted, fontWeight: 700 }}>{l.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row) => (
                  <tr key={row.from}>
                    <td style={{ fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{labelOf(row.from)}</td>
                    {LEVELS.map((l) => {
                      const n = row.to[l.key];
                      const up = LEVELS.findIndex((x) => x.key === l.key) > LEVELS.findIndex((x) => x.key === row.from);
                      const same = l.key === row.from;
                      const base = up ? "46, 125, 181" : same ? "140, 148, 163" : "184, 119, 8";
                      return (
                        <td key={l.key} title={`${n} from ${labelOf(row.from)} to ${l.label}`}
                          style={{ textAlign: "center", borderRadius: 8, padding: "9px 4px", fontWeight: 800, background: n ? `rgba(${base}, ${0.12 + 0.6 * (n / max)})` : "#F5F6F8", color: n ? T.ink : T.faint }}>
                          {n || "·"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>Blue moved up, grey stayed, gold moved down.</Note>
        </Card>
      </div>

      <DataTable
        title="By class"
        columns={[
          { key: "label", label: "Class", render: (r) => [r.label, r.hubName].filter(Boolean).join(" · "), csv: (r) => [r.label, r.hubName].filter(Boolean).join(" · ") },
          { key: "learners", label: "Learners", align: "num" },
          { key: "start", label: "Start", align: "num", render: (r) => `${r.start}%` },
          { key: "now", label: "Now", align: "num", render: (r) => `${r.now}%` },
          { key: "change", label: "Change", align: "num", render: (r) => <Move n={r.change} />, csv: (r) => r.change },
          { key: "up", label: "Moved up", align: "num" },
        ]}
        rows={data.byClass.map((r, i) => ({ ...r, key: `${r.label}-${i}` }))}
        filename="growth-by-class.csv"
        initialSort={{ key: "change", dir: "desc" }}
      />
      <DataTable
        title="Learners"
        columns={[
          { key: "name", label: "Learner", render: (r) => <button type="button" className="an-link" onClick={() => links.learner(r.learnerId)}>{r.name}</button>, csv: (r) => r.name },
          { key: "className", label: "Class", render: (r) => r.className || "–" },
          { key: "startLevel", label: "Start", render: (r) => <LevelChip level={r.startLevel} />, csv: (r) => `${labelOf(r.startLevel)} (${r.startPercent}%)`, sort: (r) => r.startPercent },
          { key: "nowLevel", label: "Now", render: (r) => <LevelChip level={r.nowLevel} />, csv: (r) => `${labelOf(r.nowLevel)} (${r.nowPercent}%)`, sort: (r) => r.nowPercent },
          { key: "change", label: "Change", align: "num", render: (r) => <Move n={r.change} />, csv: (r) => r.change },
          { key: "pieces", label: "Pieces marked", align: "num" },
        ]}
        rows={data.rows}
        filename="learner-growth.csv"
        initialSort={{ key: "change", dir: "desc" }}
        limit={20}
      />
      <Note>Start is a learner&apos;s first marked diagnostic (website or portal). Now puts together their marked work, not diagnostics, in the {data.windowDays} days up to the end of the period.</Note>
    </>
  );
}
