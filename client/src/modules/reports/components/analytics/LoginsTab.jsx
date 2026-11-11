import { FiClock, FiLock, FiLogIn, FiUserCheck, FiUsers } from "react-icons/fi";
import { BarList, Card, Columns, DataTable, Delta, Heatmap, Note, Stat, T, fmtDate, fmtNum, fmtPct } from "./ui";

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
        <Stat icon={FiLogIn} label="Sign-ins" value={fmtNum(h.logins)} delta={<Delta now={h.logins} before={h.prevLogins} />} />
        <Stat icon={FiUsers} label="People who signed in" value={fmtNum(h.activeUsers)} delta={<Delta now={h.activeUsers} before={h.prevActiveUsers} />} tone="mid" />
        <Stat icon={FiUserCheck} label="Learners reached" value={fmtPct(h.learnersReachedPercent)} sub={`${fmtNum(h.learnersReached)} of ${fmtNum(h.learnerCount)}`} tone="sky" />
        <Stat icon={FiClock} label="Typical time signed in" value={h.medianSessionMinutes != null ? `${h.medianSessionMinutes} min` : "–"} sub={h.sessionsMeasured ? `${fmtNum(h.sessionsMeasured)} sessions` : null} />
        <Stat icon={FiLock} label="Failed sign-ins" value={fmtNum(h.failed)} delta={<Delta now={h.failed} before={h.prevFailed} betterWhenLower />} tone="gold" />
      </div>

      <div className="an-two">
        <Card title="Who is signing in">
          <BarList
            rows={data.byKind.map((k) => ({ key: k.key, label: k.label, value: k.percent ?? 0, extra: `${fmtNum(k.active)} of ${fmtNum(k.population)}` }))}
            max={100}
            format={(v) => `${v}%`}
            color={T.navy}
          />
          <Note>Learners with no login of their own or a parent&apos;s: {fmtNum(data.accounts.withNoLogin)} of {fmtNum(data.accounts.learners)}.</Note>
        </Card>
        <Card title="Sign-ins per day">
          <Columns points={data.daily} valueKey="logins" labelKey="day" labelFormat={shortDay} color={T.navy} />
        </Card>
      </div>

      <Card title="When people sign in" subtitle="Kenyan time. Darker is busier.">
        <Heatmap grid={data.heatmap} />
      </Card>

      <div className="an-two">
        <Card title="Devices">
          <BarList rows={data.devices.map((d) => ({ label: d.label, value: d.percent ?? 0, extra: fmtNum(d.count) }))} max={100} format={(v) => `${v}%`} empty="No sign-ins in this period." />
        </Card>
        <Card title="Browsers">
          <BarList rows={data.browsers.map((d) => ({ label: d.label, value: d.percent ?? 0, extra: fmtNum(d.count) }))} max={100} format={(v) => `${v}%`} empty="No sign-ins in this period." />
        </Card>
      </div>

      <DataTable
        title={`Not seen for ${data.inactiveDays} days or more`}
        columns={peopleColumns(true)}
        rows={data.notSeenLately}
        total={data.notSeenLatelyCount}
        filename="not-signed-in-lately.csv"
        empty="Everyone with a login has signed in recently."
      />
      <DataTable
        title="Never signed in"
        columns={peopleColumns(false)}
        rows={data.neverSignedIn}
        total={data.neverSignedInCount}
        filename="never-signed-in.csv"
        empty="Everyone with a login has signed in at least once."
      />
      {data.accounts.noLogin.length > 0 && (
        <DataTable
          title="Learners with no login"
          subtitle="Give them one from the learner's page"
          columns={[
            { key: "name", label: "Learner", render: (r) => <button type="button" className="an-link" onClick={() => links.learner(r.learnerId)}>{r.name}</button>, csv: (r) => r.name },
            { key: "guardianName", label: "Parent / guardian", render: (r) => r.guardianName || "—" },
          ]}
          rows={data.accounts.noLogin}
          total={data.accounts.withNoLogin}
          filename="learners-without-login.csv"
        />
      )}
      <Note>Time signed in is approximate: from signing in to signing out, or 30 minutes idle.</Note>
    </>
  );
}
