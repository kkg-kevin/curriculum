import { FiClipboard, FiClock, FiEdit3, FiSend } from "react-icons/fi";
import { BarList, Card, Columns, DataTable, Delta, Empty, Note, Stat, T, fmtHours, fmtNum, fmtPct } from "./ui";

const STAGES = [
  { key: "issuedToStart", label: "Issued to started", help: "How long before learners open the work" },
  { key: "startToHandIn", label: "Started to handed in", help: "From opening it to handing it in" },
  { key: "handInToMarked", label: "Handed in to marked", help: "Marking turnaround (work marked by hand)" },
  { key: "markedToReleased", label: "Marked to released", help: "From marking to the learner seeing it" },
];
const weekLabel = (w) => `w/c ${new Date(`${w}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;

export default function TimeToTaskTab({ data, links, isHub }) {
  const s = data.summary;
  const t = s.timing;
  const p = data.previous;
  const decided = t.on_time + t.late + t.missed;

  if (!s.tasks) return <Card><Empty>No work was issued in this period. Try a longer period.</Empty></Card>;

  const rowColumns = (labelHeader) => [
    { key: "label", label: labelHeader },
    { key: "tasks", label: "Learner tasks", align: "num", render: (r) => fmtNum(r.tasks) },
    { key: "handedInPercent", label: "Handed in", align: "num", render: (r) => fmtPct(r.handedInPercent) },
    { key: "onTimePercent", label: "On time", align: "num", render: (r) => fmtPct(r.onTimePercent) },
    { key: "missed", label: "Missed", align: "num" },
    { key: "medianIssuedToHandInHours", label: "Issued to handed in", align: "num", render: (r) => fmtHours(r.medianIssuedToHandInHours) },
    { key: "medianMarkingHours", label: "Marking", align: "num", render: (r) => fmtHours(r.medianMarkingHours) },
  ];

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiClipboard} label="Learner tasks" value={fmtNum(s.tasks)} delta={<Delta now={s.tasks} before={p.tasks} />} />
        <Stat icon={FiSend} label="Issued to handed in" value={fmtHours(s.issuedToHandIn.medianHours)} tone="mid"
          delta={p.issuedToHandInMedianHours != null && s.issuedToHandIn.medianHours != null ? <Delta now={s.issuedToHandIn.medianHours} before={p.issuedToHandInMedianHours} suffix=" h" betterWhenLower /> : null} />
        <Stat icon={FiEdit3} label="Marking turnaround" value={fmtHours(s.handInToMarked.medianHours)} sub={`${fmtNum(s.handInToMarked.count)} marked by hand`} tone="gold"
          delta={p.handInToMarkedMedianHours != null && s.handInToMarked.medianHours != null ? <Delta now={s.handInToMarked.medianHours} before={p.handInToMarkedMedianHours} suffix=" h" betterWhenLower /> : null} />
        <Stat icon={FiClock} label="Handed in on time" value={fmtPct(t.onTimePercent)} sub={decided ? `${fmtNum(t.on_time)} of ${fmtNum(decided)}` : "No due dates passed yet"} tone="sky"
          delta={p.onTimePercent != null && t.onTimePercent != null ? <Delta now={t.onTimePercent} before={p.onTimePercent} suffix=" pts" /> : null} />
      </div>

      <div className="an-two">
        <Card title="Against the due date">
          <BarList
            max={s.tasks}
            color={T.navy}
            rows={[
              { key: "on_time", label: "Handed in on time", value: t.on_time },
              { key: "late", label: "Handed in late", value: t.late },
              { key: "missed", label: "Missed (due date passed)", value: t.missed },
              { key: "pending", label: "Not handed in yet (not due)", value: t.pending },
              { key: "no_due", label: "Handed in, no due date", value: t.no_due },
            ]}
          />
          {t.no_due + t.pending > decided && <Note>Most of this work has no due date, so on-time rates are thin. Set a due date when issuing to see them.</Note>}
        </Card>
        <Card title="Handed in, week by week">
          <Columns points={data.weekly} valueKey="handedIn" labelKey="week" labelFormat={weekLabel} color={T.navy} />
        </Card>
      </div>

      <div className="an-two">
        {STAGES.map((st) => (
          <Card key={st.key} title={st.label} subtitle={`Typical ${fmtHours(s[st.key].medianHours)}`}>
            <BarList rows={s[st.key].buckets.map((b) => ({ key: b.key, label: b.label, value: b.count }))} color={T.mid} empty="Nothing measured yet." />
          </Card>
        ))}
      </div>

      <DataTable title="By course" columns={rowColumns("Course")} rows={data.byCourse} filename="time-to-task-by-course.csv" initialSort={{ key: "tasks", dir: "desc" }} />
      <DataTable title={`By ${data.groupLabel.toLowerCase()}`} columns={rowColumns(data.groupLabel)} rows={data.byGroup} filename={`time-to-task-by-${data.groupLabel.toLowerCase()}.csv`} initialSort={{ key: "tasks", dir: "desc" }} />
      <DataTable title="By kind of assessment" columns={rowColumns("Kind")} rows={data.byType} filename="time-to-task-by-kind.csv" initialSort={{ key: "tasks", dir: "desc" }} />
      {!isHub && (
        <DataTable
          title="Marking speed by educator"
          columns={[
            { key: "label", label: "Marked by", render: (r) => (r.teacherId ? <button type="button" className="an-link" onClick={() => links.educator(r.teacherId)}>{r.label}</button> : r.label), csv: (r) => r.label },
            { key: "tasks", label: "Pieces marked", align: "num" },
            { key: "medianMarkingHours", label: "Typical turnaround", align: "num", render: (r) => fmtHours(r.medianMarkingHours) },
          ]}
          rows={data.byMarker}
          filename="marking-speed.csv"
          empty="Nothing was marked by hand in this period."
        />
      )}
      <Note>Times are between the recorded steps, not time spent on the page. Auto-marked work is left out of marking turnaround.</Note>
    </>
  );
}
