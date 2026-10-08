import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { useCertificate } from "../hooks/useCertificates";
import CertificateViewer from "../components/CertificateViewer";
import { certificateFields } from "../utils/certificate";

const T = { accent: "#25476a", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF" };

// /learner-portal/certificates/:certificateId — a learner's (or their guardian's) own
// certificate: the sheet, Download PDF, and the link anyone can use to check it is genuine.
export default function CertificateViewPage() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const { data: certificate, isLoading, isError } = useCertificate(certificateId);

  if (isLoading) {
    return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Loading…</div>;
  }
  if (isError || !certificate) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#B91C1C" }}>We couldn't open this certificate. It may have been withdrawn — check your profile for your current certificates.</div>;
  }

  const { title } = certificateFields(certificate);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <button
          type="button"
          onClick={() => navigate("/learner-portal/profile")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          <FiArrowLeft size={15} /> Back to profile
        </button>
        <h1 style={{ margin: "12px 0 4px", fontSize: 22, fontWeight: 800, color: T.ink }}>Certificate of Completion</h1>
        <p style={{ margin: 0, fontSize: 14, color: T.inkMuted }}>{title}</p>
      </div>

      <CertificateViewer certificate={certificate} />
    </div>
  );
}
