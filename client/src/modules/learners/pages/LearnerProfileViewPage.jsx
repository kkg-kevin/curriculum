import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { FiClipboard, FiEye } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { learnersListPath, learnerPath } from "../../../routes/portalPaths";
import { useLearnerQuery, useLearnerHubsQuery } from "../hooks/useLearners";
import { useCompetencies, useAgeCategories, useLearnerBandProgress } from "../../curriculum/hooks/useCompetencies";
import { useLearnerCertificates, useLearnerCertificateProgress } from "../../certificates/hooks/useCertificates";
import { deriveBandJourney } from "../../learner-portal/utils/bandJourney";
import { useLearnerMentors } from "../../learner-portal/hooks/useLearnerMentors";
import HubSwitcher from "../../../components/ui/HubSwitcher";
import { T, cardStyle, EmptyState } from "../../learner-portal/components/profile/theme";
import ProfileIdentityCard from "../../learner-portal/components/profile/ProfileIdentityCard";
import GuardianProfileCard from "../../learner-portal/components/profile/GuardianProfileCard";
import PortfolioSnapshot from "../../learner-portal/components/profile/PortfolioSnapshot";
import ShareProfileCard from "../../learner-portal/components/profile/ShareProfileCard";
import SideRail from "../../learner-portal/components/SideRail";
import ProfileTabs from "../../learner-portal/components/profile/ProfileTabs";
import CompetencyProgressGrid from "../../learner-portal/components/profile/CompetencyProgressGrid";
import SummaryRow from "../../learner-portal/components/profile/SummaryRow";
import FrameworkLegend from "../../learner-portal/components/profile/FrameworkLegend";
import CompetenciesTabContent from "../../learner-portal/components/profile/CompetenciesTabContent";
import PathwayTabContent from "../../learner-portal/components/profile/PathwayTabContent";
import ProgressArcCard from "../../learner-portal/components/ProgressArcCard";
import AssessmentsOverview from "../../learner-portal/components/AssessmentsOverview";
import ReportsOverview from "../../learner-portal/components/ReportsOverview";
import AchievementsShowcase from "../../certificates/components/AchievementsShowcase";

function NoClassNotice() {
  return (
    <div style={{ ...cardStyle(), padding: "12px 24px" }}>
      <EmptyState icon={FiClipboard}>This learner hasn't been assigned to a class in this hub yet — assessment data will appear here once they are.</EmptyState>
    </div>
  );
}

// The learner's own profile (learner-portal/pages/ProfilePage.jsx), as an admin or a school sees
// it — the same cards, read for this learner instead of the signed-in one. What belongs to the
// signed-in account there (password, email settings) is left off; the edit buttons go to the
// learner's Edit page. "My Courses" is left off too: a learner's course progress is kept in their
// own browser, so staff can't see it — the achievements section's course progress is the
// server-side equivalent.
export default function LearnerProfileViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSchool = user?.role === "school";
  // The school portal's own hub switcher (useSchoolPortalScope) — a school sees this learner
  // only at the hub it's on, matching every other school-portal page.
  const { selectedHubId: schoolHubId } = useOutletContext() || {};

  const { data: learner, isLoading } = useLearnerQuery(id);
  const { data: enrollments = [], isLoading: hubsLoading } = useLearnerHubsQuery(id);
  const hubs = useMemo(
    () => (isSchool ? enrollments.filter((h) => h.id === schoolHubId) : enrollments),
    [enrollments, isSchool, schoolHubId],
  );
  const [pickedHubId, setPickedHubId] = useState(null);
  const selectedHub = hubs.find((h) => h.id === pickedHubId) || hubs.find((h) => h.status === "active") || hubs[0] || null;
  const cls = selectedHub?.class || null;
  const { mentors, mentorsLoading } = useLearnerMentors(hubs);
  const [activeTab, setActiveTab] = useState("Overview");

  // Same hub-following data as the learner's own page — see ProfilePage.jsx.
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const stage = ageCategories.find((s) => s.id === selectedHub?.currentStageId) || null;
  const { data: bandProgress = [] } = useLearnerBandProgress(cls?.curriculumId, id);
  const { current: currentBand, next: nextBand } = useMemo(() => deriveBandJourney(bandProgress), [bandProgress]);

  // Certificates held (the learner sees only standing ones), and what they can earn next here.
  const { data: allCertificates = [], isLoading: certificatesLoading } = useLearnerCertificates(id);
  const certificates = useMemo(() => allCertificates.filter((c) => c.status === "issued"), [allCertificates]);
  const { data: certificateProgress } = useLearnerCertificateProgress(id, selectedHub?.id);
  const coursesCompleted = certificates.filter((c) => c.kind === "course" && c.hubId === selectedHub?.id).length;

  const goToEdit = () => navigate(learnerPath(user?.role, id, "edit"));

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }
  if (!learner) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(learnersListPath(user?.role, schoolHubId))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Learners
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <button type="button" onClick={() => navigate(learnerPath(user?.role, id, "view"))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          {learner.firstName} {learner.lastName}
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>Profile</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, color: T.accent, fontSize: 13 }}>
        <FiEye size={15} style={{ flexShrink: 0 }} />
        <span>You're seeing {learner.firstName}'s profile as {learner.firstName} and their family see it in the learner portal.</span>
      </div>

      <HubSwitcher hubs={hubs} selectedHubId={selectedHub?.id} onChange={setPickedHubId} />

      <ProfileIdentityCard learner={learner} stage={stage} band={currentBand} nextBand={nextBand} onEdit={goToEdit} />

      {activeTab === "Overview" && <ProgressArcCard curriculumId={cls?.curriculumId} learnerId={id} />}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
          <GuardianProfileCard learner={learner} onEdit={goToEdit} />
          <ShareProfileCard learner={learner} />
          <PortfolioSnapshot coursesCompleted={coursesCompleted} curriculumId={cls?.curriculumId} learnerId={id} classId={cls?.id} staffLearnerId={id} />
        </div>
        <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
      </div>

      <AchievementsShowcase certificates={certificates} progress={certificateProgress} isLoading={certificatesLoading} />

      <ProfileTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && (
        <CompetencyProgressGrid competencies={competencies} isLoading={competenciesLoading} learnerId={id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Competencies" && (
        <CompetenciesTabContent competencies={competencies} isLoading={competenciesLoading} learnerId={id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Pathway" && (
        <PathwayTabContent learnerId={id} curriculumId={cls?.curriculumId} />
      )}

      {activeTab === "Assessments" && (cls ? <AssessmentsOverview classId={cls.id} staffLearnerId={id} /> : <NoClassNotice />)}

      {activeTab === "Reports" && <ReportsOverview hubId={selectedHub?.id} staffLearnerId={id} learner={learner} cls={cls} />}

      {cls ? <SummaryRow classId={cls.id} staffLearnerId={id} /> : <NoClassNotice />}

      <FrameworkLegend />
    </div>
  );
}
