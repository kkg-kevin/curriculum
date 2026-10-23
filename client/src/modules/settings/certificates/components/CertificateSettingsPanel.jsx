import { useEffect, useState } from "react";
import ImageUploadField from "../../../../components/ImageUploadField";
import CertificateViewer from "../../../certificates/components/CertificateViewer";
import { useCertificateSettings, useSaveCertificateSettings } from "../../../certificates/hooks/useCertificates";
import { SettingsPage, SettingsSection, Field, FooterNote, LoadState } from "../../components/SettingsLayout";

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
    <SettingsPage
      title="Certificates"
      description="Who signs the certificates learners get when they complete a course, pathway or bootcamp."
    >
      <LoadState isLoading={isLoading} isError={isError} what="Certificate settings" />

      {data && (
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", alignItems: "start" }}>
          <SettingsSection
            as="form"
            onSubmit={(e) => { e.preventDefault(); save(form); }}
            title="Signatory"
            description="Printed at the foot of every certificate. Leave it empty to issue unsigned certificates — the QR code still proves each one is genuine."
            footer={(
              <>
                <button type="submit" className="stg-btn-primary" disabled={!dirty || isPending}>{isPending ? "Saving…" : "Save"}</button>
                <FooterNote>Applies to certificates issued from now on.</FooterNote>
              </>
            )}
          >
            <Field label="Name" htmlFor="cert-signatory-name">
              <input id="cert-signatory-name" className="stg-input" value={form.signatoryName} maxLength={150} onChange={(e) => set("signatoryName")(e.target.value)} placeholder="e.g. Jane Wanjiru" />
            </Field>
            <Field label="Title" htmlFor="cert-signatory-title">
              <input id="cert-signatory-title" className="stg-input" value={form.signatoryTitle} maxLength={150} onChange={(e) => set("signatoryTitle")(e.target.value)} placeholder="e.g. Director" />
            </Field>
            <Field note="A scan on a white or transparent background works best.">
              <ImageUploadField label="Signature" value={form.signatureImage} onChange={set("signatureImage")} width="240px" height="96px" />
            </Field>
          </SettingsSection>

          <SettingsSection title="Preview" description="With placeholder learner and course details.">
            <CertificateViewer certificate={sample} actions={false} />
          </SettingsSection>
        </div>
      )}
    </SettingsPage>
  );
}
