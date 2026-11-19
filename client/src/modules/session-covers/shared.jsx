import { useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { FiFileText, FiUploadCloud } from "react-icons/fi";
import { uploadApi } from "../../services/uploadApi";
import { Modal, QaStyles, btn, input, label } from "../qa/shared";
import { BRAND, pill } from "../../theme/brand";
import { useClaimCoverEarnings } from "./hooks/useCovers";

// Session covers (19 Nov 2026) — pieces the cover pages share.

export const ksh = (n) => `KSh ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
export const whenLabel = (c) => `${dayjs(c.date).format("ddd D MMM YYYY")}${c.startTime ? `, ${c.startTime}${c.endTime ? `–${c.endTime}` : ""}` : ""}`;

export const STATUS = {
  pending: { label: "Waiting for an answer", tone: "waiting" },
  accepted: { label: "Accepted", tone: "good" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  withdrawn: { label: "Pulled out", tone: "danger" },
};
export function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.cancelled;
  return <span style={pill(s.tone)}>{s.label}</span>;
}

// One cover in a list: what, when, who for whom, its status; `actions` on the right.
export function CoverRow({ cover, perspective = "class", actions = null }) {
  const people = perspective === "cover"
    ? `For ${cover.originalTeacherName || cover.hubName || "the class"}`
    : perspective === "class" ? `Cover: ${cover.coverTeacherName}` : `${cover.originalTeacherName || "—"} → ${cover.coverTeacherName}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 12, border: `1px solid ${BRAND.border}`, background: "#fff" }}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{cover.courseName}{cover.sessionTitle ? ` · ${cover.sessionTitle}` : ""}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.muted }}>{whenLabel(cover)} · {cover.className}{cover.hubName ? `, ${cover.hubName}` : ""}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: BRAND.inkSoft }}>{people}</p>
        {cover.note && perspective !== "class" && <p style={{ margin: "4px 0 0", fontSize: 12, color: BRAND.muted, fontStyle: "italic" }}>“{cover.note}”</p>}
        {(cover.declineReason || cover.cancelReason) && <p style={{ margin: "4px 0 0", fontSize: 12, color: BRAND.muted }}>{cover.declineReason || cover.cancelReason}</p>}
      </div>
      <StatusPill status={cover.status} />
      {actions}
    </div>
  );
}

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

// Claim covered sessions' pay — an eTIMS invoice, like every claim (claims/, type "covers").
export function ClaimCoversDialog({ group, onClose }) {
  const claim = useClaimCoverEarnings();
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
      <QaStyles />
      <p style={{ margin: "0 0 10px", fontSize: 13.5, color: BRAND.inkSoft }}>{group.count} covered session{group.count === 1 ? "" : "s"}:</p>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
        {group.covers.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "7px 10px", borderRadius: 9, background: BRAND.canvas }}>
            <span style={{ minWidth: 0 }}>{dayjs(c.date).format("ddd D MMM")} · {c.courseName}, {c.className}{c.originalTeacherName ? ` (for ${c.originalTeacherName})` : ""}</span>
            <strong>{ksh(c.amount)}</strong>
          </div>
        ))}
      </div>
      <span style={label}>Your eTIMS invoice for {ksh(group.amount)} (PDF)</span>
      <label style={{ ...btn("secondary"), gap: 7, cursor: uploading ? "wait" : "pointer" }}>
        {invoice ? <FiFileText /> : <FiUploadCloud />} {uploading ? "Uploading…" : invoice ? invoice.filename : "Choose the PDF"}
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => attach(e.target.files?.[0])} style={{ display: "none" }} />
      </label>
      <label htmlFor="cc-note" style={{ ...label, marginTop: 14 }}>Note (optional)</label>
      <textarea id="cc-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} style={{ ...input, resize: "vertical" }} />
    </Modal>
  );
}
