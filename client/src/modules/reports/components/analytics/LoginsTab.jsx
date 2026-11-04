import { BarList, Card, Columns, DataTable, Delta, Heatmap, Note, Stat, T, fmtDate, fmtDateTime, fmtNum, fmtPct } from "./ui";

const shortDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-KE", { day: "numeric", month: "short" });

export default function LoginsTab({ data, links }) {
  const h = data.headline;
  const personCell = (r) => (r.link?.type === "learner" ? <button type="button" className="an-link" onClick={() => links.learner(r.link.id)}>{r.name}</button>
    : r.link?.type === "educator" ? <button type="button" className="an-link" onClick={() => links.educator(r.link.id)}>{r.name}</button> : r.name);
  const peopleColumns = (withLast) => [
    { key: "name", label: "Name", render: (r) => <span>{personCell(r)}{r.note ? <span style={{ display: "block", fontSize: 11.5, color: T.faint }}>{r.note}</span> : null}</span>, csv: (r) => r.name },
    { key: "kindLabel", label: "Who" },
    { key: "hubName", label: "Hub", render: (r) => r.hubName || "—" },
    withLast
      ? { key: "lastSignIn", label: "Last signed in", render: (r) => fmtDate(r.lastSignIn), csv: (r) => r.lastSignIn, sort: (r) => (r.lastSignIn ? -new Date(r.lastSignIn).getTime() : null) }
      : { key: "accountCreated", label: "Login made", render: (r) => fmtDate(r.accountCreated), csv: (r) => r.accountCreated, sort: (r) => (r.accountCreated ? new Date(r.accountCreated).getTime() : null) },
  ];

  return (
    <>
      <div className="an-stats">
        <Stat label="Sign-ins" value={fmtNum(h.logins)} delta={<Delta now={h.logins} before={h.prevLogins} />} />
        <Stat label="People who signed in" value={fmtNum(h.activeUsers)} delta={<Delta now={h.activeUsers} before={h.prevActiveUsers} />} />
        <Stat label="Learners reached" value={fmtPct(h.learnersReachedPercent)} sub={`${fmtNum(h.learnersReached)} of ${fmtNum(h.learnerCount)} — they or a parent signed in`} />
        <Stat label="Typical time signed in" value={h.medianSessionMinutes != null ? `${h.medianSessionMinutes} min` : "—"} sub={h.sessionsMeasured ? `Middle of ${fmtNum(h.sessionsMeasured)} signed-out sessions` : "No sign-outs to measure yet"} />
        <Stat label="Failed sign-ins" value={fmtNum(h.failed)} delta={<Delta now={h.failed} before={h.prevFailed} betterWhenLower />} />
      </div>

      <div className="an-two">
        <Card title="Who is signing in" subtitle="People who signed in during the period, out of everyone with a login">
          <BarList
            rows={data.byKind.map((k) => ({ key: k.key, label: k.label, value: k.percent ?? 0, extra: `${fmtNum(k.active)} of ${fmtNum(k.population)}` }))}
            max={100}
            format={(v) => `${v}%`}
            color={T.navy}
          />
          <Note>Learners are their own username logins; parents sign in with their email. Learners with no login of their own or a parent's: {fmtNum(data.accounts.withNoLogin)} of {fmtNum(data.accounts.learners)}.</Note>
        </Card>
        <Card title="Sign-ins per day" subtitle="Hover a day for the number">
          <Columns points={data.daily} valueKey="logins" labelKey="day" labelFormat={shortDay} color={T.navy} />
        </Card>
      </div>

      <Card title="When people sign in" subtitle="Sign-ins by weekday and hour, Kenyan time — darker is busier">
        <Heatmap grid={data.heatmap} />
      </Card>

      <div className="an-two">
        <Card title="Devices" subtitle="What sign-ins came from">
          <BarList rows={data.devices.map((d) => ({ label: d.label, value: d.percent ?? 0, extra: fmtNum(d.count) }))} max={100} format={(v) => `${v}%`} empty="No sign-ins in this period." />
        </Card>
        <Card title="Browsers" subtitle="In-app browsers (Facebook, Instagram…) often block the sign-in cookie">
          <BarList rows={data.browsers.map((d) => ({ label: d.label, value: d.percent ?? 0, extra: fmtNum(d.count) }))} max={100} format={(v) => `${v}%`} empty="No sign-ins in this period." />
        </Card>
      </div>

      <DataTable
        title={`Not seen for ${data.inactiveDays} days or more`}
        subtitle="Signed in before, but not lately — oldest first"
        columns={peopleColumns(true)}
        rows={data.notSeenLately}
        total={data.notSeenLatelyCount}
        filename="not-signed-in-lately.csv"
        empty="Everyone with a login has signed in recently."
      />
      <DataTable
        title="Never signed in"
        subtitle="Has a login but has never used it"
        columns={peopleColumns(false)}
        rows={data.neverSignedIn}
        total={data.neverSignedInCount}
        filename="never-signed-in.csv"
        empty="Everyone with a login has signed in at least once."
      />
      {data.accounts.noLogin.length > 0 && (
        <DataTable
          title="Learners with no login"
          subtitle="No username login of their own and no parent login — give them one from the learner's page"
          columns={[
            { key: "name", label: "Learner", render: (r) => <button type="button" className="an-link" onClick={() => links.learner(r.learnerId)}>{r.name}</button>, csv: (r) => r.name },
            { key: "guardianName", label: "Parent / guardian", render: (r) => r.guardianName || "—" },
          ]}
          rows={data.accounts.noLogin}
          total={data.accounts.withNoLogin}
          filename="learners-without-login.csv"
        />
      )}
      <Note>From the Activity log's sign-in records{data.period ? `, ${fmtDateTime(data.period.start)} to ${fmtDateTime(data.period.end)}` : ""}. Time signed in runs from signing in to signing out or the session timing out (30 minutes idle), so it's approximate.</Note>
    </>
  );
}
