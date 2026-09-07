import { useState } from "react";
import { FiUserPlus, FiShield } from "react-icons/fi";
import { Modal, Label } from "../../components/Modal";
import { useCreateAdmin } from "../hooks/useAdmins";

const emptyForm = { name: "", email: "", password: "" };

export default function AdminsPanel() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const { mutate: createAdmin, isPending } = useCreateAdmin();

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
    createAdmin(form, {
      onSuccess: () => {
        setForm(emptyForm);
        setErrors({});
        setOpen(false);
      },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0F2645" }}>Admins</h2>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF", maxWidth: "480px", lineHeight: "1.6" }}>
            Each admin manages their own hubs, curricula, courses and assessments — one admin never sees another's data.
            There's no roster shown here; keep track of who you've invited yourself.
          </p>
        </div>
        <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
          <FiUserPlus size={14} strokeWidth={2.2} /> Add Admin
        </button>
      </div>

      <div className="stg-empty">
        <div style={{ marginBottom: "12px", color: "#25476a" }}>
          <FiShield size={40} strokeWidth={1.8} />
        </div>
        <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>Add another admin</p>
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto", lineHeight: "1.6" }}>
          They'll get their own login and their own empty workspace — nothing you've set up carries over to them.
        </p>
        <button type="button" className="stg-btn-primary" onClick={() => setOpen(true)}>
          <FiUserPlus size={14} strokeWidth={2.2} /> Add Admin
        </button>
      </div>

      {open && (
        <Modal
          title="Add Admin"
          subtitle="They'll start with a completely empty workspace of their own."
          onClose={() => { setOpen(false); setErrors({}); }}
          footer={(
            <>
              <button type="button" className="stg-btn-secondary" onClick={() => { setOpen(false); setErrors({}); }}>Cancel</button>
              <button type="button" className="stg-btn-primary" disabled={isPending} onClick={submit}>
                {isPending ? "Creating…" : "Create Admin"}
              </button>
            </>
          )}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <Label>Name</Label>
              <input className="stg-input" value={form.name} onChange={set("name")} placeholder="Full name" />
              {errors.name && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <input className="stg-input" type="email" value={form.email} onChange={set("email")} placeholder="admin@example.com" />
              {errors.email && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.email}</p>}
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
