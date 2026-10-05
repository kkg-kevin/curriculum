import { useState } from "react";
import toast from "react-hot-toast";
import { FiKey, FiTrash2, FiUserPlus } from "react-icons/fi";
import { useCreateSupervisor, useRemoveSupervisor, useSupervisors, useUpdateSupervisor } from "../hooks/useClaims";
import { Dialog, T, ghostButton, inputStyle, primaryButton } from "../shared";

const label = { display: "block", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: T.ink };
const EMPTY = { name: "", email: "", password: "" };

// Supervisor accounts: logins that only review educators' claims. Created here; an educator is
// given their supervisor on the educator form. A supervisor signs in on the normal login page
// and lands on their own page of claims to review.
export default function SupervisorsDialog({ onClose }) {
  const { data: supervisors = [], isLoading } = useSupervisors();
  const create = useCreateSupervisor();
  const update = useUpdateSupervisor();
  const remove = useRemoveSupervisor();
  const [form, setForm] = useState(EMPTY);
  const [resetting, setResetting] = useState(null); // { id, password }
  const busy = create.isPending || update.isPending || remove.isPending;

  const failed = (err, fallback) => toast.error(err.errors?.[0]?.message || err.message || fallback);
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email.trim()) && form.password.length >= 8;

  const add = async (event) => {
    event.preventDefault();
    try {
      await create.mutateAsync({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success("Supervisor account created — share the email and password with them");
      setForm(EMPTY);
    } catch (err) {
      failed(err, "Could not create the supervisor");
    }
  };

  const savePassword = async () => {
    try {
      await update.mutateAsync({ id: resetting.id, password: resetting.password });
      toast.success("Password changed");
      setResetting(null);
    } catch (err) {
      failed(err, "Could not change the password");
    }
  };

  const onRemove = async (supervisor) => {
    const consequence = supervisor.educators
      ? ` Their ${supervisor.educators} ${supervisor.educators === 1 ? "educator" : "educators"} will have no supervisor, and any claims waiting on them will come to the admin instead.`
      : "";
    if (!window.confirm(`Remove ${supervisor.name}? They will no longer be able to sign in.${consequence}`)) return;
    try {
      await remove.mutateAsync(supervisor.id);
      toast.success("Supervisor removed");
    } catch (err) {
      failed(err, "Could not remove the supervisor");
    }
  };

  return (
    <Dialog title="Supervisors" subtitle="Accounts that review educators' claims. Pick an educator's supervisor on the educator form." onClose={onClose} busy={busy} width={620}>
      {isLoading ? <p style={{ margin: 0, padding: "20px 0", textAlign: "center", fontSize: 14, color: T.inkMuted }}>Loading…</p> : supervisors.length === 0 ? (
        <p style={{ margin: 0, padding: "18px 16px", borderRadius: 12, background: "#fff", border: `1.5px dashed ${T.tintBorder}`, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>
          No supervisors yet. Until an educator has one, their claims come straight to the admin to approve and pay.
        </p>
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, background: "#fff", overflow: "hidden" }}>
          {supervisors.map((supervisor, index) => (
            <div key={supervisor.id} style={{ padding: "11px 14px", borderTop: index ? "1px solid #F1F5F9" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{supervisor.name}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{supervisor.email} · {supervisor.educators} {supervisor.educators === 1 ? "educator" : "educators"}</p>
                </div>
                <button type="button" disabled={busy} onClick={() => setResetting(resetting?.id === supervisor.id ? null : { id: supervisor.id, password: "" })} style={{ ...ghostButton, padding: "7px 11px", fontSize: 12.5 }}><FiKey size={13} /> Password</button>
                <button type="button" disabled={busy} onClick={() => onRemove(supervisor)} aria-label={`Remove ${supervisor.name}`} style={{ ...ghostButton, padding: "7px 10px", color: "#B91C1C", borderColor: "#FECACA" }}><FiTrash2 size={14} /></button>
              </div>
              {resetting?.id === supervisor.id && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input type="text" autoFocus value={resetting.password} onChange={(e) => setResetting({ id: supervisor.id, password: e.target.value })} placeholder="New password (8 characters or more)" aria-label={`New password for ${supervisor.name}`} style={{ ...inputStyle, flex: "1 1 220px", width: "auto" }} />
                  <button type="button" disabled={busy || resetting.password.length < 8} onClick={savePassword} style={primaryButton(busy || resetting.password.length < 8)}>Save password</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} style={{ marginTop: 20, padding: 16, borderRadius: 14, background: "#fff", border: `1px solid ${T.border}` }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: T.ink }}>Add a supervisor</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div>
            <label htmlFor="supervisor-name" style={label}>Name</label>
            <input id="supervisor-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="supervisor-email" style={label}>Email</label>
            <input id="supervisor-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="supervisor-password" style={label}>Password</label>
            <input id="supervisor-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" placeholder="8 characters or more" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 12, color: T.inkMuted, lineHeight: 1.5, flex: "1 1 240px" }}>The email must not already be used by an educator, staff member or anyone else — a supervisor has a login of their own.</p>
          <button type="submit" disabled={!valid || busy} style={primaryButton(!valid || busy)}><FiUserPlus size={15} /> {create.isPending ? "Creating…" : "Create supervisor"}</button>
        </div>
      </form>
    </Dialog>
  );
}
