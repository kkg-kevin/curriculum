import { Card, DataTable, Note, Stat, fmtNum } from "./ui";
import { pill } from "../../../../theme/brand";
import { OVERALL, STATUS, formatValue } from "../../../mentor-standards/standards";

// Reports & Analytics → Educators (admins only; server: analytics.educators.js): every educator
// teaching in scope, measured against the workspace's mentor standards (Settings → Mentor
// standards) — who needs support and why, and each standard per educator — then their
// performance-profile figures. Click a name for their profile.
const dash = (v, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

// One standard's cell: the figure, coloured by where it stands.
function StandardCell({ item }) {
  if (!item) return "—";
  const look = STATUS[item.status] || STATUS.not_enough;
  if (item.status === "not_enough") return <span title={`Not enough data yet (${item.evidence})`} style={{ color: "#9CA3AF" }}>{item.value == null ? "—" : formatValue(item.value, item.unit)}</span>;
  return <span title={look.label} style={pill(look.tone)}>{formatValue(item.value, item.unit)}</span>;
}

export default function EducatorsTab({ data, links }) {
  if (data.hidden) return <Note>Per-educator figures are for your workspace&apos;s admins.</Note>;
  const t = data.totals || {};
  const standards = data.standards || [];
  const itemOf = (x, key) => x.standards?.items?.find((i) => i.key === key);
  const needsSupport = data.educators
    .filter((x) => x.standards?.overall === "below")
    .sort((a, b) => b.standards.items.filter((i) => i.status === "below").length - a.standards.items.filter((i) => i.status === "below").length);
  const counted = data.educators.filter((x) => x.standards?.counted > 0).length;

  return (
    <>
      <div className="an-stats">
        <Stat label="Educators" value={fmtNum(t.educators)} sub={`${fmtNum(t.published)} with a published profile`} />
        <Stat label="Meeting every standard" value={fmtNum(t.meetingAll)} sub={counted ? `of ${fmtNum(counted)} with enough data` : "no one has enough data yet"} />
        <Stat label="Below a standard" value={fmtNum(t.belowAny)} sub="need support" />
        <Stat label="Average parent rating" value={t.rating != null ? `${t.rating} ★` : "—"} sub="last 12 months" />
        <Stat label="Average quality review" value={t.qa != null ? `${t.qa}%` : "—"} sub="all reviews, each educator" />
        <Stat label="Hours taught" value={fmtNum(t.hours90)} sub="verified, last 90 days" />
      </div>

      {standards.length > 0 && (
        <Card
          title="Needs support"
          subtitle="Educators below at least one mentor standard — their supervisor is told once a month. New educators in their grace period aren't listed."
        >
          {needsSupport.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "#047857", fontWeight: 600 }}>No educator is below a standard right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {needsSupport.map((x) => (
                <div key={x.teacherId} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, border: "1px solid #FECACA", background: "#FEF2F2" }}>
                  <button type="button" className="an-link" onClick={() => links.educator(x.teacherId)} style={{ fontWeight: 800, minWidth: 140, textAlign: "left" }}>{x.name}</button>
                  <span style={{ fontSize: 12.5, color: "#6B7280" }}>{x.standards.met} of {x.standards.counted} met</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {x.standards.items.filter((i) => i.status === "below").map((i) => (
                      <span key={i.key} style={pill("danger")}>{i.label}: {formatValue(i.value, i.unit)} <span style={{ fontWeight: 600, opacity: 0.8 }}>(standard {formatValue(i.target, i.unit)})</span></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {standards.length > 0 && (
        <DataTable
          title="Against the standards"
          subtitle="Each educator's figure for every standard switched on (Settings → Mentor standards). Grey: not enough data yet."
          columns={[
            { key: "name", label: "Educator", render: (x) => <button type="button" className="an-link" onClick={() => links.educator(x.teacherId)}>{x.name}</button>, csv: (x) => x.name },
            {
              key: "met", label: "Met", align: "num",
              render: (x) => <span style={pill((OVERALL[x.standards.overall] || OVERALL.not_enough).tone)}>{x.standards.met}/{x.standards.counted}{x.standards.inGrace ? " · new" : ""}</span>,
              csv: (x) => `${x.standards.met}/${x.standards.counted}`,
              sort: (x) => (x.standards.counted ? x.standards.met / x.standards.counted : -1),
            },
            ...standards.map((sd) => ({
              key: `std-${sd.key}`,
              label: `${sd.label} (${formatValue(sd.target, sd.unit)})`,
              align: "num",
              render: (x) => <StandardCell item={itemOf(x, sd.key)} />,
              csv: (x) => itemOf(x, sd.key)?.value ?? "",
              sort: (x) => {
                const v = itemOf(x, sd.key)?.value;
                return v == null ? -9999 : (sd.higherIsBetter === false ? -v : v);
              },
            })),
          ]}
          rows={data.educators}
          filename="educators-standards.csv"
          initialSort={{ key: "met", dir: "asc" }}
          limit={25}
          empty="No educator teaches in this scope."
        />
      )}

      <DataTable
        title="Figures"
        subtitle="From each educator's performance profile — refreshed nightly; open one for the detail"
        columns={[
          { key: "name", label: "Educator", render: (x) => <button type="button" className="an-link" onClick={() => links.educator(x.teacherId)}>{x.name}</button>, csv: (x) => x.name },
          { key: "rating", label: "Rating", align: "num", render: (x) => (x.rating == null ? "—" : `${x.rating.toFixed(1)} ★ (${x.reviews})`), csv: (x) => x.rating, sort: (x) => x.smoothed ?? -1 },
          { key: "qa", label: "Quality", align: "num", render: (x) => dash(x.qa, "%"), sort: (x) => x.qa ?? -1 },
          { key: "hours", label: "Hours", align: "num", render: (x) => fmtNum(Math.round(x.hours)) },
          { key: "hours90", label: "Hours (90 days)", align: "num", render: (x) => fmtNum(Math.round(x.hours90)) },
          { key: "learners", label: "Learners", align: "num" },
          { key: "reliability", label: "Reliability", align: "num", render: (x) => dash(x.reliability, "%"), sort: (x) => x.reliability ?? -1 },
          { key: "feedbackHours", label: "Marks within", align: "num", render: (x) => (x.feedbackHours == null ? "—" : `${Math.round(x.feedbackHours)} h`), sort: (x) => x.feedbackHours ?? 9999 },
          { key: "finished", label: "Finished", align: "num" },
          { key: "badges", label: "Badges", render: (x) => x.badges.join(", ") || "—", csv: (x) => x.badges.join("; "), sort: (x) => x.badges.length },
          { key: "published", label: "Profile", render: (x) => (x.published ? "Published" : "Private"), csv: (x) => (x.published ? "published" : "private") },
        ]}
        rows={data.educators}
        filename="educators-performance.csv"
        initialSort={{ key: "rating", dir: "desc" }}
        limit={25}
        empty="No educator teaches in this scope."
      />
    </>
  );
}
