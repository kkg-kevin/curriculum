import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiFileText, FiLock, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { uploadApi } from "../../../services/uploadApi";
import { useSubmitClaim } from "../hooks/useClaims";
import { Dialog, T, formatMoney, formatRate, ghostButton, inputStyle, primaryButton } from "../shared";

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

function Figure({ label, value, tone }) {
  const tones = {
    plain: { bg: "#fff", border: T.border, label: T.inkMuted },
    amber: { bg: "#FFFBEB", border: "#FDE68A", label: "#B45309" },
    blue: { bg: T.tintBg, border: T.tintBorder, label: T.accentMid },
  };
  const t = tones[tone] || tones.plain;
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: t.label }}>{label}</p>
      <p style={{ margin: "5px 0 0", fontSize: 17, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

// One of the two things an educator can ask for. Unavailable ones stay visible, with the reason,
// so it's clear what would unlock them.
function Option({ title, amount, description, blocked, selected, onSelect }) {
  return (
    <button
      type="button"
      disabled={!!blocked}
      onClick={onSelect}
      aria-pressed={selected}
      style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", textAlign: "left", width: "100%", padding: "14px 16px", borderRadius: 12, cursor: blocked ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", background: blocked ? "#F9FAFB" : selected ? T.tintBg : "#fff", border: `2px solid ${selected ? T.accent : T.border}`, opacity: blocked ? 0.75 : 1 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{title}</span>
        {selected ? <FiCheckCircle size={18} color={T.accent} /> : blocked ? <FiLock size={15} color={T.inkFaint} /> : null}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: blocked ? T.inkFaint : T.accent, fontVariantNumeric: "tabular-nums" }}>{amount}</p>
      <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: blocked ? "#B45309" : T.inkMuted }}>{blocked || description}</p>
    </button>
  );
}

// The educator's payment request for one course: pick an advance or the full payment, attach
// the invoice as a PDF, send it for review — to their supervisor, or to the admin if they have none.
export default function RequestPaymentModal({ course, onClose }) {
  const submit = useSubmitClaim();
  const fileInput = useRef(null);
  const [type, setType] = useState(course.canRequestFull ? "full" : course.canRequestAdvance ? "advance" : null);
  const [invoice, setInvoice] = useState(null); // { url, filename, size }
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState("");

  const money = (value) => formatMoney(value, course.currency);
  const amount = type === "advance" ? course.advanceAmount : type === "full" ? course.balance : 0;
  const busy = uploading || submit.isPending;

  const attach = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("The invoice must be a PDF file");
    if (file.size > MAX_INVOICE_BYTES) return toast.error("The invoice must be 10 MB or smaller");
    setUploading(true);
    try {
      const uploaded = await uploadApi.uploadDocument(file);
      // The server stores the path only ("/uploads/<file>.pdf"); the upload helper hands back a
      // full URL for display.
      setInvoice({ url: new URL(uploaded.url).pathname, filename: uploaded.filename || file.name, size: file.size });
    } catch (err) {
      toast.error(err.message || "Could not upload the invoice");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    try {
      await submit.mutateAsync({ classId: course.classId, courseId: course.courseId, type, invoiceUrl: invoice.url, invoiceFilename: invoice.filename, note: note.trim() || null });
      toast.success(course.supervisor ? `Payment request sent to ${course.supervisor.name}` : "Payment request sent to the admin");
      onClose();
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not send the request");
    }
  };

  return (
    <Dialog title="Request payment" subtitle={`${course.courseName}${course.className ? ` · ${course.className}` : ""}`} onClose={onClose} busy={busy} width={640}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Figure label="Course value" value={money(course.courseAmount)} />
        <Figure label="Advance requested" value={money(course.advanceRequested)} tone="amber" />
        <Figure label="Balance" value={money(course.balance)} tone="blue" />
      </div>
      <p style={{ margin: "8px 2px 0", fontSize: 12, color: T.inkMuted }}>
        {course.sessionsTotal} sessions × {formatRate(course.sessionRate, course.currency)} a session · {course.sessionsDelivered} delivered so far
      </p>

      <p style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>What are you requesting?</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <Option
          title={`Advance (${course.advancePercent}%)`}
          amount={money(course.advanceAmount)}
          description={`${course.advancePercent}% of the course value, paid before the course is finished. It comes off your full payment later.`}
          blocked={course.advanceBlocked}
          selected={type === "advance"}
          onSelect={() => setType("advance")}
        />
        <Option
          title="Full payment"
          amount={money(course.balance)}
          description={course.advanceRequested > 0 ? `The course value less your ${money(course.advanceRequested)} advance.` : "The whole course value, once every session is delivered."}
          blocked={course.fullBlocked}
          selected={type === "full"}
          onSelect={() => setType("full")}
        />
      </div>

      <p style={{ margin: "20px 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>Your invoice</p>
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
      {invoice ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
          <FiFileText size={22} color="#047857" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{invoice.filename}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#047857" }}>Attached · {(invoice.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button type="button" onClick={() => setInvoice(null)} disabled={busy} aria-label="Remove invoice" style={{ ...ghostButton, padding: "8px 10px" }}><FiTrash2 size={15} /></button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files?.[0]); }}
          style={{ width: "100%", padding: "26px 16px", borderRadius: 12, cursor: uploading ? "progress" : "pointer", fontFamily: "Inter, sans-serif", textAlign: "center", background: dragging ? T.tintBg : "#fff", border: `2px dashed ${dragging ? T.accent : T.tintBorder}` }}
        >
          <FiUploadCloud size={26} color={T.accentLight} />
          <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: T.ink }}>{uploading ? "Uploading…" : "Upload your PDF invoice"}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: T.inkMuted }}>Click to choose a file, or drag it here. PDF only, up to 10 MB.</p>
        </button>
      )}

      <label style={{ display: "block", margin: "16px 0 6px", fontSize: 12.5, fontWeight: 700, color: T.ink }} htmlFor="claim-note">Note for {course.supervisor ? "your supervisor" : "the admin"} <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
      <textarea id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Anything they should know about this claim" style={{ ...inputStyle, resize: "vertical" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>
          {type ? <>You're requesting <strong style={{ color: T.ink }}>{money(amount)}</strong></> : "Nothing can be requested for this course right now."}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} disabled={busy} style={ghostButton}>Cancel</button>
          <button type="button" onClick={send} disabled={!type || !invoice || busy} style={primaryButton(!type || !invoice || busy)}>
            {submit.isPending ? "Sending…" : "Submit payment request"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
