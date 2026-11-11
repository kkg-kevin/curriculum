import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCalendar, FiCreditCard, FiFileText, FiUploadCloud } from "react-icons/fi";
import { uploadApi } from "../../../services/uploadApi";
import { Modal, QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { useBookingEarnings, useBookings, useClaimEarnings } from "../hooks/useMentorBookings";
import { BookingRow, EmptyNote, RowStyles, SectionHead, dayLabel, ksh, splitBookings } from "../shared";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading } from "../../../theme/brand";

// The teacher portal's Mentor sessions (/teacher-portal/bookings): sessions families booked with
// this mentor — to mark (say how it went), coming up, past — and what they've earned, claimed
// with an eTIMS invoice like any claim (claims/: type "bookings"). Families can only book inside
// the availability set on the Timetable page.

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

function ClaimDialog({ group, onClose }) {
  const claim = useClaimEarnings();
  const [invoice, setInvoice] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const attach = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("The eTIMS invoice must be a PDF file");
    if (file.size > MAX_INVOICE_BYTES) return toast.error("The eTIMS invoice must be 10 MB or smaller");
    setUploading(true);
    try {
      const uploaded = await uploadApi.uploadDocument(file);
      setInvoice({ url: new URL(uploaded.url).pathname, filename: uploaded.filename || file.name });
    } catch (err) {
      toast.error(err.message || "Could not upload the eTIMS invoice");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Modal title={`Claim ${ksh(group.amount)}`} onClose={onClose} width={600} footer={(
      <>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" disabled={!invoice || claim.isPending} onClick={() => claim.mutate({ ownerAdminId: group.ownerAdminId, invoiceUrl: invoice.url, invoiceFilename: invoice.filename, note: note.trim() || null }, { onSuccess: onClose })} style={btn("primary", { disabled: !invoice || claim.isPending })}>{claim.isPending ? "Sending…" : "Send claim"}</button>
      </>
    )}>
      <CheckinStyles />
      <p style={{ margin: "0 0 10px", fontSize: 13.5, color: BRAND.inkSoft }}>{group.count} mentor session{group.count === 1 ? "" : "s"} held:</p>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
        {group.bookings.map((b) => (
          <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "7px 10px", borderRadius: 9, background: BRAND.canvas }}>
            <span style={{ minWidth: 0 }}>{dayLabel(b.date)} {b.startTime} · {b.learnerName || "Learner"}{b.status === "no_show" ? " (didn't join)" : ""}</span>
            <strong>{ksh(b.educatorPay)}</strong>
          </div>
        ))}
      </div>
      <span style={label}>Your eTIMS invoice for {ksh(group.amount)} (PDF)</span>
      <label style={{ ...btn("secondary"), gap: 7, cursor: uploading ? "wait" : "pointer" }}>
        {invoice ? <FiFileText /> : <FiUploadCloud />} {uploading ? "Uploading…" : invoice ? invoice.filename : "Choose the PDF"}
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => attach(e.target.files?.[0])} style={{ display: "none" }} />
      </label>
      <label htmlFor="bc-note" style={{ ...label, marginTop: 14 }}>Note (optional)</label>
      <textarea id="bc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} style={{ ...input, resize: "vertical" }} />
    </Modal>
  );
}

export default function MentorBookingsPage() {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: earnings } = useBookingEarnings();
  const [claiming, setClaiming] = useState(null);
  const toMark = bookings.filter((b) => b.state === "to_mark");
  const { coming, past } = splitBookings(bookings.filter((b) => b.state !== "to_mark" && !(b.status === "held" && b.state === "cancelled")));
  const upcoming = coming.filter((b) => b.state !== "held");
  const groups = earnings?.groups || [];

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14 }}>
      <RowStyles />
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900 }}>Mentor sessions</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 640, lineHeight: 1.6 }}>
          Families book you to take their child through a session they&apos;re stuck on — always inside your availability. <Link to="/teacher-portal/timetable" style={{ color: "#fff", fontWeight: 700 }}>Set your availability</Link>, weekends included.
        </p>
      </div>

      {groups.length > 0 && (
        <section style={{ ...card, padding: "16px 18px", border: `1px solid ${BRAND.skyBorder}` }}>
          <h2 style={{ ...cardHeading, marginBottom: 10 }}><FiCreditCard size={12} /> To claim</h2>
          {groups.map((g) => (
            <div key={g.ownerAdminId} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <p style={{ margin: 0, flex: "1 1 220px", fontSize: 14, color: BRAND.ink }}><strong style={{ fontSize: 18 }}>{ksh(g.amount)}</strong> for {g.count} session{g.count === 1 ? "" : "s"} held</p>
              <button type="button" className="ci-btn" onClick={() => setClaiming(g)} style={btn("primary")}>Claim it</button>
            </div>
          ))}
        </section>
      )}
      {earnings?.fullTime && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>You&apos;re full time, so mentor sessions are part of your salary — nothing to claim.</p>}

      {toMark.length > 0 && (
        <>
          <SectionHead title="Say how it went" note="The family gets your note — what you covered and what to try next." />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{toMark.map((b) => <BookingRow key={b.id} booking={b} base="/teacher-portal/bookings" show="learner" />)}</div>
        </>
      )}

      <SectionHead title="Coming up" />
      {isLoading ? <p style={{ margin: 0, color: BRAND.faint, fontSize: 13 }}>Loading…</p>
        : upcoming.length ? <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{upcoming.map((b) => <BookingRow key={b.id} booking={b} base="/teacher-portal/bookings" show="learner" />)}</div>
          : <EmptyNote title="No sessions booked" line="When a family books you, it shows here and you're told." action={<Link to="/teacher-portal/timetable" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.mid }}><FiCalendar /> Your availability</Link>} />}

      {past.length > 0 && (
        <>
          <SectionHead title="Past" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>{past.map((b) => <BookingRow key={b.id} booking={b} base="/teacher-portal/bookings" show="learner" />)}</div>
        </>
      )}
      {claiming && <ClaimDialog group={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
