import { FiAward, FiCheckCircle, FiBookOpen } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";
import { useCompetencies, useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";
import { useIssuedForLearner } from "../../../assessments/hooks/useAssessmentSubmission";

// Gold (T.gold, otherwise unused elsewhere on this page) marks a stat as real, earned progress —
// distinct from the accent blue used for every other UI chrome on the page, so these numbers
// read as achievement rather than blending into the rest of the interface.
function Stat({ value, label, isReal, icon: Icon }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: isReal ? "#FEF3E2" : "#F3F4F6", color: isReal ? T.gold : T.inkFaint, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} />
      </div>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: isReal ? T.ink : T.inkFaint }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted, lineHeight: 1.3 }}>{label}</p>
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
        <Stat value={competenciesOnTrack} label="Competencies On Track" isReal={competencies.length > 0} icon={FiAward} />
        <Stat value={evidenceItemsCollected} label="Evidence Items Collected" isReal={evidenceItemsCollected > 0} icon={FiCheckCircle} />
        <Stat value={coursesCompleted} label="Courses Completed" isReal icon={FiBookOpen} />
      </div>
    </div>
  );
}
