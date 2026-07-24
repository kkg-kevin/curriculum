import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiSend, FiShare2 } from "react-icons/fi";
import { useIssuedForLearner } from "../../../assessments/hooks/useAssessmentSubmission";
import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";

function Stage({ label, sub, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          backgroundColor: done ? T.tintBg : "#F9FAFB",
          border: `1.5px solid ${done ? T.tintBorder : T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: done ? T.accent : T.inkFaint,
        }}
      >
        {done ? <FiCheckCircle size={15} /> : <FiClock size={15} />}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{label}</p>
        <p style={{ margin: 0, fontSize: 11, color: T.inkMuted }}>{sub}</p>
      </div>
    </div>
  );
}

export default function SummaryRow() {
  const navigate = useNavigate();
  const { data, isLoading } = useIssuedForLearner();
  const rows = data?.data || [];

  const issued = rows.length;
  const graded = rows.filter((r) => r.submission.status === "graded");
  const pending = rows.filter((r) => r.submission.status === "not_started" || r.submission.status === "in_progress").length;
  const avgScore = graded.length
    ? Math.round(graded.reduce((sum, r) => sum + (r.submission.totalScore / (r.submission.maxScore || 1)) * 100, 0) / graded.length)
    : null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {/* Assessment Summary — real, drawn from this learner's actual issued assessments */}
      <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 280 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={sectionHeaderStyle()}>Assessment Summary</h2>
          <button
            type="button"
            onClick={() => navigate("/learner-portal/assessments")}
            style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
          >
            View full reports
          </button>
        </div>
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Stage label="Issued" sub={`${issued} assessment${issued !== 1 ? "s" : ""}`} done={issued > 0} />
            <Stage label="Pending" sub={`${pending} awaiting completion`} done={pending === 0 && issued > 0} />
            <Stage label="Graded" sub={graded.length ? `${graded.length} graded · avg ${avgScore}%` : "None graded yet"} done={graded.length > 0} />
          </div>
        )}
      </div>

      {/* Overall Progress — real average score across this learner's graded assessments */}
      <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260 }}>
        <h2 style={{ ...sectionHeaderStyle(), marginBottom: 16 }}>Overall Progress</h2>
        {avgScore == null ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>No graded assessments yet — a progress average will appear here once feedback comes in.</p>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: T.inkMuted }}>
              Average score across <strong style={{ color: T.ink }}>{graded.length}</strong> graded assessment{graded.length !== 1 ? "s" : ""}.
            </p>
            <div style={{ height: 10, borderRadius: 6, backgroundColor: "#F3F4F6", overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${avgScore}%`, height: "100%", backgroundColor: T.accentMid }} />
            </div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.accent }}>{avgScore}%</p>
          </>
        )}
      </div>

      {/* Share & Verify — cosmetic placeholder, no verification backend exists yet */}
      <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260, opacity: 0.7 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={sectionHeaderStyle()}>Share & Verify</h2>
          <PreviewTag />
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.5 }}>
          Employers and institutions will be able to verify this profile using a DCF Passport, once that feature ships.
        </p>
        <button
          type="button"
          disabled
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", backgroundColor: "#E5E7EB", color: T.inkMuted, border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "not-allowed" }}
        >
          <FiShare2 size={14} /> Coming soon
        </button>
      </div>
    </div>
  );
}
