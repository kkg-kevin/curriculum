import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiLock, FiMail, FiUser } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { authApi } from "../../auth/services/authApi";
import { BRAND, FONT, card, cardHeading, pill } from "../../../theme/brand";
import { affiliatesApi, errorOf, formatDay } from "../services/affiliatesApi";

// My account (/affiliate-portal/account) — someone signed in as Affiliate: their name and phone
// (kept on their affiliate record and their login — PUT /api/affiliates/me), the email they sign in
// with (staff change it), and their password. How they're paid is on Refer & earn.

const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 14, fontFamily: FONT, color: BRAND.ink, background: "#fff" };
const label = { display: "grid", gap: 6, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft };
const primary = (disabled) => ({ alignSelf: "flex-start", padding: "10px 16px", borderRadius: 10, border: "none", background: BRAND.navy, color: "#fff", fontSize: 13.5, fontWeight: 800, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 });
const STATUS = { active: ["Active", "good"], pending: ["Waiting for approval", "waiting"], suspended: ["Paused", "neutral"] };

// Fits the device: on a phone the cards stack edge to edge with less padding, fields are 16px (so
// iPhones don't zoom in when one is tapped) and buttons thumb-sized.
const PAGE_CSS = `
  .af-account { font-family: ${FONT}; display: grid; gap: 16px; width: 100%; min-width: 0; }
  .af-account h1 { margin: 0; font-size: 26px; font-weight: 900; color: ${BRAND.ink}; letter-spacing: -0.5px; }
  .af-account__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; align-items: start; }
  @media (max-width: 640px) {
    .af-account { gap: 12px; }
    .af-account h1 { font-size: 22px; }
    .af-account__cards { grid-template-columns: 100%; gap: 12px; }
    .af-account__cards > form, .af-account__cards > section { padding: 16px !important; }
    .af-account input { font-size: 16px !important; min-height: 44px; }
    .af-account button { min-height: 44px; }
  }
`;

function DetailsCard({ affiliate }) {
  const qc = useQueryClient();
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ name: affiliate.name || "", phone: affiliate.phone || "" });
  useEffect(() => setForm({ name: affiliate.name || "", phone: affiliate.phone || "" }), [affiliate.name, affiliate.phone]);
  const save = useMutation({
    mutationFn: () => affiliatesApi.updateMine({ name: form.name.trim(), phone: form.phone.trim() || null }),
    onSuccess: (d) => {
      qc.setQueryData(["affiliates", "me"], d);
      updateUser({ name: d.affiliate?.name, phone: d.affiliate?.phone });
      toast.success("Saved");
    },
    onError: (err) => toast.error(errorOf(err)),
  });
  const changed = form.name.trim() !== (affiliate.name || "") || form.phone.trim() !== (affiliate.phone || "");
  const [statusLabel, statusTone] = STATUS[affiliate.status] || STATUS.active;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (changed && form.name.trim().length >= 2) save.mutate(); }} style={{ ...card, padding: 20, display: "grid", gap: 14, alignContent: "start" }}>
      <h2 style={cardHeading}><FiUser size={13} /> Your details</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: BRAND.muted }}>
        <span style={pill(statusTone)}>{statusLabel}</span>
        <span>Affiliate since {formatDay(affiliate.createdAt)} · code <strong style={{ color: BRAND.ink, letterSpacing: "0.04em" }}>{affiliate.code}</strong></span>
      </div>
      <label style={label}>Name<input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required /></label>
      <label style={label}>Phone<input style={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" inputMode="tel" placeholder="07…" /></label>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <FiMail size={15} color={BRAND.muted} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft }}>Email — you sign in with this</div>
          <div style={{ fontSize: 14, color: BRAND.ink, overflowWrap: "anywhere" }}>{affiliate.email || "—"}</div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>To change it, ask our team.</div>
        </div>
      </div>
      {affiliate.termsAcceptedAt && <p style={{ margin: 0, fontSize: 12, color: BRAND.muted }}>You agreed to the affiliate terms on {formatDay(affiliate.termsAcceptedAt)}.</p>}
      <button type="submit" style={primary(!changed || save.isPending)} disabled={!changed || save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
    </form>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [saving, setSaving] = useState(false);
  const mismatch = form.again.length > 0 && form.next !== form.again;
  const valid = form.current && form.next.length >= 8 && form.next === form.again;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      toast.success("Password changed");
      setForm({ current: "", next: "", again: "" });
    } catch (err) {
      toast.error(err.errors?.[0]?.message || err.message || "Could not change the password");
    } finally {
      setSaving(false);
    }
  };
  const field = (key, name, autoComplete, hint) => (
    <label style={label}>{name}
      <input type="password" autoComplete={autoComplete} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ ...input, borderColor: key === "again" && mismatch ? BRAND.danger : BRAND.border }} />
      {hint && <span style={{ fontSize: 11.5, fontWeight: 500, color: key === "again" && mismatch ? BRAND.danger : BRAND.muted }}>{hint}</span>}
    </label>
  );
  return (
    <form onSubmit={submit} style={{ ...card, padding: 20, display: "grid", gap: 14, alignContent: "start" }}>
      <h2 style={cardHeading}><FiLock size={13} /> Change password</h2>
      {field("current", "Current password", "current-password")}
      {field("next", "New password", "new-password", "8 characters or more.")}
      {field("again", "New password again", "new-password", mismatch ? "The two new passwords don't match." : undefined)}
      <button type="submit" style={primary(!valid || saving)} disabled={!valid || saving}>{saving ? "Saving…" : "Change password"}</button>
    </form>
  );
}

export default function AffiliateAccountPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["affiliates", "me"], queryFn: affiliatesApi.mine });
  if (isLoading) return <p style={{ fontFamily: FONT, color: BRAND.muted }}>Loading…</p>;
  if (error) return <p style={{ fontFamily: FONT, color: BRAND.danger }}>{errorOf(error)}</p>;
  return (
    <div className="af-account">
      <style>{PAGE_CSS}</style>
      <div>
        <h1>My Account</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: BRAND.muted }}>Your details and your password. How you&rsquo;re paid is on Refer &amp; Earn.</p>
      </div>
      <div className="af-account__cards">
        {data.affiliate ? <DetailsCard affiliate={data.affiliate} /> : <section style={{ ...card, padding: 20, color: BRAND.muted, fontSize: 13.5 }}>You&rsquo;re no longer in the referral programme.</section>}
        <PasswordCard />
      </div>
    </div>
  );
}
