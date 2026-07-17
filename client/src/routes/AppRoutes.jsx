import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import TeacherPortalLayout from "../layouts/TeacherPortalLayout";
import SchoolPortalLayout from "../layouts/SchoolPortalLayout";
import LearnerPortalLayout from "../layouts/LearnerPortalLayout";
import AuthLayout from "../layouts/AuthLayout";
import LoginPage from "../modules/auth/pages/LoginPage";
import SignupPage from "../modules/auth/pages/SignupPage";
import ForgotPasswordPage from "../modules/auth/pages/ForgotPasswordPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import ComingSoon from "../components/ui/ComingSoon";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
import TeacherPortalDashboardPage from "../modules/teacher-portal/pages/DashboardPage";
import MyClassPage from "../modules/teacher-portal/pages/MyClassPage";
import TeacherCourseContentPage from "../modules/teacher-portal/pages/CourseContentPage";
import TeacherProfilePage from "../modules/teacher-portal/pages/ProfilePage";
import SchoolPortalDashboardPage from "../modules/school-portal/pages/DashboardPage";
import SchoolCurriculumPage from "../modules/school-portal/pages/CurriculumPage";
import SchoolProfilePage from "../modules/school-portal/pages/ProfilePage";
import LearnerPortalDashboardPage from "../modules/learner-portal/pages/DashboardPage";
import LearnerMyCoursesPage from "../modules/learner-portal/pages/MyCoursesPage";
import CourseContentLandingPage from "../modules/courses/pages/CourseContentLandingPage";
import CurriculumPage from "../modules/curriculum/pages/CurriculumPage";
import CreateCurriculumPage from "../modules/curriculum/pages/CreateCurriculumPage";
import CurriculumStructurePage from "../modules/curriculum/pages/CurriculumStructurePage";
import EditCurriculumPage from "../modules/curriculum/pages/EditCurriculumPage";
import CurriculumViewPage from "../modules/curriculum/pages/CurriculumViewPage";
import CurriculumVersionControlPage from "../modules/curriculum/pages/CurriculumVersionControlPage";
import AcademicYearPage from "../modules/curriculum/pages/AcademicYearPage";
import CompetenciesPage from "../modules/curriculum/pages/CompetenciesPage";
import SchoolsPage from "../modules/schools/pages/SchoolsPage";
import CreateSchoolPage from "../modules/schools/pages/CreateSchoolPage";
import EditSchoolPage from "../modules/schools/pages/EditSchoolPage";
import SchoolViewPage from "../modules/schools/pages/SchoolViewPage";
import TeachersPage from "../modules/teachers/pages/TeachersPage";
import SchoolTeachersPage from "../modules/teachers/pages/SchoolTeachersPage";
import CreateTeacherPage from "../modules/teachers/pages/CreateTeacherPage";
import EditTeacherPage from "../modules/teachers/pages/EditTeacherPage";
import TeacherViewPage from "../modules/teachers/pages/TeacherViewPage";
import ClassesPage from "../modules/classes/pages/ClassesPage";
import SchoolClassesPage from "../modules/classes/pages/SchoolClassesPage";
import EditClassPage from "../modules/classes/pages/EditClassPage";
import CreateClassPage from "../modules/classes/pages/CreateClassPage";
import ClassViewPage from "../modules/classes/pages/ClassViewPage";
import LearnersPage from "../modules/learners/pages/LearnersPage";
import SchoolLearnersPage from "../modules/learners/pages/SchoolLearnersPage";
import CreateLearnerPage from "../modules/learners/pages/CreateLearnerPage";
import EditLearnerPage from "../modules/learners/pages/EditLearnerPage";
import LearnerViewPage from "../modules/learners/pages/LearnerViewPage";
import CoursesPage from "../modules/courses/pages/CoursesPage";
import CreateCoursePage from "../modules/courses/pages/CreateCoursePage";
import EditCoursePage from "../modules/courses/pages/EditCoursePage";
import CourseViewPage from "../modules/courses/pages/CourseViewPage";
import SectionViewPage from "../modules/courses/pages/SectionViewPage";
import AssessmentsPage from "../modules/assessments/pages/AssessmentsPage";
import AssessmentBuilderPage from "../modules/assessments/pages/AssessmentBuilderPage";
import AssessmentViewPage from "../modules/assessments/pages/AssessmentViewPage";
import SettingsPage from "../modules/settings/pages/SettingsPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
      <Route element={<RoleRoute allow={["admin"]} />}>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="schools">
          <Route index element={<SchoolsPage />} />
          <Route path="create" element={<CreateSchoolPage />} />
          <Route path=":id/edit" element={<EditSchoolPage />} />
          <Route path=":id/view" element={<SchoolViewPage />} />
        </Route>
        <Route path="locations">
          <Route path="create" element={<ComingSoon name="Add Location" />} />
        </Route>
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
        <Route path="learners">
          <Route index element={<LearnersPage />} />
          <Route path="school/:schoolId" element={<SchoolLearnersPage />} />
          <Route path="create" element={<CreateLearnerPage />} />
          <Route path=":id/edit" element={<EditLearnerPage />} />
          <Route path=":id/view" element={<LearnerViewPage />} />
        </Route>
        <Route path="teachers">
          <Route index element={<TeachersPage />} />
          <Route path="school/:schoolId" element={<SchoolTeachersPage />} />
          <Route path="create" element={<CreateTeacherPage />} />
          <Route path=":id/edit" element={<EditTeacherPage />} />
          <Route path=":id/view" element={<TeacherViewPage />} />
        </Route>
        <Route path="classes">
          <Route index element={<ClassesPage />} />
          <Route path="create" element={<CreateClassPage />} />
          <Route path="school/:schoolId" element={<SchoolClassesPage />} />
          <Route path=":id/edit" element={<EditClassPage />} />
          <Route path=":id/view" element={<ClassViewPage />} />
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
        <Route path="reports" element={<ComingSoon name="Reports" />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      </Route>

      <Route element={<RoleRoute allow={["teacher"]} />}>
        <Route path="/teacher-portal" element={<TeacherPortalLayout />}>
          <Route index element={<TeacherPortalDashboardPage />} />
          <Route path="classes/:classId" element={<MyClassPage />} />
          <Route path="course-content" element={<TeacherCourseContentPage />} />
          <Route path="course-content/:courseId" element={<CourseContentLandingPage />} />
          <Route path="course-content/:courseId/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path="course-content/:courseId/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
          <Route path="assessments" element={<ComingSoon name="Assessments" />} />
          <Route path="attendance" element={<ComingSoon name="Attendance" />} />
          <Route path="profile" element={<TeacherProfilePage />} />
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
          <Route path="classes/create" element={<CreateClassPage />} />
          <Route path="classes/:id/view" element={<ClassViewPage />} />
          <Route path="classes/:id/edit" element={<EditClassPage />} />
          <Route path="teachers/:schoolId" element={<SchoolTeachersPage />} />
          <Route path="teachers/create" element={<CreateTeacherPage />} />
          <Route path="teachers/:id/view" element={<TeacherViewPage />} />
          <Route path="teachers/:id/edit" element={<EditTeacherPage />} />
          <Route path="learners/:schoolId" element={<SchoolLearnersPage />} />
          <Route path="learners/create" element={<CreateLearnerPage />} />
          <Route path="learners/:id/view" element={<LearnerViewPage />} />
          <Route path="learners/:id/edit" element={<EditLearnerPage />} />
          <Route path="reports" element={<ComingSoon name="Reports" />} />
          <Route path="profile" element={<SchoolProfilePage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute allow={["learner"]} />}>
        <Route path="/learner-portal" element={<LearnerPortalLayout />}>
          <Route index element={<LearnerPortalDashboardPage />} />
          <Route path="courses" element={<LearnerMyCoursesPage />} />
          <Route path="courses/:courseId" element={<CourseContentLandingPage />} />
          <Route path="courses/:courseId/sessions/:sessionId/sections/:sectionKey" element={<SectionViewPage />} />
          <Route path="courses/:courseId/sessions/:sessionId/sections/:sectionKey/:itemId" element={<SectionViewPage />} />
          <Route path="assessments" element={<ComingSoon name="Assessments" />} />
          <Route path="progress" element={<ComingSoon name="Progress" />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  );
}
