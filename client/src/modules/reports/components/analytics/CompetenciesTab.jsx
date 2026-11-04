import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { BarList, Card, DataTable, Empty, LEVELS, LevelLegend, LevelStack, Note, Stat, T, fmtNum, fmtPct } from "./ui";

const monthLabel = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-KE", { month: "short", year: "numeric" });
const levelLabel = (key) => LEVELS.find((l) => l.key === key)?.label || key;

function CompetencyCard({ c, groupLabel, links, filenameBase }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("indicators");
  const tabs = [
    { key: "indicators", label: "Indicators" },
    { key: "group", label: `By ${groupLabel.toLowerCase()}` },
    { key: "gender", label: "By gender" },
    { key: "stage", label: "By stage" },
    { key: "learners", label: "Learners" },
  ];
  const compare = (rows) => <BarList rows={rows.map((r) => ({ key: r.key, label: r.label, value: r.average ?? 0, extra: `${fmtNum(r.learners)} learner${r.learners === 1 ? "" : "s"}` }))} max={100} format={(v) => `${v}%`} color={T.navy} />;
  return (
    <Card>
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>{c.name}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12.5, color: T.muted }}>
            <strong style={{ color: T.ink, fontSize: 15 }}>{fmtPct(c.average)}</strong> average · {fmtNum(c.learners)} learners
            {open ? <FiChevronUp /> : <FiChevronDown />}
          </span>
        </div>
        <LevelStack levels={c.levels} height={14} showCounts />
      </button>
      {open && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <div className="ui-tab-scroll" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setView(t.key)}
                style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${view === t.key ? T.navy : T.border}`, background: view === t.key ? T.navy : "#fff", color: view === t.key ? "#fff" : T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
          {view === "indicators" && (
            c.indicators.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {c.indicators.map((i) => (
                  <div key={i.indicatorId}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ color: T.ink, fontWeight: 600 }}>{i.name}</span>
                      <span style={{ color: T.ink, fontWeight: 800, flexShrink: 0 }}>{fmtPct(i.average)} <span style={{ color: T.faint, fontWeight: 600 }}>· {fmtNum(i.learners)}</span></span>
                    </div>
                    <LevelStack levels={i.levels} height={9} />
                  </div>
                ))}
                <Note>Weakest first. Hover a bar for how many learners are at each level.</Note>
              </div>
            ) : <Empty>No indicator marks.</Empty>
          )}
          {view === "group" && compare(c.byGroup)}
          {view === "gender" && compare(c.byGender)}
          {view === "stage" && compare(c.byStage)}
          {view === "learners" && (
            <DataTable
              columns={[
                { key: "name", label: "Learner", render: (r) => <button type="button" className="an-link" onClick={() => links.learner(r.learnerId)}>{r.name}</button>, csv: (r) => r.name },
                { key: "group", label: groupLabel },
                { key: "percent", label: "Score", align: "num", render: (r) => `${r.percent}%` },
                { key: "level", label: "Level", render: (r) => levelLabel(r.level), csv: (r) => levelLabel(r.level), sort: (r) => r.percent },
              ]}
              rows={c.learnerRows}
              total={c.learners}
              filename={`${filenameBase}-${c.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-learners.csv`}
              initialSort={{ key: "percent", dir: "asc" }}
              limit={10}
            />
          )}
        </div>
      )}
    </Card>
  );
}

export default function CompetenciesTab({ data, links }) {
  const h = data.headline;
  if (!data.competencies.length) return <Card><Empty>No competency marks in this period — they come from marked work whose questions are linked to indicators. Try a longer period.</Empty></Card>;
  const totalPairs = Object.values(h.levels).reduce((s, n) => s + n, 0);
  const share = (key) => (totalPairs ? Math.round((h.levels[key] / totalPairs) * 100) : 0);

  return (
    <>
      <div className="an-stats">
        <Stat label="Learners assessed" value={fmtNum(h.learnersAssessed)} sub={`${fmtPct(h.assessedPercent)} of ${fmtNum(h.learnerCount)} learners`} />
        <Stat label="Average across competencies" value={fmtPct(h.average)} sub={`From ${fmtNum(h.markedPieces)} marked pieces`} />
        <Stat label="On track or better" value={`${share("track") + share("strong")}%`} sub="Of learner × competency results" />
        <Stat label="Strongest" value={<span style={{ fontSize: 16 }}>{h.strongest || "—"}</span>} />
        <Stat label="Needs most work" value={<span style={{ fontSize: 16 }}>{h.weakest || "—"}</span>} />
      </div>

      <Card title="Every competency at a glance" subtitle="How many learners sit at each level — open one for its indicators, comparisons and learners">
        <LevelLegend />
      </Card>
      {data.competencies.map((c) => <CompetencyCard key={c.competencyId} c={c} groupLabel={data.groupLabel} links={links} filenameBase="competency" />)}

      {data.months.length > 1 && (
        <DataTable
          title="Month by month"
          subtitle="Average per competency, from the work marked that month"
          columns={[
            { key: "name", label: "Competency" },
            ...data.months.map((m) => ({ key: m, label: monthLabel(m), align: "num", render: (r) => fmtPct(r[m]), sort: (r) => r[m] })),
          ]}
          rows={data.trend.map((t) => ({ key: t.competencyId, name: t.name, ...Object.fromEntries(t.points.map((p) => [p.month, p.average])) }))}
          filename="competencies-by-month.csv"
          limit={50}
        />
      )}
      <DataTable
        title="Summary table"
        columns={[
          { key: "name", label: "Competency" },
          { key: "learners", label: "Learners", align: "num" },
          { key: "average", label: "Average", align: "num", render: (r) => fmtPct(r.average) },
          ...LEVELS.map((l) => ({ key: l.key, label: l.label, align: "num", render: (r) => fmtNum(r.levels[l.key]), csv: (r) => r.levels[l.key], sort: (r) => r.levels[l.key] })),
        ]}
        rows={data.competencies.map((c) => ({ ...c, key: c.competencyId }))}
        filename="competencies.csv"
        limit={50}
      />
      <Note>Each learner's result per competency puts together their marks on its indicators from the work marked in the period (at most 100%). The curriculum's evidence weights aren't applied, so a learner's own profile can differ a little.</Note>
    </>
  );
}
