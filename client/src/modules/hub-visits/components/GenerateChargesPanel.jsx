import { useState } from "react";
import { usePreviewGenerateCharges, useGenerateCharges } from "../hooks/useHubVisits";

const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#111827", outline: "none" };
const fieldLabel = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 };
const buttonStyle = { padding: "9px 16px", borderRadius: 9, border: "none", fontSize: 13.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" };

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Groups a hub's unbilled visits in a date range into one hub_usage invoice per learner. The
// preview/create shape here mirrors BillingPage.jsx's bulk-invoice preview exactly (eligible/
// total/skipped/learners[].{status,reason}) — same UX for the same underlying pattern
// (resolveBulkLearners/createBulkInvoices), just fed by hub_visits instead of a flat per-learner
// amount.
export default function GenerateChargesPanel({ hubId, onClose }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [preview, setPreview] = useState(null);
  const { mutate: previewCharges, isPending: previewing } = usePreviewGenerateCharges();
  const { mutate: generate, isPending: generating } = useGenerateCharges();

  const runPreview = () => {
    setPreview(null);
    previewCharges({ hubId, data: { from, to } }, { onSuccess: setPreview });
  };

  const confirm = () => {
    generate({ hubId, data: { from, to } }, { onSuccess: () => { setPreview(null); onClose?.(); } });
  };

  return (
    <div style={{ backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Generate charges from unbilled visits</p>
        {onClose && <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Close</button>}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={fieldLabel}>From</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} style={inputStyle} />
        </div>
        <div>
          <label style={fieldLabel}>To</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} style={inputStyle} />
        </div>
        <button type="button" onClick={runPreview} disabled={previewing || !from || !to} style={{ ...buttonStyle, backgroundColor: "#25476a", color: "#fff", opacity: previewing ? 0.6 : 1 }}>
          {previewing ? "Checking visits…" : "Preview charges"}
        </button>
      </div>

      {preview && (
        <div style={{ marginTop: 16, padding: 14, background: "#fff", border: "1px solid #D7EAF2", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ fontSize: 13 }}>{preview.eligible} invoice{preview.eligible === 1 ? "" : "s"} ready</strong>
              <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
                {preview.total} learner{preview.total === 1 ? "" : "s"} checked · {preview.skipped} skipped · Expected total {fmt(preview.expectedTotal)}
              </div>
            </div>
            <button type="button" onClick={confirm} disabled={generating || preview.eligible === 0} style={{ ...buttonStyle, backgroundColor: "#feb139", color: "#25476a", opacity: generating ? 0.6 : 1 }}>
              {generating ? "Generating…" : "Generate and issue"}
            </button>
          </div>
          {preview.learners?.filter((row) => row.status === "skipped").slice(0, 5).map((row) => (
            <div key={row.learnerId} style={{ marginTop: 8, fontSize: 11.5, color: "#B45309" }}>{row.name}: {row.reason}</div>
          ))}
          {preview.skipped > 5 && <div style={{ marginTop: 6, fontSize: 11.5, color: "#9CA3AF" }}>And {preview.skipped - 5} more skipped learners.</div>}
        </div>
      )}
    </div>
  );
}
