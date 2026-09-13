import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiAward, FiEdit2, FiExternalLink, FiPlus, FiX } from "react-icons/fi";
import { useBootcampQuery, useDeleteBootcamp, useUpdateBootcamp } from "../hooks/useBootcamps";
import { useBootcampHubsQuery, useCreateBootcampHub, useDeleteBootcampHub } from "../hooks/useBootcampHubs";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import CoursePricingDisplay from "../../../components/CoursePricingDisplay";

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

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

const OFFERING_STATUS = {
  upcoming:  { bg: "#fff8e6", color: "#b07800", label: "Upcoming"  },
  active:    { bg: "#e8f5fb", color: "#25476a", label: "Active"    },
  completed: { bg: "#F9FAFB", color: "#6B7280", label: "Completed" },
};

// "Run at a Hub" replaces the old standalone Event-deployment flow — picking a bootcamp + a hub
// here auto-creates one Class per cohort at that hub, same UX as the old "Deploy to Hub" action.
function RunsAtHubsSection({ bootcamp }) {
  const { data: offerings = [], isLoading } = useBootcampHubsQuery(bootcamp.id);
  const { data: hubsData } = useAllLearningHubsQuery({});
  const { mutate: addHub, isPending: adding } = useCreateBootcampHub(bootcamp.id);
  const { mutate: removeHub } = useDeleteBootcampHub(bootcamp.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);

  const canRun = !!bootcamp.curriculumId && !!bootcamp.startDate && !!bootcamp.endDate;
  const runningHubIds = new Set(offerings.map((o) => o.hubId));
  const availableHubs = (hubsData?.data || []).filter((h) => !runningHubIds.has(h.id));

  const handleAdd = () => {
    if (!selectedHubId) return;
    addHub({ hubId: selectedHubId }, { onSuccess: () => { setPickerOpen(false); setSelectedHubId(""); } });
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Runs at these hubs</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            {canRun ? "One class per cohort is created automatically at each hub." : "Link a curriculum and set start/end dates before running this bootcamp at a hub."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={!canRun}
          title={canRun ? undefined : "Link a curriculum and set dates first"}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", backgroundColor: canRun ? "#25476a" : "#E5E7EB", color: canRun ? "#fff" : "#9CA3AF", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: canRun ? "pointer" : "not-allowed", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          <FiPlus size={13} /> Run at a Hub
        </button>
      </div>

      {pickerOpen && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #a8d5ee", backgroundColor: "#F0F7FF" }}>
          <select value={selectedHubId} onChange={(e) => setSelectedHubId(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
            <option value="">Select a hub…</option>
            {availableHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <button type="button" onClick={handleAdd} disabled={!selectedHubId || adding} style={{ padding: "8px 18px", borderRadius: 8, border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: !selectedHubId || adding ? "not-allowed" : "pointer" }}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {isLoading ? (
          <div style={{ height: 48, borderRadius: 10, backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6" }} />
        ) : offerings.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Not running at any hub yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {offerings.map((o) => {
              const s = OFFERING_STATUS[o.status] || OFFERING_STATUS.upcoming;
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E7EB" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{o.hubName}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                      {(o.classes || []).length} class{(o.classes || []).length !== 1 ? "es" : ""} · {o.learnerCount} learner{o.learnerCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {s && (
                      <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, backgroundColor: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
                    )}
                    <button type="button" onClick={() => setConfirmRemove(o)} title="Remove from this hub" style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", display: "flex", padding: 4 }}>
                      <FiX size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmRemove}
        title="Remove from this hub"
        message={`This will remove "${confirmRemove?.hubName}" and delete the classes it created there. This can't be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { removeHub(confirmRemove.id); setConfirmRemove(null); }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
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
  const coursePricing = bootcamp.coursePricing || [];

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
                {[FORMAT_LABEL[bootcamp.format], formatPrice(bootcamp), bootcamp.curriculumName].filter(Boolean).join(" · ")}
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
            <DetailRow label="Curriculum" value={bootcamp.curriculumName} empty="Standalone" />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <DetailRow label="Dates" value={bootcamp.startDate ? `${formatDate(bootcamp.startDate)} – ${formatDate(bootcamp.endDate)}` : ""} empty="Not set" />
              <DetailRow label="Registration" value={bootcamp.registrationOpenDate ? `${formatDate(bootcamp.registrationOpenDate)} – ${formatDate(bootcamp.registrationCloseDate)}` : ""} empty="Not set" />
            </div>
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

      {coursePricing.length > 0 && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Course pricing</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280" }}>
            Priced courses from this bootcamp&rsquo;s curriculum, grouped by pathway.
          </p>
          <CoursePricingDisplay curriculumId={bootcamp.curriculumId} coursePricing={coursePricing} />
        </div>
      )}

      <RunsAtHubsSection bootcamp={bootcamp} />

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
