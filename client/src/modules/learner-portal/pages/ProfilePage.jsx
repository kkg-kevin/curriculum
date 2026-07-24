import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { learnerApi } from "../../learners/services/learnerApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { useUpdateLearner, useLearnerHubsQuery } from "../../learners/hooks/useLearners";
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
  const { user } = useAuth();
  const { mutate: updateLearner, isPending: isSaving } = useUpdateLearner();
  const [activeTab, setActiveTab] = useState("Overview");
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data: learnersData, isLoading: learnerLoading } = useQuery({
    queryKey: ["learners", "byGuardianEmail", user?.email],
    queryFn: () => learnerApi.getAll({ guardianEmail: user.email }),
    enabled: !!user?.email,
  });
  const learner = learnersData?.data?.[0] || null;

  // A learner can be enrolled at several hubs — the first active enrollment is used as the
  // "current" context for curriculum-scoped data (courses, competencies), same default used
  // on DashboardPage/MyCoursesPage until a hub-context switcher exists for this portal.
  const { data: hubs = [], isLoading: hubsLoading } = useLearnerHubsQuery(learner?.id);
  const primary = hubs.find((h) => h.status === "active") || hubs[0] || null;
  const cls = primary?.class || null;

  const { data: courses = [], isLoading: coursesLoading } = useCurriculumCurrentCourses(cls?.curriculumId, cls?.gradeName);
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(cls?.curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(cls?.curriculumId);
  const stage = ageCategories.find((s) => s.id === learner?.currentStageId) || null;

  // "My Teachers & Mentors" resolves each hub's class teacher — real data via a small join,
  // not a fabricated mentor list. Hubs with no class teacher assigned are simply omitted.
  const teacherIds = useMemo(
    () => [...new Set(hubs.map((h) => h.class?.classTeacherId).filter(Boolean))],
    [hubs]
  );
  const { data: mentorTeachers = [], isLoading: mentorTeachersLoading } = useQuery({
    queryKey: ["learner-profile-mentor-teachers", teacherIds],
    queryFn: () => Promise.all(teacherIds.map((id) => teacherApi.getById(id))),
    enabled: teacherIds.length > 0,
  });
  const mentors = useMemo(
    () => hubs
      .filter((h) => h.class?.classTeacherId)
      .map((h) => {
        const teacher = mentorTeachers.find((t) => t.id === h.class.classTeacherId);
        return teacher ? { teacher, hubName: h.name } : null;
      })
      .filter(Boolean),
    [hubs, mentorTeachers]
  );

  const progressSummary = useMemo(() => summarizeCoursesProgress(user?.email, courses), [user?.email, courses]);

  const isLoading = learnerLoading || (!!learner && hubsLoading);

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
        <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={teacherIds.length > 0 && mentorTeachersLoading} />
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

      {activeTab === "Assessments" && <AssessmentsOverview />}

      {!["Overview", "Competencies", "Assessments"].includes(activeTab) && <ComingSoonPanel tab={activeTab} />}

      <SummaryRow />

      <FrameworkLegend />

      {isEditOpen && (
        <EditProfileModal learner={learner} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditOpen(false)} />
      )}
    </div>
  );
}
