import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEdit2, FiGlobe, FiPackage, FiPlus } from "react-icons/fi";
import { homeLearningApi } from "../services/homeLearningApi";

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 9, padding: "9px 11px", fontSize: 14, background: "#fff" };
const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
const checkLabel = { display: "flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 13, fontWeight: 600 };
const smallButton = { border: "1px solid #D1D5DB", borderRadius: 7, color: "#4B5563", background: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 };
const formatMoney = (amount) => `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

const EMPTY = { name: "", slug: "", summary: "", description: "", childrenIncluded: "1", monthlyAmount: "", allowExtraChildren: false, extraChildAmount: "", maxChildren: "", features: "", badge: "", isPublished: true, status: "active", sortOrder: "0" };

const toForm = (pkg) => ({
  name: pkg.name, slug: pkg.slug, summary: pkg.summary || "", description: pkg.description || "",
  childrenIncluded: String(pkg.childrenIncluded), monthlyAmount: String(pkg.monthlyAmount),
  allowExtraChildren: !!pkg.allowExtraChildren, extraChildAmount: pkg.extraChildAmount != null ? String(pkg.extraChildAmount) : "",
  maxChildren: pkg.allowExtraChildren ? String(pkg.maxChildren) : "", features: (pkg.features || []).join("\n"),
  badge: pkg.badge || "", isPublished: !!pkg.isPublished, status: pkg.status, sortOrder: String(pkg.sortOrder ?? 0),
});

const toPayload = (form) => ({
  name: form.name,
  slug: form.slug,
  summary: form.summary,
  description: form.description,
  childrenIncluded: Number(form.childrenIncluded),
  monthlyAmount: Number(form.monthlyAmount),
  allowExtraChildren: form.allowExtraChildren,
  extraChildAmount: form.allowExtraChildren && form.extraChildAmount !== "" ? Number(form.extraChildAmount) : null,
  maxChildren: form.allowExtraChildren && form.maxChildren !== "" ? Number(form.maxChildren) : undefined,
  features: form.features.split("\n").map((line) => line.trim()).filter(Boolean),
  badge: form.badge,
  isPublished: form.isPublished,
  status: form.status,
  sortOrder: Number(form.sortOrder || 0),
});

function PackageForm({ initial, isEdit, onSubmit, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(toPayload(form)); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14, padding: 16, background: "#F8FAFC", borderRadius: 12 }}>
    <label style={labelStyle}>Package name<input style={inputStyle} required maxLength={150} value={form.name} onChange={set("name")} placeholder="e.g. Three children" /></label>
    <label style={labelStyle}>Children included<input style={inputStyle} required type="number" min={1} max={50} value={form.childrenIncluded} onChange={set("childrenIncluded")} /></label>
    <label style={labelStyle}>Monthly price (KSh)<input style={inputStyle} required type="number" min={0} step={1} value={form.monthlyAmount} onChange={set("monthlyAmount")} /></label>
    <label style={labelStyle}>Badge (optional)<input style={inputStyle} maxLength={40} value={form.badge} onChange={set("badge")} placeholder="e.g. Most popular" /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Short summary (shown on the card)<input style={inputStyle} maxLength={300} value={form.summary} onChange={set("summary")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Description (optional)<textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} maxLength={5000} value={form.description} onChange={set("description")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>What's included — one per line<textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.features} onChange={set("features")} placeholder={"Weekly home visits by a Digifunzi educator\nAll learning materials\nTermly progress report"} /></label>
    <label style={{ ...checkLabel, gridColumn: "1/-1" }}><input type="checkbox" checked={form.allowExtraChildren} onChange={set("allowExtraChildren")} /> Families can add more children to this package</label>
    {form.allowExtraChildren && <>
      <label style={labelStyle}>Price per extra child (KSh / month)<input style={inputStyle} required type="number" min={0} step={1} value={form.extraChildAmount} onChange={set("extraChildAmount")} /></label>
      <label style={labelStyle}>Maximum children<input style={inputStyle} type="number" min={Number(form.childrenIncluded || 1) + 1} max={50} value={form.maxChildren} onChange={set("maxChildren")} placeholder="20" /></label>
    </>}
    {isEdit && <label style={labelStyle}>Web address slug<input style={inputStyle} maxLength={160} value={form.slug} onChange={set("slug")} /></label>}
    <label style={labelStyle}>Display order<input style={inputStyle} type="number" min={0} max={999} value={form.sortOrder} onChange={set("sortOrder")} /></label>
    <label style={labelStyle}>Status<select style={inputStyle} value={form.status} onChange={set("status")}><option value="active">Active — can be sold</option><option value="archived">Archived — no longer offered</option></select></label>
    <label style={{ ...checkLabel, alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={form.isPublished && form.status === "active"} disabled={form.status !== "active"} onChange={set("isPublished")} /> Show on the website</label>
    <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button disabled={saving} style={{ border: 0, borderRadius: 9, padding: "10px 16px", color: "#fff", background: "#25476a", fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving…" : isEdit ? "Save package" : "Create package"}</button>
      <button type="button" onClick={onCancel} style={smallButton}>Cancel</button>
      {isEdit && <span style={{ fontSize: 12, color: "#6B7280" }}>Price changes apply to new households. Existing households keep their price until you change their package.</span>}
    </div>
  </form>;
}

// Home Learning → Packages: the packages households are sold on. Ticking "Show on the website"
// publishes a package to the website's Home Schooling page (GET /api/public/home-learning/packages).
export default function PackagesPanel({ packages, isLoading }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null); // package id, "new", or null
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home-learning"] });
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? homeLearningApi.updatePackage(id, data) : homeLearningApi.createPackage(data)),
    onSuccess: (_, { id }) => { refresh(); setEditingId(null); toast.success(id ? "Package saved" : "Package created"); },
    onError: (error) => toast.error(errorMessage(error, "Could not save package")),
  });
  const quickMutation = useMutation({
    mutationFn: ({ pkg, changes }) => homeLearningApi.updatePackage(pkg.id, { ...toPayload(toForm(pkg)), ...changes }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, "Could not update package")),
  });
  const deleteMutation = useMutation({
    mutationFn: homeLearningApi.deletePackage,
    onSuccess: () => { refresh(); toast.success("Package deleted"); },
    onError: (error) => toast.error(errorMessage(error, "Could not delete package")),
  });

  return <section style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 22, boxShadow: "0 2px 8px rgba(15,23,42,.04)", marginBottom: 22 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 17, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><FiPackage /> Packages</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>What families can sign up for. Packages marked <strong>On website</strong> appear on the website's Home Schooling page, and enquiries from there arrive in Enquiries with the package attached.</p>
      </div>
      {editingId !== "new" && <button type="button" onClick={() => setEditingId("new")} style={{ ...smallButton, borderColor: "#25476a", color: "#25476a", padding: "8px 12px" }}><FiPlus /> New package</button>}
    </div>

    {editingId === "new" && <PackageForm initial={EMPTY} onSubmit={(data) => saveMutation.mutate({ id: null, data })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />}

    {isLoading ? <p style={{ color: "#6B7280", fontSize: 13 }}>Loading packages…</p> : packages.length === 0 && editingId !== "new"
      ? <p style={{ color: "#6B7280", fontSize: 13, marginTop: 14 }}>No packages yet — create one so households can be added and the website has something to show.</p>
      : <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {packages.map((pkg) => editingId === pkg.id
          ? <PackageForm key={pkg.id} initial={toForm(pkg)} isEdit onSubmit={(data) => saveMutation.mutate({ id: pkg.id, data })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />
          : <div key={pkg.id} style={{ border: "1px solid #EEF1F5", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", opacity: pkg.status === "archived" ? 0.65 : 1 }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{pkg.name}</strong>
                {pkg.badge && <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E", background: "#FEF3C7", borderRadius: 999, padding: "2px 8px" }}>{pkg.badge}</span>}
                {pkg.status === "archived"
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", background: "#F3F4F6", borderRadius: 999, padding: "2px 8px" }}>Archived</span>
                  : pkg.isPublished
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: "#047857", background: "#ECFDF5", borderRadius: 999, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}><FiGlobe /> On website</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", background: "#F3F4F6", borderRadius: 999, padding: "2px 8px" }}>Hidden from website</span>}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                {pkg.childrenIncluded} {pkg.childrenIncluded === 1 ? "child" : "children"} · <strong style={{ color: "#25476a" }}>{formatMoney(pkg.monthlyAmount)}/month</strong>
                {pkg.allowExtraChildren && <> · +{formatMoney(pkg.extraChildAmount)} per extra child (up to {pkg.maxChildren})</>}
                {" · "}{pkg.householdCount} household{pkg.householdCount === 1 ? "" : "s"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pkg.status === "active" && <button type="button" disabled={quickMutation.isPending} onClick={() => quickMutation.mutate({ pkg, changes: { isPublished: !pkg.isPublished } })} style={smallButton}><FiGlobe /> {pkg.isPublished ? "Hide from website" : "Show on website"}</button>}
              <button type="button" onClick={() => setEditingId(pkg.id)} style={smallButton}><FiEdit2 /> Edit</button>
              <button type="button" disabled={quickMutation.isPending} onClick={() => quickMutation.mutate({ pkg, changes: pkg.status === "active" ? { status: "archived", isPublished: false } : { status: "active" } })} style={smallButton}>{pkg.status === "active" ? "Archive" : "Restore"}</button>
              {pkg.householdCount === 0 && <button type="button" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete the "${pkg.name}" package?`)) deleteMutation.mutate(pkg.id); }} style={{ ...smallButton, color: "#B91C1C" }}>Delete</button>}
            </div>
          </div>)}
      </div>}
  </section>;
}
