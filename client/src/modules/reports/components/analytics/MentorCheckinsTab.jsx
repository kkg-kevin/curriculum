import { useNavigate } from "react-router-dom";
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiClock, FiMessageCircle, FiStar, FiThumbsUp, FiUsers } from "react-icons/fi";
import { BarList, Card, Columns, DataTable, Delta, Empty, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

/*
 * Parent–mentor check-ins (17 Nov 2026; server analytics.mentorcheckins.js): how many happened in
 * the period, what's still waiting (reports to write, reports with parents), how quickly reports
 * are written and approved, how many families were reached — by week, hub, class and educator.
 * A hub login sees counts only: no scores and no per-educator table (hubs never see reports).
 */

const shortWeek = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
const days = (n) => (n == null ? "—" : `${n} day${n === 1 ? "" : "s"}`);

export default function MentorCheckinsTab({ data, isHub, level, links }) {
  const navigate = useNavigate();
  const base = isHub ? "/school-portal/mentor-checkins" : level === "supervisor" ? "/supervisor-portal/mentor-checkins" : "/mentor-checkins";
  const open = (id) => navigate(`${base}/meetings/${id}`);
  const nothing = !data.scheduled && !data.cancelled && !data.waitingNow.reportsDue && !data.waitingNow.waitingOnParents;
  if (nothing) {
    return <Card><Empty>No parent check-ins in this period. Try a longer period, or set check-ins up under Quality &amp; insights → Parent–Mentor Check-ins.</Empty></Card>;
  }
  const p = data.previous || {};
  const statusRows = [
    { key: "approved", label: "Held — approved by the parent", value: data.approved, color: T.navy },
    { key: "awaiting", label: "Held — with the parent", value: data.awaitingApproval, color: "#7C3AED" },
    { key: "due", label: "Happened — report not written", value: data.reportDue, color: "#B87708" },
    { key: "missed", label: "Missed", value: data.missed, color: "#B91C1C" },
    { key: "upcoming", label: "Still to come", value: data.upcoming, color: T.sky },
    { key: "cancelled", label: "Cancelled", value: data.cancelled, color: "#9CA3AF" },
  ];
  const meetingLink = (r, text) => <button type="button" className="an-link" onClick={() => open(r.meetingId)}>{text}</button>;
  const groupColumns = (labelHeading) => [
    { key: "label", label: labelHeading },
    { key: "scheduled", label: "Check-ins", align: "num" },
    { key: "held", label: "Held", align: "num" },
    { key: "heldRate", label: "Held %", align: "num", render: (r) => fmtPct(r.heldRate) },
    { key: "approved", label: "Approved", align: "num" },
    { key: "reportDue", label: "Reports due", align: "num" },
    { key: "missed", label: "Missed", align: "num" },
    { key: "confirmRate", label: "Confirmed %", align: "num", render: (r) => fmtPct(r.confirmRate) },
    ...(isHub ? [] : [{ key: "avgScore", label: "Avg score", align: "num", render: (r) => (r.avgScore == null ? "—" : `${r.avgScore}%`) }]),
  ];

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiMessageCircle} label="Check-ins in the period" value={fmtNum(data.scheduled)} sub={`${fmtNum(data.upcoming)} still to come · ${fmtNum(data.cancelled)} cancelled`}
          delta={<Delta now={data.scheduled} before={p.scheduled} />} />
        <Stat icon={FiCheckCircle} label="Held" value={fmtNum(data.held)} tone="mid" sub={`${fmtPct(data.heldRate)} of those that came round`}
          delta={<Delta now={data.heldRate} before={p.heldRate} suffix=" pts" />} />
        <Stat icon={FiThumbsUp} label="Approved by parents" value={fmtNum(data.approved)} tone="good" sub={`${fmtPct(data.approvalRate)} of reports written`} />
        <Stat icon={FiAlertCircle} label="Reports to write — now" value={fmtNum(data.waitingNow.reportsDue)} tone={data.waitingNow.reportsDue ? "danger" : "navy"} sub="check-ins that happened, no report yet" />
        <Stat icon={FiClock} label="With parents — now" value={fmtNum(data.waitingNow.waitingOnParents)} tone={data.waitingNow.waitingOnParents ? "gold" : "navy"} sub="reports waiting for the parent's approval" />
        <Stat icon={FiUsers} label="Families reached" value={fmtPct(data.reachRate)} sub={`${fmtNum(data.familiesReached)} of ${fmtNum(data.learnersInClasses)} learners in the classes with check-ins`} />
        <Stat icon={FiCalendar} label="Next 7 days" value={fmtNum(data.nextSevenDays.total)} sub={`${fmtNum(data.nextSevenDays.unconfirmed)} not confirmed by the parent yet`} tone={data.nextSevenDays.unconfirmed ? "gold" : "navy"} />
        {!isHub && <Stat icon={FiStar} label="Average report score" value={data.avgScore == null ? "—" : `${data.avgScore}%`} sub={data.scored ? `${fmtNum(data.scored)} scored on a template` : "no template scores in the period"} />}
      </div>

      <div className="an-two">
        <Card title="Where the period's check-ins stand">
          <BarList rows={statusRows} max={Math.max(1, ...statusRows.map((r) => r.value))} />
          <Note>Confirmed by the parent: {fmtPct(data.confirmRate)} · parents who picked another time: {fmtNum(data.rescheduled)}.</Note>
        </Card>
        <Card title="Speed" subtitle="How quickly educators write up a check-in, and parents approve it.">
          <BarList format={(v) => days(v)} rows={[
            { key: "toReport", label: "Check-in → report written (median)", value: data.medianDaysToReport ?? 0, color: T.mid },
            { key: "toApproval", label: "Report → parent's approval (median)", value: data.medianDaysToApproval ?? 0, color: T.navy },
          ]} />
          <Note>{fmtNum(data.lateReports)} report{data.lateReports === 1 ? "" : "s"} written more than {data.lateReportDays} days after the check-in.</Note>
        </Card>
      </div>

      {data.byWeek.length > 0 && (
        <div className="an-two">
          <Card title="Check-ins week by week">
            <Columns points={data.byWeek} valueKey="scheduled" labelKey="week" labelFormat={shortWeek} color={T.sky} />
          </Card>
          <Card title="Held week by week">
            <Columns points={data.byWeek} valueKey="held" labelKey="week" labelFormat={shortWeek} color={T.navy} />
          </Card>
        </div>
      )}

      <DataTable
        title="Reports to write"
        subtitle="Check-ins whose day has passed with no report, longest overdue first. Open one to write it up or mark it missed."
        columns={[
          { key: "learners", label: "Learner", render: (r) => meetingLink(r, r.learners), csv: (r) => r.learners },
          { key: "parent", label: "Parent" },
          { key: "educators", label: "Mentors" },
          { key: "className", label: "Class", render: (r) => [r.className, !isHub ? r.hubName : null].filter(Boolean).join(" · "), csv: (r) => [r.className, r.hubName].filter(Boolean).join(" · ") },
          { key: "date", label: "Check-in", render: (r) => fmtDate(r.date), csv: (r) => r.date },
          { key: "daysOverdue", label: "Days overdue", align: "num" },
        ]}
        rows={data.reportsDue}
        filename="checkin-reports-due.csv"
        initialSort={{ key: "daysOverdue", dir: "desc" }}
        limit={10}
        empty="No report is overdue."
      />

      <DataTable
        title="Waiting on parents"
        subtitle="Reports written and sent, not yet approved by the parent."
        columns={[
          { key: "learners", label: "Learner", render: (r) => meetingLink(r, r.learners), csv: (r) => r.learners },
          { key: "parent", label: "Parent" },
          { key: "educators", label: "Mentors" },
          { key: "className", label: "Class", render: (r) => [r.className, !isHub ? r.hubName : null].filter(Boolean).join(" · "), csv: (r) => [r.className, r.hubName].filter(Boolean).join(" · ") },
          { key: "date", label: "Check-in", render: (r) => fmtDate(r.date), csv: (r) => r.date },
          { key: "daysWaiting", label: "Days waiting", align: "num" },
        ]}
        rows={data.waitingOnParents}
        filename="checkin-reports-with-parents.csv"
        initialSort={{ key: "daysWaiting", dir: "desc" }}
        limit={10}
        empty="No report is waiting on a parent."
      />

      {!isHub && data.byHub.length > 0 && (
        <DataTable title="By hub" columns={groupColumns("Hub")} rows={data.byHub} filename="checkins-by-hub.csv" initialSort={{ key: "scheduled", dir: "desc" }} limit={10} />
      )}
      <DataTable title="By class" columns={groupColumns("Class")} rows={data.byClass} filename="checkins-by-class.csv" initialSort={{ key: "scheduled", dir: "desc" }} limit={10} empty="No check-ins in these classes." />
      {!isHub && (
        <DataTable
          title="By educator"
          subtitle={`Every educator of a class attends its check-ins. Late = written more than ${data.lateReportDays} days after.`}
          columns={[
            { key: "name", label: "Educator", render: (r) => <button type="button" className="an-link" onClick={() => links.educator(r.teacherId)}>{r.name}</button>, csv: (r) => r.name },
            { key: "scheduled", label: "Check-ins", align: "num" },
            { key: "held", label: "Held", align: "num" },
            { key: "heldRate", label: "Held %", align: "num", render: (r) => fmtPct(r.heldRate) },
            { key: "reportDue", label: "Reports due", align: "num" },
            { key: "lateReports", label: "Late", align: "num" },
            { key: "approved", label: "Approved", align: "num" },
            { key: "avgScore", label: "Avg score", align: "num", render: (r) => (r.avgScore == null ? "—" : `${r.avgScore}%`) },
          ]}
          rows={data.byEducator}
          filename="checkins-by-educator.csv"
          initialSort={{ key: "reportDue", dir: "desc" }}
          limit={10}
          empty="No educator had a check-in in the period."
        />
      )}
      <Note>
        Counts are of check-ins dated in the period; "now" figures are as of today. Held means the report is written. Families reached: of the learners in the
        classes that had check-ins in the period, those whose check-in was held. Stage, pathway and gender filters narrow the check-ins to those learners.
      </Note>
    </>
  );
}
