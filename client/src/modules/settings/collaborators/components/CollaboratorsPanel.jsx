import { useState } from "react";
import { FiUserPlus, FiUsers, FiSettings, FiX } from "react-icons/fi";
import { Modal, Label } from "../../components/Modal";
import { useCollaborators, useInviteCollaborator, useUpdateCollaboratorRole, useRevokeCollaborator } from "../hooks/useCollaborators";
import { useAccessRoles } from "../../access/hooks/useAccessRoles";
import PersonPickerField from "./PersonPickerField";
import { MODULE_OPTIONS } from "../moduleRegistry";

const emptyForm = { name: "", email: "", password: "", roleId: "" };

// Staff accounts (role "collaborator") get their access from a role — Settings → Roles & access.
// A staff member invited before roles existed and not yet given one still has their old module
// list, shown here until a role is chosen.
function legacyAccess(c) {
  if (c.allowedModules == null) return "All modules (set before roles)";
  if (!c.allowedModules.length) return "No modules (set before roles)";
  return `${MODULE_OPTIONS.filter((m) => c.allowedModules.includes(m.key)).map((m) => m.label).join(", ")} (set before roles)`;
}

function RoleSelect({ roles, value, onChange }) {
  const selected = roles.find((r) => r.id === value);
  return (
    <div>
      <select className="stg-input" value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a role</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {selected?.description && <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6B7280", lineHeight: "1.5" }}>{selected.description}</p>}
      <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>Create or change roles in Settings → Roles & access.</p>
    </div>
  );
}

export default function CollaboratorsPanel() {
  const { data: collaborators, isLoading } = useCollaborators();
  const { data: roleRows } = useAccessRoles();
  const roles = roleRows || [];
  const { mutate: invite, isPending: isInviting } = useInviteCollaborator();
  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateCollaboratorRole();
  const { mutate: revoke } = useRevokeCollaborator();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingCollaborator, setEditingCollaborator] = useState(null);
  const [editRoleId, setEditRoleId] = useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters";
    if (!form.roleId) next.roleId = "Choose a role";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    invite(form, {
      onSuccess: () => {
        setForm(emptyForm);
        setErrors({});
        setOpen(false);
      },
    });
  };

  const openEdit = (c) => {
    setEditingCollaborator(c);
    setEditRoleId(c.roleId || "");
  };
  const closeEdit = () => setEditingCollaborator(null);
  const saveEdit = () => {
    if (!editRoleId) return;
    updateRole({ id: editingCollaborator.id, roleId: editRoleId }, { onSuccess: closeEdit });
  };

  const list = collaborators || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Staff</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF", maxWidth: "480px", lineHeight: "1.6" }}>
            People who help run your workspace. What each person can do comes from their role — set roles up in Roles &amp; access. Managing staff and roles always stays with you.
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
          <FiUserPlus size={14} strokeWidth={2.2} /> Invite staff member
        </button>
      </div>

      {isLoading && <div className="stg-spinner" />}

      {!isLoading && list.length === 0 && (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiUsers size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No staff yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Invite someone to help build out your workspace with you.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
            <FiUserPlus size={14} strokeWidth={2.2} /> Invite staff member
          </button>
        </div>
      )}

      {!isLoading && list.length > 0 && (
        <div className="stg-list">
          {list.map((c) => (
            <div key={c.id} className="stg-item">
              <div className="stg-item-top">
                <span className="stg-item-dot" style={{ background: "#38aae1" }} />
                <div className="stg-item-name">{c.name}</div>
                <button type="button" className="stg-icon-btn" title="Change role" onClick={() => openEdit(c)}>
                  <FiSettings size={15} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="stg-icon-btn danger"
                  title="Remove staff member"
                  onClick={() => { if (window.confirm(`Remove ${c.name}? Their login will stop working.`)) revoke(c.id); }}
                >
                  <FiX size={16} strokeWidth={2.2} />
                </button>
              </div>
              <div className="stg-item-sub">{c.email}</div>
              <div className="stg-item-sub" style={{ marginTop: "2px" }}>
                {c.role ? <>Role: <strong style={{ color: "#25476a" }}>{c.role.name}</strong></> : c.roleId ? "Role deleted — choose a new one (no access until then)" : legacyAccess(c)}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title="Invite staff member"
          subtitle="They'll get their own login, with the access their role gives them."
          onClose={() => { setOpen(false); setErrors({}); }}
          footer={(
            <>
              <button type="button" className="stg-btn-secondary" onClick={() => { setOpen(false); setErrors({}); }}>Cancel</button>
              <button type="button" className="stg-btn-primary" disabled={isInviting} onClick={submit}>
                {isInviting ? "Inviting…" : "Invite"}
              </button>
            </>
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <PersonPickerField onPick={({ name, email }) => setForm((f) => ({ ...f, name, email }))} />
              <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#9CA3AF", lineHeight: "1.5" }}>
                Picking someone here just fills in their name and email below — they'll still get a brand-new, separate staff login (their existing teacher/portal login is unaffected).
              </p>
            </div>
            <div>
              <Label>Name</Label>
              <input className="stg-input" value={form.name} onChange={set("name")} placeholder="Full name" />
              {errors.name && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <input className="stg-input" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
              {errors.email && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.email}</p>}
              <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Using the same email as an existing teacher/hub login will fail — staff need their own address.
              </p>
            </div>
            <div>
              <Label>Password</Label>
              <input className="stg-input" type="password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" />
              {errors.password && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.password}</p>}
            </div>
            <div>
              <Label>Role</Label>
              <RoleSelect roles={roles} value={form.roleId} onChange={(roleId) => { setForm((f) => ({ ...f, roleId })); setErrors((e) => ({ ...e, roleId: undefined })); }} />
              {errors.roleId && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.roleId}</p>}
            </div>
          </div>
        </Modal>
      )}

      {editingCollaborator && (
        <Modal
          title={`Change role — ${editingCollaborator.name}`}
          subtitle="Takes effect on their very next action."
          onClose={closeEdit}
          footer={(
            <>
              <button type="button" className="stg-btn-secondary" onClick={closeEdit}>Cancel</button>
              <button type="button" className="stg-btn-primary" disabled={isUpdatingRole || !editRoleId} onClick={saveEdit}>
                {isUpdatingRole ? "Saving…" : "Save"}
              </button>
            </>
          )}
        >
          <Label>Role</Label>
          <RoleSelect roles={roles} value={editRoleId} onChange={setEditRoleId} />
        </Modal>
      )}
    </div>
  );
}
