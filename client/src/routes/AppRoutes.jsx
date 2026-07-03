import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
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
import CreateTeacherPage from "../modules/teachers/pages/CreateTeacherPage";
import EditTeacherPage from "../modules/teachers/pages/EditTeacherPage";
import TeacherViewPage from "../modules/teachers/pages/TeacherViewPage";
import ClassesPage from "../modules/classes/pages/ClassesPage";
import SchoolClassesPage from "../modules/classes/pages/SchoolClassesPage";
import EditClassPage from "../modules/classes/pages/EditClassPage";
import ClassViewPage from "../modules/classes/pages/ClassViewPage";
import LearnersPage from "../modules/learners/pages/LearnersPage";
import CreateLearnerPage from "../modules/learners/pages/CreateLearnerPage";
import EditLearnerPage from "../modules/learners/pages/EditLearnerPage";
import LearnerViewPage from "../modules/learners/pages/LearnerViewPage";
import CoursesPage from "../modules/courses/pages/CoursesPage";
import CreateCoursePage from "../modules/courses/pages/CreateCoursePage";
import EditCoursePage from "../modules/courses/pages/EditCoursePage";
import CourseViewPage from "../modules/courses/pages/CourseViewPage";
import SectionViewPage from "../modules/courses/pages/SectionViewPage";
import AssessmentsPage from "../modules/assessments/pages/AssessmentsPage";
import CreateAssessmentPage from "../modules/assessments/pages/CreateAssessmentPage";
import EditAssessmentPage from "../modules/assessments/pages/EditAssessmentPage";
import AssessmentViewPage from "../modules/assessments/pages/AssessmentViewPage";

function ComingSoon({ name }) {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center", color: "#9CA3AF" }}>
      <p style={{ fontSize: "32px", margin: "0 0 12px" }}>🚧</p>
      <p style={{ fontSize: "16px", fontWeight: "700", color: "#374151", margin: "0 0 6px" }}>{name}</p>
      <p style={{ fontSize: "13px", margin: 0 }}>This module is coming soon.</p>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="schools">
          <Route index element={<SchoolsPage />} />
          <Route path="create" element={<CreateSchoolPage />} />
          <Route path=":id/edit" element={<EditSchoolPage />} />
          <Route path=":id/view" element={<SchoolViewPage />} />
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
          <Route path="create" element={<CreateLearnerPage />} />
          <Route path=":id/edit" element={<EditLearnerPage />} />
          <Route path=":id/view" element={<LearnerViewPage />} />
        </Route>
        <Route path="teachers">
          <Route index element={<TeachersPage />} />
          <Route path="create" element={<CreateTeacherPage />} />
          <Route path=":id/edit" element={<EditTeacherPage />} />
          <Route path=":id/view" element={<TeacherViewPage />} />
        </Route>
        <Route path="classes">
          <Route index element={<ClassesPage />} />
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
          <Route path="create" element={<CreateAssessmentPage />} />
          <Route path=":id/edit" element={<EditAssessmentPage />} />
          <Route path=":id/view" element={<AssessmentViewPage />} />
        </Route>
        <Route path="reports" element={<ComingSoon name="Reports" />} />
        <Route path="settings" element={<ComingSoon name="Settings" />} />
      </Route>
    </Routes>
  );
}
