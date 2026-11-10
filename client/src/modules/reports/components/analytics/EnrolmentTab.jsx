import { FiCreditCard, FiDollarSign, FiGift, FiInbox, FiPauseCircle, FiUserCheck } from "react-icons/fi";
import { BarList, Card, DataTable, Delta, Empty, Note, Stat, T, fmtNum, fmtPct } from "./ui";

// Enrolment & income (10 Nov 2026, admins only; server analytics.enrolment.js): from a website
// enquiry to a family still learning, per programme; where enquiries came from; the money in, month
// by month; subscriptions that lapsed; and what affiliates brought.

const KES = (n) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
const STAGES = [
  { key: "enquiries", label: "Enquired" },
  { key: "signedUp", label: "Signed up" },
  { key: "paid", label: "Paid" },
  { key: "learning", label: "Still learning" },
];
const STAGE_FILL = ["#BFE3F7", "#38aae1", "#2e7db5", "#25476a"];
const PROGRAMME_FILL = { bootcamp: "#25476a", home_learning: "#2e7db5", tech_club: "#38aae1", pathway: "#feb139", store: "#9BD7F2", hubs: "#7A8CA3", other: "#C5CCD6" };

function FunnelRow({ row, top }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100%", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 800, color: T.ink }}>{row.label}</span>
        <span style={{ color: T.muted, fontWeight: 700 }}>{row.conversion == null ? "" : `${row.conversion}% paid`}</span>
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {STAGES.map((s, i) => (
          <div key={s.key} title={`${s.label}: ${row[s.key]}`} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 26, borderRadius: 6, background: T.track, overflow: "hidden", display: "flex", alignItems: "center" }}>
              <div style={{ width: `${top ? (row[s.key] / top) * 100 : 0}%`, minWidth: row[s.key] ? 3 : 0, height: "100%", background: STAGE_FILL[i] }} />
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginTop: 2 }}>{fmtNum(row[s.key])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnrolmentTab({ data }) {
  if (data.hidden) return <Note>Enrolment and income are for your workspace&apos;s admins.</Note>;
  const t = data.funnelTotal;
  const inc = data.income;
  const monthMax = Math.max(1, ...inc.months.map((m) => m.total));
  const programmeKeys = [...new Set(inc.months.flatMap((m) => Object.keys(m).filter((k) => !["month", "label", "total"].includes(k))))];
  const funnelTop = Math.max(1, ...data.funnel.map((f) => f.enquiries));

  return (
    <>
      <div className="an-stats">
        <Stat icon={FiInbox} label="Enquiries" value={fmtNum(t.enquiries)} />
        <Stat icon={FiUserCheck} label="Paid" value={fmtNum(t.paid)} sub={t.conversion == null ? null : `${t.conversion}% of enquiries`} tone="mid" />
        <Stat icon={FiDollarSign} label="Money in" value={KES(inc.inPeriod)} tone="mid" delta={<Delta now={Math.round(inc.inPeriod)} before={Math.round(inc.previous)} />} />
        <Stat icon={FiCreditCard} label="Still owed" value={KES(inc.owed)} sub={inc.overdue ? `${inc.overdue} invoice${inc.overdue === 1 ? "" : "s"} past due` : null} tone={inc.overdue ? "gold" : "navy"} />
        <Stat icon={FiPauseCircle} label="Paused for unpaid" value={fmtNum(data.pausedForUnpaid)} sub="learners, today" tone={data.pausedForUnpaid ? "danger" : "navy"} />
      </div>

      <Card title="From enquiry to learning" action={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {STAGES.map((s, i) => <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.muted }}><span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_FILL[i] }} />{s.label}</span>)}
        </div>
      }>
        {data.funnel.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.funnel.map((row) => <FunnelRow key={row.key} row={row} top={funnelTop} />)}
          </div>
        ) : <Empty>No enquiries in this period.</Empty>}
      </Card>

      <div className="an-two">
        <Card title="Money in, month by month" action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {programmeKeys.map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.muted }}><span style={{ width: 10, height: 10, borderRadius: 3, background: PROGRAMME_FILL[k] || "#C5CCD6" }} />{data.programmes[k] || "Other"}</span>)}
          </div>
        }>
          {inc.months.some((m) => m.total) ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 150, borderBottom: `1px solid ${T.border}` }}>
                {inc.months.map((m) => (
                  <div key={m.month} title={`${m.label}: ${KES(m.total)}`} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column-reverse" }}>
                    {programmeKeys.map((k) => (m[k] ? <div key={k} style={{ height: `${(m[k] / monthMax) * 100}%`, background: PROGRAMME_FILL[k] || "#C5CCD6" }} /> : null))}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {inc.months.map((m, i) => <span key={m.month} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 10, color: T.faint }}>{i % 2 === inc.months.length % 2 ? m.label.split(" ")[0] : ""}</span>)}
              </div>
              <Note>Highest month: {KES(monthMax)} ({short(monthMax)}).</Note>
            </>
          ) : <Empty>No payments in these months.</Empty>}
        </Card>
        <Card title="Money in this period, by programme">
          <BarList rows={inc.byProgramme.map((p) => ({ key: p.key, label: p.label, value: p.amount, color: PROGRAMME_FILL[p.key] }))} format={KES} empty="No payments in this period." />
        </Card>
      </div>

      <div className="an-two">
        <Card title="Where enquiries came from">
          <BarList rows={data.sources.slice(0, 10).map((s) => ({ key: s.label, label: s.label, value: s.enquiries, extra: `${s.paid} paid` }))} color={T.navy} empty="No enquiries in this period." />
        </Card>
        <Card title="Subscriptions">
          <div className="an-table-wrap">
            <table className="an-table">
              <thead><tr><th>Programme</th><th className="num">Active</th><th className="num">Paused</th><th className="num">Cancelled</th></tr></thead>
              <tbody>
                {data.lapsed.map((l) => (
                  <tr key={l.key}>
                    <td style={{ fontWeight: 700 }}>{l.label}</td>
                    <td className="num">{fmtNum(l.active)}</td>
                    <td className="num" style={{ color: l.paused ? "#7A4F00" : undefined, fontWeight: l.paused ? 800 : 400 }}>{fmtNum(l.paused)}</td>
                    <td className="num" style={{ color: l.cancelled ? "#B91C1C" : undefined, fontWeight: l.cancelled ? 800 : 400 }}>{fmtNum(l.cancelled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>Paused and cancelled in this period. A subscription is paused when its access runs out with an invoice unpaid.</Note>
        </Card>
      </div>

      <DataTable
        title="Affiliates"
        columns={[
          { key: "name", label: "Affiliate", render: (r) => <span><strong>{r.name}</strong> <span style={{ color: T.faint }}>{r.code}</span></span>, csv: (r) => r.name },
          { key: "referrals", label: "Families referred", align: "num" },
          { key: "paid", label: "Paid", align: "num" },
          { key: "rate", label: "Paid rate", align: "num", render: (r) => fmtPct(r.referrals ? Math.round((r.paid / r.referrals) * 100) : null), sort: (r) => (r.referrals ? r.paid / r.referrals : -1), csv: (r) => (r.referrals ? Math.round((r.paid / r.referrals) * 100) : "") },
          { key: "commission", label: "Commission earned", align: "num", render: (r) => KES(r.commission), csv: (r) => r.commission },
        ]}
        rows={data.affiliates.map((r) => ({ ...r, key: r.affiliateId }))}
        filename="affiliates-in-period.csv"
        initialSort={{ key: "paid", dir: "desc" }}
        empty="No referrals in this period."
      />
      <DataTable
        title="Per programme"
        columns={[
          { key: "label", label: "Programme" },
          ...STAGES.map((s) => ({ key: s.key, label: s.label, align: "num" })),
          { key: "conversion", label: "Paid rate", align: "num", render: (r) => fmtPct(r.conversion) },
        ]}
        rows={data.funnel}
        filename="enrolment-funnel.csv"
        initialSort={{ key: "enquiries", dir: "desc" }}
      />
      <Note><FiGift size={12} aria-hidden /> Website enquiries with no hub count for the whole workspace and drop out when you pick one hub. Payments made with affiliate credit aren&apos;t counted as money in.</Note>
    </>
  );
}
