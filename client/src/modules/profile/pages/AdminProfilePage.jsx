import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../auth/services/authApi";
import ImageUploadField from "../../../components/ImageUploadField";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";
import { useWorkspaceUsers } from "../../settings/users/hooks/useWorkspaceUsers";
import { SettingsPage, SettingsSection, Field, FieldGrid, FooterNote } from "../../settings/components/SettingsLayout";
import { useSettingsStyles } from "../../settings/components/settingsStyles";

const errorText = (err, fallback) => err.response?.data?.errors?.[0]?.message || err.response?.data?.message || err.message || fallback;
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : null);
const detailsOf = (user) => ({ name: user?.name || "", jobTitle: user?.jobTitle || "", phone: user?.phone || "" });

function Avatar({ user, size = 72 }) {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#25476a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 2.6, fontWeight: 700, overflow: "hidden", flexShrink: 0 }}>
      {user?.photo ? <img src={user.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
    </div>
  );
}

function SummaryCard({ user, admins }) {
  const others = admins.filter((a) => a.id !== user.id);
  return (
    <SettingsSection
      title={(
        <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar user={user} />
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{user.name || "Your name"}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#6B7280" }}>{[user.jobTitle, user.email].filter(Boolean).join(" · ")}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA3AF" }}>
              Admin{formatDate(user.createdAt) ? ` · member since ${formatDate(user.createdAt)}` : ""}{others.length ? ` · ${others.length + 1} admins in your organisation` : ""}
            </span>
          </span>
        </span>
      )}
    />
  );
}

function DetailsSection({ user, updateUser }) {
  const [form, setForm] = useState(detailsOf(user));
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  useEffect(() => setForm(detailsOf(user)), [user]);

  const saved = detailsOf(user);
  const dirty = Object.keys(form).some((k) => form[k].trim() !== saved[k]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Your name is required");
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ name: form.name.trim(), jobTitle: form.jobTitle.trim(), phone: form.phone.trim() });
      updateUser({ name: updated.name, jobTitle: updated.jobTitle, phone: updated.phone });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorText(err, "Could not save your profile"));
    } finally {
      setSaving(false);
    }
  };

  const savePhoto = async (url) => {
    setSavingPhoto(true);
    try {
      await authApi.updateMe({ photo: url });
      updateUser({ photo: url });
    } catch (err) {
      toast.error(errorText(err, "Could not update your photo"));
    } finally {
      setSavingPhoto(false);
    }
  };

  return (
    <SettingsSection
      as="form"
      onSubmit={submit}
      title="Personal details"
      description="How you appear to the rest of your team."
      footer={(
        <>
          <button type="submit" className="stg-btn-primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</button>
          {savingPhoto && <FooterNote>Saving photo…</FooterNote>}
        </>
      )}
    >
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Field note="Saved as soon as you choose it.">
          <ImageUploadField label="Photo" value={user.photo || null} onChange={savePhoto} width="140px" height="140px" avatar />
        </Field>
        <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldGrid>
            <Field label="Name" htmlFor="profile-name">
              <input id="profile-name" className="stg-input" value={form.name} onChange={set("name")} maxLength={150} autoComplete="name" />
            </Field>
            <Field label="Job title" htmlFor="profile-title">
              <input id="profile-title" className="stg-input" value={form.jobTitle} onChange={set("jobTitle")} maxLength={100} placeholder="e.g. Programme Director" />
            </Field>
          </FieldGrid>
          <FieldGrid>
            <Field label="Phone" htmlFor="profile-phone">
              <input id="profile-phone" className="stg-input" value={form.phone} onChange={set("phone")} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="e.g. 0712 345 678" />
            </Field>
            <Field label="Email" htmlFor="profile-email" note="The email you sign in with. It can't be changed here yet.">
              <input id="profile-email" className="stg-input" value={user.email || ""} readOnly disabled style={{ background: "#F3F4F6", color: "#6B7280" }} />
            </Field>
          </FieldGrid>
        </div>
      </div>
    </SettingsSection>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const tooShort = form.next.length > 0 && form.next.length < 8;
  const mismatch = form.again.length > 0 && form.again !== form.next;
  const ready = form.current && form.next.length >= 8 && form.again === form.next;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      setForm({ current: "", next: "", again: "" });
      toast.success("Password changed");
    } catch (err) {
      toast.error(errorText(err, "Could not change your password"));
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";
  return (
    <SettingsSection
      as="form"
      onSubmit={submit}
      title="Password"
      description="Change the password you sign in with. We'll email you to confirm it changed."
      aside={(
        <button type="button" onClick={() => setShow((s) => !s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", color: "#25476a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {show ? <FiEyeOff size={14} /> : <FiEye size={14} />} {show ? "Hide" : "Show"} passwords
        </button>
      )}
      footer={<button type="submit" className="stg-btn-primary" disabled={!ready || saving}>{saving ? "Changing…" : "Change password"}</button>}
    >
      <FieldGrid>
        <Field label="Current password" htmlFor="pw-current">
          <input id="pw-current" className="stg-input" type={type} value={form.current} onChange={set("current")} autoComplete="current-password" />
        </Field>
        <Field label="New password" htmlFor="pw-next" warning={tooShort ? "At least 8 characters." : null} note={tooShort ? null : "At least 8 characters."}>
          <input id="pw-next" className="stg-input" type={type} value={form.next} onChange={set("next")} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-again" warning={mismatch ? "Doesn't match the new password." : null}>
          <input id="pw-again" className="stg-input" type={type} value={form.again} onChange={set("again")} autoComplete="new-password" />
        </Field>
      </FieldGrid>
    </SettingsSection>
  );
}

function OrganisationSection({ user, admins, isLoading }) {
  return (
    <SettingsSection
      title="Your organisation"
      description="Every admin here has the same rights over the workspace."
      footer={<Link to="/settings?tab=people&section=admins" style={{ fontSize: 13, fontWeight: 700, color: "#25476a", textDecoration: "none" }}>Manage admins →</Link>}
    >
      {isLoading ? <FooterNote>Loading…</FooterNote> : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
          {admins.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #F3F4F6", borderRadius: 10 }}>
              <Avatar user={a} size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{a.name || a.email}{a.id === user.id ? <span style={{ fontWeight: 600, color: "#9CA3AF" }}> (you)</span> : null}</div>
                <div style={{ fontSize: 12, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

// My profile — the signed-in admin's own account: photo, name, job title and phone, password,
// which emails they get, and who else administers the organisation. Admins only for now; other
// accounts have their own portal profile pages.
export default function AdminProfilePage() {
  const { user, updateUser } = useAuth();
  const { data: workspace, isLoading: adminsLoading } = useWorkspaceUsers();
  useSettingsStyles();

  if (user && user.role !== "admin") return <Navigate to="/" replace />;
  if (!user) return null;

  const admins = (workspace?.users || []).filter((u) => u.type === "admin");
  const self = admins.find((a) => a.id === user.id);
  const roster = self ? admins.map((a) => (a.id === user.id ? { ...a, ...user } : a)) : [{ ...user }, ...admins];

  return (
    <div className="stg-card" style={{ fontFamily: "Inter, sans-serif" }}>
      <SettingsPage title="My profile" description="Your own account. Workspace-wide settings are in Settings.">
        <SummaryCard user={user} admins={roster} />
        <DetailsSection user={user} updateUser={updateUser} />
        <PasswordSection />
        <SettingsSection title="Emails you receive" description="Your own choice, for your account only. What the whole workspace sends is set in Settings → Emails.">
          <div style={{ maxWidth: 520 }}><EmailNotificationSettings padding="0" /></div>
        </SettingsSection>
        <OrganisationSection user={user} admins={roster} isLoading={adminsLoading} />
      </SettingsPage>
    </div>
  );
}
