import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiChevronRight, FiCheckCircle, FiEdit2, FiMapPin, FiSearch, FiTrash2 } from "react-icons/fi";
import { useAllLearningHubsQuery, useDeleteLearningHub, useUpdateLearningHub } from "../../../learning-hubs/hooks/useLearningHub";
import { LEARNING_HUB_TYPES } from "../../../learning-hubs/schemas/learningHub.schema";
import {
  useBranchesQuery,
  useCreateBranch,
  useDeleteBranch,
  useAssignBranchAdmin,
  useUnassignBranchAdmin,
} from "../../../branches/hooks/useBranch";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import PasswordRevealDialog from "../../../../components/ui/PasswordRevealDialog";

const ACCENT = "#25476a";

const STATUS_DOT = { draft: "#feb139", active: "#38aae1", inactive: "#D1D5DB" };
const STATUS_LABEL = { draft: "Draft", active: "Active", inactive: "Inactive" };
const STATUS_BADGE = {
  draft:    { bg: "#fff8e6", color: "#b8860b", border: "#fcd97a" },
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const input = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "9px",
  border: "1.5px solid #E5E7EB",
  fontSize: "13px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.inactive;
  return (
    <span style={{ padding: "1px 8px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0 }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

/* ── Hub row — same as before: view/activate/edit/delete ────────────────── */

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

/* ── Branch admin assign/reassign/unassign — same pattern as before ─────── */

function AdminSection({ branch }) {
  const [showForm, setShowForm] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState(null);
  const { mutate: assignAdmin, isPending: isAssigning } = useAssignBranchAdmin(branch.id);
  const { mutate: unassignAdmin, isPending: isUnassigning } = useUnassignBranchAdmin(branch.id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = (data) => {
    assignAdmin(data, {
      onSuccess: () => {
        reset();
        setShowForm(false);
        setPasswordReveal({ password: data.password, name: data.name });
      },
    });
  };

  const admin = branch.branchAdmin;

  return (
    <div style={{ marginBottom: "12px" }}>
      {admin && !showForm && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "9px", marginBottom: "8px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "600", color: "#111827" }}>{admin.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>{admin.email}</p>
          </div>
          <button type="button" onClick={() => unassignAdmin()} disabled={isUnassigning} style={{ background: "none", border: "none", color: "#EF4444", fontSize: "11.5px", fontWeight: "600", cursor: isUnassigning ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>
            {isUnassigning ? "Removing…" : "Unassign"}
          </button>
        </div>
      )}

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="stg-btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>
          {admin ? "Reassign Admin" : "+ Assign Admin"}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "10px" }}>
          {admin && (
            <p style={{ margin: "0 0 2px", fontSize: "11.5px", color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", padding: "7px 9px" }}>
              This replaces <strong>{admin.name}</strong>.
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <input placeholder="Full name" style={input} {...register("name", { required: true })} />
              {errors.name && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>Required</p>}
            </div>
            <div style={{ flex: 1 }}>
              <input placeholder="Email" type="email" style={input} {...register("email", { required: true })} />
              {errors.email && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>Valid email required</p>}
            </div>
          </div>
          <input placeholder="Password (min 8 characters)" type="password" style={input} {...register("password", { required: true, minLength: 8 })} />
          {errors.password && <p style={{ margin: 0, fontSize: "11px", color: "#EF4444" }}>Min 8 characters</p>}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" disabled={isAssigning} className="stg-btn-primary" style={{ fontSize: "12px", padding: "7px 14px" }}>
              {isAssigning ? "Assigning…" : admin ? "Reassign" : "Assign"}
            </button>
            <button type="button" className="stg-btn-secondary" style={{ fontSize: "12px", padding: "7px 14px" }} onClick={() => { reset(); setShowForm(false); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <PasswordRevealDialog
        isOpen={!!passwordReveal}
        password={passwordReveal?.password}
        subjectName={passwordReveal?.name}
        onClose={() => setPasswordReveal(null)}
      />
    </div>
  );
}

/* ── Branch group — a collapsible section of hubs, with its admin inline ── */

function BranchGroup({ branch, hubs, hubActions, onDeleteBranch }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ marginBottom: "14px" }}>
      <div className="stg-item" style={{ backgroundColor: "#F0F7FF", borderColor: "#C7D9F8" }}>
        <div className="stg-item-top" style={{ cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
          <span style={{ display: "flex", alignItems: "center", color: "#9CA3AF", flexShrink: 0 }}>
            {expanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </span>
          <div className="stg-item-dot" style={{ backgroundColor: ACCENT }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stg-item-name">{branch.name}</div>
            <div className="stg-item-sub">
              {hubs.length} hub{hubs.length !== 1 ? "s" : ""} · {branch.branchAdmin ? branch.branchAdmin.name : "No admin assigned"}
            </div>
          </div>
          <button type="button" className="stg-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDeleteBranch(branch); }} title="Delete branch">
            <FiTrash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <AdminSection branch={branch} />
          {hubs.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No hubs assigned to this branch yet.</p>
          ) : (
            hubs.map((hub) => <LearningHubRow key={hub.id} hub={hub} {...hubActions(hub)} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ── Standalone group — hubs with no branch ──────────────────────────────── */

function StandaloneGroup({ hubs, hubActions }) {
  const [expanded, setExpanded] = useState(true);
  if (hubs.length === 0) return null;

  return (
    <div>
      <div className="stg-item-top" style={{ cursor: "pointer", padding: "8px 4px" }} onClick={() => setExpanded((v) => !v)}>
        <span style={{ display: "flex", alignItems: "center", color: "#9CA3AF", flexShrink: 0 }}>
          {expanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
        </span>
        <span style={{ fontSize: "12px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Standalone · {hubs.length} hub{hubs.length !== 1 ? "s" : ""}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {hubs.map((hub) => <LearningHubRow key={hub.id} hub={hub} {...hubActions(hub)} />)}
        </div>
      )}
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────────────
 * Branches and Learning Hubs used to be separate sub-tabs — this merges them
 * into one list: hubs grouped under their branch (with that branch's admin
 * managed inline), plus a Standalone section for hubs with no branch. */

export default function LearningHubsPanel() {
  const navigate = useNavigate();
  const { data: hubsData, isLoading: hubsLoading } = useAllLearningHubsQuery({ includeDrafts: true });
  const { data: branchesData, isLoading: branchesLoading } = useBranchesQuery();
  const { mutate: deleteHub } = useDeleteLearningHub();
  const { mutate: updateHub } = useUpdateLearningHub();
  const { mutate: createBranch, isPending: isCreatingBranch } = useCreateBranch();
  const { mutate: deleteBranch } = useDeleteBranch();

  const [deleteHubTarget, setDeleteHubTarget] = useState(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [search, setSearch] = useState("");

  const hubs = hubsData?.data || [];
  const branches = branchesData?.data || [];

  const query = search.trim().toLowerCase();
  const filteredHubs = query ? hubs.filter((h) => h.name.toLowerCase().includes(query)) : hubs;

  const hubsByBranch = new Map(branches.map((b) => [b.id, []]));
  const standaloneHubs = [];
  filteredHubs.forEach((hub) => {
    if (hub.branchId && hubsByBranch.has(hub.branchId)) hubsByBranch.get(hub.branchId).push(hub);
    else standaloneHubs.push(hub);
  });

  const hubActions = (hub) => ({
    onView: () => navigate(`/learning-hubs/${hub.id}/view`),
    onActivate: () => updateHub({ id: hub.id, data: { status: "active" } }),
    onEdit: () => navigate(`/settings/learning-hubs/${hub.id}/edit`),
    onDelete: () => setDeleteHubTarget(hub),
  });

  const handleCreateBranch = (e) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    createBranch({ name: branchName.trim() }, { onSuccess: () => { setBranchName(""); setShowBranchForm(false); } });
  };

  if (hubsLoading || branchesLoading) return <div className="stg-spinner" />;

  // A branch with zero hubs still shows (an admin needs to see/manage empty branches), but while
  // actively searching, one with no matching hubs is just noise — hide it.
  const visibleBranches = branches.filter((b) => !query || (hubsByBranch.get(b.id) || []).length > 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Learning Hubs</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {hubs.length} learning hub{hubs.length !== 1 ? "s" : ""} · {branches.length} branch{branches.length !== 1 ? "es" : ""} — grouped hubs share one centralized admin
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="stg-btn-secondary" onClick={() => setShowBranchForm((v) => !v)}>
            + Add Branch
          </button>
          <button type="button" className="stg-btn-primary" onClick={() => navigate("/settings/learning-hubs/create")}>
            + Add Learning Hub
          </button>
        </div>
      </div>

      {showBranchForm && (
        <form onSubmit={handleCreateBranch} style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          <input
            className="stg-input"
            style={{ maxWidth: "320px" }}
            placeholder="Branch name (e.g. Digifunzi)"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={isCreatingBranch || !branchName.trim()} className="stg-btn-primary">
            {isCreatingBranch ? "Creating…" : "Create"}
          </button>
          <button type="button" className="stg-btn-secondary" onClick={() => { setBranchName(""); setShowBranchForm(false); }}>
            Cancel
          </button>
        </form>
      )}

      {hubs.length === 0 && branches.length === 0 ? (
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

          {query && filteredHubs.length === 0 ? (
            <div className="stg-empty" style={{ padding: "40px 24px" }}>
              <div style={{ marginBottom: "10px", color: "#25476a" }}>
                <FiSearch size={32} strokeWidth={1.8} />
              </div>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>No matches for "{search}"</p>
            </div>
          ) : (
            <div>
              {visibleBranches.map((branch) => (
                <BranchGroup
                  key={branch.id}
                  branch={branch}
                  hubs={hubsByBranch.get(branch.id) || []}
                  hubActions={hubActions}
                  onDeleteBranch={setDeleteBranchTarget}
                />
              ))}
              <StandaloneGroup hubs={standaloneHubs} hubActions={hubActions} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteHubTarget}
        title="Delete Learning Hub"
        message={`"${deleteHubTarget?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteHub(deleteHubTarget.id); setDeleteHubTarget(null); }}
        onCancel={() => setDeleteHubTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteBranchTarget}
        title="Delete Branch"
        message={`"${deleteBranchTarget?.name}" will be permanently deleted. Hubs currently under it will become standalone (not deleted). This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteBranch(deleteBranchTarget.id); setDeleteBranchTarget(null); }}
        onCancel={() => setDeleteBranchTarget(null)}
      />
    </div>
  );
}
