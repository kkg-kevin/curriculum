import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { FiClipboard, FiEye } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { learnersListPath, learnerPath } from "../../../routes/portalPaths";
import {
  useLearnerQuery, useLearnerHubsQuery, useUpdateLearner, useDeleteLearner,
  useUpdateLearnerAccountStatus, useUnenrollLearnerHub,
} from "../hooks/useLearners";
import { learnerApi } from "../services/learnerApi";
import { useCompetencies, useAgeCategories, useLearnerBandProgress } from "../../curriculum/hooks/useCompetencies";
import { useLearnerCertificates, useLearnerCertificateProgress } from "../../certificates/hooks/useCertificates";
import { deriveBandJourney } from "../../learner-portal/utils/bandJourney";
import { stagePendingReason } from "../../../utils/learnerAge";
import { useLearnerMentors } from "../../learner-portal/hooks/useLearnerMentors";
import HubSwitcher from "../../../components/ui/HubSwitcher";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import PasswordRevealDialog from "../../../components/ui/PasswordRevealDialog";
import RecordHistory, { canSeeRecordHistory } from "../../activity/components/RecordHistory";
import { T, cardStyle, EmptyState } from "../../learner-portal/components/profile/theme";
import ProfileIdentityCard from "../../learner-portal/components/profile/ProfileIdentityCard";
import GuardianProfileCard from "../../learner-portal/components/profile/GuardianProfileCard";
import PortfolioSnapshot from "../../learner-portal/components/profile/PortfolioSnapshot";
import ShareProfileCard from "../../learner-portal/components/profile/ShareProfileCard";
import EditProfileModal from "../../learner-portal/components/profile/EditProfileModal";
import EditGuardianProfileModal from "../../learner-portal/components/profile/EditGuardianProfileModal";
import SideRail from "../../learner-portal/components/SideRail";
import ProfileTabs, { PROFILE_TABS } from "../../learner-portal/components/profile/ProfileTabs";
import CompetencyProgressGrid from "../../learner-portal/components/profile/CompetencyProgressGrid";
import SummaryRow from "../../learner-portal/components/profile/SummaryRow";
import FrameworkLegend from "../../learner-portal/components/profile/FrameworkLegend";
import CompetenciesTabContent from "../../learner-portal/components/profile/CompetenciesTabContent";
import PathwayTabContent from "../../learner-portal/components/profile/PathwayTabContent";
import ProgressArcCard from "../../learner-portal/components/ProgressArcCard";
import AssessmentsOverview from "../../learner-portal/components/AssessmentsOverview";
import ReportsOverview from "../../learner-portal/components/ReportsOverview";
import AchievementsShowcase from "../../certificates/components/AchievementsShowcase";
import LearnerStaffBar from "../components/staff/LearnerStaffBar";
import LearnerHubsManager from "../components/staff/LearnerHubsManager";
import PathwayManagerCard from "../components/staff/PathwayManagerCard";
import ParentTab from "../components/staff/ParentTab";
import WebsiteDiagnosticsCard from "../components/staff/WebsiteDiagnosticsCard";
import DiagnosticReportCard from "../../learner-portal/components/profile/DiagnosticReportCard";

function NoClassNotice() {
  return (
    <div style={{ ...cardStyle(), padding: "12px 24px" }}>
      <EmptyState icon={FiClipboard}>This learner hasn't been assigned to a class in this hub yet — assessment data will appear here once they are.</EmptyState>
    </div>
  );
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : null);
// A "YYYY-MM-DD" calendar date, never shifted by the viewer's timezone.
const formatBirthDate = (value) => {
  const [y, m, d] = String(value || "").slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : value || null;
};
// "Website — bootcamp enrolment · Robotics Holiday Camp · 30 Oct 2026" (server: learner-origin.js).
const joinedVia = (origin) => (origin ? [origin.title, origin.detail, formatDate(origin.at)].filter(Boolean).join(" · ") : null);

// One page per learner for staff (admin, staff, a learning hub): the learner's own profile
// (learner-portal/pages/ProfilePage.jsx) — the same cards, for this learner — with everything
// staff do to the record on it too. The bar at the top holds the whole-record actions (account
// on/off, remove, the full Edit form); the details are edited in place with the learner portal's
// own modals; hub enrollments sit in the side rail; placement (stage, pathways, diagnostics) is
// the Pathway tab; the activity log is the History tab. "Preview as learner" hides all of it and
// shows the page exactly as the learner and their family see it.
// What belongs to the learner's own account there (change password, email settings) is left off —
// staff set the passwords from the edit modals. "My Courses" is left off too: a learner's course
// progress is kept in their own browser; the achievements section is the server-side equivalent.
export default function LearnerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSchool = user?.role === "school";
  // A hub's Account Manager / Training Lead signs in as the hub but only looks (blockHubLeadWrites).
  const canManage = !user?.hubLead;
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
  const curriculumId = cls?.curriculumId;
  const { mentors, mentorsLoading } = useLearnerMentors(hubs);

  const [preview, setPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  // The tab row — the Guardian card's "Parent's login…" link scrolls to it.
  const tabsRef = useRef(null);
  // null | "learner" | "guardian" — which edit modal is open.
  const [editing, setEditing] = useState(null);
  // { password, name } — shown once after a save that set a password (see ProfilePage.jsx).
  const [passwordReveal, setPasswordReveal] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmAccountToggle, setConfirmAccountToggle] = useState(false);

  const { mutate: updateLearner, isPending: isSaving } = useUpdateLearner();
  const { mutate: deleteLearner } = useDeleteLearner();
  const { mutate: updateAccountStatus, isPending: accountTogglePending } = useUpdateLearnerAccountStatus();
  const { mutate: unenroll } = useUnenrollLearnerHub();

  // Same hub-following data as the learner's own page — see ProfilePage.jsx.
  const { data: competencies = [], isLoading: competenciesLoading } = useCompetencies(curriculumId);
  const { data: ageCategories = [] } = useAgeCategories(curriculumId);
  const stage = ageCategories.find((s) => s.id === selectedHub?.currentStageId) || null;
  const { data: bandProgress = [] } = useLearnerBandProgress(curriculumId, id, selectedHub?.id);
  const { current: currentBand, next: nextBand } = useMemo(() => deriveBandJourney(bandProgress), [bandProgress]);

  // Certificates held (the learner sees only standing ones), and what they can earn next here.
  const { data: allCertificates = [], isLoading: certificatesLoading } = useLearnerCertificates(id);
  const certificates = useMemo(() => allCertificates.filter((c) => c.status === "issued"), [allCertificates]);
  const { data: certificateProgress } = useLearnerCertificateProgress(id, selectedHub?.id);
  const coursesCompleted = certificates.filter((c) => c.kind === "course" && c.hubId === selectedHub?.id).length;

  const manage = canManage && !preview;
  // Staff also get the Parent tab (the parent on their own) and, when they may read the log, History.
  // An educator in training (TOT — learner.teacherId) is an adult learning for themself: no parent.
  const isEducatorTrainee = !!learner?.teacherId;
  const tabs = preview ? PROFILE_TABS : [...PROFILE_TABS, ...(isEducatorTrainee ? [] : ["Parent"]), ...(canSeeRecordHistory(user) ? ["History"] : [])];
  const tab = tabs.includes(activeTab) ? activeTab : "Overview";

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }
  if (!learner) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;
  }

  const fullName = `${learner.firstName} ${learner.lastName}`;
  const accountStatus = learner.accountStatus || "active";
  const listPath = learnersListPath(user?.role, schoolHubId);

  const save = (formData, revealFor) => {
    updateLearner({ id, data: formData }, {
      onSuccess: () => {
        const reveal = revealFor(formData);
        if (reveal) setPasswordReveal(reveal);
        setEditing(null);
      },
    });
  };
  const handleSaveLearner = (formData) => save(formData, (d) => d.learnerPassword && { password: d.learnerPassword, name: `${fullName} (learner login)` });
  const handleSaveGuardian = (formData) => save(formData, (d) => d.password && { password: d.password, name: d.guardianName || learner.guardianName });

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <LearnerStaffBar
        learner={learner}
        onBack={() => navigate(listPath)}
        preview={preview}
        onTogglePreview={() => setPreview((v) => !v)}
        accountStatus={accountStatus}
        onToggleAccount={isAdmin ? () => setConfirmAccountToggle(true) : undefined}
        accountTogglePending={accountTogglePending}
        onOpenFullForm={canManage ? () => navigate(learnerPath(user?.role, id, "edit")) : undefined}
        onRemove={canManage && (!isSchool || schoolHubId) ? () => setConfirmRemove(true) : undefined}
        removeLabel={isSchool ? "Remove from hub" : "Remove"}
      />

      {preview && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, color: T.accent, fontSize: 13 }}>
          <FiEye size={15} style={{ flexShrink: 0 }} />
          <span>You're seeing {learner.firstName}'s profile as {learner.firstName} and their family see it in the learner portal.</span>
        </div>
      )}

      {isEducatorTrainee && !preview && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, color: T.accent, fontSize: 13 }}>
          <span style={{ flex: 1, minWidth: 220 }}>This is an <strong>educator in training (TOT)</strong> — their own learning record. They sign in as the educator and learn in their teacher portal; their supervisor marks their work. No parent.</span>
          {isAdmin && <button type="button" onClick={() => navigate(`/teachers/${learner.teacherId}/view`)} style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${T.accent}`, background: "#fff", color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Open the educator</button>}
        </div>
      )}

      <HubSwitcher hubs={hubs} selectedHubId={selectedHub?.id} onChange={setPickedHubId} />

      <ProfileIdentityCard
        learner={learner} stage={stage} band={currentBand} nextBand={nextBand} curriculumId={curriculumId}
        onEdit={manage ? () => setEditing("learner") : undefined}
        stageHint={stage ? null : stagePendingReason({ learner, inClass: !!curriculumId, stages: ageCategories, staff: true })}
        extraMeta={preview ? [] : [
          { label: "Gender", value: learner.gender ? learner.gender.charAt(0).toUpperCase() + learner.gender.slice(1) : null },
          { label: "Date of birth", value: learner.dateOfBirth ? formatBirthDate(learner.dateOfBirth) : learner.statedAge != null ? `Not known — age ${learner.statedAge} given on ${formatBirthDate(learner.statedAgeOn)}` : null },
          { label: "Joined via", value: joinedVia(learner.origin) },
          ...(learner.origin?.note ? [{ label: "From the family", value: learner.origin.note }] : []),
          { label: "Added", value: formatDate(learner.createdAt) },
          { label: "Last updated", value: formatDate(learner.updatedAt) },
        ]}
      />

      {tab === "Overview" && <ProgressArcCard curriculumId={curriculumId} learnerId={id} hubId={selectedHub?.id} />}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
          <GuardianProfileCard
            learner={learner}
            onEdit={manage ? () => setEditing("guardian") : undefined}
            onOpenParent={preview || isEducatorTrainee ? undefined : () => { setActiveTab("Parent"); requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}
          />
          <ShareProfileCard learner={learner} />
          <PortfolioSnapshot coursesCompleted={coursesCompleted} curriculumId={curriculumId} learnerId={id} classId={cls?.id} staffLearnerId={id} hubId={selectedHub?.id} />
        </div>
        <SideRail
          hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading}
          staff={!preview}
          hubsContent={manage ? <LearnerHubsManager learnerId={id} learnerName={fullName} enrollments={hubs} isAdmin={isAdmin} /> : null}
        />
      </div>

      <AchievementsShowcase certificates={certificates} progress={certificateProgress} isLoading={certificatesLoading} />

      <div ref={tabsRef} style={{ scrollMarginTop: 16 }}>
        <ProfileTabs tabs={tabs} active={tab} onChange={setActiveTab} />
      </div>

      {tab === "Overview" && (
        <>
          <CompetencyProgressGrid competencies={competencies} isLoading={competenciesLoading} learnerId={id} curriculumId={curriculumId} hubId={selectedHub?.id} />
          <DiagnosticReportCard learnerId={id} curriculumId={curriculumId} staff={!preview} />
        </>
      )}

      {tab === "Competencies" && (
        <CompetenciesTabContent competencies={competencies} isLoading={competenciesLoading} learnerId={id} curriculumId={curriculumId} hubId={selectedHub?.id} />
      )}

      {tab === "Pathway" && (
        !manage ? (
          <>
            <PathwayTabContent learnerId={id} curriculumId={curriculumId} />
            <DiagnosticReportCard learnerId={id} curriculumId={curriculumId} staff={!preview} />
          </>
        ) : !curriculumId ? (
          <>
            <WebsiteDiagnosticsCard learnerId={id} canLink={isAdmin || isSchool} />
            <NoClassNotice />
          </>
        ) : (
          <>
            <WebsiteDiagnosticsCard learnerId={id} canLink={isAdmin || isSchool} />
            <DiagnosticReportCard learnerId={id} curriculumId={curriculumId} staff />
            <PathwayManagerCard learnerId={id} hubId={selectedHub?.id} currentStageId={selectedHub?.currentStageId} stageSource={selectedHub?.stageSource} curriculumId={curriculumId} canRemove={isAdmin || isSchool} />
          </>
        )
      )}

      {tab === "Assessments" && (cls ? <AssessmentsOverview classId={cls.id} staffLearnerId={id} /> : <NoClassNotice />)}

      {tab === "Reports" && <ReportsOverview hubId={selectedHub?.id} staffLearnerId={id} learner={learner} cls={cls} />}

      {tab === "Parent" && <ParentTab learnerId={id} onEdit={manage ? () => setEditing("guardian") : undefined} />}

      {tab === "History" && <RecordHistory entityType="learners" entityId={id} defaultOpen />}

      {tab !== "History" && tab !== "Parent" && (
        <>
          {cls ? <SummaryRow classId={cls.id} staffLearnerId={id} /> : <NoClassNotice />}
          <FrameworkLegend />
        </>
      )}

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

      <ConfirmDialog
        isOpen={confirmRemove}
        title={isSchool ? "Remove from Hub" : "Remove Learner"}
        message={
          isSchool
            ? `"${fullName}" will be removed from this hub. Their record and any other hub enrollments are unaffected.`
            : `"${fullName}" will be permanently removed. This cannot be undone.`
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmRemove(false);
          if (isSchool) {
            unenroll({ learnerId: id, hubId: schoolHubId }, { onSuccess: () => navigate(listPath) });
          } else {
            deleteLearner(id, { onSuccess: () => navigate(listPath) });
          }
        }}
        usageCheck={isSchool ? undefined : () => learnerApi.checkRemove(id)}
        onAlternative={!isSchool && accountStatus === "active" ? () => { setConfirmRemove(false); updateAccountStatus({ id, accountStatus: "inactive" }); } : undefined}
        onCancel={() => setConfirmRemove(false)}
      />

      <ConfirmDialog
        isOpen={confirmAccountToggle}
        title={accountStatus === "active" ? "Deactivate Learner Account" : "Activate Learner Account"}
        message={
          accountStatus === "active"
            ? `"${fullName}" will be marked inactive and lose learner portal access.`
            : accountStatus === "pending_payment"
              ? `"${fullName}" signed up on the website and their invoice isn't paid yet. Activating gives them portal access now; the invoice stays open. To take a payment, record it on the invoice instead — that activates them.`
              : `"${fullName}" will be marked active again and regain learner portal access.`
        }
        confirmLabel={accountStatus === "active" ? "Deactivate" : "Activate"}
        cancelLabel="Cancel"
        variant={accountStatus === "active" ? "danger" : "default"}
        onConfirm={() => {
          setConfirmAccountToggle(false);
          updateAccountStatus({ id, accountStatus: accountStatus === "active" ? "inactive" : "active" });
        }}
        onCancel={() => setConfirmAccountToggle(false)}
      />
    </div>
  );
}
