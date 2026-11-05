import { useNavigate } from "react-router-dom";
import { BarList, Card, DataTable, Note, Stat, T, fmtDate, fmtNum } from "./ui";

// Reports & Analytics → Parent feedback (server: analytics.feedback.js): what parents (and TOT
// learners) said about the educators in scope in the period. Admins see every educator and the open
// conduct concerns; a hub sees averages only for educators with 3+ reviews, never concerns.
const stars = (n) => (n == null ? "—" : `${Number(n).toFixed(1)} ★`);

export default function ParentFeedbackTab({ data, isHub }) {
  const navigate = useNavigate();
  if (data.hidden) return <Note>Your workspace doesn&apos;t share parent feedback averages with hubs.</Note>;
  const educatorPath = (id) => (isHub ? `/school-portal/teachers/${id}/view` : `/teachers/${id}/view`);
  const aspectColumns = (data.aspects || []).map((a) => ({
    key: `aspect-${a.key}`, label: a.label, align: "num",
    render: (x) => (x.aspects?.[a.key] == null ? "—" : x.aspects[a.key].toFixed(1)),
    csv: (x) => x.aspects?.[a.key] ?? "",
    sort: (x) => x.aspects?.[a.key] ?? -1,
  }));

  return (
    <>
      <div className="an-stats">
        <Stat label="Reviews" value={fmtNum(data.summary?.count)} sub="from parents and TOT learners" />
        <Stat label="Average rating" value={stars(data.summary?.average)} sub="out of 5" />
        <Stat label="Educators reviewed" value={fmtNum(data.educators.length)} sub={isHub && data.tooFew ? `${data.tooFew} more with fewer than ${data.minReviews} reviews` : "in this period"} />
        {!isHub && <Stat label="Open concerns" value={fmtNum(data.concerns.length)} sub="about conduct — to follow up" />}
      </div>

      {data.summary?.aspects?.length > 0 && (
        <Card title="By aspect" subtitle="Average stars for each thing parents rate">
          <BarList rows={data.summary.aspects.map((a) => ({ label: a.label, value: a.average || 0 }))} max={5} color={T.mid} format={(v) => (v ? v.toFixed(1) : "—")} empty="No ratings in this period." />
        </Card>
      )}

      <DataTable
        title="Educators"
        subtitle={isHub ? `Educators with at least ${data.minReviews} reviews — so no one family can be picked out` : "Lowest average first"}
        columns={[
          { key: "name", label: "Educator", render: (x) => <button type="button" className="an-link" onClick={() => navigate(educatorPath(x.teacherId))}>{x.name}</button>, csv: (x) => x.name },
          { key: "count", label: "Reviews", align: "num" },
          { key: "average", label: "Average", align: "num", render: (x) => stars(x.average), csv: (x) => x.average },
          ...aspectColumns,
          ...(isHub ? [] : [{ key: "openConcerns", label: "Open concerns", align: "num" }]),
          { key: "lastReviewAt", label: "Last review", render: (x) => fmtDate(x.lastReviewAt), csv: (x) => x.lastReviewAt, sort: (x) => new Date(x.lastReviewAt).getTime() },
        ]}
        rows={data.educators}
        filename="parent-feedback-by-educator.csv"
        initialSort={{ key: "average", dir: "asc" }}
        empty="No educator has been reviewed in this period."
      />

      {!isHub && (
        <DataTable
          title="Open concerns"
          subtitle="Raised by parents about an educator's conduct — open the educator to read and resolve"
          columns={[
            { key: "createdAt", label: "Raised", render: (x) => fmtDate(x.createdAt), csv: (x) => x.createdAt, sort: (x) => new Date(x.createdAt).getTime() },
            { key: "educator", label: "Educator", render: (x) => <button type="button" className="an-link" onClick={() => navigate(educatorPath(x.teacherId))}>{x.educator}</button>, csv: (x) => x.educator },
            { key: "learner", label: "About", render: (x) => [x.learner, x.hubName].filter(Boolean).join(" · "), csv: (x) => x.learner },
            { key: "text", label: "Concern" },
          ]}
          rows={data.concerns}
          filename="parent-feedback-concerns.csv"
          initialSort={{ key: "createdAt", dir: "desc" }}
          empty="No open concerns in this period."
        />
      )}
    </>
  );
}
