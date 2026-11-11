import { FiBookOpen, FiLogIn, FiMessageCircle, FiStar } from "react-icons/fi";
import { BarList, Card, DataTable, Funnel, Note, Stat, T, fmtDate, fmtHours, fmtNum, fmtPct } from "./ui";

// Parent engagement (10 Nov 2026; server analytics.parents.js): whether families open their child's
// reports, sign in, take part in parent–mentor check-ins and give feedback. Report opens are
// recorded from 10 Nov 2026 — reports before that show as not opened.
export default function ParentsTab({ data, links, isHub }) {
  const r = data.reports;
  const c = data.checkins;
  return (
    <>
      <div className="an-stats">
        <Stat icon={FiBookOpen} label="Reports opened by a parent" value={fmtPct(r.rate)} sub={`${fmtNum(r.openedByParent)} of ${fmtNum(r.published)} published`} tone="mid" />
        <Stat icon={FiLogIn} label="Parents who signed in" value={fmtPct(data.signInRate)} sub={`${fmtNum(data.parentsSignedIn)} of ${fmtNum(data.familiesWithLogin)} with a login`} />
        <Stat icon={FiMessageCircle} label="Check-ins approved" value={fmtNum(c.approved)} sub={c.scheduled ? `of ${fmtNum(c.scheduled)} scheduled` : "none scheduled"} tone="sky" />
        <Stat icon={FiStar} label="Mentor reviews" value={fmtNum(data.reviews.count)} sub={data.reviews.parents ? `from ${fmtNum(data.reviews.parents)} parents` : null} tone="gold" />
      </div>

      <div className="an-two">
        <Card title="Reports">
          <Funnel steps={[
            { key: "published", label: "Published", count: r.published, percent: null },
            { key: "parent", label: "Opened by a parent", count: r.openedByParent, percent: r.rate },
          ]} />
          <p style={{ margin: "12px 0 0", fontSize: 13, color: T.ink }}>
            Typical time to open: <strong>{r.medianHoursToOpen == null ? "–" : fmtHours(r.medianHoursToOpen)}</strong>
            {r.openedByLearner ? <span style={{ color: T.muted }}> · {fmtNum(r.openedByLearner)} opened by the learner</span> : null}
          </p>
        </Card>
        <Card title="Parent–mentor check-ins">
          {c.scheduled ? (
            <Funnel steps={[
              { key: "s", label: "Scheduled", count: c.scheduled, percent: null },
              { key: "c", label: "Confirmed by the parent", count: c.confirmed, percent: Math.round((c.confirmed / c.scheduled) * 100) },
              { key: "h", label: "Held, report written", count: c.held, percent: Math.round((c.held / c.scheduled) * 100) },
              { key: "a", label: "Report approved by the parent", count: c.approved, percent: Math.round((c.approved / c.scheduled) * 100) },
            ]} />
          ) : <p style={{ margin: 0, fontSize: 13, color: T.muted }}>No parent–mentor check-ins in this period.</p>}
        </Card>
      </div>

      <Card title="Reports opened, by class">
        <BarList rows={data.byClass.map((k) => ({ key: k.classId, label: [k.label, !isHub ? k.hubName : null].filter(Boolean).join(" · "), value: k.rate ?? 0, extra: `${k.opened} of ${k.published}` }))} max={100} format={(v) => `${v}%`} color={T.mid} empty="No reports published in this period." />
      </Card>

      <DataTable
        title="Families who haven't opened a report"
        columns={[
          { key: "name", label: "Learner", render: (x) => <button type="button" className="an-link" onClick={() => links.learner(x.learnerId)}>{x.name}</button>, csv: (x) => x.name },
          { key: "parentName", label: "Parent", render: (x) => x.parentName || "–" },
          { key: "className", label: "Class", render: (x) => x.className || "–" },
          { key: "reports", label: "Reports out", align: "num" },
          { key: "lastPublished", label: "Latest", render: (x) => fmtDate(x.lastPublished), csv: (x) => x.lastPublished },
          { key: "login", label: "Parent login", render: (x) => (!x.hasLogin ? "None" : x.parentSignedIn ? "Signed in" : "Not signed in"), csv: (x) => (!x.hasLogin ? "none" : x.parentSignedIn ? "signed in" : "not signed in"), sort: (x) => (x.hasLogin ? (x.parentSignedIn ? 2 : 1) : 0) },
        ]}
        rows={data.unread}
        filename="reports-not-opened.csv"
        initialSort={{ key: "reports", dir: "desc" }}
        empty="Every family opened at least one report."
      />
      <Note>Report opens are counted from 10 Nov 2026. A parent with no login can&apos;t open reports online; give them one from the learner&apos;s page.</Note>
    </>
  );
}
