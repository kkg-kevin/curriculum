import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLearnerQuery, useDeleteLearner } from "../hooks/useLearners";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT    = "#BE185D";
const GRAD_FROM = "#831843";
const GRAD_TO   = "#BE185D";

const STATUS_STYLES = {
  active:      { bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  transferred: { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  graduated:   { bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", transferred: "Transferred", graduated: "Graduated" };

function Avatar({ firstName, lastName, size = 64 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || empty}</span>
    </div>
  );
}

export default function LearnerViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: learner, isLoading } = useLearnerQuery(id);
  const { mutate: deleteLearner, isPending: isDeleting } = useDeleteLearner();
  const { data: schoolsData } = useSchoolsQuery();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", learner?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: learner.schoolId }),
    enabled: !!learner?.schoolId,
  });

  if (isLoading) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  if (!learner)  return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;

  const schoolsMap = (schoolsData?.data || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
  const classesMap = (classesData?.data || []).reduce((m, c) => { m[c.id] = c; return m; }, {});

  const school = schoolsMap[learner.schoolId];
  const cls    = learner.classId ? classesMap[learner.classId] : null;
  const ss     = STATUS_STYLES[learner.status] || STATUS_STYLES.inactive;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate("/learners")} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Learners
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{learner.firstName} {learner.lastName}</span>
      </div>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #9D174D 40%, ${ACCENT} 75%, #DB2777 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar firstName={learner.firstName} lastName={learner.lastName} />
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{learner.firstName} {learner.lastName}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{learner.admissionNumber}</span>
                <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }}>
                  {STATUS_LABELS[learner.status]}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => navigate(`/learners/${id}/edit`)} style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Enrollment */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Enrollment</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Admission Number" value={learner.admissionNumber} />
            <DetailRow label="School"           value={school?.name} />
            <DetailRow label="Class"            value={cls?.gradeName} />
            <DetailRow label="Academic Year"    value={cls?.academicYear} />
            <DetailRow label="Gender"           value={learner.gender ? learner.gender.charAt(0).toUpperCase() + learner.gender.slice(1) : null} />
            <DetailRow label="Status"           value={STATUS_LABELS[learner.status]} />
          </div>
        </div>

        {/* Guardian */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.05em" }}>Guardian</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Name"  value={learner.guardianName} />
            <DetailRow label="Phone" value={learner.guardianPhone} />
            <DetailRow label="Email" value={learner.guardianEmail} />
            <DetailRow label="Enrolled"     value={new Date(learner.createdAt).toLocaleDateString()} />
            <DetailRow label="Last Updated" value={new Date(learner.updatedAt).toLocaleDateString()} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Remove Learner"
        message={`"${learner.firstName} ${learner.lastName}" (${learner.admissionNumber}) will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteLearner(id, { onSuccess: () => navigate("/learners") });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
