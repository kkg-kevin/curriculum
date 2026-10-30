import { T, KID, cardStyle, KidHeading, PreviewTag } from "./theme";
import { useCompetencies, useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";
import { useIssuedForLearner } from "../../../assessments/hooks/useAssessmentSubmission";
import { FiAward, FiBriefcase, FiCheckCircle, FiTarget } from "react-icons/fi";

// Gold (T.gold, otherwise unused elsewhere on this page) marks a stat as real, earned progress —
// distinct from the accent blue used for every other UI chrome on the page, so these numbers
// read as achievement rather than blending into the rest of the interface.
function Stat({ value, label, isReal, icon: Icon, tone }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4, padding: "14px 8px", borderRadius: 18, backgroundColor: isReal ? tone.soft : "#F6F7FA", border: `1.5px solid ${isReal ? tone.border : T.border}` }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", color: isReal ? tone.color : T.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(37,71,106,0.08)" }}>
        <Icon size={19} strokeWidth={2.4} />
      </span>
      <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: isReal ? tone.color : T.inkFaint, lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.inkMuted, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

// `staffLearnerId` — an admin/school viewing that learner's profile (see AssessmentsOverview).
export default function PortfolioSnapshot({ coursesCompleted, curriculumId, learnerId, classId, staffLearnerId, hubId }) {
  const { data: competencies = [] } = useCompetencies(curriculumId);
  const { data: scores = [] } = useLearnerCompetencyScores(curriculumId, learnerId, hubId);
  const { data: issuedData } = useIssuedForLearner(staffLearnerId);

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
      <KidHeading icon={FiBriefcase} tone={KID.gold} action={<PreviewTag />}>Portfolio Snapshot</KidHeading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
        <Stat value={competenciesOnTrack} label="Skills on track" isReal={competencies.length > 0} icon={FiTarget} tone={KID.sky} />
        <Stat value={evidenceItemsCollected} label="Pieces of work marked" isReal={evidenceItemsCollected > 0} icon={FiCheckCircle} tone={KID.sky} />
        <Stat value={coursesCompleted} label="Courses finished" isReal icon={FiAward} tone={KID.gold} />
      </div>
    </div>
  );
}
