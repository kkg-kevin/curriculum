import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiBookOpen, FiClock, FiCreditCard, FiExternalLink, FiMapPin, FiMessageSquare, FiStar, FiVideo, FiXCircle } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { Modal, QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { useBooking, useCancelBooking, useMarkBooking, useMarkRefunded, useSetBookingLink } from "../hooks/useMentorBookings";
import { StatePill, dayLabel, ksh, lengthLabel, useBookingsBase, whereLabel } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import RecordStamp from "../../activity/components/RecordStamp";

// One booking — the same page in every portal (/parent/bookings/:id, /teacher-portal/bookings/:id,
// /mentor-bookings/:id, /school-portal/mentor-bookings/:id). The server decides what each sees and
// may do (`can`): the family pays, joins, cancels (up to the cut-off) and reads the mentor's note;
// the mentor adds the join link, says how it went, cancels; staff do any of that and mark refunds;
// the hub sees only when and where its space is used.

const box = { ...card, padding: "18px 20px" };
const invoicePath = (base, id) => (base.startsWith("/parent") ? `/parent/invoices/${id}` : base.startsWith("/school-portal") ? `/school-portal/billing/${id}` : `/billing/${id}`);

function CancelDialog({ booking, base, onClose }) {
  const cancel = useCancelBooking();
  const [reason, setReason] = useState("");
  const family = base.startsWith("/parent");
  const paid = booking.invoice?.amountPaid || 0;
  return (
    <Modal
      title="Cancel this session?"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Keep it</button>
          <button type="button" className="ci-btn" disabled={cancel.isPending || (!family && !reason.trim())} onClick={() => cancel.mutate({ id: booking.id, reason }, { onSuccess: onClose })} style={btn("danger", { disabled: cancel.isPending || (!family && !reason.trim()) })}>{cancel.isPending ? "Cancelling…" : "Cancel session"}</button>
        </>
      )}
    >
      <CheckinStyles />
      <p style={{ margin: "0 0 12px", fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.6 }}>
        {booking.status === "held" ? "The time goes back and the invoice is cancelled." : paid > 0 ? `${ksh(paid)} was paid — it's refunded to the family.` : "The time goes back to the mentor."}
      </p>
      <label htmlFor="bk-reason" style={label}>{family ? "Why? (optional)" : "Why? The family sees this."}</label>
      <textarea id="bk-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} style={{ ...input, resize: "vertical" }} />
    </Modal>
  );
}

function MarkDialog({ booking, onClose }) {
  const mark = useMarkBooking();
  const [outcome, setOutcome] = useState("completed");
  const [note, setNote] = useState(booking.mentorNote || "");
  const needsNote = outcome === "completed" && !note.trim();
  return (
    <Modal
      title="How did it go?"
      onClose={onClose}
      width={600}
      footer={(
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Not now</button>
          <button type="button" className="ci-btn" disabled={mark.isPending || needsNote} onClick={() => mark.mutate({ id: booking.id, outcome, note }, { onSuccess: onClose })} style={btn("primary", { disabled: mark.isPending || needsNote })}>{mark.isPending ? "Saving…" : "Save and tell the family"}</button>
        </>
      )}
    >
      <CheckinStyles />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[["completed", "It was held"], ["no_show", `${booking.learner?.name?.split(" ")[0] || "The learner"} didn't join`]].map(([key, text]) => (
          <button key={key} type="button" onClick={() => setOutcome(key)} style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${outcome === key ? BRAND.navy : BRAND.border}`, background: outcome === key ? BRAND.navy : "#fff", color: outcome === key ? "#fff" : BRAND.inkSoft, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{text}</button>
        ))}
      </div>
      <label htmlFor="bk-note" style={label}>{outcome === "completed" ? "A note for the family — what you covered, and what to try next" : "A note for the family (optional)"}</label>
      <textarea id="bk-note" value={note} onChange={(e) => setNote(e.target.value)} rows={6} maxLength={5000} style={{ ...input, resize: "vertical" }} />
    </Modal>
  );
}

function LinkDialog({ booking, onClose }) {
  const save = useSetBookingLink();
  const [link, setLink] = useState(booking.meetingLink || "");
  return (
    <Modal title="Join link" onClose={onClose} footer={(
      <>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={save.isPending} onClick={() => save.mutate({ id: booking.id, meetingLink: link.trim() || null }, { onSuccess: onClose })} style={btn("primary", { disabled: save.isPending })}>Save</button>
      </>
    )}>
      <CheckinStyles />
      <label htmlFor="bk-link" style={label}>Google Meet, Zoom or Teams link</label>
      <input id="bk-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" style={input} />
      <p style={{ margin: "6px 0 0", fontSize: 12, color: BRAND.muted }}>The family gets a Join button on the booking.</p>
    </Modal>
  );
}

function RefundDialog({ booking, onClose }) {
  const done = useMarkRefunded();
  const [reference, setReference] = useState("");
  return (
    <Modal title={`Refund ${ksh(booking.refundAmount)}`} onClose={onClose} footer={(
      <>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={done.isPending} onClick={() => done.mutate({ id: booking.id, reference }, { onSuccess: onClose })} style={btn("primary", { disabled: done.isPending })}>Mark refunded</button>
      </>
    )}>
      <CheckinStyles />
      <p style={{ margin: "0 0 10px", fontSize: 13.5, color: BRAND.inkSoft }}>Give the family their money back first{booking.parent?.phone ? ` (${booking.parent.phone})` : ""}, then record it here.</p>
      <label htmlFor="bk-ref" style={label}>M-Pesa code or bank reference</label>
      <input id="bk-ref" value={reference} onChange={(e) => setReference(e.target.value)} style={input} />
    </Modal>
  );
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useBookingsBase();
  const { data: b, isLoading, isError } = useBooking(id);
  const [dialog, setDialog] = useState(null);
  const family = base.startsWith("/parent");
  const mentorView = base.startsWith("/teacher-portal");
  const hubView = base.startsWith("/school-portal");

  if (isLoading) return <div style={{ padding: "60px 20px", textAlign: "center", color: BRAND.faint, fontFamily: FONT }}>Loading…</div>;
  if (isError || !b) return <div style={{ padding: "50px 20px", textAlign: "center", fontFamily: FONT }}>This booking isn&apos;t available. <Link to={base}>Back</Link></div>;

  const person = mentorView || hubView ? { name: b.learner?.name || "Learner", photo: null, sub: "Learner" } : { name: b.mentor?.name || "Mentor", photo: b.mentor?.photo, sub: "Mentor" };
  const [first, ...rest] = person.name.split(" ");
  const live = ["confirmed", "today", "to_mark"].includes(b.state);
  const join = b.mode === "online" && b.meetingLink && ["confirmed", "today", "to_mark"].includes(b.state);
  const actionBtn = { padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "22px 26px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => navigate(base)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 13, cursor: "pointer", fontFamily: FONT, padding: 0, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 14 }}><FiArrowLeft size={13} /> Mentor sessions</button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 340px" }}>
              <Avatar firstName={first} lastName={rest.join(" ")} photo={person.photo} size={62} borderColor="rgba(255,255,255,0.3)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff" }}>{person.name}</h1>
                  <StatePill state={b.state} />
                  {b.refundStatus === "due" && <span style={pill("danger")}>Refund due</span>}
                  {b.refundStatus === "refunded" && <span style={pill("neutral")}>Refunded</span>}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>{family && b.learner ? `With ${b.learner.name}` : !family && !mentorView && b.mentor ? `With ${b.mentor.name}` : person.sub}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 7, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiClock size={13} /> {dayLabel(b.date, { weekday: "long", day: "numeric", month: "long" })}, {b.startTime}–{b.endTime} ({lengthLabel(b.minutes)})</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{b.mode === "online" ? <FiVideo size={13} /> : <FiMapPin size={13} />} {whereLabel(b)}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {join && <a href={b.meetingLink} target="_blank" rel="noreferrer" style={{ ...actionBtn, background: BRAND.gold, color: BRAND.navy, border: "none", textDecoration: "none" }}><FiVideo size={14} /> Join</a>}
              {b.can?.pay && <Link to={invoicePath(base, b.invoice.id)} style={{ ...actionBtn, background: BRAND.gold, color: BRAND.navy, border: "none", textDecoration: "none" }}><FiCreditCard size={14} /> Pay {ksh(b.invoice.total - b.invoice.amountPaid)}</Link>}
              {b.can?.mark && <button type="button" onClick={() => setDialog("mark")} style={{ ...actionBtn, background: BRAND.gold, color: BRAND.navy, border: "none" }}><FiMessageSquare size={14} /> How did it go?</button>}
              {b.can?.editLink && <button type="button" onClick={() => setDialog("link")} style={{ ...actionBtn, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)" }}>{b.meetingLink ? "Change join link" : "Add join link"}</button>}
              {b.can?.refund && <button type="button" onClick={() => setDialog("refund")} style={{ ...actionBtn, background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)" }}>Mark refunded</button>}
              {b.can?.cancel && <button type="button" onClick={() => setDialog("cancel")} style={{ ...actionBtn, background: "transparent", color: "#FECACA", border: "1.5px solid rgba(254,202,202,0.45)" }}><FiXCircle size={14} /> Cancel</button>}
            </div>
          </div>
        </div>
      </div>
      {/* Who created it, who changed it last (admin side only — modules/activity). */}
      <RecordStamp type="mentor_bookings" id={id} />

      {b.state === "held" && family && (
        <div style={{ ...box, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 13.5 }}>
          This time is held for you until {b.holdExpiresAt ? new Date(b.holdExpiresAt).toLocaleString("en-KE", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "soon"}. Pay to confirm it — after that it&apos;s released.
        </div>
      )}
      {b.mode === "online" && live && !b.meetingLink && (family || mentorView) && (
        <div style={{ ...box, fontSize: 13.5, color: BRAND.inkSoft }}>{mentorView ? "Add the join link so the family can join from here." : "The mentor will add the join link before the session."}</div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", alignItems: "start" }}>
        {!hubView && (
          <section style={box}>
            <h2 style={{ ...cardHeading, marginBottom: 10 }}><FiBookOpen size={12} /> What it&apos;s about</h2>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{b.sessionTitle || b.courseName || "Help with their course"}</p>
            {b.sessionTitle && b.courseName && <p style={{ margin: "2px 0 0", fontSize: 13, color: BRAND.muted }}>{b.courseName}</p>}
            {b.topic && <p style={{ margin: "10px 0 0", fontSize: 13.5, color: BRAND.inkSoft, lineHeight: 1.6, whiteSpace: "pre-line" }}>&ldquo;{b.topic}&rdquo;</p>}
          </section>
        )}

        <section style={box}>
          <h2 style={{ ...cardHeading, marginBottom: 10 }}><FiCreditCard size={12} /> {mentorView ? "Your pay" : "Payment"}</h2>
          {mentorView ? (
            <>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: BRAND.ink }}>{ksh(b.educatorPay)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: BRAND.muted }}>
                {b.claimId ? "Claimed." : ["completed", "no_show"].includes(b.status) ? "Claim it from Payments → Mentor sessions." : "Earned once the session is held."}
              </p>
            </>
          ) : (
            <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", fontSize: 13.5 }}>
              {!hubView && <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>Mentor session · {lengthLabel(b.minutes)}</span><span>{b.includedInPlan ? "Included in plan" : ksh(b.mentorFee)}</span></div>}
              {b.mode === "hub" && <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{b.spaceName || "Space"}</span><span>{b.deskFee ? ksh(b.deskFee) : "No charge"}</span></div>}
              {!hubView && <div style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingTop: 7, borderTop: `1px solid ${BRAND.line}`, fontWeight: 900 }}><span>Total</span><span>{ksh(b.total)}</span></div>}
              {b.hubShare > 0 && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: BRAND.muted }}>{ksh(b.hubShare)} of the space fee is owed to {b.hubName} ({b.deskCollectionPercent}% kept for collecting){b.settlementId ? " — settled." : "."}</p>}
              {b.educatorPay != null && !family && !hubView && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>Mentor earns {ksh(b.educatorPay)}{b.claimId ? " (claimed)" : ""}.</p>}
              {b.invoice && !hubView && (
                <Link to={invoicePath(base, b.invoice.id)} style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: BRAND.mid, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {b.invoice.invoiceNumber} · {b.invoice.status.replace(/_/g, " ")} <FiExternalLink size={12} />
                </Link>
              )}
              {b.refundStatus && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: b.refundStatus === "due" ? BRAND.danger : BRAND.muted }}>{b.refundStatus === "due" ? `${ksh(b.refundAmount)} to refund.` : `${ksh(b.refundAmount)} refunded${b.refundReference ? ` (${b.refundReference})` : ""}.`}</p>}
            </div>
          )}
        </section>

        {(b.mentorNote || ["completed", "no_show"].includes(b.status)) && !hubView && (
          <section style={{ ...box, gridColumn: "1 / -1" }}>
            <h2 style={{ ...cardHeading, marginBottom: 10 }}><FiMessageSquare size={12} /> From the mentor</h2>
            {b.mentorNote ? <p style={{ margin: 0, fontSize: 14, color: BRAND.ink, lineHeight: 1.65, whiteSpace: "pre-line" }}>{b.mentorNote}</p> : <p style={{ margin: 0, fontSize: 13.5, color: BRAND.muted }}>{b.status === "no_show" ? `${b.learner?.name?.split(" ")[0] || "The learner"} didn't join.` : "No note."}</p>}
            {family && b.status === "completed" && b.courseId && <Link to="/parent/feedback" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.mid }}><FiStar size={13} /> Rate {b.mentor?.name?.split(" ")[0] || "the mentor"}</Link>}
          </section>
        )}

        {b.status === "cancelled" && (
          <section style={{ ...box, gridColumn: "1 / -1" }}>
            <h2 style={{ ...cardHeading, marginBottom: 8 }}><FiXCircle size={12} /> Cancelled</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: BRAND.inkSoft }}>
              {{ parent: "By the family", mentor: "By the mentor", staff: "By our team", system: "Not paid in time" }[b.cancelledBy] || "Cancelled"}
              {b.cancelReason && b.cancelledBy !== "system" ? ` — "${b.cancelReason}"` : ""}
            </p>
          </section>
        )}

        {b.parent && (
          <section style={box}>
            <h2 style={{ ...cardHeading, marginBottom: 10 }}>Family</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: BRAND.ink }}>{b.parent.name || "Parent"}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: BRAND.muted }}>{[b.parent.phone, b.parent.email].filter(Boolean).join(" · ")}</p>
          </section>
        )}
      </div>

      {dialog === "cancel" && <CancelDialog booking={b} base={base} onClose={() => setDialog(null)} />}
      {dialog === "mark" && <MarkDialog booking={b} onClose={() => setDialog(null)} />}
      {dialog === "link" && <LinkDialog booking={b} onClose={() => setDialog(null)} />}
      {dialog === "refund" && <RefundDialog booking={b} onClose={() => setDialog(null)} />}
    </div>
  );
}
