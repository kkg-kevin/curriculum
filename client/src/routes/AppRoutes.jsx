import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazyPage } from "./lazyPage";
const MainLayout = lazyPage(() => import("../layouts/MainLayout"));
const TeacherPortalLayout = lazyPage(() => import("../layouts/TeacherPortalLayout"));
const SchoolPortalLayout = lazyPage(() => import("../layouts/SchoolPortalLayout"));
const LearnerPortalLayout = lazyPage(() => import("../layouts/LearnerPortalLayout"));
const SupervisorPortalLayout = lazyPage(() => import("../layouts/SupervisorPortalLayout"));
const AffiliatePortalLayout = lazyPage(() => import("../layouts/AffiliatePortalLayout"));
import AuthLayout from "../layouts/AuthLayout";
import LoginPage from "../modules/auth/pages/LoginPage";
import SignupPage from "../modules/auth/pages/SignupPage";
import ForgotPasswordPage from "../modules/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "../modules/auth/pages/ResetPasswordPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
const DashboardPage = lazyPage(() => import("../modules/dashboard/pages/DashboardPage"));
const TeacherPortalDashboardPage = lazyPage(() => import("../modules/teacher-portal/pages/DashboardPage"));
const MyClassPage = lazyPage(() => import("../modules/teacher-portal/pages/MyClassPage"));
const TeacherCourseContentPage = lazyPage(() => import("../modules/teacher-portal/pages/CourseContentPage"));
const TeacherAssessmentsPage = lazyPage(() => import("../modules/teacher-portal/pages/AssessmentsPage"));
const TeacherAssessmentRosterPage = lazyPage(() => import("../modules/teacher-portal/pages/AssessmentRosterPage"));
import TotLearnerHandoff from "../modules/tot/components/TotLearnerHandoff";
const MentorFeedbackPage = lazyPage(() => import("../modules/mentor-reviews/pages/MentorFeedbackPage"));
const MyFeedbackPage = lazyPage(() => import("../modules/mentor-reviews/pages/MyFeedbackPage"));
const PublicEducatorPage = lazyPage(() => import("../modules/educator-profiles/pages/PublicEducatorPage"));
const FindMentorPage = lazyPage(() => import("../modules/educator-profiles/pages/FindMentorPage"));
const MentorProfilePage = lazyPage(() => import("../modules/educator-profiles/pages/FindMentorPage"), "MentorProfilePage");
const TotMarkingPage = lazyPage(() => import("../modules/tot/pages/TotMarkingPage"));
const TeacherReportsPage = lazyPage(() => import("../modules/teacher-portal/pages/ReportsPage"));
const TeacherReportEditorPage = lazyPage(() => import("../modules/teacher-portal/pages/ReportEditorPage"));
const TeacherAttendancePage = lazyPage(() => import("../modules/teacher-portal/pages/AttendancePage"));
const TeacherTimetablePage = lazyPage(() => import("../modules/teacher-portal/pages/TimetablePage"));
const TeacherClaimCoursePage = lazyPage(() => import("../modules/teacher-portal/pages/ClaimCoursePage"));
const TeacherPaymentsPage = lazyPage(() => import("../modules/teacher-portal/pages/PaymentsPage"));
const TeacherProfilePage = lazyPage(() => import("../modules/teacher-portal/pages/ProfilePage"));
const SchoolPortalDashboardPage = lazyPage(() => import("../modules/school-portal/pages/DashboardPage"));
const SchoolCurriculumPage = lazyPage(() => import("../modules/school-portal/pages/CurriculumPage"));
const SchoolReportsPage = lazyPage(() => import("../modules/school-portal/pages/ReportsPage"));
const SchoolAttendancePage = lazyPage(() => import("../modules/school-portal/pages/AttendancePage"));
const SchoolTimetablePage = lazyPage(() => import("../modules/school-portal/pages/TimetablePage"));
const SchoolRoomsPage = lazyPage(() => import("../modules/school-portal/pages/RoomsPage"));
const SchoolProfilePage = lazyPage(() => import("../modules/school-portal/pages/ProfilePage"));
const LearnerPortalDashboardPage = lazyPage(() => import("../modules/learner-portal/pages/DashboardPage"));
const ParentPortalLayout = lazyPage(() => import("../layouts/ParentPortalLayout"));
const ParentHomePage = lazyPage(() => import("../modules/parent/pages/ParentHomePage"));
const ParentChildLayout = lazyPage(() => import("../modules/parent/pages/ParentChildLayout"));
const ChildLoginPage = lazyPage(() => import("../modules/parent/pages/ChildLoginPage"));
const ParentTimetablePage = lazyPage(() => import("../modules/parent/pages/ParentTimetablePage"));
const ParentAccountPage = lazyPage(() => import("../modules/parent/pages/ParentAccountPage"));
const LearnerMyCoursesPage = lazyPage(() => import("../modules/learner-portal/pages/MyCoursesPage"));
const LearnerAssessmentsPage = lazyPage(() => import("../modules/learner-portal/pages/AssessmentsPage"));
const LearnerAssessmentDetailPage = lazyPage(() => import("../modules/learner-portal/pages/AssessmentDetailPage"));
const LearnerReportsPage = lazyPage(() => import("../modules/learner-portal/pages/ReportsPage"));
const LearnerReportDetailPage = lazyPage(() => import("../modules/learner-portal/pages/ReportDetailPage"));
const LearnerProgressPage = lazyPage(() => import("../modules/learner-portal/pages/ProgressPage"));
const LearnerTimetablePage = lazyPage(() => import("../modules/learner-portal/pages/TimetablePage"));
const LearnerProfilePage = lazyPage(() => import("../modules/learner-portal/pages/ProfilePage"));
const LearnerFamilyPage = lazyPage(() => import("../modules/learner-portal/pages/FamilyPage"));
const AdminReportsPage = lazyPage(() => import("../modules/reports/pages/AdminReportsPage"));
const CourseContentLandingPage = lazyPage(() => import("../modules/courses/pages/CourseContentLandingPage"));
const CurriculumPage = lazyPage(() => import("../modules/curriculum/pages/CurriculumPage"));
const CreateCurriculumPage = lazyPage(() => import("../modules/curriculum/pages/CreateCurriculumPage"));
const CurriculumStructurePage = lazyPage(() => import("../modules/curriculum/pages/CurriculumStructurePage"));
const EditCurriculumPage = lazyPage(() => import("../modules/curriculum/pages/EditCurriculumPage"));
const CurriculumViewPage = lazyPage(() => import("../modules/curriculum/pages/CurriculumViewPage"));
const CurriculumVersionControlPage = lazyPage(() => import("../modules/curriculum/pages/CurriculumVersionControlPage"));
const AcademicYearPage = lazyPage(() => import("../modules/curriculum/pages/AcademicYearPage"));
const CompetenciesPage = lazyPage(() => import("../modules/curriculum/pages/CompetenciesPage"));
const LearningHubsPage = lazyPage(() => import("../modules/learning-hubs/pages/LearningHubsPage"));
const LearningHubViewPage = lazyPage(() => import("../modules/learning-hubs/pages/LearningHubViewPage"));
const HubRevenueOverviewPage = lazyPage(() => import("../modules/hub-visits/pages/HubRevenueOverviewPage"));
const CreateLearningHubPage = lazyPage(() => import("../modules/settings/learning-hubs/pages/CreateLearningHubPage"));
const EditLearningHubPage = lazyPage(() => import("../modules/settings/learning-hubs/pages/EditLearningHubPage"));
const TeachersPage = lazyPage(() => import("../modules/teachers/pages/TeachersPage"));
const SchoolTeachersPage = lazyPage(() => import("../modules/teachers/pages/SchoolTeachersPage"));
const CreateTeacherPage = lazyPage(() => import("../modules/teachers/pages/CreateTeacherPage"));
const EditTeacherPage = lazyPage(() => import("../modules/teachers/pages/EditTeacherPage"));
const TeacherViewPage = lazyPage(() => import("../modules/teachers/pages/TeacherViewPage"));
const ClassesPage = lazyPage(() => import("../modules/classes/pages/ClassesPage"));
const SchoolClassesPage = lazyPage(() => import("../modules/classes/pages/SchoolClassesPage"));
const EditClassPage = lazyPage(() => import("../modules/classes/pages/EditClassPage"));
const CreateClassPage = lazyPage(() => import("../modules/classes/pages/CreateClassPage"));
const ClassViewPage = lazyPage(() => import("../modules/classes/pages/ClassViewPage"));
const GradeStreamsPage = lazyPage(() => import("../modules/classes/pages/GradeStreamsPage"));
const ProgramsListPage = lazyPage(() => import("../modules/programs/pages/ProgramsListPage"));
const CreateCompetitionPage = lazyPage(() => import("../modules/competitions/pages/CreateCompetitionPage"));
const CompetitionViewPage = lazyPage(() => import("../modules/competitions/pages/CompetitionViewPage"));
const CreateBootcampPage = lazyPage(() => import("../modules/bootcamps/pages/CreateBootcampPage"));
const GeneralEventFormPage = lazyPage(() => import("../modules/general-events/pages/GeneralEventFormPage"));
const GeneralEventPage = lazyPage(() => import("../modules/general-events/pages/GeneralEventPage"));
const TicketPage = lazyPage(() => import("../modules/general-events/pages/TicketPage"));
const BootcampViewPage = lazyPage(() => import("../modules/bootcamps/pages/BootcampViewPage"));
const LearnersPage = lazyPage(() => import("../modules/learners/pages/LearnersPage"));
const AdminBulkImportPage = lazyPage(() => import("../modules/learners/pages/AdminBulkImportPage"));
const SchoolLearnersPage = lazyPage(() => import("../modules/learners/pages/SchoolLearnersPage"));
const CreateLearnerPage = lazyPage(() => import("../modules/learners/pages/CreateLearnerPage"));
const EditLearnerPage = lazyPage(() => import("../modules/learners/pages/EditLearnerPage"));
const LearnerPage = lazyPage(() => import("../modules/learners/pages/LearnerPage"));
const PublicLearnerProfilePage = lazyPage(() => import("../modules/learners/pages/PublicLearnerProfilePage"));
const VerifyCertificatePage = lazyPage(() => import("../modules/certificates/pages/VerifyCertificatePage"));
const LearnerCertificateViewPage = lazyPage(() => import("../modules/certificates/pages/CertificateViewPage"));
const CertificatesListPage = lazyPage(() => import("../modules/certificates/pages/CertificatesListPage"));
const EmailPreferencesPage = lazyPage(() => import("../modules/notifications/pages/EmailPreferencesPage"));
const CoursesPage = lazyPage(() => import("../modules/courses/pages/CoursesPage"));
const CreateCoursePage = lazyPage(() => import("../modules/courses/pages/CreateCoursePage"));
const EditCoursePage = lazyPage(() => import("../modules/courses/pages/EditCoursePage"));
const CourseViewPage = lazyPage(() => import("../modules/courses/pages/CourseViewPage"));
const SectionViewPage = lazyPage(() => import("../modules/courses/pages/SectionViewPage"));
const AssessmentsPage = lazyPage(() => import("../modules/assessments/pages/AssessmentsPage"));
const AssessmentBuilderPage = lazyPage(() => import("../modules/assessments/pages/AssessmentBuilderPage"));
const AssessmentViewPage = lazyPage(() => import("../modules/assessments/pages/AssessmentViewPage"));
const SettingsPage = lazyPage(() => import("../modules/settings/pages/SettingsPage"));
const ActivityPage = lazyPage(() => import("../modules/activity/pages/ActivityPage"));
const CheckinsPage = lazyPage(() => import("../modules/checkins/pages/CheckinsPage"));
const CheckinSessionPage = lazyPage(() => import("../modules/checkins/pages/CheckinSessionPage"));
const QaPage = lazyPage(() => import("../modules/qa/pages/QaPage"));
const QaVisitPage = lazyPage(() => import("../modules/qa/pages/VisitPage"));
const QaTemplateEditorPage = lazyPage(() => import("../modules/qa/pages/TemplateEditorPage"));
const MentorCheckinsPage = lazyPage(() => import("../modules/mentor-checkins/pages/MentorCheckinsPage"));
const MentorNewRoundPage = lazyPage(() => import("../modules/mentor-checkins/pages/NewRoundPage"));
const MentorRoundPage = lazyPage(() => import("../modules/mentor-checkins/pages/RoundPage"));
const MentorMeetingPage = lazyPage(() => import("../modules/mentor-checkins/pages/MeetingPage"));
const ParentBookingsPage = lazyPage(() => import("../modules/mentor-bookings/pages/ParentBookingsPage"));
const BookMentorPage = lazyPage(() => import("../modules/mentor-bookings/pages/BookMentorPage"));
const BookingPage = lazyPage(() => import("../modules/mentor-bookings/pages/BookingPage"));
const MentorBookingsPage = lazyPage(() => import("../modules/mentor-bookings/pages/MentorBookingsPage"));
const AdminBookingsPage = lazyPage(() => import("../modules/mentor-bookings/pages/AdminBookingsPage"));
const HubBookingsPage = lazyPage(() => import("../modules/mentor-bookings/pages/HubBookingsPage"));
const MyQaPage = lazyPage(() => import("../modules/qa/pages/MyQaPage"));
const SupervisorEducatorPage = lazyPage(() => import("../modules/qa/pages/SupervisorEducatorPage"));
const BillingPage = lazyPage(() => import("../modules/billing/pages/BillingPage"));
const SupervisorDashboardPage = lazyPage(() => import("../modules/claims/pages/SupervisorDashboardPage"));
const SupervisorClaimsPage = lazyPage(() => import("../modules/claims/pages/SupervisorClaimsPage"));
const SupervisorClaimPage = lazyPage(() => import("../modules/claims/pages/SupervisorClaimPage"));
const AdminClaimPage = lazyPage(() => import("../modules/claims/pages/SupervisorClaimPage"), "AdminClaimPage");
const ClaimInvoicesPage = lazyPage(() => import("../modules/claims/pages/ClaimInvoicesPage"));
const SupervisorEducatorsPage = lazyPage(() => import("../modules/claims/pages/SupervisorEducatorsPage"));
const SupervisorProfilePage = lazyPage(() => import("../modules/claims/pages/SupervisorProfilePage"));
const AdminProfilePage = lazyPage(() => import("../modules/profile/pages/AdminProfilePage"));
const InvoiceDetailPage = lazyPage(() => import("../modules/billing/pages/InvoiceDetailPage"));
const ReceiptsListPage = lazyPage(() => import("../modules/billing/pages/ReceiptsListPage"));
const ReceiptDetailPage = lazyPage(() => import("../modules/billing/pages/ReceiptDetailPage"));
const StatementOfAccountPage = lazyPage(() => import("../modules/billing/pages/StatementOfAccountPage"));
const CustomersListPage = lazyPage(() => import("../modules/billing/pages/CustomersListPage"));
const CustomerDetailPage = lazyPage(() => import("../modules/billing/pages/CustomerDetailPage"));
const EnquiriesListPage = lazyPage(() => import("../modules/leads/pages/EnquiriesListPage"));
const HomeLearningPage = lazyPage(() => import("../modules/home-learning/pages/HomeLearningPage"));
const EducatorHomeLearningPage = lazyPage(() => import("../modules/home-learning/pages/EducatorHomeLearningPage"));
const HomeLearningTimetablePage = lazyPage(() => import("../modules/home-learning/pages/HomeLearningTimetablePage"));
const TechClubsPage = lazyPage(() => import("../modules/tech-clubs/pages/TechClubsPage"));
const PathwaySubscriptionsPage = lazyPage(() => import("../modules/pathway-subscriptions/pages/PathwaySubscriptionsPage"));
const AffiliatesPage = lazyPage(() => import("../modules/affiliates/pages/AffiliatesPage"));
const ReferEarnPage = lazyPage(() => import("../modules/affiliates/pages/ReferEarnPage"));
const AffiliateAccountPage = lazyPage(() => import("../modules/affiliates/pages/AffiliateAccountPage"));

// Educator claims sit inside Billing. Links to the old /claims address — notifications and
// emails carry /claims?claim=<id> — land on that tab, with the claim still opened.
function ClaimsRedirect() {
  const params = new URLSearchParams(useLocation().search);
  params.set("tab", "claims");
  return <Navigate to={`/billing?${params}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Unauthenticated by design — the scan destination for a learner's "Share Profile" QR
          code (see ShareProfileCard). No RoleRoute/ProtectedRoute/
          MainLayout wrapper on purpose: someone scanning a printed badge on their own phone is
          never expected to be logged in. */}
      <Route path="/public/learners/:token" element={<PublicLearnerProfilePage />} />
      {/* A published educator profile — no sign-in, read only (modules/educator-profiles). */}
      <Route path="/public/educators/:slug" element={<PublicEducatorPage />} />
      {/* Unauthenticated too — where the QR on a course certificate leads, for anyone checking
          that it is genuine. */}
      <Route path="/certificates/verify/:token" element={<VerifyCertificatePage />} />
      {/* A general event's ticket QR code leads here — staff signed in check the person in, anyone
          else is told to show it at the door (modules/general-events/pages/TicketPage.jsx). */}
      <Route path="/ticket/:code" element={<TicketPage />} />
      {/* Unauthenticated too — the "choose which emails you get" link in an email's footer. */}
      <Route path="/email-preferences" element={<EmailPreferencesPage />} />

      <Route element={<ProtectedRoute />}>
      {/* A collaborator (see RoleRoute.jsx) shares this whole admin tree — creation/editing
          across curricula, courses, assessments, hubs, bootcamps, competitions, settings — same
          as the admin who invited them, scoped server-side to that admin's own tenant. Deletion
          and collaborator management stay admin-only, enforced server-side and hidden in the UI
          per-page (see e.g. SettingsPage's Collaborators panel). */}
      <Route element={<RoleRoute allow={["admin", "collaborator"]} />}>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="events">
          <Route index element={<ProgramsListPage />} />
          {/* Competitions and Bootcamps are their own standalone features that live under this
              URL prefix on the admin side (no separate sidebar item — the "Events" nav entry
              points here). The /api/competitions and /api/bootcamps routes and the public
              website are unchanged. Either can optionally link to a curriculum via
              curriculumId, and can be run at one or more hubs via its own hub-offerings. */}
          <Route path="competitions/create" element={<CreateCompetitionPage />} />
          <Route path="competitions/:id/view" element={<CompetitionViewPage />} />
          <Route path="competitions/:id/edit" element={<CreateCompetitionPage />} />
          {/* General events — showcases, open days (modules/general-events/). */}
          <Route path="general/create" element={<GeneralEventFormPage />} />
          <Route path="general/:id" element={<GeneralEventPage />} />
          <Route path="general/:id/edit" element={<GeneralEventFormPage />} />
          <Route path="bootcamps/create" element={<CreateBootcampPage />} />
          <Route path="bootcamps/:id/view" element={<BootcampViewPage />} />
          <Route path="bootcamps/:id/edit" element={<CreateBootcampPage />} />
        </Route>
        <Route path="courses">
          <Route index element={<CoursesPage />} />
          <Route path="create" element={<CreateCoursePage />} />
          <Route path=":id/edit" element={<EditCoursePage />} />
          <Route path=":id/view" element={<CourseViewPage />} />
          <Route path=":id/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path=":id/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
        </Route>
        <Route path="assessments">
          <Route index element={<AssessmentsPage />} />
          <Route path="new/:type" element={<AssessmentBuilderPage />} />
          <Route path=":id/edit" element={<AssessmentBuilderPage />} />
          <Route path=":id/view" element={<AssessmentViewPage />} />
        </Route>
        <Route path="enquiries" element={<EnquiriesListPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="reports/certificates" element={<CertificatesListPage backTo="/reports" />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/customers" element={<CustomersListPage />} />
        <Route path="billing/customers/:hubId" element={<CustomerDetailPage />} />
        <Route path="billing/receipts" element={<ReceiptsListPage />} />
        <Route path="billing/receipts/:invoiceId/:paymentId" element={<ReceiptDetailPage />} />
        <Route path="billing/statements" element={<StatementOfAccountPage />} />
        <Route path="billing/claims/:claimId" element={<AdminClaimPage />} />
        <Route path="billing/claim-invoices" element={<ClaimInvoicesPage />} />
        <Route path="billing/:id" element={<InvoiceDetailPage />} />
        {/* The activity log — who did what, when. The owner, and staff whose role grants it. */}
        <Route path="activity" element={<ActivityPage />} />
        {/* Hub check-ins — Account Managers, Training Leads and their managers (modules/checkins).
            /checkins/actions is where older follow-up notifications link; it opens the same page. */}
        <Route path="checkins" element={<CheckinsPage />} />
        <Route path="checkins/actions" element={<CheckinsPage />} />
        <Route path="checkins/sessions/:id" element={<CheckinSessionPage />} />
        {/* Check-in report templates — QA's template editor, saving to check-ins (managers). */}
        <Route path="checkins/templates/new" element={<QaTemplateEditorPage key="checkins-template" source="checkins" />} />
        <Route path="checkins/templates/:id" element={<QaTemplateEditorPage key="checkins-template" source="checkins" />} />
        {/* Parent–mentor check-ins — a class's educators meeting each family (modules/mentor-checkins). */}
        <Route path="mentor-checkins" element={<MentorCheckinsPage />} />
        <Route path="mentor-checkins/rounds/new" element={<MentorNewRoundPage />} />
        <Route path="mentor-checkins/rounds/:id" element={<MentorRoundPage />} />
        <Route path="mentor-checkins/meetings/:id" element={<MentorMeetingPage />} />
        <Route path="mentor-checkins/templates/new" element={<QaTemplateEditorPage key="mentor-template" source="mentor" />} />
        <Route path="mentor-checkins/templates/:id" element={<QaTemplateEditorPage key="mentor-template" source="mentor" />} />
        {/* Families booking a mentor; refunds; partner hubs' desk fees (modules/mentor-bookings). */}
        <Route path="mentor-bookings" element={<AdminBookingsPage />} />
        <Route path="mentor-bookings/:id" element={<BookingPage />} />
        {/* Quality assurance — visits to educators, their reviews, schedules and templates (modules/qa). */}
        <Route path="qa" element={<QaPage />} />
        <Route path="qa/visits/:id" element={<QaVisitPage />} />
        <Route path="qa/templates/new" element={<QaTemplateEditorPage />} />
        <Route path="qa/templates/:id" element={<QaTemplateEditorPage />} />
        {/* Educator claims — the supervisor's review and the admin's approval and payment — are
            Billing's "Educator Claims" tab. The educator's own side lives in the teacher-portal
            (claims, claims/:classId/:courseId). */}
        <Route path="claims" element={<ClaimsRedirect />} />
        {/* My profile — the signed-in admin's own account (admins only; the page sends anyone else home). */}
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="settings">
          <Route index element={<SettingsPage />} />
          <Route path="learning-hubs/create" element={<CreateLearningHubPage />} />
          <Route path="learning-hubs/:id/edit" element={<EditLearningHubPage />} />
        </Route>
      </Route>
      </Route>

      {/* Curriculum authoring — admin (unrestricted) and curriculumAdmin (own curriculum only,
          enforced server-side). Kept as its own RoleRoute/MainLayout branch, separate from the
          admin-only tree above, so a curriculumAdmin never gets routed anywhere else in the
          admin app (Schools, Educators, Learners, Settings, etc). Same MainLayout shell and
          the exact same "/curriculum/*" paths admin already uses — Sidebar.jsx filters the nav
          for this role, and the pages themselves don't need to know which role is viewing them. */}
      <Route element={<RoleRoute allow={["admin", "collaborator", "curriculumAdmin"]} />}>
      <Route path="/" element={<MainLayout />}>
        <Route path="curriculum">
          <Route index element={<CurriculumPage />} />
          <Route path="create" element={<CreateCurriculumPage />} />
          <Route path=":id/edit" element={<EditCurriculumPage />} />
          <Route path=":id/structure" element={<CurriculumStructurePage />} />
          <Route path=":id/view" element={<CurriculumViewPage />} />
          <Route path=":id/versions" element={<CurriculumVersionControlPage />} />
          <Route path=":id/academic-year" element={<AcademicYearPage />} />
          <Route path=":id/competencies" element={<CompetenciesPage />} />
        </Route>
      </Route>
      </Route>

      {/* Hub network management — admin/collaborator (a hub itself can be the parent of other
          "branch" hubs now — see scope.middleware.js's req.ownSchools/req.ownSchool — but that
          admin reaches it through the school-portal with a hub-switcher, not through this
          tree). */}
      <Route element={<RoleRoute allow={["admin", "collaborator"]} />}>
      <Route path="/" element={<MainLayout />}>
        <Route path="learning-hubs">
          <Route index element={<LearningHubsPage />} />
          {/* Admin-only cross-hub finance rollup (server-side authorize("admin") on
              /api/hub-visits/revenue-summary — a collaborator reaching this route gets a 403
              from the API, same posture as billing/customers below). Registered before ":id/view"
              so "revenue" isn't swallowed as a hub id. */}
          <Route path="revenue" element={<HubRevenueOverviewPage />} />
          <Route path=":id/view" element={<LearningHubViewPage />} />
        </Route>
        <Route path="settings/learning-hubs/create" element={<CreateLearningHubPage />} />
        <Route path="settings/learning-hubs/:id/edit" element={<EditLearningHubPage />} />
        <Route path="learners">
          <Route index element={<LearnersPage />} />
          <Route path="bulk-import" element={<AdminBulkImportPage />} />
          <Route path="create" element={<CreateLearnerPage />} />
          <Route path=":id/edit" element={<EditLearnerPage />} />
          {/* One page per learner: their profile as they see it, plus every staff action. The
              old record (/view) and profile (/profile) addresses lead to it. */}
          <Route path=":id" element={<LearnerPage />} />
          <Route path=":id/view" element={<Navigate to=".." relative="path" replace />} />
          <Route path=":id/profile" element={<Navigate to=".." relative="path" replace />} />
        </Route>
        <Route path="home-learning" element={<HomeLearningPage />} />
        <Route path="home-learning/timetable" element={<HomeLearningTimetablePage />} />
        <Route path="tech-clubs" element={<TechClubsPage />} />
        <Route path="pathway-subscriptions" element={<PathwaySubscriptionsPage />} />
        {/* Affiliate marketing — affiliates, referrals, commissions, payouts (modules/affiliates). */}
        <Route path="affiliates" element={<AffiliatesPage />} />
        <Route path="teachers">
          <Route index element={<TeachersPage />} />
          <Route path="create" element={<CreateTeacherPage />} />
          <Route path=":id/edit" element={<EditTeacherPage />} />
          <Route path=":id/view" element={<TeacherViewPage />} />
          {/* Training of trainers: work to mark from educators with no supervisor (modules/tot). */}
          <Route path="training" element={<TotMarkingPage />} />
        </Route>
        <Route path="classes">
          <Route index element={<ClassesPage />} />
          <Route path="create" element={<CreateClassPage />} />
          <Route path="school/:schoolId" element={<SchoolClassesPage />} />
          <Route path="school/:schoolId/grade/:gradeId/:academicYear" element={<GradeStreamsPage />} />
          <Route path=":id/edit" element={<EditClassPage />} />
          <Route path=":id/view" element={<ClassViewPage />} />
        </Route>
      </Route>
      </Route>

      <Route element={<RoleRoute allow={["teacher"]} />}>
        <Route path="/teacher-portal" element={<TeacherPortalLayout />}>
          <Route index element={<TeacherPortalDashboardPage />} />
          <Route path="classes/:classId" element={<MyClassPage />} />
          <Route path="course-content" element={<TeacherCourseContentPage />} />
          <Route path="home-learning" element={<EducatorHomeLearningPage />} />
          <Route path="course-content/:courseId" element={<CourseContentLandingPage />} />
          <Route path="course-content/:courseId/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path="course-content/:courseId/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
          <Route path="assessments" element={<TeacherAssessmentsPage />} />
          <Route path="assessments/:issueId" element={<TeacherAssessmentRosterPage />} />
          <Route path="reports" element={<TeacherReportsPage />} />
          <Route path="reports/:reportId" element={<TeacherReportEditorPage />} />
          <Route path="attendance" element={<TeacherAttendancePage />} />
          <Route path="timetable" element={<TeacherTimetablePage />} />
          <Route path="claims" element={<TeacherPaymentsPage tab="claims" />} />
          <Route path="claims/:classId/:courseId" element={<TeacherClaimCoursePage />} />
          <Route path="invoices" element={<TeacherPaymentsPage tab="invoices" />} />
          <Route path="profile" element={<TeacherProfilePage />} />
          {/* Training of trainers is a sign-in of its own now (TOT learner — the learner portal):
              old "My learning" links switch to it and open the same page there. */}
          <Route path="learning/*" element={<TotLearnerHandoff />} />
          {/* QA visits to this educator: announced ones coming up, and the reports, to reply to. */}
          <Route path="qa" element={<MyQaPage />} />
          {/* Hub check-ins this educator takes part in (modules/checkins). */}
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="checkins/sessions/:id" element={<CheckinSessionPage />} />
          {/* Mentor sessions families booked with this educator (modules/mentor-bookings). */}
          <Route path="bookings" element={<MentorBookingsPage />} />
          <Route path="bookings/:id" element={<BookingPage />} />
          {/* Parent check-ins of this educator's classes — the schedule and the reports (modules/mentor-checkins). */}
          <Route path="mentor-checkins" element={<MentorCheckinsPage />} />
          <Route path="mentor-checkins/rounds/:id" element={<MentorRoundPage />} />
          <Route path="mentor-checkins/meetings/:id" element={<MentorMeetingPage />} />
          {/* What families say about this educator — anonymous, from 3 reviews (modules/mentor-reviews). */}
          <Route path="feedback" element={<MyFeedbackPage />} />
          {/* Refer & earn — their referral link and commissions (modules/affiliates). */}
          <Route path="refer" element={<ReferEarnPage />} />
          {/* Their performance profile, and their public one (modules/educator-profiles). */}
          <Route path="my-profile" element={<Navigate to="/teacher-portal/profile?tab=public" replace />} />
          <Route path="qa/:id" element={<QaVisitPage />} />
        </Route>
      </Route>

      {/* An affiliate who isn't a parent or educator here signs in as Affiliate (modules/affiliates,
          server account-roles.js's AFFILIATE_ROLE): their Refer & earn and their account. */}
      <Route element={<RoleRoute allow={["affiliate"]} />}>
        <Route path="/affiliate-portal" element={<AffiliatePortalLayout />}>
          <Route index element={<ReferEarnPage />} />
          <Route path="account" element={<AffiliateAccountPage />} />
        </Route>
      </Route>

      {/* A claim supervisor — an account that only reviews the claims of the educators assigned
          to it (see server/src/modules/claims/supervisor.service.js). */}
      <Route element={<RoleRoute allow={["supervisor"]} />}>
        <Route path="/supervisor-portal" element={<SupervisorPortalLayout />}>
          <Route index element={<SupervisorDashboardPage />} />
          <Route path="claims" element={<SupervisorClaimsPage />} />
          <Route path="claims/:claimId" element={<SupervisorClaimPage />} />
          <Route path="educators" element={<SupervisorEducatorsPage />} />
          <Route path="educators/:id" element={<SupervisorEducatorPage />} />
          {/* Training of trainers: their educators' work to mark (modules/tot). */}
          <Route path="marking" element={<TotMarkingPage />} />
          {/* Quality assurance for the supervisor's own educators (modules/qa). */}
          <Route path="qa" element={<QaPage />} />
          <Route path="qa/visits/:id" element={<QaVisitPage />} />
          <Route path="qa/templates/new" element={<QaTemplateEditorPage />} />
          <Route path="qa/templates/:id" element={<QaTemplateEditorPage />} />
          {/* Parent check-ins of their educators' classes — the schedule only (modules/mentor-checkins). */}
          <Route path="mentor-checkins" element={<MentorCheckinsPage />} />
          <Route path="mentor-checkins/rounds/:id" element={<MentorRoundPage />} />
          <Route path="mentor-checkins/meetings/:id" element={<MentorMeetingPage />} />
          <Route path="profile" element={<SupervisorProfilePage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute allow={["school"]} />}>
        <Route path="/school-portal" element={<SchoolPortalLayout />}>
          <Route index element={<SchoolPortalDashboardPage />} />
          <Route path="curriculum" element={<SchoolCurriculumPage />} />
          <Route path="curriculum/:courseId" element={<CourseContentLandingPage />} />
          <Route path="curriculum/:courseId/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path="curriculum/:courseId/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
          <Route path="classes/:schoolId" element={<SchoolClassesPage />} />
          <Route path="classes/:schoolId/grade/:gradeId/:academicYear" element={<GradeStreamsPage />} />
          <Route path="classes/create" element={<CreateClassPage />} />
          <Route path="classes/:id/view" element={<ClassViewPage />} />
          <Route path="classes/:id/edit" element={<EditClassPage />} />
          <Route path="teachers/:schoolId" element={<SchoolTeachersPage />} />
          <Route path="teachers/create" element={<CreateTeacherPage />} />
          <Route path="teachers/:id/view" element={<TeacherViewPage />} />
          <Route path="teachers/:id/edit" element={<EditTeacherPage />} />
          <Route path="learners/:schoolId" element={<SchoolLearnersPage />} />
          <Route path="learners/create" element={<CreateLearnerPage />} />
          {/* Stays at /view here: /school-portal/learners/:id is the hub's learner list. */}
          <Route path="learners/:id/view" element={<LearnerPage />} />
          <Route path="learners/:id/profile" element={<Navigate to="../view" relative="path" replace />} />
          <Route path="learners/:id/edit" element={<EditLearnerPage />} />
          <Route path="attendance" element={<SchoolAttendancePage />} />
          <Route path="timetable" element={<SchoolTimetablePage />} />
          <Route path="rooms" element={<SchoolRoomsPage />} />
          <Route path="reports" element={<SchoolReportsPage />} />
          <Route path="reports/certificates" element={<CertificatesListPage backTo="/school-portal/reports" />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="billing/receipts" element={<ReceiptsListPage />} />
          <Route path="billing/receipts/:invoiceId/:paymentId" element={<ReceiptDetailPage />} />
          <Route path="billing/statements" element={<StatementOfAccountPage />} />
          <Route path="billing/:id" element={<InvoiceDetailPage />} />
          <Route path="profile" element={<SchoolProfilePage />} />
          {/* A hub's Account Manager / Training Lead (a hubLead session) — their check-ins. */}
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="checkins/sessions/:id" element={<CheckinSessionPage />} />
          {/* Mentor sessions at the hub's spaces, and its desk-fee statement (modules/mentor-bookings). */}
          <Route path="mentor-bookings" element={<HubBookingsPage />} />
          <Route path="mentor-bookings/:id" element={<BookingPage />} />
          {/* The hub's parent check-ins — its classes' schedules (modules/mentor-checkins). */}
          <Route path="mentor-checkins" element={<MentorCheckinsPage />} />
          <Route path="mentor-checkins/rounds/:id" element={<MentorRoundPage />} />
          <Route path="mentor-checkins/meetings/:id" element={<MentorMeetingPage />} />
          {/* The hub's QA view: its educators' announced visits and a summary of each report. */}
          <Route path="qa" element={<MyQaPage />} />
          <Route path="qa/:id" element={<QaVisitPage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute allow={["learner"]} />}>
        <Route path="/learner-portal" element={<LearnerPortalLayout />}>
          <Route index element={<LearnerPortalDashboardPage />} />
          <Route path="courses" element={<LearnerMyCoursesPage />} />
          <Route path="courses/:courseId" element={<CourseContentLandingPage />} />
          <Route path="courses/:courseId/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path="courses/:courseId/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
          <Route path="assessments" element={<LearnerAssessmentsPage />} />
          <Route path="assessments/:issueId" element={<LearnerAssessmentDetailPage />} />
          <Route path="reports" element={<LearnerReportsPage />} />
          <Route path="reports/:reportId" element={<LearnerReportDetailPage />} />
          <Route path="certificates/:certificateId" element={<LearnerCertificateViewPage />} />
          <Route path="progress" element={<LearnerProgressPage />} />
          {/* A TOT learner rates their trainers (modules/mentor-reviews). */}
          <Route path="feedback" element={<MentorFeedbackPage />} />
          <Route path="timetable" element={<LearnerTimetablePage />} />
          <Route path="profile" element={<LearnerProfilePage />} />
          <Route path="family" element={<LearnerFamilyPage />} />
          <Route path="invoices" element={<BillingPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="receipts" element={<ReceiptsListPage />} />
          <Route path="receipts/:invoiceId/:paymentId" element={<ReceiptDetailPage />} />
          <Route path="statement" element={<StatementOfAccountPage />} />
        </Route>

        {/* A parent's own portal — the family across all their children (see ParentPortalLayout). */}
        <Route path="/parent" element={<ParentPortalLayout />}>
          <Route index element={<ParentHomePage />} />
          <Route path="children/:childId" element={<ParentChildLayout />}>
            {/* The child's learner profile, as the learner portal shows it. Its lists open detail
                pages below; the old list addresses fall back to the profile. */}
            <Route index element={<LearnerProfilePage />} />
            <Route path="assessments" element={<Navigate to=".." relative="path" replace />} />
            <Route path="assessments/:issueId" element={<LearnerAssessmentDetailPage />} />
            <Route path="reports" element={<Navigate to=".." relative="path" replace />} />
            <Route path="reports/:reportId" element={<LearnerReportDetailPage />} />
            <Route path="certificates/:certificateId" element={<LearnerCertificateViewPage />} />
            <Route path="progress" element={<Navigate to=".." relative="path" replace />} />
            <Route path="login" element={<ChildLoginPage />} />
          </Route>
          <Route path="timetable" element={<ParentTimetablePage />} />
          {/* Parents review the mentors teaching their children (modules/mentor-reviews). */}
          <Route path="feedback" element={<MentorFeedbackPage />} />
          {/* Find a mentor — published educator profiles, and asking for one (modules/educator-profiles). */}
          <Route path="mentors" element={<FindMentorPage />} />
          {/* Hub check-ins this parent takes part in (modules/checkins). */}
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="checkins/sessions/:id" element={<CheckinSessionPage />} />
          {/* Mentor sessions: their children's help requests, booking a mentor, each booking (modules/mentor-bookings). */}
          <Route path="bookings" element={<ParentBookingsPage />} />
          <Route path="bookings/new" element={<BookMentorPage />} />
          <Route path="bookings/:id" element={<BookingPage />} />
          {/* Check-ins with their children's mentors: confirm or move, read and approve the report (modules/mentor-checkins). */}
          <Route path="mentor-checkins" element={<MentorCheckinsPage />} />
          <Route path="mentor-checkins/meetings/:id" element={<MentorMeetingPage />} />
          <Route path="mentors/:slug" element={<MentorProfilePage />} />
          {/* Refer & earn — their referral link and commissions (modules/affiliates). */}
          <Route path="refer" element={<ReferEarnPage />} />
          <Route path="account" element={<ParentAccountPage />} />
          <Route path="family" element={<LearnerFamilyPage />} />
          <Route path="invoices" element={<BillingPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="receipts" element={<ReceiptsListPage />} />
          <Route path="receipts/:invoiceId/:paymentId" element={<ReceiptDetailPage />} />
          <Route path="statement" element={<StatementOfAccountPage />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  );
}
