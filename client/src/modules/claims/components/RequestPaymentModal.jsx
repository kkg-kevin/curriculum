import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiFileText, FiLock, FiPlus, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { uploadApi } from "../../../services/uploadApi";
import { useSubmitClaim } from "../hooks/useClaims";
import { Dialog, T, formatMoney, ghostButton, inputStyle, primaryButton } from "../shared";

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

// One of the two things an educator can ask for: a single row — name, amount, and (only when it
// can't be chosen) the reason, so it's clear what would unlock it.
function Option({ title, amount, blocked, selected, onSelect }) {
  return (
    <button
      type="button"
      disabled={!!blocked}
      onClick={onSelect}
      aria-pressed={selected}
      style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", padding: "12px 14px", borderRadius: 12, cursor: blocked ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", background: blocked ? "#F9FAFB" : selected ? T.tintBg : "#fff", border: `2px solid ${selected ? T.accent : T.border}` }}
    >
      {blocked ? <FiLock size={16} color={T.inkFaint} style={{ flexShrink: 0 }} /> : selected ? <FiCheckCircle size={18} color={T.accent} style={{ flexShrink: 0 }} /> : <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${T.border}`, flexShrink: 0, boxSizing: "border-box" }} />}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: blocked ? T.inkMuted : T.ink }}>{title}</span>
        {blocked && <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "#B45309" }}>{blocked}</span>}
      </span>
      <span style={{ fontSize: 15, fontWeight: 800, color: blocked ? T.inkFaint : T.accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{amount}</span>
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
  const [noteOpen, setNoteOpen] = useState(false);

  const money = (value) => formatMoney(value, course.currency);
  const amount = type === "advance" ? course.advanceAmount : type === "full" ? course.balance : 0;
  const busy = uploading || submit.isPending;
  const reviewer = course.supervisor ? "your supervisor" : "the admin";

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
    <Dialog title="Request payment" subtitle={`${course.courseName}${course.className ? ` · ${course.className}` : ""}`} onClose={onClose} busy={busy} width={480}>
      {/* The course page behind this dialog already shows the full breakdown — here, just enough
          to pick an option. */}
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.inkMuted }}>
        Course value <strong style={{ color: T.ink }}>{money(course.courseAmount)}</strong> · {course.sessionsDelivered} of {course.sessionsTotal} sessions delivered
        {course.advanceRequested > 0 && <> · {money(course.advanceRequested)} advance already requested</>}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Option title={`Advance (${course.advancePercent}%)`} amount={money(course.advanceAmount)} blocked={course.advanceBlocked} selected={type === "advance"} onSelect={() => setType("advance")} />
        <Option title="Full payment" amount={money(course.balance)} blocked={course.fullBlocked} selected={type === "full"} onSelect={() => setType("full")} />
      </div>
      {type === "advance" && <p style={{ margin: "8px 2px 0", fontSize: 12, color: T.inkMuted }}>The advance comes off your full payment later.</p>}

      <div style={{ height: 16 }} />
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
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, cursor: uploading ? "progress" : "pointer", fontFamily: "Inter, sans-serif", textAlign: "left", background: dragging ? T.tintBg : "#fff", border: `2px dashed ${dragging ? T.accent : T.tintBorder}` }}
        >
          <FiUploadCloud size={22} color={T.accentLight} style={{ flexShrink: 0 }} />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{uploading ? "Uploading…" : "Attach your invoice"}</span>
            <span style={{ display: "block", marginTop: 1, fontSize: 12, color: T.inkMuted }}>PDF, up to 10 MB</span>
          </span>
        </button>
      )}

      {noteOpen ? (
        <textarea id="claim-note" autoFocus aria-label={`Note for ${reviewer}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={`Note for ${reviewer} (optional)`} style={{ ...inputStyle, resize: "vertical", marginTop: 10 }} />
      ) : (
        <button type="button" onClick={() => setNoteOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, padding: 0, border: "none", background: "none", color: T.accent, fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          <FiPlus size={13} /> Add a note for {reviewer}
        </button>
      )}

      {!type && <p style={{ margin: "14px 0 0", fontSize: 12.5, color: "#B45309" }}>Nothing can be requested for this course right now.</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={busy} style={ghostButton}>Cancel</button>
        <button type="button" onClick={send} disabled={!type || !invoice || busy} style={primaryButton(!type || !invoice || busy)}>
          {submit.isPending ? "Sending…" : type ? `Request ${money(amount)}` : "Request payment"}
        </button>
      </div>
    </Dialog>
  );
}
