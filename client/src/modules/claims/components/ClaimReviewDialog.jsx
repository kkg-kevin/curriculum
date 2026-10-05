import { useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiExternalLink, FiFileText, FiInfo, FiX } from "react-icons/fi";
import { useAdminDecision, useClaim, useMarkClaimPaid, useSupervisorDecision } from "../hooks/useClaims";
import { ClaimStatusPill, ClaimTimeline, Dialog, LocationChip, T, TYPE_LABEL, formatDate, formatMoney, formatRate, ghostButton, inputStyle, invoiceHref, primaryButton } from "../shared";
import SessionEvidence from "./SessionEvidence";

// A reviewer's view of one claim: what is being asked for and how it was worked out, the
// invoice, the course's records, and — for whoever's turn it is — the decision.
//
// `canSupervise` / `canApprove` say which stage the viewer may act on (the workspace owner: both).

function Row({ label, value, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", fontSize: 13 }}>
      <span style={{ color: T.inkMuted }}>{label}</span>
      <span style={{ color: T.ink, fontWeight: strong ? 800 : 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

// "Then" is what the educator's records looked like when they submitted; "now" is the live
// picture — they can keep marking and grading while a claim waits.
function Record({ label, then, now, empty }) {
  const text = (pair) => (!pair || pair.of === 0 ? empty : `${pair.done}/${pair.of}`);
  const complete = now && now.of > 0 && now.done >= now.of;
  return (
    <div style={{ flex: "1 1 150px", padding: "12px 14px", borderRadius: 12, background: "#fff", border: `1px solid ${complete ? "#A7F3D0" : T.border}` }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 17, fontWeight: 800, color: complete ? "#047857" : T.ink, fontVariantNumeric: "tabular-nums" }}>{text(now || then)}</p>
      {now && then && text(now) !== text(then) && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.inkFaint }}>{text(then)} when submitted</p>}
    </div>
  );
}

const pairs = (evidence) => evidence && {
  attendance: { done: evidence.attendanceMarked, of: evidence.sessionsDelivered },
  assignments: { done: evidence.assignmentsGraded, of: evidence.assignmentsExpected },
  reports: { done: evidence.reportsDone, of: evidence.reportsExpected },
};

export default function ClaimReviewDialog({ claimId, canSupervise, canApprove, onClose }) {
  const { data: claim, isLoading, isError, error } = useClaim(claimId);
  const supervisor = useSupervisorDecision();
  const admin = useAdminDecision();
  const paid = useMarkClaimPaid();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const busy = supervisor.isPending || admin.isPending || paid.isPending;

  if (isLoading || isError) {
    return (
      <Dialog title="Claim" onClose={onClose}>
        <p style={{ margin: 0, padding: "30px 0", textAlign: "center", fontSize: 14, color: isError ? "#B91C1C" : T.inkMuted }}>{isError ? error?.message || "This claim couldn't be loaded" : "Loading the claim…"}</p>
      </Dialog>
    );
  }

  const money = (value) => formatMoney(value, claim.currency);
  const stage = claim.status === "pending_supervisor" ? "supervisor" : claim.status === "pending_admin" ? "admin" : null;
  const myTurn = (stage === "supervisor" && canSupervise) || (stage === "admin" && canApprove);
  const decide = stage === "supervisor" ? supervisor : admin;
  const then = pairs(claim.evidence);
  const now = pairs(claim.course?.evidence);
  const href = invoiceHref(claim);

  const run = async (action, success) => {
    try {
      await action();
      toast.success(success);
      onClose();
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "That didn't go through");
    }
  };
  const approve = () => run(() => decide.mutateAsync({ id: claim.id, decision: "approve" }), stage === "supervisor" ? "Approved and sent to the admin" : "Approved for payment");
  const decline = () => run(() => decide.mutateAsync({ id: claim.id, decision: "reject", reason: reason.trim() }), "Claim declined — the educator has been told why");
  const markPaid = () => run(() => paid.mutateAsync({ id: claim.id, paymentReference: reference.trim() || null, paidAt }), "Marked as paid");

  return (
    <Dialog title={`${TYPE_LABEL[claim.type]} claim · ${money(claim.amount)}`} subtitle={`${claim.claimNumber} · submitted ${formatDate(claim.createdAt)}`} onClose={onClose} busy={busy} width={980}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 14 }}>
        <div style={{ padding: 16, borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>{claim.teacherName}</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: T.inkMuted }}>{claim.courseName}{claim.className ? ` · ${claim.className}` : ""}</p>
            </div>
            <ClaimStatusPill status={claim.status} size="small" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 12px", flexWrap: "wrap" }}>
            <LocationChip hub={claim.course?.hub} />
            <span style={{ fontSize: 12.5, color: T.inkMuted }}>{claim.hubName || "—"}</span>
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6 }}>
            <Row label="Sessions delivered" value={`${claim.sessionsDelivered} of ${claim.sessionsTotal}`} />
            <Row label="Rate per session" value={formatRate(claim.sessionRate, claim.currency)} />
            <Row label="Course value" value={money(claim.courseAmount)} />
            {claim.type === "full" && claim.advanceDeducted > 0 && <Row label="Less advance" value={`− ${money(claim.advanceDeducted)}`} />}
            <div style={{ borderTop: `1px dashed ${T.border}`, marginTop: 4 }}>
              <Row label={claim.type === "advance" ? "Advance requested" : "Amount requested"} value={money(claim.amount)} strong />
            </div>
          </div>
          {claim.note && <p style={{ margin: "10px 0 0", padding: "10px 12px", borderRadius: 10, background: "#F8FAFC", fontSize: 12.5, color: T.ink, lineHeight: 1.5, overflowWrap: "anywhere" }}><strong>Educator's note:</strong> {claim.note}</p>}
          {claim.course?.coEducators?.length > 0 && (
            <p style={{ margin: "10px 0 0", display: "flex", gap: 6, fontSize: 12, color: "#B45309", lineHeight: 1.5 }}><FiInfo size={13} style={{ flexShrink: 0, marginTop: 2 }} /> Also teaching this course: {claim.course.coEducators.join(", ")}.</p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a href={href} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, background: "#fff", border: `1px solid ${T.tintBorder}`, textDecoration: "none" }}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><FiFileText size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.invoiceFilename || "Invoice.pdf"}</span>
              <span style={{ display: "block", fontSize: 12, color: T.inkMuted }}>The educator's invoice — opens in a new tab</span>
            </span>
            <FiExternalLink size={16} color={T.accentMid} />
          </a>
          <div style={{ padding: "18px 14px 14px", borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
            <ClaimTimeline claim={claim} />
            {claim.status === "rejected" && (
              <p style={{ margin: "14px 0 0", padding: "10px 12px", borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 12.5, color: "#7F1D1D", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><strong>Reason given:</strong> {claim.rejectionReason}</p>
            )}
            {claim.status === "paid" && <p style={{ margin: "14px 0 0", fontSize: 12.5, color: T.inkMuted }}>Paid {formatDate(claim.paidAt)}{claim.paymentReference ? <> · reference <strong style={{ color: T.ink }}>{claim.paymentReference}</strong></> : null}</p>}
          </div>
        </div>
      </div>

      <p style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>Records for delivered sessions</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Record label="Attendance marked" then={then?.attendance} now={now?.attendance} empty="—" />
        <Record label="Assignments graded" then={then?.assignments} now={now?.assignments} empty="None set" />
        <Record label="Reports done" then={then?.reports} now={now?.reports} empty="Not needed" />
      </div>

      <div style={{ marginTop: 14 }}>
        {claim.course ? <SessionEvidence course={claim.course} /> : (
          <p style={{ margin: 0, padding: "18px 16px", borderRadius: 12, background: "#fff", border: `1px solid ${T.border}`, fontSize: 13, color: T.inkMuted }}>The class or course behind this claim has since been removed, so its session records can't be shown. The figures above are what was recorded when the claim was submitted.</p>
        )}
      </div>

      {/* The decision. */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
        {myTurn && !declining && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => setDeclining(true)} style={{ ...ghostButton, color: "#B91C1C", borderColor: "#FECACA" }}><FiX size={15} /> Decline</button>
            <button type="button" disabled={busy} onClick={approve} style={primaryButton(busy)}><FiCheck size={15} /> {stage === "supervisor" ? "Approve and send to admin" : "Approve for payment"}</button>
          </div>
        )}

        {myTurn && declining && (
          <div>
            <label htmlFor="decline-reason" style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: T.ink }}>Why is this claim declined?</label>
            <textarea id="decline-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} placeholder="This message is sent to the educator — say what needs fixing before they claim again." style={{ ...inputStyle, resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button type="button" disabled={busy} onClick={() => setDeclining(false)} style={ghostButton}>Back</button>
              <button type="button" disabled={busy || reason.trim().length < 3} onClick={decline} style={{ ...primaryButton(busy || reason.trim().length < 3), background: busy || reason.trim().length < 3 ? "#E5A4A4" : "#DC2626" }}>Decline and notify educator</button>
            </div>
          </div>
        )}

        {claim.status === "approved" && canApprove && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label htmlFor="payment-reference" style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink }}>Payment reference <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
              <input id="payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="e.g. M-Pesa or bank transaction code" style={inputStyle} />
            </div>
            <div style={{ flex: "0 1 170px" }}>
              <label htmlFor="payment-date" style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink }}>Paid on</label>
              <input id="payment-date" type="date" value={paidAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />
            </div>
            <button type="button" disabled={busy || !paidAt} onClick={markPaid} style={primaryButton(busy || !paidAt)}><FiCheck size={15} /> Mark as paid</button>
          </div>
        )}

        {!myTurn && !(claim.status === "approved" && canApprove) && (
          <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
            {{
              pending_supervisor: "Waiting for a supervisor's review — your role doesn't include that.",
              pending_admin: "Approved by the supervisor; waiting for the admin's final approval.",
              approved: "Approved for payment; waiting for the payment to be recorded.",
              paid: "This claim has been paid.",
              rejected: "This claim was declined. The educator can submit a new one.",
            }[claim.status]}
          </p>
        )}
      </div>
    </Dialog>
  );
}
