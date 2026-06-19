import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
import CurriculumPage from "../modules/curriculum/pages/CurriculumPage";
import CreateCurriculumPage from "../modules/curriculum/pages/CreateCurriculumPage";
import CurriculumStructurePage from "../modules/curriculum/pages/CurriculumStructurePage";
import EditCurriculumPage from "../modules/curriculum/pages/EditCurriculumPage";
import CurriculumViewPage from "../modules/curriculum/pages/CurriculumViewPage";

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
        <Route path="schools" element={<ComingSoon name="Schools" />} />
        <Route path="curriculum">
          <Route index element={<CurriculumPage />} />
          <Route path="create" element={<CreateCurriculumPage />} />
          <Route path=":id/edit" element={<EditCurriculumPage />} />
          <Route path=":id/structure" element={<CurriculumStructurePage />} />
          <Route path=":id/view" element={<CurriculumViewPage />} />
        </Route>
        <Route path="learners" element={<ComingSoon name="Learners" />} />
        <Route path="teachers" element={<ComingSoon name="Teachers" />} />
        <Route path="classes" element={<ComingSoon name="Classes" />} />
        <Route path="assessments" element={<ComingSoon name="Assessments" />} />
        <Route path="reports" element={<ComingSoon name="Reports" />} />
        <Route path="settings" element={<ComingSoon name="Settings" />} />
      </Route>
    </Routes>
  );
}