import { Link, useSearchParams } from "react-router-dom";
import { FiMail } from "react-icons/fi";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";

// Where the "Choose which emails you get, or stop them" link in an email's footer lands.
// Unauthenticated by design: the token in the link stands in for a session, and opens nothing
// but that one account's email preferences — someone reading an email on their phone shouldn't
// have to sign in to stop it. `type` is the email they came from, shown in bold.
export default function EmailPreferencesPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F5F7FA", padding: "40px 16px", fontFamily: "Inter, sans-serif", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", backgroundColor: "#fff", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <div style={{ padding: "22px 24px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "#e8f5fb", color: "#25476a", display: "grid", placeItems: "center", flexShrink: 0 }}><FiMail size={17} /></span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Email preferences</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280" }}>Choose which emails you get. Changes save straight away.</p>
          </div>
        </div>

        {token ? (
          <EmailNotificationSettings token={token} highlight={params.get("type")} padding="18px 24px" />
        ) : (
          <p style={{ margin: 0, padding: "18px 24px", fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>This link isn't complete. Open it again from the email, or sign in to change your email settings.</p>
        )}

        <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
          Emails about your password, and invoices and receipts, are always sent. <Link to="/login" style={{ color: "#25476a", fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
