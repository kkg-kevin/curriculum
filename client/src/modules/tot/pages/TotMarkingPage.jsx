import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FiCheckCircle, FiEdit3 } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useTotMarking } from "../hooks/useTot";
import { useGradeSubmission } from "../../assessments/hooks/useAssessmentSubmission";
import DiagnosticGradingModal from "../../assessments/components/DiagnosticGradingModal";
import { Segmented } from "../../checkins/shared";

const fmt = (v) => (v ? new Date(v).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const waited = (v) => {
  if (!v) return null;
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
  return days < 1 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

// Training of trainers — work educators have handed in on their TOT courses, waiting to be marked.
//   supervisor   /supervisor-portal/marking — their own educators' work.
//   admin        /teachers/training — educators with no supervisor (or every educator's).
// Marking opens the work and its marking panel; saving the mark sends the feedback to the educator.
export default function TotMarkingPage() {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor";
  const [scope, setScope] = useState("unsupervised");
  const { data: rows = [], isLoading, isError, error } = useTotMarking(isSupervisor || scope === "unsupervised" ? {} : { all: "1" });
  const { mutate: grade, isPending } = useGradeSubmission();
  const [open, setOpen] = useState(null);
  const qc = useQueryClient();

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "24px 28px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Educator training — work to mark</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5, maxWidth: 660 }}>
          {isSupervisor
            ? "Work your educators have handed in on their TOT courses. Mark it and give feedback — they see it as soon as you save."
            : "TOT work from educators who have no supervisor — the admin marks it. Give an educator a supervisor (on the educator form) and their work goes to them instead."}
        </p>
      </div>

      {!isSupervisor && (
        <Segmented label="Show" options={[{ key: "unsupervised", label: "No supervisor" }, { key: "all", label: "Every educator" }]} value={scope} onChange={setScope} />
      )}

      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        {isLoading && <p style={{ margin: 0, padding: 20, fontSize: 13, color: "#9CA3AF" }}>Loading…</p>}
        {isError && <p style={{ margin: 0, padding: 20, fontSize: 13, color: "#B91C1C" }}>{error?.message || "Couldn't load the work to mark."}</p>}
        {!isLoading && !isError && rows.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 12px", borderRadius: 16, background: "#ECFDF5", color: "#16A34A", display: "grid", placeItems: "center" }}><FiCheckCircle size={24} /></div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>Nothing waiting to be marked</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7280" }}>Work appears here as educators hand it in.</p>
          </div>
        )}
        {rows.map((row) => (
          <div key={row.submission.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#111827" }}>{row.assessment.name}</p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#6B7280" }}>
                {row.educator?.name || `${row.learner.firstName} ${row.learner.lastName}`} · handed in {fmt(row.submission.submittedAt)}
                {waited(row.submission.submittedAt) && <span style={{ marginLeft: 8, color: "#B45309", fontWeight: 700 }}>waiting {waited(row.submission.submittedAt)}</span>}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(row)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: "#25476a", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              <FiEdit3 size={14} /> Mark
            </button>
          </div>
        ))}
      </div>

      {open && (
        <DiagnosticGradingModal
          title={`${open.assessment.name} — ${open.educator?.name || `${open.learner.firstName} ${open.learner.lastName}`}`}
          assessment={open.assessment}
          submission={open.submission}
          isSaving={isPending}
          onSave={(payload) => grade({ id: open.submission.id, ...payload }, { onSuccess: () => { setOpen(null); qc.invalidateQueries({ queryKey: ["tot"] }); } })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
