import { useState } from "react";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCheck, FiEye, FiFileText, FiInfo, FiX } from "react-icons/fi";
import { useAdminDecision, useClaim, useClaimPayouts, useMarkClaimPaid, usePayClaimByMpesa, useSupervisorDecision } from "../hooks/useClaims";
import { ClaimStatusPill, ClaimTimeline, Dialog, LocationChip, RATE_TYPE_LABEL, T, TYPE_LABEL, formatDate, formatMoney, ghostButton, inputStyle, invoiceHref, primaryButton, rateLabel, unitsLabel } from "../shared";
import { InvoicePanel, useSideBySide } from "./ClaimInvoiceViewer";
import SessionEvidence from "./SessionEvidence";

// A reviewer's view of one claim: what is being asked for and how it was worked out, the
// invoice, the course's records, and — for whoever's turn it is — the decision.
//
// `canSupervise` says the viewer may decide a claim that is with a supervisor (the supervisor
// themself, or the workspace in their place); `canApprove` that they may approve a claim that has
// no supervisor and record payments (the admin's side).

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

const PAYOUT_STATUS = {
  pending: "Sent to M-Pesa — waiting for its answer…",
  successful: "Paid by M-Pesa",
  failed: "M-Pesa didn't pay it",
  error: "M-Pesa didn't take the request",
  timeout: "M-Pesa never said whether it went through",
};

// Pay an approved claim straight to the educator's phone (M-Pesa B2C, when the workspace has a
// disbursement shortcode — Settings → Payments). The claim becomes paid when M-Pesa confirms the
// money went; until then it stays approved. Paying asks to confirm the amount and number, and a
// payout M-Pesa never answered must be checked before paying again.
function MpesaPayout({ claim }) {
  const { data } = useClaimPayouts(claim.id);
  const pay = usePayClaimByMpesa();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  if (!data?.canPayOut && !data?.payouts?.length) return null;
  const latest = data.payouts[0];
  const waiting = latest?.status === "pending";
  const unknown = latest?.status === "timeout";
  const amount = Number(claim.amount);
  const whole = Number.isInteger(amount);

  const send = async () => {
    try {
      await pay.mutateAsync({ id: claim.id, phone: phone.trim() || null, amount, confirmUnknown: unknown });
      toast.success("Sent to M-Pesa — the claim is marked paid once M-Pesa confirms");
      setOpen(false);
      setConfirmed(false);
    } catch (err) {
      toast.error(err.message || "M-Pesa didn't take the payment");
    }
  };

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
      {latest && (
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: latest.status === "successful" ? "#047857" : latest.status === "pending" ? T.inkMuted : "#B45309" }}>
          <strong>{PAYOUT_STATUS[latest.status] || latest.status}</strong>
          {latest.receiptNumber ? ` · M-Pesa ${latest.receiptNumber}` : ""}{latest.receiverName ? ` · to ${latest.receiverName}` : ""}
          {latest.resultDesc && latest.status !== "successful" ? ` — ${latest.resultDesc}` : ""}
        </p>
      )}
      {data.canPayOut && !waiting && latest?.status !== "successful" && !open && (
        <button type="button" onClick={() => { setOpen(true); setPhone(data.phone || ""); }} disabled={!whole} style={{ ...ghostButton, borderColor: "#86EFAC", color: "#15803D" }}>
          {unknown ? "Pay by M-Pesa again…" : "Pay by M-Pesa…"}
        </button>
      )}
      {!whole && data.canPayOut && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.inkMuted }}>M-Pesa pays whole shillings, and this claim has cents — pay it another way and mark it as paid.</p>}
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label htmlFor="payout-phone" style={{ display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink }}>Educator's M-Pesa number</label>
              <input id="payout-phone" value={phone} onChange={(e) => { setPhone(e.target.value); setConfirmed(false); }} maxLength={20} placeholder="0712 345 678" style={inputStyle} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, paddingBottom: 9 }}>{formatMoney(amount, claim.currency)}</div>
          </div>
          {unknown && <p style={{ margin: 0, fontSize: 12.5, color: "#B45309" }}>Check the B2C account's statement first: if the last payment went through, mark the claim as paid instead.</p>}
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: T.ink }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Send {formatMoney(amount, claim.currency)} to {phone || "this number"} for {claim.teacherName}. Money sent by M-Pesa can't be pulled back from here.</span>
          </label>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setOpen(false); setConfirmed(false); }} disabled={pay.isPending} style={ghostButton}>Cancel</button>
            <button type="button" onClick={send} disabled={!confirmed || pay.isPending || phone.trim().length < 9} style={primaryButton(!confirmed || pay.isPending || phone.trim().length < 9)}>
              {pay.isPending ? "Sending…" : "Send payment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const pairs = (evidence) => evidence && {
  attendance: { done: evidence.attendanceMarked, of: evidence.sessionsDelivered },
  assignments: { done: evidence.assignmentsGraded, of: evidence.assignmentsExpected },
  reports: { done: evidence.reportsDone, of: evidence.reportsExpected },
};

// The review, without its frame. `frame({ title, subtitle, wide, busy, children })` puts it in a
// pop-up or on a page; `onDone` runs after a decision; `asPage` sizes the invoice panel for a page
// (it sits beside the claim while the window scrolls) rather than inside a pop-up.
export function ClaimReview({ claimId, canSupervise, canApprove, onDone, frame, asPage = false }) {
  const onClose = onDone;
  const { data: claim, isLoading, isError, error } = useClaim(claimId);
  const supervisor = useSupervisorDecision();
  const admin = useAdminDecision();
  const paid = useMarkClaimPaid();
  const [declining, setDeclining] = useState(false);
  // Which invoice is showing beside the claim — "claim" (generated) or "etims" (uploaded).
  const [viewing, setViewing] = useState(null);
  const wide = useSideBySide();
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const busy = supervisor.isPending || admin.isPending || paid.isPending;

  if (isLoading || isError) {
    return frame({
      title: "Claim",
      children: <p style={{ margin: 0, padding: "30px 0", textAlign: "center", fontSize: 14, color: isError ? "#B91C1C" : T.inkMuted }}>{isError ? error?.message || "This claim couldn't be loaded" : "Loading the claim…"}</p>,
    });
  }

  const money = (value) => formatMoney(value, claim.currency);
  const stage = claim.status === "pending_supervisor" ? "supervisor" : claim.status === "pending_admin" ? "admin" : null;
  const myTurn = (stage === "supervisor" && canSupervise) || (stage === "admin" && canApprove);
  const decide = stage === "supervisor" ? supervisor : admin;
  const then = pairs(claim.evidence);
  const now = pairs(claim.course?.evidence);
  const href = invoiceHref(claim);
  const toggle = (kind) => setViewing((v) => (v === kind ? null : kind));
  const invoiceButton = (kind) => ({
    display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 16px", borderRadius: 14, textAlign: "left", cursor: "pointer", fontFamily: "Inter, sans-serif",
    background: viewing === kind ? T.tintBg : "#fff",
    border: `${viewing === kind ? 2 : 1}px solid ${viewing === kind ? T.accent : T.tintBorder}`,
  });

  const run = async (action, success) => {
    try {
      await action();
      toast.success(success);
      onClose();
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "That didn't go through");
    }
  };
  const approve = () => run(() => decide.mutateAsync({ id: claim.id, decision: "approve" }), stage === "supervisor" ? "Approved — it's now with the admin to be paid" : "Approved for payment");
  const decline = () => run(() => decide.mutateAsync({ id: claim.id, decision: "reject", reason: reason.trim() }), "Claim declined — the educator has been told why");
  const markPaid = () => run(() => paid.mutateAsync({ id: claim.id, paymentReference: reference.trim() || null, paidAt }), "Marked as paid");

  const details = (
    <>
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
            <Row label="Worked out" value={RATE_TYPE_LABEL[claim.rateType || "session"]} />
            <Row label="Delivered" value={`${unitsLabel(claim.unitsDelivered ?? claim.sessionsDelivered, claim.rateType)} of ${unitsLabel(claim.unitsTotal ?? claim.sessionsTotal, claim.rateType)}`} />
            <Row label="Rate" value={rateLabel(claim.rate ?? claim.sessionRate, claim.rateType, claim.currency)} />
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
          {/* The two invoices: generated by the system from the claim's figures, and the
              educator's own eTIMS invoice. Either opens beside the claim, to check one against
              the other — the same panel the educator has on My Invoices. */}
          <button type="button" onClick={() => toggle("claim")} aria-pressed={viewing === "claim"} style={invoiceButton("claim")}>
            <span style={{ width: 40, height: 40, borderRadius: 11, background: viewing === "claim" ? "#fff" : T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><FiFileText size={19} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.ink }}>Claim invoice {claim.claimNumber}</span>
              <span style={{ display: "block", fontSize: 12, color: T.inkMuted }}>Generated from the claim&apos;s figures</span>
            </span>
            <FiEye size={16} color={T.accentMid} />
          </button>
          {href && (
            <button type="button" onClick={() => toggle("etims")} aria-pressed={viewing === "etims"} style={invoiceButton("etims")}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: viewing === "etims" ? "#fff" : T.tintBg, color: T.accent, display: "grid", placeItems: "center", flexShrink: 0 }}><FiFileText size={19} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>eTIMS invoice · {claim.invoiceFilename || "Invoice.pdf"}</span>
                <span style={{ display: "block", fontSize: 12, color: T.inkMuted }}>Uploaded by the educator</span>
              </span>
              <FiEye size={16} color={T.accentMid} />
            </button>
          )}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            {/* The workspace deciding a claim that was sent to a supervisor. */}
            {stage === "supervisor" && canApprove && claim.supervisorName && <p style={{ margin: 0, flex: "1 1 240px", fontSize: 12.5, color: T.inkMuted }}>This claim is with <strong style={{ color: T.ink }}>{claim.supervisorName}</strong>. You can decide it in their place.</p>}
            <button type="button" disabled={busy} onClick={() => setDeclining(true)} style={{ ...ghostButton, color: "#B91C1C", borderColor: "#FECACA" }}><FiX size={15} /> Decline</button>
            <button type="button" disabled={busy} onClick={approve} style={primaryButton(busy)}><FiCheck size={15} /> Approve for payment</button>
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

        {claim.status === "approved" && canApprove && <MpesaPayout claim={claim} />}

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
              pending_supervisor: `Waiting for ${claim.supervisorName || "the supervisor"} to review it.`,
              pending_admin: "This educator has no supervisor, so the claim is waiting for the admin's approval.",
              approved: "Approved; waiting for the admin to pay it.",
              paid: "This claim has been paid.",
              rejected: "This claim was declined. The educator can submit a new one.",
            }[claim.status]}
          </p>
        )}
      </div>
    </>
  );

  const panel = viewing && <InvoicePanel claim={claim} kind={viewing} onKind={setViewing} onClose={() => setViewing(null)} />;

  return frame({
    title: `${TYPE_LABEL[claim.type]} claim · ${money(claim.amount)}`,
    subtitle: `${claim.claimNumber} · submitted ${formatDate(claim.createdAt)}`,
    wide: Boolean(viewing && wide),
    busy,
    children: !viewing ? (
        details
      ) : wide ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)", gap: 16, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>{details}</div>
          {/* Stays in view while the claim's details scroll. */}
          <div style={{ position: "sticky", top: asPage ? 16 : 0, height: asPage ? "calc(100vh - 120px)" : "calc(90vh - 110px)", minHeight: 420 }}>{panel}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={() => setViewing(null)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: T.inkMuted, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            <FiArrowLeft size={14} /> Back to the claim
          </button>
          <div style={{ height: "75vh" }}>{panel}</div>
        </div>
      ),
  });
}

// The review in a pop-up — the admin's Billing → Educator Claims tab.
export default function ClaimReviewDialog({ claimId, canSupervise, canApprove, onClose }) {
  return (
    <ClaimReview
      claimId={claimId}
      canSupervise={canSupervise}
      canApprove={canApprove}
      onDone={onClose}
      frame={({ title, subtitle, wide, busy = false, children }) => (
        <Dialog title={title} subtitle={subtitle} onClose={onClose} busy={busy} width={wide ? 1480 : 980}>
          {children}
        </Dialog>
      )}
    />
  );
}
