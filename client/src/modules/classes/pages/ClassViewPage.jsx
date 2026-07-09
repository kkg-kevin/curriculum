import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClassQuery, useDeleteClass } from "../hooks/useClasses";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useQuery } from "@tanstack/react-query";
import { teacherApi } from "../../teachers/services/teacherApi";
import { learnerApi } from "../../learners/services/learnerApi";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || empty}</span>
    </div>
  );
}

function CapacityRow({ enrolled, capacity }) {
  if (!capacity) {
    return <DetailRow label="Capacity" value={`${enrolled} enrolled · Unlimited`} />;
  }
  const pct = Math.min(100, Math.round((enrolled / capacity) * 100));
  const color = enrolled >= capacity ? "#EF4444" : pct >= 80 ? "#feb139" : "#38aae1";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Capacity</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{enrolled} / {capacity} enrolled</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, backgroundColor: color, transition: "width 0.2s" }} />
      </div>
    </div>
  );
}

export default function ClassViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cls, isLoading } = useClassQuery(id);
  const { mutate: deleteClass } = useDeleteClass();
  const { data: schoolsData } = useSchoolsQuery();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: curriculum }   = useCurriculumQuery(cls?.curriculumId);

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", cls?.schoolId],
    queryFn: () => teacherApi.getAll({ schoolId: cls.schoolId }),
    enabled: !!cls?.schoolId,
  });

  const { data: learnersData } = useQuery({
    queryKey: ["learners", "byClass", cls?.id],
    queryFn: () => learnerApi.getAll({ classId: cls.id }),
    enabled: !!cls?.id,
  });
  const classLearners = learnersData?.data || [];

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!cls) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Class not found.</div>;
  }

  const schoolsMap = (schoolsData?.data || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
  const teachersMap = (teachersData?.data || []).reduce((m, t) => { m[t.id] = t; return m; }, {});

  const school  = schoolsMap[cls.schoolId];
  const teacher = cls.classTeacherId ? teachersMap[cls.classTeacherId] : null;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate("/classes")} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Classes
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        {school && (
          <>
            <button type="button" onClick={() => navigate(`/classes/school/${cls.schoolId}`)} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {school.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
          </>
        )}
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{cls.gradeName}</span>
      </div>

      {/* Header card */}
      <div style={{ background: `linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🏫</div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{cls.gradeName}</h1>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>Academic Year {cls.academicYear} · {cls.status === "active" ? "Active" : "Inactive"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(`/classes/${id}/edit`)}
              style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="School"        value={school?.name} />
            <DetailRow label="Curriculum"    value={curriculum?.name} />
            <DetailRow label="Grade"         value={cls.gradeName} />
            <DetailRow label="Academic Year" value={cls.academicYear} />
            <DetailRow label="Class Teacher" value={teacher ? `${teacher.firstName} ${teacher.lastName}` : null} />
            <CapacityRow enrolled={classLearners.length} capacity={cls.capacity} />
            <DetailRow label="Status"        value={cls.status === "active" ? "Active" : "Inactive"} />
          </div>
        </div>

        {/* Learners in this class */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learners</h3>
            <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>{classLearners.length}</span>
          </div>
          {classLearners.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🎒</div>
              <p style={{ margin: "0 0 12px", fontSize: 13 }}>No learners enrolled in this class yet.</p>
              <button type="button" onClick={() => navigate("/learners/create")} style={{ padding: "8px 16px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Enroll Learner</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {classLearners.slice(0, 8).map((l) => (
                <div key={l.id} onClick={() => navigate(`/learners/${l.id}/view`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {(l.firstName?.[0] || "") + (l.lastName?.[0] || "")}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#111827" }}>{l.firstName} {l.lastName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{l.admissionNumber}</p>
                    </div>
                  </div>
                </div>
              ))}
              {classLearners.length > 8 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>+{classLearners.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Class"
        message={`"${cls.gradeName} — ${cls.academicYear}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteClass(id, { onSuccess: () => navigate("/classes") });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
