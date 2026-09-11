import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiAward, FiEdit2, FiExternalLink } from "react-icons/fi";
import { useBootcampQuery, useDeleteBootcamp, useUpdateBootcamp } from "../hooks/useBootcamps";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const FORMAT_LABEL = { holiday: "Holiday", weekend: "Weekend", after_school: "After school", online: "Online" };

// GET /api/public/bootcamps/:idOrSlug checks `id === idOrSlug` before falling back to the
// computed slug (public-bootcamp.service.js), so linking straight off the bootcamp's own id
// always resolves correctly — no need to duplicate the server's slugify logic here.
const PUBLIC_SITE_URL = "https://africa.digifunzi.com";

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500, whiteSpace: "pre-wrap" }}>{value || empty}</span>
    </div>
  );
}

function formatPrice(bootcamp) {
  if (bootcamp.priceAmount == null) return "Enquire for pricing";
  return `${bootcamp.priceCurrency || "KES"} ${Number(bootcamp.priceAmount).toLocaleString()}`;
}

function formatAgeRange(bootcamp) {
  if (bootcamp.ageMin == null && bootcamp.ageMax == null) return "";
  if (bootcamp.ageMin != null && bootcamp.ageMax != null) return `${bootcamp.ageMin}–${bootcamp.ageMax} years`;
  return `${bootcamp.ageMin ?? bootcamp.ageMax} years`;
}

export default function BootcampViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: bootcamp, isLoading } = useBootcampQuery(id);
  const { mutate: deleteBootcamp } = useDeleteBootcamp();
  const { mutate: updateBootcamp, isPending: saving } = useUpdateBootcamp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backToList = "/events";
  const editPath = `/events/bootcamps/${id}/edit`;

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!bootcamp) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Bootcamp not found.</div>;
  }

  const onSale = bootcamp.saleStatus === "for_sale";
  const highlights = bootcamp.highlights || [];

  const toggleSale = () => {
    updateBootcamp({ id, data: { saleStatus: onSale ? "internal" : "for_sale" } });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(backToList)} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Events &amp; Competitions
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{bootcamp.name}</span>
      </div>

      <div style={{ background: bootcamp.coverImage ? `linear-gradient(rgba(20,40,64,0.78), rgba(20,40,64,0.78)), center / cover no-repeat url(${bootcamp.coverImage})` : "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <FiAward size={28} strokeWidth={1.8} />
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{bootcamp.name}</h1>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
                {[FORMAT_LABEL[bootcamp.format], formatPrice(bootcamp), bootcamp.eventName].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate(editPath)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              <FiEdit2 size={13} /> Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bootcamp Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Description" value={bootcamp.description} />
            <DetailRow label="Tagline" value={bootcamp.tagline} />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <DetailRow label="Format" value={FORMAT_LABEL[bootcamp.format]} />
              <DetailRow label="Duration" value={bootcamp.durationLabel} />
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <DetailRow label="Price" value={formatPrice(bootcamp)} />
              <DetailRow label="Age range" value={formatAgeRange(bootcamp)} />
            </div>
            <DetailRow label="Linked Event" value={bootcamp.eventName} empty="Standalone" />
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</h3>
            {onSale && (
              <a
                href={`${PUBLIC_SITE_URL}/bootcamps/${bootcamp.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none", backgroundColor: "#feb139", color: "#25476a", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}
              >
                <FiExternalLink size={12} /> View on Website
              </a>
            )}
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${onSale ? "#a8d5ee" : "#E5E7EB"}`, backgroundColor: onSale ? "#F0F7FF" : "#F9FAFB" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              {onSale
                ? "This bootcamp is live on the website."
                : "Not published. Flip this on to feature it on the website."}
            </p>
            <button
              type="button"
              onClick={toggleSale}
              disabled={saving}
              style={{ padding: "8px 18px", backgroundColor: onSale ? "transparent" : "#25476a", color: onSale ? "#25476a" : "#fff", border: onSale ? "1.5px solid #25476a" : "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {onSale ? "Unpublish" : "Publish to website"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>What you&rsquo;ll build / learn</h3>
        {highlights.length === 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#9CA3AF" }}>
            No highlights yet. <button type="button" onClick={() => navigate(editPath)} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>Add some</button>.
          </p>
        ) : (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {highlights.map((h, i) => (
              <li key={i} style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>{h}</li>
            ))}
          </ul>
        )}
      </div>

      {bootcamp.eventId && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Upcoming Runs</h3>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6B7280" }}>
            Read-only — driven by the linked Event&rsquo;s hub deployments. Deploy the Event to a hub to add a run.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
            View the linked Event&rsquo;s own page for its full deployment list.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Bootcamp"
        message={`"${bootcamp.name}" will be removed. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteBootcamp(id, { onSuccess: () => navigate(backToList) });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
