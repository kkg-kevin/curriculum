import { useNavigate } from "react-router-dom";
import { FiBarChart2, FiCheckCircle, FiClipboard, FiClock, FiInbox } from "react-icons/fi";
import { useIssuedForLearner } from "../../../assessments/hooks/useAssessmentSubmission";
import { T, cardStyle, KID, KidHeading } from "./theme";

function Stage({ label, sub, done, icon: Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 16, backgroundColor: done ? KID.sky.soft : "#F6F7FA", border: `1.5px solid ${done ? KID.sky.border : T.border}` }}>
      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, backgroundColor: "#fff", color: done ? KID.sky.color : T.inkFaint, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} strokeWidth={2.4} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>{label}</p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.inkMuted }}>{sub}</p>
      </div>
      {done && <FiCheckCircle size={18} color={KID.sky.color} style={{ flexShrink: 0 }} />}
    </div>
  );
}

// `classId`, when given, scopes to one hub's class — see AssessmentsOverview for why.
// `staffLearnerId` — an admin/school viewing that learner's profile (see AssessmentsOverview).
export default function SummaryRow({ classId, staffLearnerId } = {}) {
  const navigate = useNavigate();
  const { data, isLoading } = useIssuedForLearner(staffLearnerId);
  const allRows = data?.data || [];
  const rows = classId ? allRows.filter((r) => r.issue.classId === classId) : allRows;

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
        <KidHeading icon={FiClipboard} tone={KID.gold} action={!staffLearnerId && <button
            type="button"
            onClick={() => navigate("/learner-portal/reports")}
            style={{ background: KID.gold.soft, border: `1.5px solid ${KID.gold.border}`, borderRadius: 999, padding: "6px 12px", color: KID.gold.color, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            My reports →
          </button>}>Assessment Summary</KidHeading>
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Stage icon={FiInbox} label="Issued" sub={`${issued} assessment${issued !== 1 ? "s" : ""}`} done={issued > 0} />
            <Stage icon={FiClock} label="Pending" sub={`${pending} awaiting completion`} done={pending === 0 && issued > 0} />
            <Stage icon={FiCheckCircle} label="Graded" sub={graded.length ? `${graded.length} graded · avg ${avgScore}%` : "None graded yet"} done={graded.length > 0} />
          </div>
        )}
      </div>

      {/* Overall Progress — real average score across this learner's graded assessments */}
      <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260 }}>
        <KidHeading icon={FiBarChart2} tone={KID.sky}>Overall Progress</KidHeading>
        {avgScore == null ? (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: T.inkMuted, lineHeight: 1.5 }}>Nothing marked yet — your average shows up here once your teacher marks your work.</p>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: T.inkMuted }}>
              Average score across <strong style={{ color: T.ink }}>{graded.length}</strong> graded assessment{graded.length !== 1 ? "s" : ""}.
            </p>
            <div style={{ height: 16, borderRadius: 999, backgroundColor: KID.sky.soft, overflow: "hidden", marginBottom: 8, border: `1.5px solid ${KID.sky.border}` }}>
              <div style={{ width: `${avgScore}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${KID.navy.fill}, ${KID.sky.fill})` }} />
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: KID.sky.color }}>{avgScore}%</p>
          </>
        )}
      </div>
    </div>
  );
}
