import { DataTable, Note, Stat, fmtNum } from "./ui";

// Reports & Analytics → Educators (admins only; server: analytics.educators.js): every educator
// teaching in scope with their performance-profile figures — parent rating, quality reviews, verified
// hours, reliability, feedback speed, learners, badges. Click a name for their profile.
const dash = (v, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

export default function EducatorsTab({ data, links }) {
  if (data.hidden) return <Note>Per-educator figures are for your workspace&apos;s admins.</Note>;
  const t = data.totals || {};
  return (
    <>
      <div className="an-stats">
        <Stat label="Educators" value={fmtNum(t.educators)} sub={`${fmtNum(t.published)} with a published profile`} />
        <Stat label="Average parent rating" value={t.rating != null ? `${t.rating} ★` : "—"} sub="last 12 months" />
        <Stat label="Average quality review" value={t.qa != null ? `${t.qa}%` : "—"} sub="all reviews, each educator" />
        <Stat label="Hours taught" value={fmtNum(t.hours90)} sub="verified, last 90 days" />
      </div>
      <DataTable
        title="Educators"
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
