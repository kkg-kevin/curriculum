import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import CurriculumPage from "../modules/curriculum/pages/CurriculumPage";
import CreateCurriculumPage from "../modules/curriculum/pages/CreateCurriculumPage";

function Dashboard() {
  return <h2>Dashboard Page</h2>;
}
function Schools() {
  return <h2>Schools Page</h2>;
}
function Learners() {
  return <h2>Learners Page</h2>;
}
function Teachers() {
  return <h2>Teachers Page</h2>;
}
function Classes() {
  return <h2>Classes Page</h2>;
}
function Assessments() {
  return <h2>Assessments Page</h2>;
}
function Reports() {
  return <h2>Reports Page</h2>;
}
function Settings() {
  return <h2>Settings Page</h2>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="schools" element={<Schools />} />
        <Route path="curriculum">
          <Route index element={<CurriculumPage />} />
          <Route path="create" element={<CreateCurriculumPage />} />
        </Route>
        <Route path="learners" element={<Learners />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="classes" element={<Classes />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}