import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiDollarSign, FiFileText, FiInfo, FiUsers } from "react-icons/fi";
import { useMyClaimCourse, useWithdrawClaim } from "../../claims/hooks/useClaims";
import { CourseStagePill, LocationChip, ProgressRing, T, cardStyle, formatMoney, formatRate, primaryButton } from "../../claims/shared";
import SessionEvidence from "../../claims/components/SessionEvidence";
import ClaimCard from "../../claims/components/ClaimCard";
import RequestPaymentModal from "../../claims/components/RequestPaymentModal";

// One course's claim: what it pays, its sessions with every student's records, the payment
// request, and the history of the claims already made for it.

function Evidence({ label, done, of, empty }) {
  const complete = of > 0 && done >= of;
  return (
    <div style={{ flex: "1 1 130px", minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: of === 0 ? T.inkFaint : complete ? "#047857" : T.ink, fontVariantNumeric: "tabular-nums" }}>{of === 0 ? empty : `${done}/${of}`}</p>
    </div>
  );
}

export default function ClaimCoursePage() {
  const { classId, courseId } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading, isError, error } = useMyClaimCourse(classId, courseId);
  const withdraw = useWithdrawClaim();
  const [requesting, setRequesting] = useState(false);

  const back = (
    <button type="button" onClick={() => navigate("/teacher-portal/claims")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
      <FiArrowLeft size={15} /> My Claims
    </button>
  );

  if (isLoading) return <div style={{ fontFamily: "Inter, sans-serif" }}>{back}<p style={{ color: T.inkMuted, fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading this course…</p></div>;
  if (isError) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
        {back}
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>This course couldn't be loaded</p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
        </div>
      </div>
    );
  }

  const money = (value) => formatMoney(value, course.currency);
  const percent = course.sessionsTotal > 0 ? Math.round((course.sessionsDelivered / course.sessionsTotal) * 100) : 0;
  const canRequest = course.canRequestAdvance || course.canRequestFull;
  const blockedReason = course.fullBlocked || course.advanceBlocked;
  const { evidence } = course;

  const onWithdraw = async (claim) => {
    if (!window.confirm("Withdraw this payment request? You can send a new one afterwards.")) return;
    try {
      await withdraw.mutateAsync(claim.id);
      toast.success("Payment request withdrawn");
    } catch (err) {
      toast.error(err.message || "Could not withdraw the request");
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      {back}

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.ink, letterSpacing: "-0.4px" }}>{course.courseName}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <LocationChip hub={course.hub} />
            <span style={{ fontSize: 13, color: T.inkMuted }}>{[course.className, course.hub?.name].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <CourseStagePill stage={course.stage} />
      </div>

      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, background: T.border, overflow: "hidden" }}>
        <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, background: "#fff" }}>
          <ProgressRing percent={percent} />
          <div>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>Course progress</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 800, color: T.ink }}>{course.sessionsDelivered}/{course.sessionsTotal} sessions</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 10px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 12, fontWeight: 700 }}>
              <FiUsers size={12} /> {course.learners.length} {course.learners.length === 1 ? "student" : "students"}
            </span>
          </div>
        </div>

        <div style={{ padding: 20, background: "#fff" }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>Amount payable</p>
          <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: T.accent, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{money(course.courseAmount)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{course.sessionsTotal} sessions × {formatRate(course.sessionRate, course.currency)} · {money(course.earnedAmount)} earned so far</p>
          <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: T.inkMuted }}>Advance ({course.advancePercent}%)</p>
              <p style={{ margin: "2px 0 0", fontSize: 14.5, fontWeight: 800, color: "#C2410C", fontVariantNumeric: "tabular-nums" }}>{money(course.advanceAmount)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: T.inkMuted }}>Balance</p>
              <p style={{ margin: "2px 0 0", fontSize: 14.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{money(course.balance)}</p>
            </div>
          </div>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
          <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>Payment actions</p>
          <p style={{ margin: 0, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>Submit an invoice for an advance or the full payment. {course.supervisor ? <>Your supervisor, <strong>{course.supervisor.name}</strong>, approves it and the admin pays.</> : "It goes to the admin, who approves and pays it."}</p>
          <button type="button" disabled={!canRequest} onClick={() => setRequesting(true)} style={{ ...primaryButton(!canRequest), width: "100%", marginTop: "auto" }}>
            <FiDollarSign size={16} /> Request payment
          </button>
          {!canRequest && blockedReason && (
            <p style={{ margin: 0, display: "flex", gap: 6, fontSize: 12, color: "#B45309", lineHeight: 1.5 }}><FiInfo size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {blockedReason}</p>
          )}
        </div>
      </div>

      {/* What a reviewer will look at before approving — worth getting to 100% before claiming. */}
      <div style={{ ...cardStyle, padding: "16px 20px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>Records for delivered sessions</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: T.inkMuted, lineHeight: 1.5 }}>{course.supervisor ? "Your supervisor sees" : "The admin sees"} these with your claim.</p>
        </div>
        <Evidence label="Attendance marked" done={evidence.attendanceMarked} of={evidence.sessionsDelivered} empty="—" />
        <Evidence label="Assignments graded" done={evidence.assignmentsGraded} of={evidence.assignmentsExpected} empty="None set" />
        <Evidence label="Reports done" done={evidence.reportsDone} of={evidence.reportsExpected} empty="Not needed" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))", gap: 16, alignItems: "start" }}>
        <SessionEvidence course={course} />

        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink }}>Claim history</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{course.courseName}</p>
            </div>
            <span style={{ minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: "#F1F5F9", color: T.inkMuted, fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center" }}>{course.claims.length}</span>
          </div>
          {course.claims.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", borderRadius: 12, border: `1.5px dashed ${T.tintBorder}`, background: "#F8FBFE" }}>
              <FiFileText size={22} color={T.inkFaint} />
              <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: T.ink }}>No claims yet</p>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.inkMuted }}>Payment requests for this course will appear here.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {course.claims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  actions={claim.status === "pending_supervisor" || claim.status === "pending_admin" ? (
                    <button type="button" onClick={() => onWithdraw(claim)} disabled={withdraw.isPending} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #FECACA", background: "#fff", color: "#B91C1C", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Withdraw</button>
                  ) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {requesting && <RequestPaymentModal course={course} onClose={() => setRequesting(false)} />}
    </div>
  );
}
