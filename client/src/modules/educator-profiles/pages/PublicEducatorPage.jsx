import { useState } from "react";
import { useParams } from "react-router-dom";
import { FiCheck, FiShare2 } from "react-icons/fi";
import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";
import { usePublicEducatorProfile } from "../hooks/useEducatorProfile";
import PublicProfileView from "../components/PublicProfileView";

// The share page of a published educator profile (/public/educators/:slug) — no sign-in, read only,
// served by the portal itself. Nothing is collected here: families who want this educator ask in
// their parent portal (Find a mentor).
export default function PublicEducatorPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = usePublicEducatorProfile(slug);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${data.name} — ${BRAND_NAME} educator`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled or blocked */ }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F6FA", fontFamily: "Inter, sans-serif" }}>
      <header style={{ background: "#25476a", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: 32, filter: BRAND_LOGO_DARK_BG_FILTER }} />
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5 }}>Educator profile</span>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 16px 40px" }}>
        {isLoading ? (
          <p style={{ textAlign: "center", color: "#9CA3AF", padding: "60px 0" }}>Loading…</p>
        ) : isError || !data ? (
          <div style={{ textAlign: "center", padding: "70px 20px", background: "#fff", borderRadius: 18 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 20, color: "#111827" }}>This profile isn&apos;t available</h1>
            <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>It may have been taken down, or the link is wrong.</p>
          </div>
        ) : (
          <PublicProfileView
            profile={data}
            actions={(
              <button type="button" onClick={share} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "none", background: "#feb139", color: "#25476a", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {copied ? <><FiCheck /> Link copied</> : <><FiShare2 /> Share profile</>}
              </button>
            )}
          />
        )}
      </main>
    </div>
  );
}
