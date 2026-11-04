import { Card, DataTable, Delta, Empty, Funnel, LevelLegend, LevelStack, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

export default function AssessmentsTab({ data, links, isHub }) {
  const h = data.headline;
  const r = data.reports;
  const learnerCell = (row) => <button type="button" className="an-link" onClick={() => links.learner(row.learnerId)}>{row.learner}</button>;
  const rateColumns = (first) => [
    first,
    { key: "issues", label: "Issued", align: "num" },
    { key: "tasks", label: "Learner tasks", align: "num" },
    { key: "handedInPercent", label: "Handed in", align: "num", render: (x) => fmtPct(x.handedInPercent) },
    { key: "missed", label: "Missed", align: "num" },
    { key: "marked", label: "Marked", align: "num" },
    { key: "averageScore", label: "Average score", align: "num", render: (x) => fmtPct(x.averageScore) },
  ];

  return (
    <>
      <div className="an-stats">
        <Stat label="Assessments issued" value={fmtNum(h.issues)} sub={`${fmtNum(h.tasks)} learner tasks`} delta={<Delta now={h.issues} before={h.prevIssues} />} />
        <Stat label="Handed in" value={fmtPct(h.handedInPercent)} delta={<Delta now={h.handedInPercent} before={h.prevHandedInPercent} suffix=" pts" />} />
        <Stat label="Average score" value={fmtPct(h.averageScore)} sub="Marked work issued in the period" delta={<Delta now={h.averageScore} before={h.prevAverageScore} suffix=" pts" />} />
        <Stat label="Waiting to be marked" value={fmtNum(h.waitingToMark)} sub="Right now, whenever it was issued" />
        <Stat label="Missed" value={fmtNum(h.missed)} sub={h.withoutDueDate ? `${fmtNum(h.withoutDueDate)} issued with no due date` : "Past the due date, not handed in"} />
      </div>

      <div className="an-two">
        <Card title="From issuing to the learner's report" subtitle="Learner tasks issued in the period, and how far each got">
          {data.funnel[0].count ? <Funnel steps={data.funnel} /> : <Empty>No work was issued in this period.</Empty>}
        </Card>
        <Card title="Reports and certificates" subtitle="In the period">
          <div className="an-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Stat label="Session reports out" value={fmtNum(r.sessionReportsPublished)} />
            <Stat label="Course reports published" value={fmtNum(r.courseReportsPublished)} />
            <Stat label="Course reports in draft" value={fmtNum(r.courseReportsDraft)} sub="Ready for an educator to publish (now)" />
            <Stat label="Certificates issued" value={fmtNum(r.certificatesIssued)} />
          </div>
        </Card>
      </div>

      <DataTable
        title="Waiting to be marked"
        subtitle="Handed in and not yet marked — longest waiting first"
        columns={[
          { key: "learner", label: "Learner", render: learnerCell },
          { key: "assessment", label: "Assessment" },
          { key: "className", label: "Class", render: (x) => [x.className, !isHub ? x.hubName : null].filter(Boolean).join(" · ") || "—", csv: (x) => [x.className, x.hubName].filter(Boolean).join(" · ") },
          { key: "submittedAt", label: "Handed in", render: (x) => fmtDate(x.submittedAt), csv: (x) => x.submittedAt, sort: (x) => (x.submittedAt ? new Date(x.submittedAt).getTime() : null) },
          { key: "daysWaiting", label: "Days waiting", align: "num" },
        ]}
        rows={data.backlog}
        filename="waiting-to-be-marked.csv"
        initialSort={{ key: "daysWaiting", dir: "desc" }}
        empty="Nothing is waiting to be marked."
      />

      <DataTable
        title="Missed work"
        subtitle="Issued in the period, past its due date and never handed in — most overdue first"
        columns={[
          { key: "learner", label: "Learner", render: learnerCell },
          { key: "assessment", label: "Assessment" },
          { key: "className", label: "Class", render: (x) => [x.className, !isHub ? x.hubName : null].filter(Boolean).join(" · ") || "—", csv: (x) => [x.className, x.hubName].filter(Boolean).join(" · ") },
          { key: "dueDate", label: "Due", render: (x) => fmtDate(x.dueDate), csv: (x) => x.dueDate },
          { key: "daysOverdue", label: "Days overdue", align: "num" },
          { key: "started", label: "Started?", render: (x) => (x.started ? "Started" : "Not opened"), csv: (x) => (x.started ? "yes" : "no") },
        ]}
        rows={data.overdue}
        total={data.overdueCount}
        filename="missed-work.csv"
        initialSort={{ key: "daysOverdue", dir: "desc" }}
        empty={h.withoutDueDate ? "Nothing missed — but work without a due date can never count as missed." : "Nothing missed in this period."}
      />

      <DataTable title="By class" subtitle="Lowest hand-in rate first" columns={[
        { key: "label", label: "Class", render: (x) => [x.label, !isHub ? x.hubName : null].filter(Boolean).join(" · "), csv: (x) => [x.label, x.hubName].filter(Boolean).join(" · ") },
        { key: "learners", label: "Learners", align: "num" },
        ...rateColumns({ key: "_", label: "" }).slice(2),
      ]} rows={data.byClass} filename="assessments-by-class.csv" initialSort={{ key: "handedInPercent", dir: "asc" }} />
      <DataTable title="By course" columns={rateColumns({ key: "label", label: "Course" })} rows={data.byCourse} filename="assessments-by-course.csv" initialSort={{ key: "tasks", dir: "desc" }} />
      <DataTable title="By kind of assessment" columns={rateColumns({ key: "label", label: "Kind" })} rows={data.byType} filename="assessments-by-kind.csv" initialSort={{ key: "issues", dir: "desc" }} />
      {!isHub && (
        <DataTable
          title="Who issued work"
          columns={[
            { key: "label", label: "Issued by", render: (x) => (x.teacherId ? <button type="button" className="an-link" onClick={() => links.educator(x.teacherId)}>{x.label}</button> : x.label), csv: (x) => x.label },
            { key: "issues", label: "Issued", align: "num" },
            { key: "withoutDueDate", label: "With no due date", align: "num" },
          ]}
          rows={data.byIssuer}
          filename="issued-by.csv"
          initialSort={{ key: "issues", dir: "desc" }}
        />
      )}

      <Card title="How each assessment went" subtitle="Marked work, spread across the four level words">
        {data.scoreSpread.length ? (
          <>
            <LevelLegend />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {data.scoreSpread.slice(0, 25).map((a) => (
                <div key={a.assessmentId}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: T.ink }}>{a.name} <span style={{ fontWeight: 500, color: T.faint }}>· {a.type}</span></span>
                    <span style={{ color: T.ink, fontWeight: 800 }}>{fmtPct(a.averageScore)} <span style={{ color: T.faint, fontWeight: 600 }}>average · {fmtNum(a.marked)} marked</span></span>
                  </div>
                  <LevelStack levels={a.levels} />
                </div>
              ))}
            </div>
          </>
        ) : <Empty>Nothing marked in this period.</Empty>}
      </Card>

      <DataTable
        title="Questions most learners got wrong"
        subtitle="Auto-marked questions answered at least twice — a sign the question or its teaching needs another look"
        columns={[
          { key: "question", label: "Question", render: (x) => <span style={{ display: "block", maxWidth: 460 }}>{x.question}</span> },
          { key: "assessment", label: "Assessment" },
          { key: "attempts", label: "Answers", align: "num" },
          { key: "correctPercent", label: "Right", align: "num", render: (x) => fmtPct(x.correctPercent) },
        ]}
        rows={data.hardestQuestions}
        filename="hardest-questions.csv"
        initialSort={{ key: "correctPercent", dir: "asc" }}
        empty="No auto-marked question has been answered twice yet."
      />
      <Note>“Learner tasks” are one per learner for each piece of work issued to them (a class's work counts once per learner in it). Work issued by the website's diagnostics isn't counted here.</Note>
    </>
  );
}
