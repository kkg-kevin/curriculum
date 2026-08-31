import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiChevronRight, FiCheckCircle, FiEdit2, FiMapPin, FiPauseCircle, FiSearch, FiTrash2 } from "react-icons/fi";
import { useAllLearningHubsQuery, useDeleteLearningHub, useUpdateLearningHub } from "../../../learning-hubs/hooks/useLearningHub";
import { LEARNING_HUB_TYPES } from "../../../learning-hubs/schemas/learningHub.schema";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

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

/* ── Hub row — view/activate/edit/delete ─────────────────────────────────── */

function LearningHubRow({ hub, onView, onToggleStatus, onEdit, onDelete }) {
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
        <button
          type="button"
          className="stg-icon-btn"
          onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
          title={hub.status === "active" ? "Deactivate" : "Activate"}
        >
          {hub.status === "active" ? <FiPauseCircle size={14} strokeWidth={2} /> : <FiCheckCircle size={14} strokeWidth={2} />}
        </button>
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

/* ── Parent hub group — a hub with one or more branch hubs nested under it.
   A hub can itself be the parent of other hubs now (see learning-hub.validation.js's
   parentHubId) — its own existing admin login gets access to switch into each branch (see
   scope.middleware.js's req.ownSchools), so there's no separate admin to assign here the way
   the old standalone Branch entity needed. */

function ParentHubGroup({ hub, branchHubs, hubActions }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {branchHubs.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", flexShrink: 0, display: "flex", padding: "4px" }}
            title={expanded ? "Collapse branches" : "Expand branches"}
          >
            {expanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <LearningHubRow hub={hub} {...hubActions(hub)} />
        </div>
      </div>

      {expanded && branchHubs.length > 0 && (
        <div style={{ marginLeft: "26px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: "700", color: ACCENT, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Branches · {branchHubs.length}
          </p>
          {branchHubs.map((h) => <LearningHubRow key={h.id} hub={h} {...hubActions(h)} />)}
        </div>
      )}
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────
 * Every top-level hub (no parentHubId) shows as its own row; a hub with branch
 * hubs pointing at it (their parentHubId) shows those nested underneath. */

export default function LearningHubsPanel() {
  const navigate = useNavigate();
  const { data: hubsData, isLoading: hubsLoading } = useAllLearningHubsQuery({ includeDrafts: true });
  const { mutate: deleteHub } = useDeleteLearningHub();
  const { mutate: updateHub } = useUpdateLearningHub();

  const [deleteHubTarget, setDeleteHubTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [search, setSearch] = useState("");

  const hubs = hubsData?.data || [];

  const query = search.trim().toLowerCase();
  const matches = (h) => !query || h.name.toLowerCase().includes(query);

  const childrenByParent = new Map();
  hubs.forEach((h) => {
    if (!h.parentHubId) return;
    if (!childrenByParent.has(h.parentHubId)) childrenByParent.set(h.parentHubId, []);
    childrenByParent.get(h.parentHubId).push(h);
  });
  const topLevelHubs = hubs.filter((h) => !h.parentHubId);
  // A parent hub whose own name doesn't match still shows while searching if one of its
  // branches does — hiding the group would hide the match itself.
  const visibleTopLevelHubs = topLevelHubs.filter((h) => matches(h) || (childrenByParent.get(h.id) || []).some(matches));
  const hubsWithBranches = topLevelHubs.filter((h) => (childrenByParent.get(h.id) || []).length > 0).length;

  const hubActions = (hub) => ({
    onView: () => navigate(`/learning-hubs/${hub.id}/view`),
    // Deactivating a hub also deactivates every learner and teacher tied to it (cascade lives in
    // the server's learning-hub.service.js) — confirm first rather than a silent one-click toggle.
    onToggleStatus: () => setStatusTarget(hub),
    onEdit: () => navigate(`/settings/learning-hubs/${hub.id}/edit`),
    onDelete: () => setDeleteHubTarget(hub),
  });

  const deactivating = statusTarget?.status === "active";
  const branchCount = (childrenByParent.get(statusTarget?.id) || []).length;

  if (hubsLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Learning Hubs</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {hubs.length} learning hub{hubs.length !== 1 ? "s" : ""}
            {hubsWithBranches > 0 && ` · ${hubsWithBranches} with branches — a hub's own admin can switch into its branches`}
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

          {query && visibleTopLevelHubs.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div>
              {visibleTopLevelHubs.map((hub) => (
                <ParentHubGroup
                  key={hub.id}
                  hub={hub}
                  branchHubs={childrenByParent.get(hub.id) || []}
                  hubActions={hubActions}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!statusTarget}
        title={deactivating ? "Deactivate Learning Hub" : "Activate Learning Hub"}
        message={
          deactivating
            ? `"${statusTarget?.name}" will be deactivated. Every learner enrolled here and every educator assigned to it will also be deactivated and lose portal access` +
              (branchCount > 0 ? `, along with its ${branchCount} branch hub${branchCount === 1 ? "" : "s"} and everyone in ${branchCount === 1 ? "it" : "them"}` : "") +
              `. A learner or educator who is still active at another hub keeps their account. Reactivating the hub brings everyone back.`
            : `"${statusTarget?.name}" will be reactivated. Its enrollments and everyone tied to it are set active again` +
              (branchCount > 0 ? `, along with its ${branchCount} branch hub${branchCount === 1 ? "" : "s"}` : "") + `.`
        }
        confirmLabel={deactivating ? "Deactivate" : "Activate"}
        cancelLabel="Cancel"
        variant={deactivating ? "danger" : "default"}
        onConfirm={() => {
          updateHub({ id: statusTarget.id, data: { status: deactivating ? "inactive" : "active" } });
          setStatusTarget(null);
        }}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteHubTarget}
        title="Delete Learning Hub"
        message={
          (childrenByParent.get(deleteHubTarget?.id) || []).length > 0
            ? `"${deleteHubTarget?.name}" will be permanently deleted. Its branch hubs will become standalone (not deleted). This cannot be undone.`
            : `"${deleteHubTarget?.name}" will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteHub(deleteHubTarget.id); setDeleteHubTarget(null); }}
        onCancel={() => setDeleteHubTarget(null)}
      />
    </div>
  );
}
