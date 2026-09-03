import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useUpdateLearner } from "../../learners/hooks/useLearners";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
import { useCompetencies, useAgeCategories, useLearnerBandProgress } from "../../curriculum/hooks/useCompetencies";
import { summarizeCoursesProgress } from "../utils/progressStorage";
import { deriveBandJourney } from "../utils/bandJourney";

import { FiClipboard } from "react-icons/fi";
import { T, cardStyle, EmptyState } from "../components/profile/theme";
import ProfileIdentityCard from "../components/profile/ProfileIdentityCard";
import GuardianProfileCard from "../components/profile/GuardianProfileCard";
import PortfolioSnapshot from "../components/profile/PortfolioSnapshot";
import ShareProfileCard from "../components/profile/ShareProfileCard";
import SideRail from "../components/SideRail";
import EditProfileModal from "../components/profile/EditProfileModal";
import EditGuardianProfileModal from "../components/profile/EditGuardianProfileModal";
import PasswordRevealDialog from "../../../components/ui/PasswordRevealDialog";
import ProfileTabs from "../components/profile/ProfileTabs";
import CompetencyProgressGrid from "../components/profile/CompetencyProgressGrid";
import MyCoursesCard from "../components/profile/MyCoursesCard";
import SummaryRow from "../components/profile/SummaryRow";
import FrameworkLegend from "../components/profile/FrameworkLegend";
import CompetenciesTabContent from "../components/profile/CompetenciesTabContent";
import ProgressArcCard from "../components/ProgressArcCard";
import PathwayTabContent from "../components/profile/PathwayTabContent";
import AssessmentsOverview from "../components/AssessmentsOverview";
import ReportsOverview from "../components/ReportsOverview";

// classId-scoped components (AssessmentsOverview, SummaryRow) fall back to showing the
// learner's ENTIRE cross-hub assessment history when classId is undefined — correct for a
// caller that truly wants no scoping, but wrong here: this hub just hasn't had a class
// assigned to this learner yet, so show an explicit empty state instead of leaking other hubs' data.
function NoClassNotice() {
  return (
    <div style={{ ...cardStyle(), padding: "12px 24px" }}>
      <EmptyState icon={FiClipboard}>You haven't been assigned to a class in this hub yet — assessment data will appear here once you are.</EmptyState>
    </div>
  );
}

export default function ProfilePage() {
  const { user, learner, isLoading, hubs, hubsLoading, cls, selectedHub, mentors, mentorsLoading } = useOutletContext();
  const { mutate: updateLearner, isPending: isSaving } = useUpdateLearner();
  const [activeTab, setActiveTab] = useState("Overview");
  // null | "learner" | "guardian" — which of the two now-separate edit modals is open.
  const [editing, setEditing] = useState(null);
  // { password, name } — shown once after a save that included a new password (learner's own or
  // the guardian's own); only one of the two modals ever sets a password per submit, so a single
  // slot (not a queue) is enough here, unlike CreateLearnerPage/EditLearnerPage which can set both
  // in one go.
  const [passwordReveal, setPasswordReveal] = useState(null);

  // Curriculum-scoped content (courses, competencies) follows whichever hub the portal-wide
  // switcher is currently on — the guardian/identity fields and hub/teacher rail below
  // deliberately don't, since those are meant to always show this learner's whole record, not
  // just one hub's slice. Stage IS hub-specific (see selectedHub.currentStageId's own comment in
  // learner.service.js) — a learner running two different curricula at two hubs genuinely has a
  // different Developmental Stage at each.
  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeId);
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const stage = ageCategories.find((s) => s.id === selectedHub?.currentStageId) || null;
  // "Current Level Summary" now reflects this learner's live standing (Engine 4's per-band
  // completion %, same data the Competencies tab's Band Progress section shows) instead of
  // selectedHub.currentBandId — a value only ever written once, by a diagnostic-placement event,
  // that never updates again as the learner keeps progressing. Both surfaces read the same
  // deriveBandJourney() so they can never disagree with each other.
  const { data: bandProgress = [] } = useLearnerBandProgress(cls?.curriculumId, learner?.id);
  const { current: currentBand, next: nextBand } = useMemo(() => deriveBandJourney(bandProgress), [bandProgress]);

  // A learner's own dedicated login has no email — fall back to username so progress storage
  // (keyed locally per-learner, see progressStorage.js) doesn't collapse into a shared bucket.
  const progressKey = user?.email || user?.username;
  const progressSummary = useMemo(() => summarizeCoursesProgress(progressKey, courses), [progressKey, courses]);

  const handleSaveLearner = (formData) => {
    updateLearner({ id: learner.id, data: formData }, {
      onSuccess: () => {
        if (formData.learnerPassword) {
          setPasswordReveal({ password: formData.learnerPassword, name: `${learner.firstName} ${learner.lastName} (learner login)` });
        }
        setEditing(null);
      },
    });
  };

  const handleSaveGuardian = (formData) => {
    updateLearner({ id: learner.id, data: formData }, {
      onSuccess: () => {
        if (formData.password) {
          setPasswordReveal({ password: formData.password, name: formData.guardianName || learner.guardianName });
        }
        setEditing(null);
      },
    });
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
      <ProfileIdentityCard learner={learner} stage={stage} band={currentBand} nextBand={nextBand} onEdit={() => setEditing("learner")} />

      {/* Only on Overview — Progress Arc otherwise lived further down, inside the Overview tab's
          own content below; moved up here, above Guardian Profile/My Learning Hubs, per the
          product decision this was built for. Still tab-scoped (not shown on Competencies/
          Pathway/etc.) since CompetencyProgressGrid right below it already covers the
          Overview-only Progress Arc + competency summary pairing those other tabs don't need. */}
      {activeTab === "Overview" && <ProgressArcCard curriculumId={cls?.curriculumId} learnerId={learner.id} />}

      {/* Guardian + Portfolio stack into their own column (matching SideRail's own two stacked
          cards) rather than sitting as three same-row siblings of mismatched height — Guardian
          Profile and Portfolio Snapshot are both short, so left as flex siblings next to
          SideRail's taller stacked pair they just left dead space below them. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
          <GuardianProfileCard learner={learner} onEdit={() => setEditing("guardian")} />
          <ShareProfileCard learnerId={learner.id} />
          <PortfolioSnapshot coursesCompleted={progressSummary.completed} curriculumId={cls?.curriculumId} learnerId={learner.id} classId={cls?.id} />
        </div>
        <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
      </div>

      <ProfileTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && (
        <>
          <CompetencyProgressGrid competencies={competencies} isLoading={competenciesLoading} learnerId={learner.id} curriculumId={cls?.curriculumId} />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <MyCoursesCard courses={courses} email={progressKey} isLoading={coursesLoading} />
          </div>
        </>
      )}

      {activeTab === "Competencies" && (
        <CompetenciesTabContent competencies={competencies} isLoading={competenciesLoading} learnerId={learner.id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Pathway" && (
        <PathwayTabContent learnerId={learner.id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Assessments" && (cls ? <AssessmentsOverview classId={cls.id} /> : <NoClassNotice />)}

      {activeTab === "Reports" && <ReportsOverview hubId={selectedHub?.id} />}

      {cls ? <SummaryRow classId={cls.id} /> : <NoClassNotice />}

      <FrameworkLegend />

      {editing === "learner" && (
        <EditProfileModal learner={learner} isSaving={isSaving} onSave={handleSaveLearner} onClose={() => setEditing(null)} />
      )}
      {editing === "guardian" && (
        <EditGuardianProfileModal learner={learner} isSaving={isSaving} onSave={handleSaveGuardian} onClose={() => setEditing(null)} />
      )}

      <PasswordRevealDialog
        isOpen={!!passwordReveal}
        password={passwordReveal?.password}
        subjectName={passwordReveal?.name}
        onClose={() => setPasswordReveal(null)}
      />
    </div>
  );
}
