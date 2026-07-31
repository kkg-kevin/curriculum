import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useUpdateLearner } from "../../learners/hooks/useLearners";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useCompetencies, useAgeCategories, usePerformanceBands } from "../../curriculum/hooks/useCompetencies";
import { summarizeCoursesProgress } from "../utils/progressStorage";

import { T, cardStyle } from "../components/profile/theme";
import ProfileIdentityCard from "../components/profile/ProfileIdentityCard";
import PortfolioSnapshot from "../components/profile/PortfolioSnapshot";
import SideRail from "../components/SideRail";
import EditProfileModal from "../components/profile/EditProfileModal";
import ProfileTabs from "../components/profile/ProfileTabs";
import CompetencyProgressGrid from "../components/profile/CompetencyProgressGrid";
import MyCoursesCard from "../components/profile/MyCoursesCard";
import SummaryRow from "../components/profile/SummaryRow";
import FrameworkLegend from "../components/profile/FrameworkLegend";
import CompetenciesTabContent from "../components/profile/CompetenciesTabContent";
import LearningJourneyTabContent from "../components/profile/LearningJourneyTabContent";
import AssessmentsOverview from "../components/AssessmentsOverview";
import ReportsOverview from "../components/ReportsOverview";

// classId-scoped components (AssessmentsOverview, SummaryRow) fall back to showing the
// learner's ENTIRE cross-hub assessment history when classId is undefined — correct for a
// caller that truly wants no scoping, but wrong here: this hub just hasn't had a class
// assigned to this learner yet, so show an explicit empty state instead of leaking other hubs' data.
function NoClassNotice() {
  return (
    <div style={{ ...cardStyle(), padding: "32px 24px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>You haven't been assigned to a class in this hub yet — assessment data will appear here once you are.</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, learner, isLoading, hubs, hubsLoading, cls, selectedHub, mentors, mentorsLoading } = useOutletContext();
  const { mutate: updateLearner, isPending: isSaving } = useUpdateLearner();
  const [activeTab, setActiveTab] = useState("Overview");
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Curriculum-scoped content (courses, competencies) follows whichever hub the portal-wide
  // switcher is currently on — the guardian/identity fields and hub/teacher rail below
  // deliberately don't, since those are meant to always show this learner's whole record, not
  // just one hub's slice. Stage/band ARE hub-specific (see selectedHub.currentStageId's own
  // comment in learner.service.js) — a learner running two different curricula at two hubs
  // genuinely has a different Developmental Stage/Performance Band at each.
  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const stage = ageCategories.find((s) => s.id === selectedHub?.currentStageId) || null;
  const { data: performanceBands = [] } = usePerformanceBands(cls?.curriculumId);
  const band = performanceBands.find((b) => b.id === selectedHub?.currentBandId) || null;

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
        <ProfileIdentityCard learner={learner} stage={stage} band={band} onEdit={() => setIsEditOpen(true)} />
        <PortfolioSnapshot coursesCompleted={progressSummary.completed} curriculumId={cls?.curriculumId} learnerId={learner.id} classId={cls?.id} />
        <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
      </div>

      <ProfileTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && (
        <>
          <CompetencyProgressGrid competencies={competencies} isLoading={competenciesLoading} learnerId={learner.id} curriculumId={cls?.curriculumId} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <MyCoursesCard courses={courses} email={user?.email} isLoading={coursesLoading} />
          </div>
        </>
      )}

      {activeTab === "Competencies" && (
        <CompetenciesTabContent competencies={competencies} isLoading={competenciesLoading} learnerId={learner.id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Learning Journey" && (
        <LearningJourneyTabContent learnerId={learner.id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Assessments" && (cls ? <AssessmentsOverview classId={cls.id} /> : <NoClassNotice />)}

      {activeTab === "Reports" && <ReportsOverview />}

      {cls ? <SummaryRow classId={cls.id} /> : <NoClassNotice />}

      <FrameworkLegend />

      {isEditOpen && (
        <EditProfileModal learner={learner} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditOpen(false)} />
      )}
    </div>
  );
}
