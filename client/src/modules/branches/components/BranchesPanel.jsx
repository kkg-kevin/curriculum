import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { FiTrash2, FiUsers } from "react-icons/fi";
import {
  useBranchesQuery,
  useCreateBranch,
  useDeleteBranch,
  useAssignBranchAdmin,
  useUnassignBranchAdmin,
} from "../hooks/useBranch";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import PasswordRevealDialog from "../../../components/ui/PasswordRevealDialog";

const ACCENT = "#25476a";

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

/* ── Admin assign/reassign/unassign — same pattern as CurriculumAdminsCard ─────────────── */

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
    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #E5E7EB" }}>
      {admin && !showForm && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6", borderRadius: "9px", marginBottom: "8px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "600", color: "#111827" }}>{admin.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>{admin.email}</p>
          </div>
          <button type="button" onClick={() => unassignAdmin()} disabled={isUnassigning} style={{ background: "none", border: "none", color: "#EF4444", fontSize: "11.5px", fontWeight: "600", cursor: isUnassigning ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>
            {isUnassigning ? "Removing…" : "Unassign"}
          </button>
        </div>
      )}
      {!admin && !showForm && (
        <p style={{ margin: "0 0 8px", fontSize: "12.5px", color: "#9CA3AF" }}>No branch admin assigned.</p>
      )}

      {!showForm && (
        <button type="button" onClick={() => setShowForm(true)} className="stg-btn-secondary" style={{ fontSize: "12px", padding: "6px 12px" }}>
          {admin ? "Reassign Admin" : "+ Assign Admin"}
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px" }}>
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
            <button type="button" onClick={() => { reset(); setShowForm(false); }} className="stg-btn-secondary" style={{ fontSize: "12px", padding: "7px 14px" }}>
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

/* ── Hubs list — every hub currently assigned to this branch ──────────────────────────── */

const HUB_STATUS_DOT = { draft: "#feb139", active: "#38aae1", inactive: "#D1D5DB" };

function HubsSection({ branch }) {
  const navigate = useNavigate();
  const { data, isLoading } = useAllLearningHubsQuery({ branchId: branch.id, includeDrafts: true });
  const hubs = data?.data || [];

  if (isLoading) return <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "#9CA3AF" }}>Loading hubs…</p>;

  return (
    <div style={{ marginTop: "12px", marginBottom: "12px" }}>
      {hubs.length === 0 ? (
        <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>No hubs assigned to this branch yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {hubs.map((hub) => (
            <div
              key={hub.id}
              onClick={() => navigate(`/learning-hubs/${hub.id}/view`)}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6", borderRadius: "8px", cursor: "pointer" }}
            >
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0, backgroundColor: HUB_STATUS_DOT[hub.status] || HUB_STATUS_DOT.inactive }} />
              <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#111827", flex: 1, minWidth: 0 }}>{hub.name}</span>
              {hub.code && <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{hub.code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Row ─────────────────────────────────────────────────────────────────────────────── */

function BranchRow({ branch, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="stg-item">
      <div className="stg-item-top" style={{ cursor: "pointer" }} onClick={() => setExpanded((v) => !v)}>
        <div className="stg-item-dot" style={{ backgroundColor: ACCENT }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="stg-item-name">{branch.name}</div>
          <div className="stg-item-sub">
            {branch.hubCount} hub{branch.hubCount !== 1 ? "s" : ""} · {branch.branchAdmin ? branch.branchAdmin.name : "No admin assigned"}
          </div>
        </div>
        <button type="button" className="stg-icon-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
          <FiTrash2 size={14} strokeWidth={2} />
        </button>
      </div>
      {expanded && (
        <>
          <HubsSection branch={branch} />
          <AdminSection branch={branch} />
        </>
      )}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────────────────────── */

export default function BranchesPanel() {
  const { data, isLoading } = useBranchesQuery();
  const { mutate: createBranch, isPending: isCreating } = useCreateBranch();
  const { mutate: deleteBranch } = useDeleteBranch();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [name, setName] = useState("");

  const branches = data?.data || [];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createBranch({ name: name.trim() }, { onSuccess: () => { setName(""); setShowForm(false); } });
  };

  if (isLoading) return <div className="stg-spinner" />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Branches</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            Group related hubs (e.g. multiple locations of the same network) under one centralized admin.
          </p>
        </div>
        {!showForm && (
          <button type="button" className="stg-btn-primary" onClick={() => setShowForm(true)}>
            + Add Branch
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
          <input
            className="stg-input"
            style={{ maxWidth: "320px" }}
            placeholder="Branch name (e.g. Digifunzi)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={isCreating || !name.trim()} className="stg-btn-primary">
            {isCreating ? "Creating…" : "Create"}
          </button>
          <button type="button" className="stg-btn-secondary" onClick={() => { setName(""); setShowForm(false); }}>
            Cancel
          </button>
        </form>
      )}

      {branches.length === 0 ? (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: ACCENT }}>
            <FiUsers size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No branches yet</p>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Create one to group related hubs together under a single centralized admin.
          </p>
        </div>
      ) : (
        <div className="stg-list">
          {branches.map((branch) => (
            <BranchRow key={branch.id} branch={branch} onDelete={() => setDeleteTarget(branch)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Branch"
        message={`"${deleteTarget?.name}" will be permanently deleted. Hubs currently under it will become standalone (not deleted). This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { deleteBranch(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
