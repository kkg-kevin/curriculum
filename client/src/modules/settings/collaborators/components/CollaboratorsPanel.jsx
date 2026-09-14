import { useState } from "react";
import { FiUserPlus, FiUsers, FiX } from "react-icons/fi";
import { Modal, Label } from "../../components/Modal";
import { useCollaborators, useInviteCollaborator, useRevokeCollaborator } from "../hooks/useCollaborators";
import PersonPickerField from "./PersonPickerField";

const emptyForm = { name: "", email: "", password: "" };

export default function CollaboratorsPanel() {
  const { data: collaborators, isLoading } = useCollaborators();
  const { mutate: invite, isPending: isInviting } = useInviteCollaborator();
  const { mutate: revoke } = useRevokeCollaborator();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters";
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

  const list = collaborators || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Collaborators</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF", maxWidth: "480px", lineHeight: "1.6" }}>
            A collaborator can create and edit anything in your workspace — hubs, curricula, courses, assessments, classes, educators, learners, bootcamps, competitions and settings — but can't delete records or manage other collaborators.
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
          <FiUserPlus size={14} strokeWidth={2.2} /> Invite Collaborator
        </button>
      </div>

      {isLoading && <div className="stg-spinner" />}

      {!isLoading && list.length === 0 && (
        <div className="stg-empty">
          <div style={{ marginBottom: "12px", color: "#25476a" }}>
            <FiUsers size={40} strokeWidth={1.8} />
          </div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No collaborators yet</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
            Invite someone to help build out your workspace with you.
          </p>
          <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
            <FiUserPlus size={14} strokeWidth={2.2} /> Invite Collaborator
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
                <button
                  type="button"
                  className="stg-icon-btn danger"
                  title="Remove collaborator"
                  onClick={() => { if (window.confirm(`Remove ${c.name} as a collaborator?`)) revoke(c.id); }}
                >
                  <FiX size={16} strokeWidth={2.2} />
                </button>
              </div>
              <div className="stg-item-sub">{c.email}</div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title="Invite Collaborator"
          subtitle="They'll get their own login with edit access to your whole workspace."
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
                Picking someone here just fills in their name and email below — they'll still get a brand-new, separate collaborator login (their existing teacher/portal login is unaffected).
              </p>
            </div>
            <div>
              <Label>Name</Label>
              <input className="stg-input" value={form.name} onChange={set("name")} placeholder="Full name" />
              {errors.name && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <input className="stg-input" type="email" value={form.email} onChange={set("email")} placeholder="collaborator@example.com" />
              {errors.email && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.email}</p>}
              <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Using the same email as an existing teacher/hub login will fail — collaborators need their own address.
              </p>
            </div>
            <div>
              <Label>Password</Label>
              <input className="stg-input" type="password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" />
              {errors.password && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.password}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
