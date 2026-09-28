import { Link, useOutletContext } from "react-router-dom";
import { FiBookOpen, FiHome, FiMapPin, FiPhone, FiUser, FiUsers } from "react-icons/fi";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";

const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(15,23,42,.04)" };

function LearnerAssignment({ assignment }) {
  const { data: courses = [], isLoading } = useCurriculumCurrentCourses(assignment.curriculum?.id, assignment.gradeId || undefined);
  const child = assignment.learner || {};
  const home = assignment.household || {};
  return <article style={card}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, color: "#111827" }}>{child.firstName} {child.lastName}</h2>
        <p style={{ margin: "5px 0 0", color: "#25476a", fontWeight: 700, fontSize: 13 }}><FiBookOpen style={{ verticalAlign: "-2px" }} /> {assignment.curriculum?.name || "Curriculum"}{assignment.gradeName ? ` · ${assignment.gradeName}` : ""}</p>
        {assignment.classId
          ? <Link to={`/teacher-portal/classes/${assignment.classId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, textDecoration: "none", color: "#fff", background: "#25476a", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700 }}><FiUsers /> Open class — attendance, assessments &amp; reports</Link>
          : <p style={{ margin: "8px 0 0", color: "#B45309", fontSize: 12 }}>Waiting for the admin to set this child's grade — attendance and assessments open once it's set.</p>}
      </div>
      <div style={{ minWidth: 230, color: "#4B5563", fontSize: 13, display: "grid", gap: 5 }}>
        <strong style={{ color: "#111827" }}><FiUser style={{ verticalAlign: "-2px" }} /> {home.guardianName}</strong>
        {home.guardianPhone && <span><FiPhone style={{ verticalAlign: "-2px" }} /> {home.guardianPhone}</span>}
        <span><FiMapPin style={{ verticalAlign: "-2px" }} /> {[home.addressLine, home.landmark, home.town, home.subCounty, home.county].filter(Boolean).join(", ") || "Home location not recorded"}</span>
      </div>
    </div>
    <div style={{ borderTop: "1px solid #EEF1F5", marginTop: 16, paddingTop: 14 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, color: "#4B5563" }}>Assigned courses</h3>
      {isLoading ? <span style={{ color: "#9CA3AF", fontSize: 13 }}>Loading courses…</span> : courses.length === 0 ? <span style={{ color: "#9CA3AF", fontSize: 13 }}>No published courses for this grade yet.</span> : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {courses.map((course) => <Link key={course.id} to={`/teacher-portal/course-content/${course.id}`} style={{ textDecoration: "none", color: "#25476a", border: "1px solid #D6E5F0", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700 }}>{course.name}</Link>)}
      </div>}
    </div>
  </article>;
}

export default function EducatorHomeLearningPage() {
  const { homeLearningAssignments: assignments = [], homeLearningLoading: isLoading, homeLearningError: isError } = useOutletContext();
  return <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: "#E8F5FB", color: "#25476a" }}><FiHome size={22} /></div>
      <div><h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Home Learning learners</h1><p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>The children you teach at home, their curriculum and grade, and each family's contact details.</p></div>
    </header>
    {isLoading ? <div style={card}>Loading assignments…</div> : isError ? <div style={{ ...card, color: "#B91C1C" }}>Could not load your Home Learning assignments.</div> : assignments.length === 0 ? <div style={{ ...card, color: "#6B7280", textAlign: "center", padding: 36 }}>You do not have any active Home Learning assignments yet.</div> : <div style={{ display: "grid", gap: 14 }}>{assignments.map((assignment) => <LearnerAssignment key={assignment.id} assignment={assignment} />)}</div>}
  </div>;
}
