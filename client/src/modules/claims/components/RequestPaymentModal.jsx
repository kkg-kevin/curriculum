import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiChevronDown, FiChevronUp, FiFileText, FiInfo, FiPlus, FiRefreshCw, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { uploadApi } from "../../../services/uploadApi";
import { useSubmitClaim } from "../hooks/useClaims";
import { Dialog, RATE_TYPE_LABEL, T, TYPE_LABEL, claimBasis, formatMoney, ghostButton, inputStyle, primaryButton } from "../shared";
import { draftClaim } from "../invoicePdf";
import { ClaimInvoicePreview } from "./ClaimInvoiceViewer";

const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

const linkButton = { display: "inline-flex", alignItems: "center", gap: 5, padding: 0, border: "none", background: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" };
const smallButton = { ...ghostButton, padding: "7px 12px", fontSize: 12.5, fontWeight: 700 };

const firstOpen = (figures) => (figures.canRequestFull ? "full" : figures.canRequestAdvance ? "advance" : null);
const canRequest = (figures, type) => (type === "advance" ? figures.canRequestAdvance : type === "full" ? figures.canRequestFull : false);
const amountFor = (figures, type) => (type === "advance" ? figures.advanceAmount : type === "full" ? figures.balance : 0);

// A tick when it's done, an empty ring while it's still needed.
function Mark({ done }) {
  return done ? (
    <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: "#16A34A", color: "#fff", flexShrink: 0 }}><FiCheck size={13} strokeWidth={3} /></span>
  ) : (
    <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${T.border}`, boxSizing: "border-box", flexShrink: 0 }} />
  );
}

function ChecklistRow({ done, title, sub, actions, highlight = false, ...rest }) {
  return (
    <div {...rest} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: highlight ? T.tintBg : "#fff", border: `1.5px ${highlight ? "dashed" : "solid"} ${highlight ? T.accent : T.border}` }}>
      <Mark done={done} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted, lineHeight: 1.4 }}>{sub}</p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

// The educator's payment request for one course, on one screen:
//   - how it's worked out (only a choice when they're paid more than one way and the course has
//     no claim yet), each way showing what it comes to;
//   - the amount, and an advance or the full payment — a choice only when both are open;
//   - the two invoices that go with it, as a checklist: the claim invoice made for them (shown
//     right here, not in another window) and their eTIMS invoice (required);
//   - an optional note. Then off for review: to their supervisor, or to the admin if they have none.
export default function RequestPaymentModal({ course, onClose }) {
  const submit = useSubmitClaim();
  const fileInput = useRef(null);
  const options = course.rateOptions?.length ? course.rateOptions : [course];
  const [rateType, setRateType] = useState(course.rateType || options[0].rateType || "session");
  const figures = options.find((o) => o.rateType === rateType) || options[0];
  const [type, setType] = useState(firstOpen(figures));
  const [invoice, setInvoice] = useState(null); // { url, filename, size }
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);

  const money = (value) => formatMoney(value, course.currency);
  const amount = amountFor(figures, type);
  const busy = uploading || submit.isPending;
  const reviewer = course.supervisor ? "your supervisor" : "the admin";
  const draft = useMemo(() => (type ? draftClaim(course, figures, type) : null), [course, figures, type]);

  const bothOpen = figures.canRequestAdvance && figures.canRequestFull;
  // When only one of the two is open, say why the other isn't — quietly, as a note.
  const closedReason = bothOpen ? null : type === "full" ? figures.advanceBlocked : type === "advance" ? figures.fullBlocked : null;

  const chooseRate = (next) => {
    const nextFigures = options.find((o) => o.rateType === next) || options[0];
    setRateType(next);
    setType(canRequest(nextFigures, type) ? type : firstOpen(nextFigures));
  };

  const attach = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("The eTIMS invoice must be a PDF file");
    if (file.size > MAX_INVOICE_BYTES) return toast.error("The eTIMS invoice must be 10 MB or smaller");
    setUploading(true);
    try {
      const uploaded = await uploadApi.uploadDocument(file);
      // The server stores the path only ("/uploads/<file>.pdf"); the upload helper hands back a
      // full URL for display.
      setInvoice({ url: new URL(uploaded.url).pathname, filename: uploaded.filename || file.name, size: file.size });
    } catch (err) {
      toast.error(err.message || "Could not upload the eTIMS invoice");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    try {
      await submit.mutateAsync({ classId: course.classId, courseId: course.courseId, type, rateType: figures.rateType || "session", invoiceUrl: invoice.url, invoiceFilename: invoice.filename, note: note.trim() || null });
      toast.success(course.supervisor ? `Payment request sent to ${course.supervisor.name}` : "Payment request sent to the admin");
      onClose();
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not send the request");
    }
  };

  const missing = !type ? "Nothing can be requested for this course right now." : !invoice ? "Attach your eTIMS invoice to send." : null;
  const route = course.supervisor ? `Goes to ${course.supervisor.name}, then to the admin.` : "Goes to the admin for payment.";
  const dropHandlers = invoice || !type
    ? {}
    : {
        onDragOver: (e) => { e.preventDefault(); setDragging(true); },
        onDragLeave: () => setDragging(false),
        onDrop: (e) => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files?.[0]); },
      };

  return (
    <Dialog title="Request payment" subtitle={`${course.courseName}${course.className ? ` · ${course.className}` : ""}`} onClose={onClose} busy={busy} width={620}>
      {/* How it's worked out — a choice only when there is one, each showing what it comes to. */}
      {options.length > 1 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.inkMuted }}>Paid by</span>
          <div role="radiogroup" aria-label="Paid by" style={{ flex: "1 1 300px", display: "flex", padding: 4, borderRadius: 12, background: "#EEF2F7" }}>
            {options.map((o) => {
              const selected = o.rateType === figures.rateType;
              const t = canRequest(o, type) ? type : firstOpen(o);
              return (
                <button
                  key={o.rateType}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseRate(o.rateType)}
                  disabled={busy}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", background: selected ? "#fff" : "transparent", boxShadow: selected ? "0 1px 3px rgba(15,23,42,0.12)" : "none" }}
                >
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: selected ? T.ink : T.inkMuted }}>{RATE_TYPE_LABEL[o.rateType]}</span>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: selected ? T.accent : T.inkFaint, fontVariantNumeric: "tabular-nums" }}>{t ? money(amountFor(o, t)) : "—"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: T.inkMuted }}>Paid <strong style={{ color: T.ink }}>{(RATE_TYPE_LABEL[figures.rateType] || RATE_TYPE_LABEL.session).toLowerCase()}</strong></p>
      )}

      {/* The amount — the one thing that matters most here. */}
      <div style={{ padding: "18px 20px", borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
        {type ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.inkMuted, textTransform: "uppercase", letterSpacing: "0.4px" }}>You&apos;re requesting</p>
                <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>{money(amount)}</p>
              </div>
              {!bothOpen && <span style={{ fontSize: 13.5, fontWeight: 700, color: T.accent }}>{type === "advance" ? `Advance (${figures.advancePercent}%)` : TYPE_LABEL[type]}</span>}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>
              {type === "advance" ? `${figures.advancePercent}% of ${claimBasis({ ...draft, type: "advance" })}` : claimBasis(draft)}
              {draft.advanceDeducted > 0 ? `, less the ${money(draft.advanceDeducted)} advance` : ""}
            </p>

            {bothOpen && (
              <div role="radiogroup" aria-label="Advance or full payment" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {[
                  ["advance", `Advance (${figures.advancePercent}%)`, figures.advanceAmount],
                  ["full", TYPE_LABEL.full, figures.balance],
                ].map(([key, label, value]) => {
                  const selected = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(key)}
                      disabled={busy}
                      style={{ flex: "1 1 160px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 700, background: selected ? T.tintBg : "#fff", color: T.ink, border: `2px solid ${selected ? T.accent : T.border}` }}
                    >
                      {label}
                      <span style={{ color: selected ? T.accent : T.inkMuted, fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: T.inkMuted, lineHeight: 1.5 }}>{figures.fullBlocked || figures.advanceBlocked || "Nothing can be requested for this course right now."}</p>
        )}
      </div>
      {closedReason && (
        <p style={{ display: "flex", alignItems: "flex-start", gap: 6, margin: "8px 2px 0", fontSize: 12.5, color: T.inkMuted, lineHeight: 1.45 }}>
          <FiInfo size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          {type === "full" ? "Advance isn't available." : "Full payment isn't available yet."} {closedReason.replace(/\s*—.*$/, "").replace(/\.?$/, ".")}
        </p>
      )}

      {type && (
        <>
          <p style={{ margin: "20px 0 8px", fontSize: 13, fontWeight: 800, color: T.ink }}>Invoices sent with this claim</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ChecklistRow
              done
              title="Claim invoice"
              sub="Made for you from these figures"
              actions={
                <button type="button" onClick={() => setPreviewOpen((v) => !v)} aria-expanded={previewOpen} style={smallButton}>
                  {previewOpen ? <><FiChevronUp size={14} /> Hide</> : <><FiChevronDown size={14} /> View</>}
                </button>
              }
            />
            {previewOpen && draft && <ClaimInvoicePreview claim={draft} height={440} />}

            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
            <ChecklistRow
              done={!!invoice}
              highlight={dragging}
              title={invoice ? invoice.filename : "eTIMS invoice"}
              sub={uploading ? "Uploading…" : invoice ? `eTIMS invoice · ${(invoice.size / 1024 / 1024).toFixed(2)} MB` : "Required · PDF, up to 10 MB · or drop it here"}
              actions={
                invoice ? (
                  <>
                    <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} style={smallButton}><FiRefreshCw size={13} /> Replace</button>
                    <button type="button" onClick={() => setInvoice(null)} disabled={busy} aria-label="Remove eTIMS invoice" style={{ ...smallButton, padding: "7px 9px" }}><FiTrash2 size={14} /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} style={{ ...primaryButton(uploading), padding: "8px 14px", fontSize: 12.5 }}>
                    <FiUploadCloud size={14} /> {uploading ? "Uploading…" : "Attach"}
                  </button>
                )
              }
              {...dropHandlers}
            />
          </div>

          {noteOpen ? (
            <textarea id="claim-note" autoFocus aria-label={`Note for ${reviewer}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={`Note for ${reviewer} (optional)`} style={{ ...inputStyle, resize: "vertical", marginTop: 14 }} />
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} style={{ ...linkButton, fontWeight: 600, marginTop: 14 }}>
              <FiPlus size={13} /> Add a note for {reviewer}
            </button>
          )}
        </>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        <p style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, fontSize: 12.5, color: T.inkMuted }}>
          <FiFileText size={13} style={{ flexShrink: 0 }} /> {route}
        </p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: "auto" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} disabled={submit.isPending} style={ghostButton}>Cancel</button>
            <button type="button" onClick={send} disabled={!!missing || busy} style={primaryButton(!!missing || busy)}>
              {submit.isPending ? "Sending…" : type ? `Send ${money(amount)}` : "Send"}
            </button>
          </div>
          {missing && <span style={{ fontSize: 12, color: T.inkMuted }}>{missing}</span>}
        </div>
      </div>
    </Dialog>
  );
}
