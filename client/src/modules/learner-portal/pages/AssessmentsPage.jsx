import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClipboard, FiClock, FiSend } from "react-icons/fi";
import { useIssuedForLearner } from "../../assessments/hooks/useAssessmentSubmission";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
};

function cardStyle() {
  return {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: `1px solid ${T.border}`,
  };
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function KpiTile({ icon, value, label, sub }) {
  return (
    <div style={{ ...cardStyle(), padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: T.accent, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  not_started: { label: "Not Started", bg: "#F9FAFB", color: T.inkMuted, border: T.border, cta: "Start" },
  in_progress: { label: "In Progress", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A", cta: "Continue" },
  submitted:   { label: "Submitted",   bg: T.tintBg,  color: T.accent,  border: T.tintBorder, cta: "View" },
  graded:      { label: "Graded",      bg: "#ECFDF5", color: "#059669", border: "#A7F3D0", cta: "View Feedback" },
};

export default function LearnerAssessmentsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useIssuedForLearner();
  const rows = data?.data || [];

  const pending = rows.filter((r) => r.submission.status === "not_started" || r.submission.status === "in_progress").length;
  const gradedRows = rows.filter((r) => r.submission.status === "graded");
  const avgScore = gradedRows.length
    ? Math.round(gradedRows.reduce((sum, r) => sum + (r.submission.totalScore / (r.submission.maxScore || 1)) * 100, 0) / gradedRows.length)
    : null;

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Assessments</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>Assessments your teacher has issued to your class.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiTile icon={<FiClipboard />} value={rows.length} label="Issued" />
        <KpiTile icon={<FiClock />} value={pending} label="Pending" sub="Not started or in progress" />
        <KpiTile icon={<FiCheckCircle />} value={gradedRows.length} label="Graded" sub={avgScore != null ? `Average ${avgScore}%` : undefined} />
      </div>

      {rows.length === 0 ? (
        <div style={{ ...cardStyle(), textAlign: "center", padding: "60px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: T.tintBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.accent, fontSize: 24 }}><FiSend /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>Nothing issued yet</h3>
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>Your teacher hasn't issued any assessments to your class yet — check back later.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {rows.map(({ issue, assessment, submission }) => {
            const cfg = STATUS_CONFIG[submission.status] || STATUS_CONFIG.not_started;
            return (
              <div key={issue.id} style={{ ...cardStyle(), padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 220, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>{assessment.name}</p>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: T.inkMuted }}>{stripHtml(assessment.description) || "No description added"}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, minWidth: 140 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, backgroundColor: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 999, padding: "6px 12px" }}>
                      {cfg.label}{submission.status === "graded" ? ` · ${submission.totalScore}/${submission.maxScore}` : ""}
                    </span>
                    <button type="button" onClick={() => navigate(`/learner-portal/assessments/${issue.id}`)} style={{ padding: "10px 14px", minWidth: 120, backgroundColor: T.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {cfg.cta}
                    </button>
                  </div>
                </div>
                {issue.dueDate && <p style={{ margin: 0, fontSize: 12, color: T.accent, fontWeight: 600 }}>Due {new Date(issue.dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
