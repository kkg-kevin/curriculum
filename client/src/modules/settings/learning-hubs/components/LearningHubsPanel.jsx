import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiEdit2, FiMapPin, FiSearch, FiTrash2 } from "react-icons/fi";
import { useAllLearningHubsQuery, useDeleteLearningHub, useUpdateLearningHub } from "../../../learning-hubs/hooks/useLearningHub";
import { LEARNING_HUB_TYPES } from "../../../learning-hubs/schemas/learningHub.schema";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const STATUS_DOT = { draft: "#feb139", active: "#38aae1", inactive: "#D1D5DB" };
const STATUS_LABEL = { draft: "Draft", active: "Active", inactive: "Inactive" };
const STATUS_BADGE = {
  draft:    { bg: "#fff8e6", color: "#b8860b", border: "#fcd97a" },
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.inactive;
  return (
    <span style={{ padding: "1px 8px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0 }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function LearningHubRow({ hub, onView, onActivate, onEdit, onDelete }) {
  const typeLabel = LEARNING_HUB_TYPES.find((t) => t.value === hub.hubType)?.label || hub.hubType;
  const sub = [typeLabel, hub.code, hub.address?.county].filter(Boolean).join(" · ");

  return (
    <div className="stg-item">
      <div className="stg-item-top" style={{ cursor: "pointer" }} onClick={onView}>
        <div className="stg-item-dot" style={{ backgroundColor: STATUS_DOT[hub.status] || STATUS_DOT.inactive }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stg-item-name">{hub.name}</div>
          {sub && <div className="stg-item-sub">{sub}</div>}
        </div>
        <StatusBadge status={hub.status} />
        {hub.status === "draft" && (
          <button type="button" className="stg-icon-btn" onClick={(e) => { e.stopPropagation(); onActivate(); }} title="Activate — move into the Learning Hubs module">
            <FiCheckCircle size={14} strokeWidth={2} />
          </button>
        )}
        <button type="button" className="stg-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
          <FiEdit2 size={14} strokeWidth={2} />
        </button>
        <button type="button" className="stg-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
          <FiTrash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export default function LearningHubsPanel() {
  const navigate = useNavigate();
  const { data, isLoading } = useAllLearningHubsQuery({ includeDrafts: true });
  const { mutate: deleteHub } = useDeleteLearningHub();
  const { mutate: updateHub } = useUpdateLearningHub();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  const hubs = data?.data || [];
  const query = search.trim().toLowerCase();
  const filtered = query ? hubs.filter((h) => h.name.toLowerCase().includes(query)) : hubs;

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Learning Hubs</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {hubs.length} learning hub{hubs.length !== 1 ? "s" : ""} registered — schools, campuses, and other learning spaces
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => navigate("/settings/learning-hubs/create")}>
          + Add Learning Hub
        </button>
      </div>

      {hubs.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiMapPin size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No learning hubs yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Register your first school, campus, or learning space to get started.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => navigate("/settings/learning-hubs/create")}>
            + Add Learning Hub
          </button>
        </div>
      ) : (
        <>
          <div className="stg-search-wrap">
            <FiSearch size={14} className="stg-search-icon" />
            <input
              className="stg-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${hubs.length} learning hub${hubs.length !== 1 ? "s" : ""}…`}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div className="stg-list">
              {filtered.map((hub) => (
                <LearningHubRow
                  key={hub.id}
                  hub={hub}
                  onView={() => navigate(`/learning-hubs/${hub.id}/view`)}
                  onActivate={() => updateHub({ id: hub.id, data: { status: "active" } })}
                  onEdit={() => navigate(`/settings/learning-hubs/${hub.id}/edit`)}
                  onDelete={() => setDeleteTarget(hub)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Learning Hub"
        message={`"${deleteTarget?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteHub(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
