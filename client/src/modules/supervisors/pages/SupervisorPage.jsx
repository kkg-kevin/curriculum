import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiEdit2, FiInbox, FiKey, FiLogIn, FiMail, FiPhone, FiTrash2, FiUserMinus, FiUserPlus, FiUsers } from "react-icons/fi";
import { useSetSupervisorEducators, useSupervisor, useSupervisorEducatorOptions, useUpdateSupervisor } from "../../claims/hooks/useClaims";
import { usePermissions } from "../../../hooks/usePermissions";
import RemovePersonDialog from "../../removals/components/RemovePersonDialog";
import EducatorPicker from "../components/EducatorPicker";
import { HistoryButton } from "../../activity/components/RecordStamp";
import { T, cardStyle, formatDate } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";

/*
 * One supervisor (People → Supervisors → a supervisor, 17 Nov 2026): who they are, what's waiting
 * on them, and the educators they look after — assign more, or take one off. Edit their details,
 * set a new password, or remove them (deactivate → hand over → delete, modules/removals/).
 */
const ROLE_LABEL = { teacher: "Educator", collaborator: "Staff", admin: "Admin", school: "Learning hub", learner: "Parent", affiliate: "Affiliate" };
const field = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "inherit", color: T.ink };
const button = (kind = "ghost") => ({
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  border: kind === "primary" ? "none" : kind === "danger" ? "1.5px solid #FECACA" : `1.5px solid ${T.border}`,
  background: kind === "primary" ? T.accent : "#fff", color: kind === "primary" ? "#fff" : kind === "danger" ? "#B91C1C" : T.ink,
});

function Modal({ title, onClose, children, width = 620 }) {
  return (
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(17,32,51,0.45)" }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ width: "100%", maxWidth: width, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#fff", borderRadius: 18, padding: "18px 20px 20px", fontFamily: "Inter, sans-serif", boxShadow: "0 24px 64px rgba(17,32,51,0.28)" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 900, color: T.ink }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function SupervisorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can("claims-approval", "edit");
  const { data: s, isLoading, isError } = useSupervisor(id);
  const update = useUpdateSupervisor();
  const setEducators = useSetSupervisorEducators();
  const [editing, setEditing] = useState(null);
  const [password, setPassword] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [removing, setRemoving] = useState(false);
  const options = useSupervisorEducatorOptions();

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: T.inkMuted }}>Loading…</p>;
  if (isError || !s) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <Link to="/supervisors" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none" }}><FiArrowLeft size={14} /> Supervisors</Link>
        <p style={{ marginTop: 14, color: "#B91C1C", fontSize: 14 }}>This supervisor couldn&apos;t be found.</p>
      </div>
    );
  }

  const saveDetails = () => update.mutate({ id, name: editing.name.trim(), phone: editing.phone.trim(), jobTitle: editing.jobTitle.trim() }, {
    onSuccess: () => { toast.success("Details saved"); setEditing(null); },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't save"),
  });
  const savePassword = () => update.mutate({ id, password }, {
    onSuccess: () => { toast.success("Password changed — let them know"); setPassword(null); },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't change the password"),
  });
  const saveEducators = (ids, message) => setEducators.mutate({ id, teacherIds: [...ids] }, {
    onSuccess: () => { toast.success(message); setAssigning(null); },
    onError: (err) => toast.error(err?.response?.data?.message || "Couldn't save the educators"),
  });
  const current = new Set(s.educatorList.map((e) => e.id));

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <Link to="/supervisors" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Supervisors</Link>

      <section style={{ ...cardStyle, padding: "20px 22px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <Avatar name={s.name} photo={s.photo} size={64} />
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {s.name}
            <span style={{ padding: "3px 10px", borderRadius: 999, background: T.tintBg, color: T.accent, fontSize: 11.5, fontWeight: 800 }}>Supervisor</span>
            {s.otherRoles.map((r) => <span key={r} style={{ padding: "3px 10px", borderRadius: 999, background: "#F3F4F6", color: "#374151", fontSize: 11.5, fontWeight: 800 }}>Also {ROLE_LABEL[r] || r}</span>)}
            {s.deactivated && <span style={{ padding: "3px 10px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", fontSize: 11.5, fontWeight: 800 }}>Deactivated</span>}
          </h1>
          {s.jobTitle && <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "#374151", fontWeight: 600 }}>{s.jobTitle}</p>}
          <div style={{ display: "flex", gap: "6px 18px", flexWrap: "wrap", marginTop: 8, fontSize: 13, color: T.inkMuted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiMail size={13} /> {s.email}</span>
            {s.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiPhone size={13} /> {s.phone}</span>}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiCalendar size={13} /> Added {formatDate(s.createdAt)}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FiLogIn size={13} /> {s.lastSignInAt ? `Last signed in ${formatDate(s.lastSignInAt)}` : "Not signed in yet"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <HistoryButton type="users" id={s.id} label={s.name} />
          {canManage && <button type="button" onClick={() => setEditing({ name: s.name, phone: s.phone || "", jobTitle: s.jobTitle || "" })} style={button()}><FiEdit2 size={14} /> Edit details</button>}
          {canManage && <button type="button" onClick={() => setPassword("")} style={button()}><FiKey size={14} /> New password</button>}
          {canManage && <button type="button" onClick={() => setRemoving(true)} style={button("danger")}><FiTrash2 size={14} /> Remove</button>}
        </div>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {[[FiUsers, s.educators, "Educators they look after"], [FiInbox, s.claimsWaiting, "Claims waiting on them"], [FiCheckCircle, s.claimsDecided, "Claims they've decided"]].map(([Icon, value, labelText]) => (
          <div key={labelText} style={{ ...cardStyle, flex: "1 1 180px", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><Icon size={18} /></span>
            <div><p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink }}>{value}</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.inkMuted }}>{labelText}</p></div>
          </div>
        ))}
      </div>

      <section style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Educators they look after</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>Their claims go to {s.name.split(/\s+/)[0]} first; their QA, training work, parent feedback and check-ins show in the supervisor portal.</p>
          </div>
          {canManage && <button type="button" onClick={() => setAssigning(new Set(current))} style={button("primary")}><FiUserPlus size={14} /> Choose educators</button>}
        </div>
        {s.educatorList.length === 0 && <p style={{ margin: 0, padding: 18, fontSize: 13, color: T.inkMuted }}>No educators yet — choose the ones they&apos;ll look after.</p>}
        {s.educatorList.map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 18px", borderTop: "1px solid #F3F4F6" }}>
            <Avatar name={e.name} photo={e.photo} size={36} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <Link to={`/teachers/${e.id}/view`} style={{ fontSize: 14, fontWeight: 800, color: T.ink, textDecoration: "none" }}>{e.name}</Link>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>{[e.email, e.hubs.join(", ")].filter(Boolean).join(" · ") || "No school yet"}</p>
            </div>
            {e.status !== "active" && <span style={{ padding: "2px 9px", borderRadius: 999, background: "#FFFBEB", color: "#B45309", fontSize: 11.5, fontWeight: 800 }}>{e.status.replace("_", " ")}</span>}
            {canManage && (
              <button type="button" disabled={setEducators.isPending} onClick={() => { const n = new Set(current); n.delete(e.id); saveEducators(n, `${e.name} no longer has a supervisor`); }} style={{ ...button(), padding: "6px 10px", fontSize: 12.5 }}>
                <FiUserMinus size={13} /> Take off
              </button>
            )}
          </div>
        ))}
      </section>

      {editing && (
        <Modal title="Edit details" onClose={() => setEditing(null)} width={480}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[["name", "Full name"], ["phone", "Phone"], ["jobTitle", "Job title"]].map(([k, l]) => (
              <label key={k} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700, color: T.ink }}>{l}<input value={editing[k]} onChange={(ev) => setEditing({ ...editing, [k]: ev.target.value })} style={field} /></label>
            ))}
            <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>The email is their sign-in and doesn&apos;t change here.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setEditing(null)} style={button()}>Cancel</button>
              <button type="button" disabled={!editing.name.trim() || update.isPending} onClick={saveDetails} style={button("primary")}>Save</button>
            </div>
          </div>
        </Modal>
      )}
      {password !== null && (
        <Modal title={`New password for ${s.name}`} onClose={() => setPassword(null)} width={460}>
          <input autoFocus type="text" value={password} onChange={(ev) => setPassword(ev.target.value)} placeholder="8 characters or more" style={field} />
          <p style={{ margin: "8px 0 14px", fontSize: 12, color: T.inkMuted }}>{s.otherRoles.length ? "This is their one sign-in — the password changes for their other roles too." : "Share it with them; they can change it from My Profile."}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setPassword(null)} style={button()}>Cancel</button>
            <button type="button" disabled={password.length < 8 || update.isPending} onClick={savePassword} style={button("primary")}>Save password</button>
          </div>
        </Modal>
      )}
      {assigning && (
        <Modal title={`Educators ${s.name.split(/\s+/)[0]} looks after`} onClose={() => setAssigning(null)}>
          <EducatorPicker options={options.data || []} selected={assigning} onChange={setAssigning} supervisorId={s.id} loading={options.isLoading} excludeEmail={s.email} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button type="button" onClick={() => setAssigning(null)} style={button()}>Cancel</button>
            <button type="button" disabled={setEducators.isPending} onClick={() => saveEducators(assigning, "Educators saved")} style={button("primary")}>Save · {assigning.size} educator{assigning.size === 1 ? "" : "s"}</button>
          </div>
        </Modal>
      )}
      <RemovePersonDialog open={removing} kind="supervisor" id={s.id} name={s.name} onClose={() => setRemoving(false)} onRemoved={() => { setRemoving(false); navigate("/supervisors"); }} />
    </div>
  );
}
