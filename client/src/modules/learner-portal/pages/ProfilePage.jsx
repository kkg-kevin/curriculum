import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useUpdateLearner } from "../../learners/hooks/useLearners";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useCompetencies, useAgeCategories } from "../../curriculum/hooks/useCompetencies";
import { summarizeCoursesProgress } from "../utils/progressStorage";

import { T, cardStyle } from "../components/profile/theme";
import ProfileIdentityCard from "../components/profile/ProfileIdentityCard";
import PortfolioSnapshot from "../components/profile/PortfolioSnapshot";
import SideRail from "../components/SideRail";
import EditProfileModal from "../components/profile/EditProfileModal";
import ProfileTabs from "../components/profile/ProfileTabs";
import CompetencyProgressGrid from "../components/profile/CompetencyProgressGrid";
import LearningJourneyCard from "../components/profile/LearningJourneyCard";
import RecentEvidenceCard from "../components/profile/RecentEvidenceCard";
import BadgesCertificatesCard from "../components/profile/BadgesCertificatesCard";
import SummaryRow from "../components/profile/SummaryRow";
import FrameworkLegend from "../components/profile/FrameworkLegend";
import CompetenciesTabContent from "../components/profile/CompetenciesTabContent";
import AssessmentsOverview from "../components/AssessmentsOverview";

function ComingSoonPanel({ tab }) {
  return (
    <div style={{ ...cardStyle(), padding: "60px 24px", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: T.ink }}>{tab} is coming soon</h3>
      <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>This section isn't built yet — check the Overview tab for what's live today.</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, learner, isLoading, hubs, hubsLoading, cls, mentors, mentorsLoading } = useOutletContext();
  const { mutate: updateLearner, isPending: isSaving } = useUpdateLearner();
  const [activeTab, setActiveTab] = useState("Overview");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Curriculum-scoped content (courses, competencies) follows whichever hub the portal-wide
  // switcher is currently on — the identity card and hub/teacher rail below deliberately don't,
  // since those are meant to always show this learner's whole record, not just one hub's slice.
  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const stage = ageCategories.find((s) => s.id === learner?.currentStageId) || null;

  const progressSummary = useMemo(() => summarizeCoursesProgress(user?.email, courses), [user?.email, courses]);

  const handleSave = (formData) => {
    updateLearner({ id: learner.id, data: formData }, { onSuccess: () => setIsEditOpen(false) });
  };

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  if (!learner) {
    return (
      <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>No learner profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Ask your school to connect this account to a learner record.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: "-0.3px" }}>Learner Profile</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>A lifelong record of learning. Portable. Verifiable. Future Ready.</p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <ProfileIdentityCard learner={learner} stage={stage} onEdit={() => setIsEditOpen(true)} />
        <PortfolioSnapshot coursesCompleted={progressSummary.completed} />
        <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
      </div>

      <ProfileTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && (
        <>
          <CompetencyProgressGrid competencies={competencies} isLoading={competenciesLoading} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <LearningJourneyCard courses={courses} email={user?.email} isLoading={coursesLoading} />
            <RecentEvidenceCard />
            <BadgesCertificatesCard />
          </div>
        </>
      )}

      {activeTab === "Competencies" && (
        <CompetenciesTabContent competencies={competencies} isLoading={competenciesLoading} />
      )}

      {activeTab === "Assessments" && <AssessmentsOverview classId={cls?.id} />}

      {!["Overview", "Competencies", "Assessments"].includes(activeTab) && <ComingSoonPanel tab={activeTab} />}

      <SummaryRow classId={cls?.id} />

      <FrameworkLegend />

      {isEditOpen && (
        <EditProfileModal learner={learner} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditOpen(false)} />
      )}
    </div>
  );
}
