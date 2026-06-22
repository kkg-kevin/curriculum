import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurriculumVersionsQuery, useCreateVersion, usePublishVersion } from "../hooks/useCurriculumVersions";
import CreateVersionModal from "./CreateVersionModal";
import ConfirmDialog from "./ConfirmDialog";

/* ── Status config ───────────────────────────────────────────────────── */

const STATUS = {
  active:   { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", dot: "#16A34A", label: "Active"   },
  draft:    { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", dot: "#D97706", label: "Draft"    },
  archived: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF", label: "Archived" },
};

const FILTERS = ["all", "active", "draft", "archived"];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Version card ─────────────────────────────────────────────────────── */

function VersionCard({ version, isLast, onPublish, publishPending, onView, compareMode, isSelected, onSelect }) {
  const s          = STATUS[version.status] || STATUS.archived;
  const snap       = version.snapshot || {};
  const isDraft    = version.status === "draft";
  const isArchived = version.status === "archived";

  const handleCardClick = () => {
    if (compareMode) onSelect(version.id);
  };

  return (
    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>

      {/* Timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        {compareMode ? (
          /* Checkbox circle */
          <div
            onClick={() => onSelect(version.id)}
            style={{
              width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "2px",
              backgroundColor: isSelected ? "#0D47A1" : "#fff",
              border: `2px solid ${isSelected ? "#0D47A1" : "#D1D5DB"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {isSelected && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ) : (
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: s.dot, border: `2px solid ${s.border}`, flexShrink: 0, marginTop: "5px" }} />
        )}
        {!isLast && (
          <div style={{ width: "2px", flex: 1, minHeight: "24px", backgroundColor: "#E5E7EB", marginTop: "4px" }} />
        )}
      </div>

      {/* Card */}
      <div
        onClick={compareMode ? handleCardClick : undefined}
        style={{
          flex: 1,
          backgroundColor: compareMode && isSelected ? "#EFF6FF" : "#ffffff",
          border: `1.5px solid ${
            compareMode && isSelected ? "#93C5FD"
            : version.status === "active" ? "#BBF7D0"
            : "#E5E7EB"
          }`,
          borderRadius: "12px",
          overflow: "hidden",
          marginBottom: isLast ? "0" : "10px",
          opacity: isArchived && !compareMode ? 0.72 : 1,
          cursor: compareMode ? "pointer" : "default",
          transition: "border-color 0.15s, background-color 0.15s",
          boxShadow: compareMode && isSelected ? "0 0 0 3px rgba(13,71,161,0.1)" : "none",
        }}
      >
        {/* Card header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 14px",
          backgroundColor:
            compareMode && isSelected ? "#DBEAFE"
            : version.status === "active" ? "#F0FDF4"
            : version.status === "draft"  ? "#FFFBEB"
            : "#FAFAFA",
          borderBottom: "1px solid #F3F4F6", gap: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span style={{
              width: "26px", height: "26px", borderRadius: "8px",
              backgroundColor:
                compareMode && isSelected ? "#0D47A1"
                : version.status === "active" ? "#15803D"
                : version.status === "draft"  ? "#D97706"
                : "#E5E7EB",
              color: isArchived && !isSelected ? "#6B7280" : "#fff",
              fontSize: "11px", fontWeight: "800",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              v{version.versionNumber}
            </span>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {version.versionLabel}
            </p>
          </div>

          {/* Actions (hidden in compare mode) */}
          {!compareMode && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              {isDraft && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onPublish(version); }} disabled={publishPending}
                  style={{ padding: "3px 10px", borderRadius: "6px", border: "1.5px solid #0D47A1", backgroundColor: "#EFF6FF", color: "#0D47A1", fontSize: "11px", fontWeight: "700", cursor: publishPending ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { if (!publishPending) { e.currentTarget.style.backgroundColor = "#0D47A1"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#EFF6FF"; e.currentTarget.style.color = "#0D47A1"; }}>
                  ↑ Publish
                </button>
              )}
              <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onView(version.id); }}
                style={{ padding: "3px 10px", borderRadius: "6px", border: "1.5px solid #E5E7EB", backgroundColor: "#F9FAFB", color: "#374151", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.borderColor = "#9CA3AF"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
                View →
              </button>
            </div>
          )}

          {/* Compare mode: status badge only */}
          {compareMode && (
            <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>
              {s.label}
            </span>
          )}
        </div>

        {/* Card body */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
            {snap.framework && (
              <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>{snap.framework}</span>
            )}
            {snap.academicYear && (
              <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}>{snap.academicYear}</span>
            )}
            {snap.periods?.length > 0 && (
              <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                {snap.periods.length} {snap.academicCycleModel || "periods"}
              </span>
            )}
            {(snap.structure || []).some((t) => (t.grades?.length || 0) > 0) && (
              <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", backgroundColor: "#F5F3FF", color: "#5B21B6", border: "1px solid #C4B5FD" }}>
                {(snap.structure || []).reduce((s, t) => s + (t.grades?.length || 0), 0)} classes
              </span>
            )}
          </div>
          {version.changeNotes && (
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.5", fontStyle: "italic" }}>"{version.changeNotes}"</p>
          )}
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Saved {formatDate(version.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Filter tabs ──────────────────────────────────────────────────────── */

function FilterTabs({ active, onChange, counts }) {
  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {FILTERS.map((f) => {
        const isActive = active === f;
        const count    = counts[f] ?? 0;
        if (f !== "all" && count === 0) return null;
        return (
          <button key={f} type="button" onClick={() => onChange(f)}
            style={{
              padding: "4px 10px", borderRadius: "20px", border: `1.5px solid ${isActive ? "#0D47A1" : "#E5E7EB"}`,
              backgroundColor: isActive ? "#0D47A1" : "#fff",
              color: isActive ? "#fff" : "#6B7280",
              fontSize: "11px", fontWeight: "700",
              fontFamily: "Inter, sans-serif", cursor: "pointer",
              textTransform: "capitalize", transition: "all 0.15s",
              display: "inline-flex", alignItems: "center", gap: "4px",
            }}>
            {f}
            <span style={{ padding: "0px 5px", borderRadius: "10px", backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#F3F4F6", color: isActive ? "#fff" : "#6B7280", fontSize: "10px", fontWeight: "800" }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */

function VersionSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
      {[1, 2].map((n) => (
        <div key={n} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#E5E7EB", marginTop: "5px", flexShrink: 0 }} />
          <div style={{ flex: 1, height: "88px", borderRadius: "12px", backgroundColor: "#F3F4F6" }} />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function VersionHistory({ curriculumId }) {
  const navigate = useNavigate();

  const [modalOpen, setModalOpen]           = useState(false);
  const [confirmVersion, setConfirmVersion] = useState(null);
  const [filterStatus, setFilterStatus]     = useState("all");
  const [compareMode, setCompareMode]       = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);

  const { data, isLoading }                            = useCurriculumVersionsQuery(curriculumId);
  const { mutate: createVersion, isPending: creating } = useCreateVersion(curriculumId);
  const { mutate: publishVersion, isPending: publishing } = usePublishVersion(curriculumId);

  const versions = data?.data || [];

  /* Count per status for filter tab badges */
  const counts = {
    all:      versions.length,
    active:   versions.filter((v) => v.status === "active").length,
    draft:    versions.filter((v) => v.status === "draft").length,
    archived: versions.filter((v) => v.status === "archived").length,
  };

  const filteredVersions = filterStatus === "all"
    ? versions
    : versions.filter((v) => v.status === filterStatus);

  /* Compare mode handlers */
  const handleToggleSelect = (vId) => {
    setSelectedVersions((prev) => {
      if (prev.includes(vId)) return prev.filter((id) => id !== vId);
      if (prev.length >= 2) return [prev[1], vId]; // slide the window
      return [...prev, vId];
    });
  };

  const handleEnterCompare = () => {
    setCompareMode(true);
    setFilterStatus("all"); // show all so user can pick across statuses
    setSelectedVersions([]);
  };

  const handleExitCompare = () => {
    setCompareMode(false);
    setSelectedVersions([]);
  };

  const handleCompare = () => {
    if (selectedVersions.length !== 2) return;
    // Sort by versionNumber so A is always the older one
    const [a, b] = [...selectedVersions].sort((x, y) => {
      const vA = versions.find((v) => v.id === x)?.versionNumber ?? 0;
      const vB = versions.find((v) => v.id === y)?.versionNumber ?? 0;
      return vA - vB;
    });
    navigate(`/curriculum/${curriculumId}/versions/${a}/diff/${b}`);
  };

  const handleCreate = (body) => createVersion(body, { onSuccess: () => setModalOpen(false) });

  const handlePublishConfirm = () => {
    if (!confirmVersion) return;
    publishVersion(confirmVersion.id, { onSettled: () => setConfirmVersion(null) });
  };

  const canCompare = versions.length >= 2;

  return (
    <>
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "24px" }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Version History</h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Track and publish changes to this curriculum</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
            {!compareMode ? (
              <>
                {versions.length > 0 && (
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                    {versions.length} {versions.length === 1 ? "version" : "versions"}
                  </span>
                )}
                {/* Compare toggle */}
                {canCompare && (
                  <button type="button" onClick={handleEnterCompare}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", backgroundColor: "#fff", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#9CA3AF"; e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.backgroundColor = "#fff"; }}>
                    ⇄ Compare
                  </button>
                )}
                <button type="button" onClick={() => setModalOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 13px", backgroundColor: "#0D47A1", color: "#ffffff", border: "none", borderRadius: "9px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span>
                  Save Version
                </button>
              </>
            ) : (
              /* Compare mode controls */
              <>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  {selectedVersions.length === 0
                    ? "Select 2 versions to compare"
                    : selectedVersions.length === 1
                    ? "Select 1 more version"
                    : "Ready to compare"}
                </span>
                <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", backgroundColor: selectedVersions.length === 2 ? "#0D47A1" : "#F3F4F6", color: selectedVersions.length === 2 ? "#fff" : "#9CA3AF", border: "none" }}>
                  {selectedVersions.length} / 2
                </span>
                <button type="button" onClick={handleCompare} disabled={selectedVersions.length !== 2}
                  style={{ padding: "7px 14px", backgroundColor: selectedVersions.length === 2 ? "#0D47A1" : "#E5E7EB", color: selectedVersions.length === 2 ? "#fff" : "#9CA3AF", border: "none", borderRadius: "9px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: selectedVersions.length === 2 ? "pointer" : "not-allowed", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                  ⇄ Compare Selected
                </button>
                <button type="button" onClick={handleExitCompare}
                  style={{ padding: "7px 12px", backgroundColor: "#fff", color: "#6B7280", border: "1.5px solid #E5E7EB", borderRadius: "9px", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  ✕ Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Filter tabs (hidden in compare mode) ───────────────────── */}
        {!compareMode && versions.length > 0 && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #F3F4F6", backgroundColor: "#FAFAFA" }}>
            <FilterTabs active={filterStatus} onChange={setFilterStatus} counts={counts} />
          </div>
        )}

        {/* ── Compare mode info banner ────────────────────────────────── */}
        {compareMode && (
          <div style={{ padding: "10px 20px", backgroundColor: "#EFF6FF", borderBottom: "1px solid #DBEAFE", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px" }}>ℹ️</span>
            <p style={{ margin: 0, fontSize: "12px", color: "#1D4ED8" }}>
              Click any two version cards to select them, then click <strong>Compare Selected</strong>.
            </p>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ padding: "16px 20px" }}>
          {isLoading ? (
            <VersionSkeleton />
          ) : versions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>🕓</div>
              <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#374151" }}>No versions recorded</p>
              <p style={{ margin: "0 0 16px", fontSize: "12px" }}>Click "Save Version" to snapshot the current curriculum state.</p>
            </div>
          ) : filteredVersions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
              <p style={{ margin: 0, fontSize: "13px" }}>No {filterStatus} versions.</p>
            </div>
          ) : (
            <div>
              {filteredVersions.map((v, i) => (
                <VersionCard
                  key={v.id}
                  version={v}
                  curriculumId={curriculumId}
                  isLast={i === filteredVersions.length - 1}
                  onPublish={setConfirmVersion}
                  publishPending={publishing}
                  onView={(vId) => navigate(`/curriculum/${curriculumId}/versions/${vId}`)}
                  compareMode={compareMode}
                  isSelected={selectedVersions.includes(v.id)}
                  onSelect={handleToggleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateVersionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} isPending={creating} />

      <ConfirmDialog
        isOpen={!!confirmVersion}
        title="Publish this version?"
        message={`"${confirmVersion?.versionLabel}" will become the active version. The current active version will be archived. This cannot be undone.`}
        confirmLabel="Publish"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={handlePublishConfirm}
        onCancel={() => setConfirmVersion(null)}
      />
    </>
  );
}
