import { useEffect, useState } from "react";
import ImageUploadField from "../../../../components/ImageUploadField";
import CertificateViewer from "../../../certificates/components/CertificateViewer";
import { useCertificateSettings, useSaveCertificateSettings } from "../../../certificates/hooks/useCertificates";

const heading = { margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" };
const hint = { margin: "4px 0 0", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 640 };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 };

const EMPTY = { signatoryName: "", signatoryTitle: "", signatureImage: null };

// Settings → Certificates (owner only): who signs the workspace's certificates. The preview is
// the real certificate sheet with made-up details, so what is set here is seen exactly as it
// will print.
//
// A certificate keeps the signatory it was issued with; changing this only affects certificates
// issued from now on — and ones issued before any signatory was set, which show the current one.
export default function CertificateSettingsPanel() {
  const { data, isLoading, isError } = useCertificateSettings();
  const { mutate: save, isPending } = useSaveCertificateSettings();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (data) setForm({ signatoryName: data.signatoryName || "", signatoryTitle: data.signatoryTitle || "", signatureImage: data.signatureImage || null });
  }, [data]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const dirty = Boolean(data) && ["signatoryName", "signatoryTitle", "signatureImage"].some((f) => (form[f] || "") !== (data[f] || ""));

  const sample = {
    certificateNumber: "DF-0000-000000",
    kind: "course",
    status: "issued",
    learnerName: "Learner Name",
    title: "Course name",
    hubName: "Learning hub",
    issuedAt: new Date().toISOString(),
    signatory: form.signatoryName || form.signatureImage ? { name: form.signatoryName, title: form.signatoryTitle, image: form.signatureImage } : null,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <h2 style={heading}>Who signs your certificates</h2>
        <p style={hint}>
          The name, title and signature printed at the foot of every certificate of completion. Leave all three empty to issue certificates without a signature: each one still carries a QR code that confirms it is genuine.
        </p>

        {isLoading && <p style={{ ...hint, marginTop: 14 }}>Loading…</p>}
        {isError && <p style={{ ...hint, marginTop: 14, color: "#B91C1C" }}>Certificate settings could not be loaded.</p>}

        {data && (
          <form
            onSubmit={(e) => { e.preventDefault(); save(form); }}
            style={{ marginTop: 16, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", maxWidth: 820, alignItems: "start" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label htmlFor="cert-signatory-name" style={label}>Signatory's name</label>
                <input id="cert-signatory-name" className="stg-input" value={form.signatoryName} maxLength={150} onChange={(e) => set("signatoryName")(e.target.value)} placeholder="e.g. Jane Wanjiru" />
              </div>
              <div>
                <label htmlFor="cert-signatory-title" style={label}>Their title</label>
                <input id="cert-signatory-title" className="stg-input" value={form.signatoryTitle} maxLength={150} onChange={(e) => set("signatoryTitle")(e.target.value)} placeholder="e.g. Director" />
              </div>
            </div>

            <div>
              <ImageUploadField label="Signature" value={form.signatureImage} onChange={set("signatureImage")} width="240px" height="96px" />
              <p style={{ ...hint, marginTop: 6 }}>A photo or scan of the signature on a white or transparent background works best.</p>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="stg-btn-primary" disabled={!dirty || isPending}>
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </section>

      {data && (
        <section>
          <h2 style={heading}>Preview</h2>
          <p style={hint}>How a certificate looks with what is entered above. The learner, course, hub and number here are placeholders.</p>
          <div style={{ marginTop: 14, maxWidth: 760 }}>
            <CertificateViewer certificate={sample} actions={false} />
          </div>
        </section>
      )}
    </div>
  );
}
