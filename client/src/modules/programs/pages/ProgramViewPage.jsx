import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowRight, FiLayers } from "react-icons/fi";
import { useProgramQuery, useDeleteProgram } from "../hooks/usePrograms";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const STATUS_LABEL = { upcoming: "Upcoming", active: "Active", completed: "Completed" };

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || empty}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function ProgramViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: program, isLoading } = useProgramQuery(id);
  const { mutate: deleteProgram } = useDeleteProgram();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!program) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Program not found.</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate("/programs")} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Programs
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{program.name}</span>
      </div>

      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <FiLayers size={28} strokeWidth={1.8} />
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{program.name}</h1>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
                {program.hubName || "Unknown hub"} · {STATUS_LABEL[program.status] || program.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Program Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Description"  value={program.description} />
            <DetailRow label="Curriculum"   value={program.curriculumName} />
            <DetailRow label="Learning Hub" value={program.hubName} />
            <DetailRow label="Cohort"       value={program.gradeName} />
            <DetailRow label="Start Date"   value={formatDate(program.startDate)} />
            <DetailRow label="End Date"     value={formatDate(program.endDate)} />
            <DetailRow label="Status"       value={STATUS_LABEL[program.status] || program.status} />
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Manage</h3>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
            Structure, competencies, courses, and version control all live on the program curriculum itself — same authoring
            flow as any curriculum. Rosters, attendance, and the class tech educator live on the class.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/curriculum/${program.curriculumId}/view`)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", backgroundColor: "#25476a", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            View Program Curriculum <FiArrowRight size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => navigate(`/classes/${program.classId}/view`)}
            style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", backgroundColor: "transparent", color: "#25476a", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
          >
            View Class ({program.learnerCount} learner{program.learnerCount !== 1 ? "s" : ""}) <FiArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Program"
        message={`"${program.name}" will be removed. Its class and curriculum content stay intact — only the program record itself is deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteProgram(id, { onSuccess: () => navigate("/programs") });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
