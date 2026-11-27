import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCamera, FiCopy, FiPaperclip, FiPlus, FiSend, FiTrash2 } from "react-icons/fi";
import { BRAND, FONT, card } from "../../../theme/brand";
import { expensesApi, errorOf, formatMoney, kenyaToday } from "../services/expensesApi";
import { Modal, ProofFile, btn, hint, input, label, primary } from "./ui";
import LinkPicker from "./LinkPicker";

// Making or changing an expense claim: what it was for, the hub it was for (optional), and its
// lines, each with optional proof and what it was spent on — linked to a record (a Home Learning
// family, a class, a bootcamp…, 27 Nov 2026), so reviewers and the record's own page see it. A
// new line starts linked like the one before it. Save keeps a draft; Send sends it for review.

let keySeq = 0;
const newKey = () => `l${Date.now()}-${keySeq++}`;

const noLink = { linkType: null, linkId: null, linkLabel: null };
const blankLine = (category) => ({ key: newKey(), id: null, spentOn: kenyaToday(), category, description: "", vendor: "", amount: "", mpesaCode: "", noReceiptReason: "", files: [], uploading: 0, ...noLink });

const lineOf = (item) => ({
  key: newKey(), id: item.id, spentOn: item.spentOn, category: item.category, description: item.description || "", vendor: item.vendor || "",
  amount: String(item.amount ?? ""), mpesaCode: item.mpesaCode || "", noReceiptReason: item.noReceiptReason || "", files: item.files || [], uploading: 0,
  note: item.status === "rejected" ? item.rejectionReason : null,
  linkType: item.linkType || null, linkId: item.linkId || null, linkLabel: item.linkLabel || null,
});

function LineCard({ line, index, count, settings, categories, linkTypes, onChange, onRemove, onLinkAll }) {
  const pickRef = useRef(null);
  const cameraRef = useRef(null);
  const set = (k, v) => onChange({ ...line, [k]: v });
  const noProof = line.files.length === 0 && !line.uploading;

  const addFiles = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    onChange((l) => ({ ...l, uploading: l.uploading + files.length }));
    for (const file of files) {
      try {
        const saved = await expensesApi.uploadProof(file);
        onChange((l) => ({ ...l, files: [...l.files, saved], uploading: l.uploading - 1 }));
      } catch (err) {
        toast.error(errorOf(err, `Couldn't upload ${file.name}`));
        onChange((l) => ({ ...l, uploading: l.uploading - 1 }));
      }
    }
  };

  return (
    <section style={{ ...card, padding: 14, display: "grid", gap: 12, gridTemplateColumns: "100%", borderColor: line.note ? BRAND.goldBorder : BRAND.border }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 13, color: BRAND.ink }}>Expense {index + 1}</strong>
        {count > 1 && <button type="button" style={{ ...btn, padding: "5px 9px" }} onClick={onRemove} aria-label={`Remove expense ${index + 1}`}><FiTrash2 size={13} /> Remove</button>}
      </div>
      {line.note && <p style={{ ...hint, color: BRAND.goldText, fontWeight: 700 }}>Reviewer: {line.note}</p>}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}>
        <label style={label}>Date
          <input type="date" style={input} value={line.spentOn} onChange={(e) => set("spentOn", e.target.value)} required />
        </label>
        <label style={label}>Category
          <select style={input} value={line.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label style={label}>Amount ({settings.currency === "KES" ? "KSh" : settings.currency})
          <input type="number" inputMode="decimal" min="0" step="0.01" style={input} value={line.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" required />
        </label>
        <label style={label}>Paid to
          <input style={input} value={line.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Shop, station, driver…" maxLength={200} />
        </label>
      </div>
      <label style={label}>What it was for
        <input style={input} value={line.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Fuel to Brookhouse and back" maxLength={500} required />
      </label>
      <LinkPicker types={linkTypes} required={settings.requireLink} idPrefix={`lk-${line.key}`}
        value={{ linkType: line.linkType, linkId: line.linkId, linkLabel: line.linkLabel }}
        onChange={(link) => onChange((l) => ({ ...l, ...link }))} />
      {count > 1 && line.linkType && (line.linkType === "general" || line.linkId) && (
        <div><button type="button" style={{ ...btn, padding: "5px 10px", fontSize: 12 }} onClick={onLinkAll}><FiCopy size={12} /> Link every expense on this claim the same way</button></div>
      )}
      <label style={{ ...label, maxWidth: 280 }}>M-Pesa transaction code <span style={{ fontWeight: 500, color: BRAND.muted }}>(if you paid by M-Pesa)</span>
        <input style={{ ...input, textTransform: "uppercase", letterSpacing: "0.04em" }} value={line.mpesaCode} onChange={(e) => set("mpesaCode", e.target.value)} placeholder="e.g. SGH7K2LM3P" maxLength={30} />
      </label>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>Proof — receipt, M-Pesa message screenshot or PDF <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span></span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          {line.files.map((f) => <ProofFile key={f.id} file={f} onRemove={() => onChange((l) => ({ ...l, files: l.files.filter((x) => x.id !== f.id) }))} />)}
          {line.uploading > 0 && <div style={{ width: 92, height: 92, borderRadius: 10, border: `1.5px dashed ${BRAND.border}`, display: "grid", placeItems: "center", fontSize: 11.5, color: BRAND.muted }}>Uploading…</div>}
          <div style={{ display: "grid", gap: 6 }}>
            <button type="button" style={btn} onClick={() => pickRef.current?.click()}><FiPaperclip size={14} /> Attach file</button>
            <button type="button" style={btn} onClick={() => cameraRef.current?.click()}><FiCamera size={14} /> Take photo</button>
          </div>
          <input ref={pickRef} type="file" accept="image/*,application/pdf,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        {noProof && (
          <label style={label}>No receipt? Say why <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span>
            <input style={input} value={line.noReceiptReason} onChange={(e) => set("noReceiptReason", e.target.value)} placeholder="e.g. Matatu fare — no receipt given" maxLength={500} />
          </label>
        )}
      </div>
    </section>
  );
}

export default function ClaimForm({ claim, options, onClose, onSaved }) {
  const { settings, hubs, reviewer, linkTypes = [] } = options;
  const categories = settings.categories.filter((c) => c.active || claim?.items?.some((i) => i.category === c.key));
  const firstCategory = categories[0]?.key || "other";
  const [title, setTitle] = useState(claim?.title || "");
  const [purpose, setPurpose] = useState(claim?.purpose || "");
  const [hubId, setHubId] = useState(claim?.hubId || "");
  const [lines, setLines] = useState(() => (claim?.items?.length ? claim.items.map(lineOf) : [blankLine(firstCategory)]));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  // Once the first save has worked, every later save changes that claim (sending can still fail
  // after a save and must not make a second claim).
  const [savedId, setSavedId] = useState(claim?.id || null);

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const uploading = lines.some((l) => l.uploading > 0);
  const updateLine = (key) => (next) => setLines((all) => all.map((l) => (l.key === key ? (typeof next === "function" ? next(l) : next) : l)));

  const body = () => ({
    title: title.trim(),
    purpose: purpose.trim() || null,
    hubId: hubId || null,
    items: lines.map((l) => ({
      id: l.id || null, clientKey: l.key, spentOn: l.spentOn, category: l.category, description: l.description.trim(), vendor: l.vendor.trim() || null,
      amount: l.amount, mpesaCode: l.mpesaCode.trim() || null, noReceiptReason: l.files.length ? null : l.noReceiptReason.trim() || null, fileIds: l.files.map((f) => f.id),
      linkType: l.linkType || null, linkId: l.linkType === "general" ? null : l.linkId || null,
    })),
  });

  const save = async (send) => {
    setError(null);
    setBusy(send ? "send" : "save");
    try {
      let saved = savedId ? await expensesApi.update(savedId, body()) : await expensesApi.create(body());
      setSavedId(saved.id);
      // The lines now have ids: keep them, so the next save updates rather than replaces them.
      setLines((all) => all.map((l, i) => ({ ...l, id: saved.items?.[i]?.id || l.id })));
      if (send) saved = await expensesApi.submit(saved.id);
      toast.success(send ? "Claim sent" : "Draft saved");
      onSaved(saved);
    } catch (err) {
      setError(errorOf(err, "Couldn't save the claim"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      title={claim?.id ? `Edit ${claim.number || "claim"}` : "New expense claim"}
      subtitle={`Money you spent on the organisation's work, to be paid back. It goes to ${reviewer}.`}
      onClose={onClose}
      width={820}
      footer={(
        <>
          <span style={{ marginRight: "auto", alignSelf: "center", fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Total {formatMoney(total, settings.currency)}</span>
          <button type="button" style={btn} onClick={onClose}>Cancel</button>
          <button type="button" style={btn} disabled={!!busy || uploading} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button type="button" style={primary} disabled={!!busy || uploading} onClick={() => save(true)}><FiSend size={14} /> {busy === "send" ? "Sending…" : "Send for approval"}</button>
        </>
      )}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%", fontFamily: FONT }}>
        {claim?.status === "returned" && claim.returnReason && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: BRAND.goldTint, border: `1px solid ${BRAND.goldBorder}`, color: BRAND.goldText, fontSize: 13 }}>
            <strong>Sent back:</strong> {claim.returnReason}
          </div>
        )}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          <label style={label}>Title
            <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Visit to Brookhouse School, 18 Nov" maxLength={200} required />
          </label>
          <label style={label}>Learning hub or school <span style={{ fontWeight: 500, color: BRAND.muted }}>(if it was for one)</span>
            <select style={input} value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">— Not for a particular hub —</option>
              {hubs.some((h) => h.mine) && <optgroup label="Your hubs">{hubs.filter((h) => h.mine).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</optgroup>}
              <optgroup label={hubs.some((h) => h.mine) ? "Other hubs" : "Hubs"}>{hubs.filter((h) => !h.mine).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</optgroup>
            </select>
          </label>
        </div>
        <label style={label}>What was it for? <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span>
          <textarea style={{ ...input, minHeight: 60, resize: "vertical" }} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Home-schooling session with the Otieno family; met the head teacher about next term" maxLength={4000} />
        </label>

        {lines.map((line, index) => (
          <LineCard key={line.key} line={line} index={index} count={lines.length} settings={settings} categories={categories} linkTypes={linkTypes}
            onChange={updateLine(line.key)} onRemove={() => setLines((all) => all.filter((l) => l.key !== line.key))}
            onLinkAll={() => setLines((all) => all.map((l) => ({ ...l, linkType: line.linkType, linkId: line.linkId, linkLabel: line.linkLabel })))} />
        ))}
        <div><button type="button" style={btn} onClick={() => setLines((all) => [...all, { ...blankLine(firstCategory), spentOn: all[all.length - 1]?.spentOn || kenyaToday(), linkType: all[all.length - 1]?.linkType || null, linkId: all[all.length - 1]?.linkId || null, linkLabel: all[all.length - 1]?.linkLabel || null }])}><FiPlus size={14} /> Add another expense</button></div>

        {error && <p role="alert" style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: BRAND.dangerTint, border: `1px solid ${BRAND.dangerBorder}`, color: BRAND.danger, fontSize: 13, fontWeight: 600 }}>{error}</p>}
      </div>
    </Modal>
  );
}
