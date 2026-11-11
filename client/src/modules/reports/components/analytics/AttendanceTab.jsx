import { FiCalendar, FiCheckCircle, FiClock, FiUserX } from "react-icons/fi";
import { BarList, Card, Columns, DataTable, Delta, Empty, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

// Attendance (10 Nov 2026; server analytics.attendance.js): how often learners came, from the class
// registers — the rate against the period before, day by day, by weekday and by class, and the
// learners absent again and again. Excused days are left out of every rate.
const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
// Many days → weeks, each week's rate worked out from its own marks (rates can't be added up).
function byWeek(days) {
  if (days.length <= 62) return days;
  const weeks = new Map();
  for (const d of days) {
    const dt = new Date(`${d.date}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    const key = dt.toISOString().slice(0, 10);
    const w = weeks.get(key) || { date: key, attended: 0, total: 0 };
    w.attended += d.attended; w.total += d.total;
    weeks.set(key, w);
  }
  return [...weeks.values()].map((w) => ({ ...w, rate: w.total ? Math.round((w.attended / w.total) * 100) : null }));
}
const tone = (rate) => (rate == null ? T.track : rate >= 85 ? T.mid : rate >= 70 ? "#feb139" : "#B91C1C");

export default function AttendanceTab({ data, links, isHub }) {
  if (!data.marked) return <Card><Empty>No registers were marked in this period. Try a longer period.</Empty></Card>;
  const c = data.statusCounts;
  return (
    <>
      <div className="an-stats">
        <Stat icon={FiCheckCircle} label="Attendance" value={fmtPct(data.rate)} tone="mid"
          delta={<Delta now={data.rate} before={data.previousRate} suffix=" pts" />} />
        <Stat icon={FiCalendar} label="Register days" value={fmtNum(data.registerDays)} sub={`${fmtNum(data.learnersRegistered)} learners`} />
        <Stat icon={FiClock} label="Late" value={fmtNum(c.late)} tone="gold" />
        <Stat icon={FiUserX} label={`Absent ${data.repeatedThreshold}+ times`} value={fmtNum(data.absences.length)} tone={data.absences.length ? "danger" : "navy"} />
      </div>

      <div className="an-two">
        <Card title={data.byDay.length > 62 ? "Week by week" : "Day by day"}>
          <Columns points={byWeek(data.byDay)} valueKey="rate" labelKey="date" labelFormat={shortDay} color={T.mid} format={(v) => `${v}%`} />
        </Card>
        <Card title="By weekday">
          <BarList rows={data.byWeekday.map((w) => ({ key: w.label, label: w.label, value: w.rate ?? 0, extra: `${fmtNum(w.total)} marks`, color: tone(w.rate) }))} max={100} format={(v) => `${v}%`} />
        </Card>
      </div>

      <div className="an-two">
        <Card title="Present, late, absent">
          <BarList max={c.present + c.late + c.absent + c.excused} rows={[
            { key: "present", label: "Present", value: c.present, color: T.mid },
            { key: "late", label: "Late", value: c.late, color: "#feb139" },
            { key: "absent", label: "Absent", value: c.absent, color: "#B91C1C" },
            { key: "excused", label: "Excused", value: c.excused, color: "#9CA3AF" },
          ]} />
        </Card>
        <Card title="By class">
          <BarList rows={data.byClass.slice(0, 12).map((k) => ({ key: k.classId, label: [k.label, !isHub ? k.hubName : null].filter(Boolean).join(" · "), value: k.rate ?? 0, extra: `${k.days} days`, color: tone(k.rate) }))} max={100} format={(v) => `${v}%`} />
          {data.byClass.length > 12 && <Note>Lowest 12 shown. The full list is in the CSV below.</Note>}
        </Card>
      </div>

      <DataTable
        title="Absent again and again"
        columns={[
          { key: "name", label: "Learner", render: (r) => <button type="button" className="an-link" onClick={() => links.learner(r.learnerId)}>{r.name}</button>, csv: (r) => r.name },
          { key: "className", label: "Class", render: (r) => [r.className, !isHub ? r.hubName : null].filter(Boolean).join(" · ") || "–", csv: (r) => [r.className, r.hubName].filter(Boolean).join(" · ") },
          { key: "absent", label: "Absent", align: "num" },
          { key: "late", label: "Late", align: "num" },
          { key: "rate", label: "Attended", align: "num", render: (r) => fmtPct(r.rate) },
          { key: "lastAbsent", label: "Last absent", render: (r) => fmtDate(r.lastAbsent), csv: (r) => r.lastAbsent },
        ]}
        rows={data.absences}
        filename="repeated-absences.csv"
        initialSort={{ key: "absent", dir: "desc" }}
        empty={`No learner was absent ${data.repeatedThreshold} or more times.`}
      />
      <DataTable
        title="Every class"
        columns={[
          { key: "label", label: "Class", render: (r) => [r.label, !isHub ? r.hubName : null].filter(Boolean).join(" · "), csv: (r) => [r.label, r.hubName].filter(Boolean).join(" · ") },
          { key: "learners", label: "Learners", align: "num" },
          { key: "days", label: "Register days", align: "num" },
          { key: "rate", label: "Attended", align: "num", render: (r) => fmtPct(r.rate) },
        ]}
        rows={data.byClass.map((r) => ({ ...r, key: r.classId }))}
        filename="attendance-by-class.csv"
        initialSort={{ key: "rate", dir: "asc" }}
        limit={10}
      />
      <Note>Present and late count as attended. Excused days are left out.</Note>
    </>
  );
}
