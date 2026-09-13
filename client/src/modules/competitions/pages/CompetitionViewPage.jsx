import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiFlag, FiEdit2, FiExternalLink, FiPlus, FiX } from "react-icons/fi";
import { useCompetitionQuery, useDeleteCompetition, useUpdateCompetition } from "../hooks/useCompetitions";
import { useCompetitionHubsQuery, useCreateCompetitionHub, useDeleteCompetitionHub } from "../hooks/useCompetitionHubs";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import CoursePricingDisplay from "../../../components/CoursePricingDisplay";

const STATUS_LABEL = { draft: "Draft", open: "Open", closed: "Closed" };
const FORMAT_LABEL = { individual: "Individual", pairs: "Pairs", team: "Team" };
const CADENCE_LABEL = { one_off: "One-off", annual: "Annual", termly: "Termly" };

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500, whiteSpace: "pre-wrap" }}>{value || empty}</span>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

const OFFERING_STATUS = {
  upcoming:  { bg: "#fff8e6", color: "#b07800", label: "Upcoming"  },
  active:    { bg: "#e8f5fb", color: "#25476a", label: "Active"    },
  completed: { bg: "#F9FAFB", color: "#6B7280", label: "Completed" },
};

// "Run at a Hub" replaces the old standalone Event-deployment flow — picking a competition + a
// hub here auto-creates one Class per cohort at that hub, same UX as the old "Deploy to Hub".
function RunsAtHubsSection({ competition }) {
  const { data: offerings = [], isLoading } = useCompetitionHubsQuery(competition.id);
  const { data: hubsData } = useAllLearningHubsQuery({});
  const { mutate: addHub, isPending: adding } = useCreateCompetitionHub(competition.id);
  const { mutate: removeHub } = useDeleteCompetitionHub(competition.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);

  const canRun = !!competition.curriculumId && !!competition.startDate && !!competition.endDate;
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
            {canRun ? "One class per cohort is created automatically at each hub." : "Link a curriculum and set start/end dates before running this competition at a hub."}
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

function TrackCard({ track, index }) {
  return (
    <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>TRACK {index + 1}</span>
      </div>
      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>{track.name}</h4>
      {track.subtitle && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#15803D" }}>{track.subtitle}</p>}
      {track.description && <p style={{ margin: 0, fontSize: 13.5, color: "#4B5563", lineHeight: 1.6 }}>{track.description}</p>}
      {(track.highlights || []).length > 0 && (
        <ul style={{ margin: "2px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {track.highlights.map((h, i) => (
            <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{h}</li>
          ))}
        </ul>
      )}
      {(track.knowMoreUrl || track.registerUrl) && (
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
          {track.knowMoreUrl && (
            <a href={track.knowMoreUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#25476a", textDecoration: "none", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "6px 12px" }}>
              Know more <FiExternalLink size={12} />
            </a>
          )}
          {track.registerUrl && (
            <a href={track.registerUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#fff", textDecoration: "none", backgroundColor: "#feb139", borderRadius: 8, padding: "6px 14px" }}>
              Register <FiExternalLink size={12} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompetitionViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: competition, isLoading } = useCompetitionQuery(id);
  const { mutate: deleteCompetition } = useDeleteCompetition();
  const { mutate: updateCompetition, isPending: saving } = useUpdateCompetition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backToList = "/events";
  const editPath = `/events/competitions/${id}/edit`;

  if (isLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!competition) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Competition not found.</div>;
  }

  const tracks = competition.tracks || [];
  const coursePricing = competition.coursePricing || [];
  const dateRange = [formatDate(competition.startDate), formatDate(competition.endDate)].filter(Boolean).join(" – ");
  const registrationRange = [formatDate(competition.registrationOpenDate), formatDate(competition.registrationCloseDate)].filter(Boolean).join(" – ");

  const togglePublic = () => {
    updateCompetition({ id, data: { isPublic: !competition.isPublic } });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(backToList)} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Events &amp; Competitions
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{competition.name}</span>
      </div>

      <div style={{ background: competition.coverImage ? `linear-gradient(rgba(20,40,64,0.78), rgba(20,40,64,0.78)), center / cover no-repeat url(${competition.coverImage})` : "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <FiFlag size={28} strokeWidth={1.8} />
            </div>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{competition.name}</h1>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.72)" }}>
                {[competition.edition, STATUS_LABEL[competition.status] || competition.status, competition.curriculumName].filter(Boolean).join(" · ")}
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
          <h3 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Competition Info</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Description" value={competition.description} />
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <DetailRow label="Edition" value={competition.edition} />
              <DetailRow label="Level" value={competition.level} />
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <DetailRow label="Format" value={FORMAT_LABEL[competition.format]} />
              <DetailRow label="Cadence" value={CADENCE_LABEL[competition.cadence]} />
            </div>
            <DetailRow label="Dates" value={dateRange} />
            <DetailRow label="Registration" value={registrationRange} empty="Not set" />
            <DetailRow label="Curriculum" value={competition.curriculumName} empty="Standalone" />
          </div>
        </div>

        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 14 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
            <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{STATUS_LABEL[competition.status] || competition.status}</span>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${competition.isPublic && competition.status !== "draft" ? "#a8d5ee" : "#E5E7EB"}`, backgroundColor: competition.isPublic && competition.status !== "draft" ? "#F0F7FF" : "#F9FAFB" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
              {competition.isPublic
                ? competition.status === "draft"
                  ? "Marked public, but it's still a Draft — it won't appear on the website until the status is Open or Closed."
                  : "This competition is live on the website."
                : "Not published. Flip this on to feature it on the website."}
            </p>
            <button
              type="button"
              onClick={togglePublic}
              disabled={saving}
              style={{ padding: "8px 18px", backgroundColor: competition.isPublic ? "transparent" : "#25476a", color: competition.isPublic ? "#25476a" : "#fff", border: competition.isPublic ? "1.5px solid #25476a" : "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {competition.isPublic ? "Unpublish" : "Publish to website"}
            </button>
          </div>
        </div>
      </div>

      {coursePricing.length > 0 && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Course pricing</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280" }}>
            Priced courses from this competition&rsquo;s curriculum, grouped by pathway.
          </p>
          <CoursePricingDisplay curriculumId={competition.curriculumId} coursePricing={coursePricing} />
        </div>
      )}

      <RunsAtHubsSection competition={competition} />

      <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Tracks</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280" }}>
          Each track shows as its own card on the website.
        </p>
        {tracks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
            No tracks yet. <button type="button" onClick={() => navigate(editPath)} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>Add one</button>.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {tracks.map((track, i) => <TrackCard key={track.id || i} track={track} index={i} />)}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Competition"
        message={`"${competition.name}" and its tracks will be removed. This can't be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteCompetition(id, { onSuccess: () => navigate(backToList) });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
