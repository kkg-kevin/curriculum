import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../auth/services/authApi";
import ImageUploadField from "../../../components/ImageUploadField";
import ChangePasswordCard from "../../auth/components/ChangePasswordCard";
import EmailNotificationSettings from "../../../components/ui/EmailNotificationSettings";
import { T, cardStyle } from "../../learner-portal/components/profile/theme";

const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 14, fontFamily: "Inter, sans-serif" };
const label = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink };
const detailsOf = (user) => ({ name: user?.name || "", phone: user?.phone || "" });

// The parent's own account — their details, password and which emails they get. Each child's
// login is on that child's page.
export default function ParentAccountPage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState(detailsOf(user));
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(detailsOf(user)), [user]);

  const saved = detailsOf(user);
  const dirty = form.name.trim() !== saved.name || form.phone.trim() !== saved.phone;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Your name is required");
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ name: form.name.trim(), phone: form.phone.trim() });
      updateUser({ name: updated.name, phone: updated.phone });
      toast.success("Details saved");
    } catch (err) {
      toast.error(err.message || "Could not save your details");
    } finally {
      setSaving(false);
    }
  };

  const savePhoto = async (url) => {
    try {
      await authApi.updateMe({ photo: url });
      updateUser({ photo: url });
    } catch (err) {
      toast.error(err.message || "Could not update your photo");
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink }}>My account</h1>

      <form onSubmit={submit} style={{ ...cardStyle({ padding: "20px" }), display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ImageUploadField label="Photo" value={user?.photo || null} onChange={savePhoto} width="120px" height="120px" avatar />
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={label}>
            Name
            <input style={input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={150} autoComplete="name" />
          </label>
          <label style={label}>
            Phone
            <input style={input} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="e.g. 0712 345 678" />
          </label>
          <label style={label}>
            Email
            <input style={{ ...input, background: "#F3F4F6", color: T.inkMuted }} value={user?.email || ""} readOnly disabled />
            <span style={{ fontWeight: 400, fontSize: 11.5, color: T.inkFaint }}>The email you sign in with — your children&apos;s hub uses it to reach you.</span>
          </label>
          <button type="submit" disabled={!dirty || saving} style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 10, border: "none", background: !dirty || saving ? "#9CB4C9" : T.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: !dirty || saving ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <ChangePasswordCard />

      <div style={{ ...cardStyle({ padding: "18px 20px" }) }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800, color: T.ink }}>Emails</h2>
        <EmailNotificationSettings padding={0} />
      </div>
    </div>
  );
}
