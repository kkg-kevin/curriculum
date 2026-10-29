import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useQaVisits } from "../hooks/useQa";
import { VisitRow } from "../components/VisitList";
import { Empty, QaStyles, ScoreBadge, T, card, font, hint } from "../shared";

// QA for the people visited: the educator (/teacher-portal/qa) — their announced visits coming
// up and every report on them, to read and reply to; the hub (/school-portal/qa) — the same for its
// educators, with a summary of each report. A surprise visit shows only once its report is sent.
export default function MyQaPage() {
  const { user } = useAuth();
  const isEducator = user?.role === "teacher";
  // The hub portal's hub switcher — which hub's visits the hub reads (the server goes by the hub
  // the portal is on; this only refetches on a switch). An educator sees all their visits, whatever
  // hub their portal is viewing.
  const { selectedHubId } = useOutletContext() || {};
  const { data, isLoading, isError, error } = useQaVisits({ view: "all", page: 1, limit: 200, ...(!isEducator && selectedHubId ? { hubId: selectedHubId } : {}) });
  const visits = useMemo(() => data?.visits || [], [data]);
  const comingUp = visits.filter((v) => v.status === "open").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const reports = visits.filter((v) => v.status === "submitted");
  const scored = reports.filter((v) => v.score != null);
  const average = scored.length ? Math.round((scored.reduce((n, v) => n + Number(v.score), 0) / scored.length) * 10) / 10 : null;

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16 }}>
      <QaStyles />
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>QA Reviews</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5, maxWidth: 620 }}>
            {isEducator
              ? "Your supervisor visits to see how your classes are going, then sends you a report. Read each one here, and reply if you'd like to."
              : "Visits to your hub's educators by their supervisors, and a summary of each report."}
          </p>
        </div>
        {reports.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "10px 16px", textAlign: "center" }}>
            <ScoreBadge score={average} size="lg" />
            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>Average · {reports.length} {reports.length === 1 ? "report" : "reports"}</p>
          </div>
        )}
      </div>

      {isLoading && <p style={hint}>Loading…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>{error?.message || "Visits couldn't be loaded."}</p>}

      {data && (
        <>
          <section style={{ ...card, overflow: "hidden" }}>
            <h2 style={{ margin: 0, padding: "16px 18px 8px", fontSize: 15, fontWeight: 800, color: T.ink }}>Coming up</h2>
            {comingUp.length === 0
              ? <p style={{ ...hint, padding: "0 18px 16px", margin: 0 }}>{isEducator ? "No announced visits right now." : "No announced visits to your educators right now."}</p>
              : comingUp.map((v) => <VisitRow key={v.id} visit={v} showTeacher={!isEducator} />)}
          </section>
          <section style={{ ...card, overflow: "hidden" }}>
            <h2 style={{ margin: 0, padding: "16px 18px 8px", fontSize: 15, fontWeight: 800, color: T.ink }}>Reports</h2>
            {reports.length === 0
              ? <Empty title="No reports yet">{isEducator ? "Reports from your QA visits appear here once your supervisor sends them." : "Summaries of your educators' QA reports appear here once they're sent."}</Empty>
              : reports.map((v) => <VisitRow key={v.id} visit={v} showTeacher={!isEducator} />)}
          </section>
        </>
      )}
    </div>
  );
}
