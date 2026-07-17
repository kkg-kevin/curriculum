import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { useClassQuery } from "../../classes/hooks/useClasses";
import { teacherApi } from "../../teachers/services/teacherApi";
import { learnerApi } from "../../learners/services/learnerApi";

const LEARNER_STATUS_STYLES = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive" },
  transferred: { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Transferred" },
  graduated:   { bg: "#fff8e6", color: "#b07800", border: "#fcd97a", label: "Graduated" },
};

function LearnerStatusBadge({ status }) {
  const s = LEARNER_STATUS_STYLES[status] || LEARNER_STATUS_STYLES.active;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function LearnerRow({ learner }) {
  const initials = `${learner.firstName?.[0] ?? ""}${learner.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid #F9FAFB" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {initials || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{learner.firstName} {learner.lastName}</p>
        <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{learner.admissionNumber || "No ID"}</p>
      </div>
      <span style={{ fontSize: 12, color: "#6B7280" }}>{learner.guardianPhone || "No guardian phone"}</span>
      <LearnerStatusBadge status={learner.status} />
    </div>
  );
}

export default function MyClassPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: cls, isLoading: classLoading } = useClassQuery(classId);

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "byEmail", user?.email],
    queryFn: () => teacherApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const teacher = teachersData?.data?.[0] || null;

  const { data: learnersData, isLoading: learnersLoading } = useQuery({
    queryKey: ["learners", "byClass", classId],
    queryFn: () => learnerApi.getAll({ classId }),
    enabled: !!classId,
  });
  const learners = learnersData?.data || [];

  if (classLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }

  if (!cls) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Class not found.
      </div>
    );
  }

  if (teacher && cls.classTeacherId !== teacher.id) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ You aren't the class teacher for this class.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <button
        type="button"
        onClick={() => navigate("/teacher-portal")}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", marginBottom: "16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        ← Dashboard
      </button>

      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#ffffff" }}>{cls.gradeName}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>Academic Year {cls.academicYear} · {learners.length} learner{learners.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/teacher-portal/attendance?classId=${classId}`)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}
        >
          📋 Take Attendance
        </button>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
        {learnersLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading roster…</div>
        ) : learners.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>No learners enrolled in this class yet.</div>
        ) : (
          learners.map((l) => <LearnerRow key={l.id} learner={l} />)
        )}
      </div>
    </div>
  );
}
