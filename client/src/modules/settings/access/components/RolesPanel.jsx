import { useState } from "react";
import { FiCopy, FiEdit2, FiPlus, FiShield, FiTrash2 } from "react-icons/fi";
import { Modal, Label } from "../../components/Modal";
import PermissionMatrix, { ACTION_LABELS } from "./PermissionMatrix";
import { useAccessModules, useAccessRoles, useCreateRole, useDeleteRole, useUpdateRole } from "../hooks/useAccessRoles";

// "Learners: View, Add · Billing: View" — the first few modules a role covers.
function summarise(permissions, modules) {
  const entries = modules.filter((m) => permissions?.[m.key]?.length);
  if (!entries.length) return "No access to any module";
  const text = entries.slice(0, 4).map((m) => `${m.label}: ${permissions[m.key].map((a) => ACTION_LABELS[a]).join(", ")}`).join(" · ");
  return entries.length > 4 ? `${text} · +${entries.length - 4} more` : text;
}

function RoleEditor({ initial, title, modules, actions, saving, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const submit = () => {
    if (!form.name.trim()) return setError("Give the role a name");
    onSave({ name: form.name.trim(), description: form.description.trim(), permissions: form.permissions });
  };
  return (
    <Modal
      title={title}
      subtitle="Changes apply to everyone with this role on their next action."
      width={760}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="stg-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="stg-btn-primary" disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save role"}</button>
        </>
      )}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <Label>Role name</Label>
            <input className="stg-input" maxLength={100} value={form.name} onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(""); }} placeholder="e.g. Programme coordinator" />
            {error && <p style={{ margin: "5px 0 0", fontSize: 12, color: "#DC2626" }}>{error}</p>}
          </div>
          <div>
            <Label>Description (optional)</Label>
            <input className="stg-input" maxLength={255} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this role is for" />
          </div>
        </div>
        <div>
          <Label>What this role can do</Label>
          <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
            <strong>Add</strong> creates new records · <strong>Edit</strong> changes existing ones and what's inside them · <strong>Delete</strong> removes records.
            Click a column heading to tick it for every module. Staff/role management always stays with you.
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
            Competencies, pathways, system levels and items from Settings can always be <strong>used</strong> in the modules that need them
            (for example, picking competencies while building an assessment). The Settings row only controls who can <strong>change</strong> them.
          </p>
          <PermissionMatrix modules={modules} actions={actions} value={form.permissions} onChange={(permissions) => setForm((f) => ({ ...f, permissions }))} />
        </div>
      </div>
    </Modal>
  );
}

const EMPTY_ROLE = { name: "", description: "", permissions: {} };

export default function RolesPanel() {
  const { data: registry } = useAccessModules();
  const { data: roles, isLoading } = useAccessRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [editor, setEditor] = useState(null); // { mode: "create" | "edit", role }

  const modules = registry?.modules || [];
  const actions = registry?.actions || ["view", "create", "edit", "delete"];
  const list = roles || [];

  const openCreate = (from) => setEditor({
    mode: "create",
    role: from ? { name: `Copy of ${from.name}`.slice(0, 100), description: from.description || "", permissions: from.permissions || {} } : EMPTY_ROLE,
  });
  const openEdit = (role) => setEditor({ mode: "edit", role: { id: role.id, name: role.name, description: role.description || "", permissions: role.permissions || {} } });
  const save = (data) => {
    const done = { onSuccess: () => setEditor(null) };
    if (editor.mode === "edit") updateRole.mutate({ id: editor.role.id, ...data }, done);
    else createRole.mutate(data, done);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F2645" }}>Roles & access</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9CA3AF", maxWidth: 520, lineHeight: 1.6 }}>
            A role is a set of permissions — which modules someone can view, add to, edit and delete in. Give each staff member a role in the Staff tab.
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => openCreate(null)}>
          <FiPlus size={14} strokeWidth={2.2} /> New role
        </button>
      </div>

      {isLoading && <div className="stg-spinner" />}

      {!isLoading && list.length > 0 && (
        <div className="stg-list">
          {list.map((role) => (
            <div key={role.id} className="stg-item">
              <div className="stg-item-top">
                <span style={{ color: "#25476a", display: "inline-flex" }}><FiShield size={15} /></span>
                <div className="stg-item-name">{role.name}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: role.staffCount ? "#1D4ED8" : "#9CA3AF", background: role.staffCount ? "#EFF6FF" : "#F3F4F6", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
                  {role.staffCount} staff
                </span>
                <button type="button" className="stg-icon-btn" title="Edit role" onClick={() => openEdit(role)}><FiEdit2 size={14} strokeWidth={2.2} /></button>
                <button type="button" className="stg-icon-btn" title="Duplicate role" onClick={() => openCreate(role)}><FiCopy size={14} strokeWidth={2.2} /></button>
                <button
                  type="button"
                  className="stg-icon-btn danger"
                  title={role.staffCount ? "Give its staff another role before deleting it" : "Delete role"}
                  disabled={role.staffCount > 0}
                  style={role.staffCount > 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                  onClick={() => { if (window.confirm(`Delete the role "${role.name}"?`)) deleteRole.mutate(role.id); }}
                >
                  <FiTrash2 size={14} strokeWidth={2.2} />
                </button>
              </div>
              {role.description && <div className="stg-item-sub">{role.description}</div>}
              <div className="stg-item-sub" style={{ marginTop: 2 }}>{summarise(role.permissions, modules)}</div>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <RoleEditor
          key={editor.role.id || "new"}
          title={editor.mode === "edit" ? `Edit role — ${editor.role.name}` : "New role"}
          initial={editor.role}
          modules={modules}
          actions={actions}
          saving={createRole.isPending || updateRole.isPending}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
