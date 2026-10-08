import { useParams } from "react-router-dom";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useVerifyCertificate } from "../hooks/useCertificates";
import CertificateViewer from "../components/CertificateViewer";
import { certificateFields, formatCertificateDate } from "../utils/certificate";
import { BRAND_NAME } from "../../../branding";

const ACCENT = "#25476a";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";
const BORDER = "#E6EBF2";

const page = { minHeight: "100vh", backgroundColor: "#F5F7FA", fontFamily: "Inter, sans-serif", padding: "32px 16px 48px", boxSizing: "border-box" };
const wrap = { maxWidth: 1123, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 };
const card = { backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "20px 24px" };

function Message({ title, children }) {
  return (
    <div style={page}>
      <div style={{ ...wrap, maxWidth: 460 }}>
        <div style={{ ...card, textAlign: "center", padding: "32px 28px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: INK }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 13.5, color: INK_MUTED, lineHeight: 1.5 }}>{children}</p>
        </div>
      </div>
    </div>
  );
}

// /certificates/verify/:token — where the QR on a certificate leads. No sign-in, outside every
// portal layout: the person checking it (a school, an employer, a relative) has no account. Says
// plainly whether the certificate stands, and shows only what is printed on it.
export default function VerifyCertificatePage() {
  const { token } = useParams();
  const { data: certificate, isLoading, isError, error } = useVerifyCertificate(token);

  if (isLoading) return <Message title="Checking this certificate…">One moment.</Message>;
  if (isError || !certificate) {
    const missing = (error?.statusCode ?? error?.response?.status) === 404;
    return missing
      ? <Message title="No certificate found">This link doesn't match a certificate issued by {BRAND_NAME}. Check that the whole link was copied, or scan the QR code again.</Message>
      : <Message title="Couldn't check this certificate">Something went wrong on our side. Check your connection and try again.</Message>;
  }

  const c = certificateFields(certificate);
  const valid = c.status === "issued";

  return (
    <div style={page}>
      <div style={wrap}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: INK_FAINT, textTransform: "uppercase", letterSpacing: "0.1em" }}>{BRAND_NAME} · Certificate check</p>

        <div style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start", borderColor: valid ? "#A7F3D0" : "#FECACA", backgroundColor: valid ? "#ECFDF5" : "#FEF2F2" }}>
          {valid ? <FiCheckCircle size={26} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} /> : <FiXCircle size={26} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />}
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: valid ? "#065F46" : "#991B1B" }}>
              {valid ? "This certificate is genuine" : "This certificate has been withdrawn"}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: INK, lineHeight: 1.55 }}>
              {valid ? (
                <>{BRAND_NAME} awarded certificate <strong>{c.number}</strong> to <strong>{c.learnerName}</strong> for completing {c.kindNoun} <strong>{c.title}</strong>{c.hubName ? <> at {c.hubName}</> : null} on {formatCertificateDate(c.issuedAt)}.</>
              ) : (
                <>Certificate <strong>{c.number}</strong> was issued by {BRAND_NAME} but is no longer valid. Ask the learner or their learning hub for a current one.</>
              )}
            </p>
          </div>
        </div>

        {valid && <CertificateViewer certificate={certificate} />}

        <p style={{ margin: 0, fontSize: 11.5, color: INK_FAINT, textAlign: "center" }}>
          {BRAND_NAME} · <a href="/" style={{ color: ACCENT }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
