import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";
import { useCompetencies, useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";
import { useIssuedForLearner } from "../../../assessments/hooks/useAssessmentSubmission";

function Stat({ value, label, isReal }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: isReal ? T.accent : T.inkFaint }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{label}</p>
    </div>
  );
}

export default function PortfolioSnapshot({ coursesCompleted, curriculumId, learnerId, classId }) {
  const { data: competencies = [] } = useCompetencies(curriculumId);
  const { data: scores = [] } = useLearnerCompetencyScores(curriculumId, learnerId);
  const { data: issuedData } = useIssuedForLearner();

  // "On track" = adopted competencies whose real score has cleared this curriculum's own
  // minimumThreshold for that competency — the same threshold shown on the Competencies tab.
  const onTrackCount = scores.filter((s) => {
    const threshold = competencies.find((c) => c.id === s.competencyId)?.minimumThreshold ?? 60;
    return s.score >= threshold;
  }).length;
  const competenciesOnTrack = competencies.length > 0 ? `${onTrackCount}/${competencies.length}` : "—";

  // Evidence items collected — every assessment this learner has actually been graded on, in
  // this hub's class (same classId scoping as AssessmentsOverview/SummaryRow).
  const allRows = issuedData?.data || [];
  const rows = classId ? allRows.filter((r) => r.issue.classId === classId) : allRows;
  const evidenceItemsCollected = rows.filter((r) => r.submission.status === "graded").length;

  return (
    <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={sectionHeaderStyle()}>Portfolio Snapshot</h2>
        <PreviewTag />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px 12px" }}>
        <Stat value={competenciesOnTrack} label="Competencies On Track" isReal={competencies.length > 0} />
        <Stat value={evidenceItemsCollected} label="Evidence Items Collected" isReal={evidenceItemsCollected > 0} />
        <Stat value={coursesCompleted} label="Courses Completed" isReal />
      </div>
    </div>
  );
}
