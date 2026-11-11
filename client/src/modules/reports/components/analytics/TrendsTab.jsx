import { FiAward, FiCalendar, FiCheckCircle, FiClock, FiUsers } from "react-icons/fi";
import { DataTable, Note, T, TrendLine, fmtNum, fmtPct } from "./ui";

// Trends (10 Nov 2026; server analytics.trends.js): the key figures month by month for the 12
// months up to the end of the period, so a change reads as a direction. Each card: this month,
// its change on last month, and the line.
export default function TrendsTab({ data }) {
  const m = data.months;
  return (
    <>
      <div className="an-three">
        <TrendLine points={m} valueKey="onTime" label="Handed in on time" icon={FiClock} />
        <TrendLine points={m} valueKey="score" label="Average score" icon={FiAward} color={T.mid} />
        <TrendLine points={m} valueKey="attendance" label="Attendance" icon={FiCalendar} color={T.sky} />
        <TrendLine points={m} valueKey="active" label="Learners handing in work" icon={FiUsers} format={(v) => fmtNum(v)} suffix="" max={null} color={T.navy} />
        {data.showMentors && <TrendLine points={m} valueKey="mentors" label="Mentors meeting every standard" icon={FiCheckCircle} color="#B87708" />}
      </div>
      <DataTable
        title="Month by month"
        columns={[
          { key: "label", label: "Month", sort: (r) => r.month },
          { key: "onTime", label: "On time", align: "num", render: (r) => fmtPct(r.onTime) },
          { key: "score", label: "Average score", align: "num", render: (r) => fmtPct(r.score) },
          { key: "attendance", label: "Attendance", align: "num", render: (r) => fmtPct(r.attendance) },
          { key: "active", label: "Handing in", align: "num", render: (r) => fmtNum(r.active) },
          ...(data.showMentors ? [{ key: "mentors", label: "Mentors at standard", align: "num", render: (r) => fmtPct(r.mentors) }] : []),
        ]}
        rows={[...m].reverse().map((r) => ({ ...r, key: r.month }))}
        filename="trends-by-month.csv"
        limit={12}
      />
      <Note>The last 12 months up to the end of the period you picked. The other filters apply.</Note>
    </>
  );
}
