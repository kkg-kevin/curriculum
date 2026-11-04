import { useState } from "react";
import { Card, DataTable, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

// Reason tags in the system colours (gold, sky, navy, grey) — each also says its reason in words.
const TAG = {
  lowScore: { bg: "#FFF5E1", border: "#FDD89A", color: "#7A4F00" },
  lowAttendance: { bg: "#EAF6FD", border: "#BFE3F7", color: "#1F6F9E" },
  missedWork: { bg: "#E6ECF3", border: "#A9BCD2", color: "#1a3550" },
  notSignedIn: { bg: "#EEF0F4", border: "#D5DAE3", color: "#374151" },
};

export default function AtRiskTab({ data, links, isHub }) {
  const [only, setOnly] = useState("");
  const labelOf = Object.fromEntries(data.flags.map((f) => [f.key, f.label]));
  const rows = only ? data.learners.filter((l) => l.flags.includes(only)) : data.learners;
  const r = data.rules;

  return (
    <>
      <div className="an-stats">
        <Stat label="Learners at risk" value={fmtNum(data.atRiskCount)} sub={`${fmtPct(data.atRiskPercent)} of ${fmtNum(data.learnerCount)} learners`} />
        {data.flags.map((f) => (
          <button key={f.key} type="button" onClick={() => setOnly((x) => (x === f.key ? "" : f.key))} aria-pressed={only === f.key}
            style={{ textAlign: "left", padding: 0, border: "none", background: "none", cursor: "pointer", borderRadius: 14, outline: only === f.key ? `2px solid ${T.navy}` : "none" }}>
            <Stat label={f.label} value={fmtNum(f.count)} sub={only === f.key ? "Showing only these — click again for all" : "Click to show only these"} />
          </button>
        ))}
      </div>

      <DataTable
        title={only ? `At risk: ${labelOf[only]}` : "Who needs help"}
        subtitle="Most reasons first, then lowest score"
        columns={[
          { key: "name", label: "Learner", render: (x) => <button type="button" className="an-link" onClick={() => links.learner(x.learnerId)}>{x.name}</button>, csv: (x) => x.name },
          { key: "className", label: "Class", render: (x) => [x.className, !isHub ? x.hubName : null].filter(Boolean).join(" · ") || "—", csv: (x) => [x.className, x.hubName].filter(Boolean).join(" · ") },
          {
            key: "flags", label: "Why",
            render: (x) => (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {x.flags.map((f) => <span key={f} style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: TAG[f].bg, border: `1px solid ${TAG[f].border}`, color: TAG[f].color, whiteSpace: "nowrap" }}>{labelOf[f]}</span>)}
              </span>
            ),
            csv: (x) => x.flags.map((f) => labelOf[f]).join("; "),
            sort: (x) => x.flags.length,
          },
          { key: "score", label: "Score", align: "num", render: (x) => (x.score == null ? "—" : `${x.score}%`), csv: (x) => x.score },
          { key: "attendanceRate", label: "Attendance", align: "num", render: (x) => (x.attendanceRate == null ? "—" : `${x.attendanceRate}%`), csv: (x) => x.attendanceRate },
          { key: "missed", label: "Missed", align: "num" },
          { key: "lastSignIn", label: "Last signed in", render: (x) => (!x.hasLogin ? "No login" : x.lastSignIn ? fmtDate(x.lastSignIn) : "Never"), csv: (x) => x.lastSignIn || (x.hasLogin ? "never" : "no login"), sort: (x) => (x.lastSignIn ? new Date(x.lastSignIn).getTime() : 0) },
        ]}
        rows={rows}
        filename="learners-at-risk.csv"
        initialSort={{ key: "flags", dir: "desc" }}
        limit={25}
        empty="No learner matches these reasons in this period."
      />
      <Card title="How a learner is flagged">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.ink, lineHeight: 1.7 }}>
          <li><strong>Low scores</strong> — their marked work in the period comes to under {r.lowScore.threshold}%.</li>
          <li><strong>Low attendance</strong> — under {r.lowAttendance.threshold}% attended (present or late), with at least {r.lowAttendance.minDays} days marked.</li>
          <li><strong>Missed work</strong> — {r.missedWork.threshold} or more pieces past their due date and never handed in.</li>
          <li><strong>Not signing in</strong> — they or a parent have a login, but neither has signed in for {r.notSignedIn.days} days.</li>
        </ul>
        <Note>Excused absences don't count against attendance.</Note>
      </Card>
    </>
  );
}
