import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEdit2, FiGlobe, FiPackage, FiPlus } from "react-icons/fi";
import { billingApi } from "../services/billingApi";
import { techClubApi } from "../../tech-clubs/services/techClubApi";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { BILLING_PERIODS, periodHow, periodUnit, pricePer } from "../../../utils/billingPeriods";

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 9, padding: "9px 11px", fontSize: 14, background: "#fff" };
const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
const checkLabel = { display: "flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 13, fontWeight: 600 };
const smallButton = { border: "1px solid #D1D5DB", borderRadius: 7, color: "#4B5563", background: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 };
const formatMoney = (amount) => `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

const EMPTY = { name: "", slug: "", summary: "", description: "", childrenIncluded: "1", billingPeriod: "monthly", amount: "", allowExtraChildren: false, extraChildAmount: "", maxChildren: "", features: "", badge: "", isPublished: true, status: "active", sortOrder: "0", hubIds: [] };

// The two kinds of package managed here. Home Learning is the original panel, unchanged; Tech Club
// packages add which clubs a package is offered at (none ticked = every club).
const PROGRAMMES = {
  home_learning: {
    title: "Home Learning packages",
    intro: <>What Home Learning families sign up for, billed daily, weekly, monthly, quarterly or yearly — invoices go out automatically. Households pick one of these on the Home Learning page. Packages marked <strong>On website</strong> appear on the website's Home Schooling page, and enquiries from there arrive in Enquiries with the package attached.</>,
    queryKey: ["billing", "packages"],
    refreshKeys: [["home-learning"]],
    list: billingApi.listPackages, create: billingApi.createPackage, update: billingApi.updatePackage, remove: billingApi.deletePackage, checkRemove: billingApi.checkDeletePackage,
    count: (pkg) => pkg.householdCount, noun: ["household", "households"],
    featuresPlaceholder: "Weekly home visits by a Digifunzi educator\nAll learning materials\nTermly progress report",
    namePlaceholder: "e.g. Three children",
    empty: "No packages yet — create one so households can be added and the website has something to show.",
    editNote: "Price and billing changes apply to new households. Existing households keep theirs until you change their package — and then from their next billing period.",
  },
  tech_club: {
    title: "Tech Club packages",
    intro: <>What families pay to join an Estate Tech Club, billed daily, weekly, monthly, quarterly or yearly — invoices go out automatically. Packages marked <strong>On website</strong> appear on the club pages of the website, where parents sign up and pay; the sign-ups arrive on the Tech Clubs page for you to approve.</>,
    queryKey: ["billing", "club-packages"],
    refreshKeys: [["tech-clubs"]],
    list: billingApi.listClubPackages, create: billingApi.createClubPackage, update: billingApi.updateClubPackage, remove: billingApi.deleteClubPackage, checkRemove: billingApi.checkDeleteClubPackage,
    count: (pkg) => pkg.membershipCount, noun: ["family", "families"],
    featuresPlaceholder: "Coding, robotics and AI sessions\nAll club materials\nTermly progress report",
    namePlaceholder: "e.g. One child",
    empty: "No club packages yet — create one so families can sign up for a club on the website.",
    editNote: "Price and billing changes apply to new sign-ups. Existing families keep theirs until you change their package — and then from their next billing period.",
    withClubs: true,
  },
};

const toForm = (pkg) => ({
  name: pkg.name, slug: pkg.slug, summary: pkg.summary || "", description: pkg.description || "",
  childrenIncluded: String(pkg.childrenIncluded), billingPeriod: pkg.billingPeriod || "monthly", amount: String(pkg.amount),
  allowExtraChildren: !!pkg.allowExtraChildren, extraChildAmount: pkg.extraChildAmount != null ? String(pkg.extraChildAmount) : "",
  maxChildren: pkg.allowExtraChildren ? String(pkg.maxChildren) : "", features: (pkg.features || []).join("\n"),
  badge: pkg.badge || "", isPublished: !!pkg.isPublished, status: pkg.status, sortOrder: String(pkg.sortOrder ?? 0),
  hubIds: Array.isArray(pkg.hubIds) ? pkg.hubIds : [],
});

// `withClubs` adds the club list — only Tech Club packages have one.
const toPayload = (form, withClubs = false) => ({
  ...(withClubs ? { hubIds: form.hubIds } : {}),
  name: form.name,
  slug: form.slug,
  summary: form.summary,
  description: form.description,
  childrenIncluded: Number(form.childrenIncluded),
  billingPeriod: form.billingPeriod,
  amount: Number(form.amount),
  // A daily package is billed at month end, so it's never offered on the website.
  isPublished: form.billingPeriod === "daily" ? false : form.isPublished,
  allowExtraChildren: form.allowExtraChildren,
  extraChildAmount: form.allowExtraChildren && form.extraChildAmount !== "" ? Number(form.extraChildAmount) : null,
  maxChildren: form.allowExtraChildren && form.maxChildren !== "" ? Number(form.maxChildren) : undefined,
  features: form.features.split("\n").map((line) => line.trim()).filter(Boolean),
  badge: form.badge,
  status: form.status,
  sortOrder: Number(form.sortOrder || 0),
});

// Which clubs a Tech Club package is offered at. None ticked = every club.
function ClubPicker({ clubs, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return <fieldset style={{ gridColumn: "1/-1", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px", margin: 0 }}>
    <legend style={{ ...labelStyle, padding: "0 4px" }}>Offered at</legend>
    <label style={{ ...checkLabel, marginBottom: 6 }}><input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} /> Every club</label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
      {clubs.map((club) => <label key={club.id} style={{ ...checkLabel, fontWeight: 500 }}>
        <input type="checkbox" checked={value.includes(club.id)} onChange={() => toggle(club.id)} /> {club.name}{club.status !== "active" ? " (not live)" : ""}
      </label>)}
      {clubs.length === 0 && <span style={{ fontSize: 12, color: "#6B7280" }}>No clubs yet — clubs are your non-school learning hubs.</span>}
    </div>
  </fieldset>;
}

function PackageForm({ initial, isEdit, onSubmit, onCancel, saving, config, clubs }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(toPayload(form, config.withClubs)); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14, padding: 16, background: "#F8FAFC", borderRadius: 12 }}>
    <label style={labelStyle}>Package name<input style={inputStyle} required maxLength={150} value={form.name} onChange={set("name")} placeholder={config.namePlaceholder} /></label>
    <label style={labelStyle}>Children included<input style={inputStyle} required type="number" min={1} max={50} value={form.childrenIncluded} onChange={set("childrenIncluded")} /></label>
    <label style={labelStyle}>Billed<select style={inputStyle} value={form.billingPeriod} onChange={set("billingPeriod")}>
      {BILLING_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
    </select></label>
    <label style={labelStyle}>Price per {periodUnit(form.billingPeriod)} (KSh)<input style={inputStyle} required type="number" min={0} step={1} value={form.amount} onChange={set("amount")} /></label>
    <p style={{ gridColumn: "1/-1", margin: "-4px 0 0", fontSize: 12, color: "#6B7280" }}>{periodHow(form.billingPeriod)}</p>
    <label style={labelStyle}>Badge (optional)<input style={inputStyle} maxLength={40} value={form.badge} onChange={set("badge")} placeholder="e.g. Most popular" /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Short summary (shown on the card)<input style={inputStyle} maxLength={300} value={form.summary} onChange={set("summary")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Description (optional)<textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} maxLength={5000} value={form.description} onChange={set("description")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>What's included — one per line<textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.features} onChange={set("features")} placeholder={config.featuresPlaceholder} /></label>
    {config.withClubs && <ClubPicker clubs={clubs} value={form.hubIds} onChange={(hubIds) => setForm((current) => ({ ...current, hubIds }))} />}
    <label style={{ ...checkLabel, gridColumn: "1/-1" }}><input type="checkbox" checked={form.allowExtraChildren} onChange={set("allowExtraChildren")} /> Families can add more children to this package</label>
    {form.allowExtraChildren && <>
      <label style={labelStyle}>Price per extra child (KSh / {periodUnit(form.billingPeriod)})<input style={inputStyle} required type="number" min={0} step={1} value={form.extraChildAmount} onChange={set("extraChildAmount")} /></label>
      <label style={labelStyle}>Maximum children<input style={inputStyle} type="number" min={Number(form.childrenIncluded || 1) + 1} max={50} value={form.maxChildren} onChange={set("maxChildren")} placeholder="20" /></label>
    </>}
    {isEdit && <label style={labelStyle}>Web address slug<input style={inputStyle} maxLength={160} value={form.slug} onChange={set("slug")} /></label>}
    <label style={labelStyle}>Display order<input style={inputStyle} type="number" min={0} max={999} value={form.sortOrder} onChange={set("sortOrder")} /></label>
    <label style={labelStyle}>Status<select style={inputStyle} value={form.status} onChange={set("status")}><option value="active">Active — can be sold</option><option value="archived">Archived — no longer offered</option></select></label>
    <label style={{ ...checkLabel, alignSelf: "end", paddingBottom: 10 }} title={form.billingPeriod === "daily" ? "A daily package is billed at the end of each month, so it can't be offered on the website" : undefined}><input type="checkbox" checked={form.isPublished && form.status === "active" && form.billingPeriod !== "daily"} disabled={form.status !== "active" || form.billingPeriod === "daily"} onChange={set("isPublished")} /> Show on the website</label>
    <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button disabled={saving} style={{ border: 0, borderRadius: 9, padding: "10px 16px", color: "#fff", background: "#25476a", fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving…" : isEdit ? "Save package" : "Create package"}</button>
      <button type="button" onClick={onCancel} style={smallButton}>Cancel</button>
      {isEdit && <span style={{ fontSize: 12, color: "#6B7280" }}>{config.editNote}</span>}
    </div>
  </form>;
}

// Billing → Packages: the Home Learning packages households are billed on (moved here from the
// Home Learning page, which now only picks from them), and — with programme="tech_club" — the
// Estate Tech Club packages. Ticking "Show on the website" publishes a package to the website's
// Home Schooling page (GET /api/public/home-learning/packages) or its club pages
// (GET /api/public/clubs/packages).
export default function PackagesPanel({ programme = "home_learning" }) {
  const config = PROGRAMMES[programme];
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null); // package id, "new", or null
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: packageRows, isLoading } = useQuery({ queryKey: config.queryKey, queryFn: config.list });
  const packages = Array.isArray(packageRows) ? packageRows : [];
  // The clubs a Tech Club package can be limited to (shares the Tech Clubs page's cache).
  const { data: clubRows } = useQuery({ queryKey: ["tech-clubs", "clubs"], queryFn: techClubApi.getClubs, enabled: !!config.withClubs });
  const clubs = Array.isArray(clubRows) ? clubRows : [];
  const clubNames = new Map(clubs.map((club) => [club.id, club.name]));
  // Households / memberships show their package's name and price, so their list refreshes too.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: config.queryKey });
    config.refreshKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? config.update(id, data) : config.create(data)),
    onSuccess: (_, { id }) => { refresh(); setEditingId(null); toast.success(id ? "Package saved" : "Package created"); },
    onError: (error) => toast.error(errorMessage(error, "Could not save package")),
  });
  const quickMutation = useMutation({
    mutationFn: ({ pkg, changes }) => config.update(pkg.id, { ...toPayload(toForm(pkg), config.withClubs), ...changes }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, "Could not update package")),
  });
  const deleteMutation = useMutation({
    mutationFn: config.remove,
    onSuccess: () => { refresh(); toast.success("Package deleted"); },
    onError: (error) => toast.error(errorMessage(error, "Could not delete package")),
  });

  return <section style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 22, boxShadow: "0 2px 8px rgba(15,23,42,.04)", marginBottom: 22 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        <h2 style={{ fontSize: 17, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}><FiPackage /> {config.title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{config.intro}</p>
      </div>
      {editingId !== "new" && <button type="button" onClick={() => setEditingId("new")} style={{ ...smallButton, borderColor: "#25476a", color: "#25476a", padding: "8px 12px" }}><FiPlus /> New package</button>}
    </div>

    {editingId === "new" && <PackageForm initial={EMPTY} config={config} clubs={clubs} onSubmit={(data) => saveMutation.mutate({ id: null, data })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />}

    {isLoading ? <p style={{ color: "#6B7280", fontSize: 13 }}>Loading packages…</p> : packages.length === 0 && editingId !== "new"
      ? <p style={{ color: "#6B7280", fontSize: 13, marginTop: 14 }}>{config.empty}</p>
      : <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {packages.map((pkg) => editingId === pkg.id
          ? <PackageForm key={pkg.id} initial={toForm(pkg)} isEdit config={config} clubs={clubs} onSubmit={(data) => saveMutation.mutate({ id: pkg.id, data })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />
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
                {pkg.childrenIncluded} {pkg.childrenIncluded === 1 ? "child" : "children"} · <strong style={{ color: "#25476a" }}>{pricePer(pkg.amount, pkg.billingPeriod)}</strong>
                {pkg.allowExtraChildren && <> · +{formatMoney(pkg.extraChildAmount)} per extra child (up to {pkg.maxChildren})</>}
                {" · "}{config.count(pkg)} {config.noun[config.count(pkg) === 1 ? 0 : 1]}
              </div>
              {config.withClubs && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {pkg.hubIds?.length ? `At ${pkg.hubIds.map((id) => clubNames.get(id) || "a removed club").join(", ")}` : "At every club"}
              </div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pkg.status === "active" && pkg.billingPeriod !== "daily" && <button type="button" disabled={quickMutation.isPending} onClick={() => quickMutation.mutate({ pkg, changes: { isPublished: !pkg.isPublished } })} style={smallButton}><FiGlobe /> {pkg.isPublished ? "Hide from website" : "Show on website"}</button>}
              <button type="button" onClick={() => setEditingId(pkg.id)} style={smallButton}><FiEdit2 /> Edit</button>
              <button type="button" disabled={quickMutation.isPending} onClick={() => quickMutation.mutate({ pkg, changes: pkg.status === "active" ? { status: "archived", isPublished: false } : { status: "active" } })} style={smallButton}>{pkg.status === "active" ? "Archive" : "Restore"}</button>
              {config.count(pkg) === 0 && <button type="button" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(pkg)} style={{ ...smallButton, color: "#B91C1C" }}>Delete</button>}
            </div>
          </div>)}
      </div>}

    <ConfirmDialog
      isOpen={!!deleteTarget}
      title="Delete package"
      message={`The "${deleteTarget?.name}" package will be permanently deleted. This cannot be undone.`}
      confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
      onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
      onCancel={() => setDeleteTarget(null)}
      usageCheck={() => config.checkRemove(deleteTarget.id)}
      onAlternative={deleteTarget?.status === "active" ? () => { quickMutation.mutate({ pkg: deleteTarget, changes: { status: "archived", isPublished: false } }); setDeleteTarget(null); } : undefined}
    />
  </section>;
}
