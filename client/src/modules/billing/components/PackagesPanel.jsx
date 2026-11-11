import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEdit2, FiGlobe, FiPackage, FiPlus } from "react-icons/fi";
import { billingApi } from "../services/billingApi";
import { techClubApi } from "../../tech-clubs/services/techClubApi";
import { pathwaySubscriptionApi } from "../../pathway-subscriptions/services/pathwaySubscriptionApi";
import { pathwayTemplatesApi } from "../../settings/pathways/services/pathwayTemplatesApi";
import { usePathwayDirectory } from "../../settings/pathways/hooks/usePathwayTemplates";
import PathwayWebsiteFields from "../../pathway-subscriptions/components/PathwayWebsiteFields";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { pricePer } from "../../../utils/billingPeriods";
import { HistoryButton } from "../../activity/components/RecordStamp";

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 9, padding: "9px 11px", fontSize: 14, background: "#fff" };
const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
const checkLabel = { display: "flex", alignItems: "center", gap: 8, color: "#374151", fontSize: 13, fontWeight: 600 };
const smallButton = { border: "1px solid #D1D5DB", borderRadius: 7, color: "#4B5563", background: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 };
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

// The periods a package can be offered for (6 Nov 2026 — never daily), in order.
const OFFERED = [
  { value: "weekly", label: "Weekly", unit: "week" },
  { value: "monthly", label: "Monthly", unit: "month" },
  { value: "quarterly", label: "Every 3 months", unit: "3 months" },
  { value: "annually", label: "Yearly", unit: "year" },
];
const blankPrices = () => Object.fromEntries(OFFERED.map((p) => [p.value, { on: false, amount: "", extra: "" }]));

const EMPTY = { name: "", slug: "", summary: "", description: "", childrenIncluded: "1", prices: { ...blankPrices(), monthly: { on: true, amount: "", extra: "" } }, defaultPeriod: "monthly", legacyDaily: false, allowExtraChildren: false, maxChildren: "", features: "", badge: "", isPublished: true, status: "active", sortOrder: "0", hubIds: [], pathwayTemplateId: "", includedHelpSessions: "0" };

// A package's prices, one per period (its periodPrices; a package saved before 6 Nov 2026 has just
// its one amount + billingPeriod).
function pricesList(pkg) {
  const list = Array.isArray(pkg.periodPrices) && pkg.periodPrices.length
    ? pkg.periodPrices
    : [{ billingPeriod: pkg.billingPeriod || "monthly", amount: pkg.amount, extraChildAmount: pkg.extraChildAmount }];
  const order = ["daily", ...OFFERED.map((o) => o.value)];
  return [...list].sort((a, b) => order.indexOf(a.billingPeriod) - order.indexOf(b.billingPeriod));
}

// The two kinds of package managed here. Home Learning is the original panel, unchanged; Tech Club
// packages add which clubs a package is offered at (none ticked = every club).
const PROGRAMMES = {
  home_learning: {
    title: "Home Learning packages",
    intro: <>What Home Learning families sign up for, billed weekly, monthly, every 3 months or yearly (one package can offer several — families choose on the website) — invoices go out automatically. Households pick one of these on the Home Learning page. Packages marked <strong>On website</strong> appear on the website's Home Schooling page, and enquiries from there arrive in Enquiries with the package attached.</>,
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
    intro: <>What families pay to join an Estate Tech Club, billed weekly, monthly, every 3 months or yearly (one package can offer several — families choose on the website) — invoices go out automatically. Packages marked <strong>On website</strong> appear on the club pages of the website, where parents sign up and pay; the sign-ups arrive on the Tech Clubs page for you to approve.</>,
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
  // Website pathways sold by subscription (modules/pathway-subscriptions): each plan sells one
  // pathway's access — every stage's courses, self-paced, no class needed — renewing every period.
  pathway: {
    title: "Pathway plans",
    intro: <>Subscriptions for the pathways on the website: a family pays every week, month, quarter or year and their children can open the pathway's courses — every stage, self-paced, no class needed. Invoices go out automatically; an unpaid period locks the courses after the grace days (Settings → Payments), keeping the children's progress, until the family renews. A pathway is on the website while it has a plan marked <strong>On website</strong>; choose its picture and hubs in the plan.</>,
    queryKey: ["billing", "pathway-packages"],
    refreshKeys: [["pathway-subscriptions"]],
    list: () => pathwaySubscriptionApi.listPackages(), create: pathwaySubscriptionApi.createPackage, update: pathwaySubscriptionApi.updatePackage, remove: pathwaySubscriptionApi.deletePackage, checkRemove: null,
    count: (pkg) => pkg.subscriptions || 0, noun: ["subscription", "subscriptions"],
    featuresPlaceholder: "Every stage of the pathway\nSelf-paced — learn any time\nCertificates as each course is finished",
    namePlaceholder: "e.g. Monthly — one child",
    empty: "No pathway plans yet — create one to sell a pathway on the website by subscription.",
    editNote: "Price and billing changes apply to new subscriptions. Existing ones keep theirs until you change their plan — and then from their next billing period.",
    withPathway: true,
    noDaily: true,
  },
};

function toForm(pkg) {
  const prices = blankPrices();
  for (const p of pricesList(pkg)) {
    if (prices[p.billingPeriod]) prices[p.billingPeriod] = { on: true, amount: String(p.amount ?? ""), extra: p.extraChildAmount != null ? String(p.extraChildAmount) : "" };
  }
  return {
  name: pkg.name, slug: pkg.slug, summary: pkg.summary || "", description: pkg.description || "",
  childrenIncluded: String(pkg.childrenIncluded),
  prices, defaultPeriod: prices[pkg.billingPeriod]?.on ? pkg.billingPeriod : (OFFERED.find((o) => prices[o.value].on)?.value || "monthly"),
  // A daily package (no longer offered) keeps billing daily until its periods are chosen and saved.
  legacyDaily: pkg.billingPeriod === "daily" && !OFFERED.some((o) => prices[o.value].on),
  allowExtraChildren: !!pkg.allowExtraChildren,
  maxChildren: pkg.allowExtraChildren ? String(pkg.maxChildren) : "", features: (pkg.features || []).join("\n"),
  badge: pkg.badge || "", isPublished: !!pkg.isPublished, status: pkg.status, sortOrder: String(pkg.sortOrder ?? 0),
  hubIds: Array.isArray(pkg.hubIds) ? pkg.hubIds : [],
  pathwayTemplateId: pkg.pathwayTemplateId || "",
  includedHelpSessions: String(pkg.includedHelpSessions ?? 0),
  };
}

// `withClubs` adds the club list — only Tech Club packages have one.
const toPayload = (form, withClubs = false, withPathway = false) => ({
  ...(withClubs ? { hubIds: form.hubIds } : {}),
  ...(withPathway ? { pathwayTemplateId: form.pathwayTemplateId, includedHelpSessions: Number(form.includedHelpSessions || 0) } : {}),
  name: form.name,
  slug: form.slug,
  summary: form.summary,
  description: form.description,
  childrenIncluded: Number(form.childrenIncluded),
  // One price per period it's offered for, and the one shown first (server: resolvePricing).
  periodPrices: OFFERED.filter((o) => form.prices[o.value].on).map((o) => ({
    billingPeriod: o.value,
    amount: form.prices[o.value].amount === "" ? null : Number(form.prices[o.value].amount),
    extraChildAmount: form.allowExtraChildren && form.prices[o.value].extra !== "" ? Number(form.prices[o.value].extra) : null,
  })),
  defaultPeriod: form.defaultPeriod,
  isPublished: form.isPublished,
  allowExtraChildren: form.allowExtraChildren,
  maxChildren: form.allowExtraChildren && form.maxChildren !== "" ? Number(form.maxChildren) : undefined,
  features: form.features.split("\n").map((line) => line.trim()).filter(Boolean),
  badge: form.badge,
  status: form.status,
  sortOrder: Number(form.sortOrder || 0),
});

// The package's prices: a row per period — offered or not, its price, its price per extra child,
// and which period the website shows first. A family is billed on the one period they choose.
function PeriodPrices({ form, setForm }) {
  const setPrice = (period, patch) => setForm((current) => {
    const prices = { ...current.prices, [period]: { ...current.prices[period], ...patch } };
    let { defaultPeriod } = current;
    if (!prices[defaultPeriod]?.on) defaultPeriod = OFFERED.find((o) => prices[o.value].on)?.value || defaultPeriod;
    if (patch.on && !OFFERED.some((o) => o.value !== period && current.prices[o.value].on)) defaultPeriod = period;
    return { ...current, prices, defaultPeriod };
  });
  const cell = { padding: "6px 8px", fontSize: 12.5, verticalAlign: "middle" };
  const offeredCount = OFFERED.filter((o) => form.prices[o.value].on).length;
  return <fieldset style={{ gridColumn: "1/-1", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px 12px", margin: 0, background: "#fff" }}>
    <legend style={{ ...labelStyle, padding: "0 4px" }}>Prices</legend>
    {form.legacyDaily && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "6px 10px" }}>This package is billed daily, which is no longer offered. Tick the periods it's sold for and save — families already on it keep their daily billing until they're moved.</p>}
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#6B7280", fontSize: 11.5 }}>
            <th style={cell}>Offered</th>
            <th style={cell}>Price (KSh)</th>
            {form.allowExtraChildren && <th style={cell}>Per extra child (KSh)</th>}
            <th style={cell} title="The period the website's card opens on">Shown first</th>
          </tr>
        </thead>
        <tbody>
          {OFFERED.map((o) => {
            const row = form.prices[o.value];
            return <tr key={o.value} style={{ borderTop: "1px solid #F3F4F6", opacity: row.on ? 1 : 0.6 }}>
              <td style={cell}><label style={{ ...checkLabel, fontWeight: 600 }}><input type="checkbox" checked={row.on} onChange={(e) => setPrice(o.value, { on: e.target.checked })} /> {o.label}</label></td>
              <td style={cell}><input style={{ ...inputStyle, minWidth: 110 }} type="number" min={1} step={1} disabled={!row.on} required={row.on} value={row.amount} onChange={(e) => setPrice(o.value, { amount: e.target.value })} placeholder={`per ${o.unit}`} aria-label={`${o.label} price`} /></td>
              {form.allowExtraChildren && <td style={cell}><input style={{ ...inputStyle, minWidth: 110 }} type="number" min={0} step={1} disabled={!row.on} required={row.on} value={row.extra} onChange={(e) => setPrice(o.value, { extra: e.target.value })} placeholder={`per ${o.unit}`} aria-label={`${o.label} price per extra child`} /></td>}
              <td style={cell}><input type="radio" name="defaultPeriod" disabled={!row.on} checked={form.defaultPeriod === o.value && row.on} onChange={() => setForm((current) => ({ ...current, defaultPeriod: o.value }))} aria-label={`Show ${o.label} first`} /></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280" }}>
      {offeredCount > 1
        ? "The website's card has a switch between these; the family is invoiced on the one they choose, every period from the day they join."
        : "Tick more periods to let families choose — the website's card then gets a switch between them. Invoiced every period from the day the family joins."}
    </p>
  </fieldset>;
}

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

// The website details of a pathway, as the form edits them: { hubIds, image }.
const websiteOf = (pathway) => ({ hubIds: pathway?.website?.hubIds || [], image: pathway?.website?.image || "" });

function PackageForm({ initial, isEdit, onSubmit, onCancel, saving, config, clubs, pathways = [], hubs = [] }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  // Pathway plans: the chosen pathway, and its picture and hubs (shared by its plans).
  const pathway = config.withPathway ? pathways.find((p) => p.templateId === form.pathwayTemplateId) : null;
  const [website, setWebsite] = useState(() => websiteOf(pathway));
  const choosePathway = (event) => {
    const id = event.target.value;
    setForm((current) => ({ ...current, pathwayTemplateId: id }));
    setWebsite(websiteOf(pathways.find((p) => p.templateId === id)));
  };
  const submit = () => onSubmit(toPayload(form, config.withClubs, config.withPathway), pathway ? { pathway, website } : null);
  return <form onSubmit={(event) => { event.preventDefault(); submit(); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14, padding: 16, background: "#F8FAFC", borderRadius: 12 }}>
    {config.withPathway && <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Pathway<select style={inputStyle} required value={form.pathwayTemplateId} onChange={choosePathway}>
      <option value="">Choose the pathway this plan sells…</option>
      {pathways.map((p) => <option key={p.templateId} value={p.templateId}>{p.name}</option>)}
    </select></label>}
    {pathway && <PathwayWebsiteFields pathway={pathway} hubs={hubs} value={website} onChange={setWebsite} />}
    <label style={labelStyle}>Package name<input style={inputStyle} required maxLength={150} value={form.name} onChange={set("name")} placeholder={config.namePlaceholder} /></label>
    <label style={labelStyle}>Children included<input style={inputStyle} required type="number" min={1} max={50} value={form.childrenIncluded} onChange={set("childrenIncluded")} /></label>
    <label style={labelStyle}>Badge (optional)<input style={inputStyle} maxLength={40} value={form.badge} onChange={set("badge")} placeholder="e.g. Most popular" /></label>
    {/* Mentor sessions the plan includes each period — the mentor's fee is waived for them (modules/mentor-bookings). */}
    {config.withPathway && <label style={labelStyle}>Mentor sessions included per period<input style={inputStyle} type="number" min={0} max={60} value={form.includedHelpSessions} onChange={set("includedHelpSessions")} placeholder="0" /></label>}
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Short summary (shown on the card)<input style={inputStyle} maxLength={300} value={form.summary} onChange={set("summary")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Description (optional)<textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} maxLength={5000} value={form.description} onChange={set("description")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>What's included — one per line<textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.features} onChange={set("features")} placeholder={config.featuresPlaceholder} /></label>
    {config.withClubs && <ClubPicker clubs={clubs} value={form.hubIds} onChange={(hubIds) => setForm((current) => ({ ...current, hubIds }))} />}
    <label style={{ ...checkLabel, gridColumn: "1/-1" }}><input type="checkbox" checked={form.allowExtraChildren} onChange={set("allowExtraChildren")} /> Families can add more children to this package</label>
    {form.allowExtraChildren && <label style={labelStyle}>Maximum children<input style={inputStyle} type="number" min={Number(form.childrenIncluded || 1) + 1} max={50} value={form.maxChildren} onChange={set("maxChildren")} placeholder="20" /></label>}
    <PeriodPrices form={form} setForm={setForm} />
    {isEdit && <label style={labelStyle}>Web address slug<input style={inputStyle} maxLength={160} value={form.slug} onChange={set("slug")} /></label>}
    <label style={labelStyle}>Display order<input style={inputStyle} type="number" min={0} max={999} value={form.sortOrder} onChange={set("sortOrder")} /></label>
    <label style={labelStyle}>Status<select style={inputStyle} value={form.status} onChange={set("status")}><option value="active">Active — can be sold</option><option value="archived">Archived — no longer offered</option></select></label>
    <label style={{ ...checkLabel, alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={form.isPublished && form.status === "active"} disabled={form.status !== "active"} onChange={set("isPublished")} /> Show on the website</label>
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
// With programme="pathway": the website pathways' subscription plans — each plan's form picks the
// pathway (one the curricula use) and sets its picture and hubs; a pathway is on the website while
// it has a published plan (public-site.service.js's onWebsite).
// The table each programme's packages live in (the activity log's record type).
const PACKAGE_TABLE = { home_learning: "home_learning_packages", tech_club: "club_packages", pathway: "pathway_packages" };

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
  // The pathways a plan can sell — the ones the curricula use — with their website details, and
  // the hubs they can run at (the pathway directory, Settings → Pathways).
  const { data: directory } = usePathwayDirectory({ enabled: !!config.withPathway });
  const pathways = (directory?.pathways || []).filter((p) => p.inUse && p.templateId).sort((a, b) => a.name.localeCompare(b.name));
  const directoryHubs = directory?.hubs || [];
  const pathwayById = new Map(pathways.map((p) => [p.templateId, p]));
  // A pathway's picture and hubs, saved with its plan; publishing a plan puts the pathway on the
  // website (the pathway's own "shown" flag is kept on).
  const saveWebsite = async (pathway, website) => {
    await pathwayTemplatesApi.setWebsite(pathway.templateId, { visible: true, hubIds: website.hubIds, image: website.image || null });
    queryClient.invalidateQueries({ queryKey: ["settings", "pathway-templates"] });
  };
  // Households / memberships show their package's name and price, so their list refreshes too.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: config.queryKey });
    config.refreshKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };
  const saveMutation = useMutation({
    mutationFn: async ({ id, data, extra }) => {
      const saved = await (id ? config.update(id, data) : config.create(data));
      if (extra?.pathway) await saveWebsite(extra.pathway, extra.website);
      return saved;
    },
    onSuccess: (_, { id }) => { refresh(); setEditingId(null); toast.success(id ? "Package saved" : "Package created"); },
    onError: (error) => toast.error(errorMessage(error, "Could not save package")),
  });
  const quickMutation = useMutation({
    mutationFn: async ({ pkg, changes }) => {
      const saved = await config.update(pkg.id, { ...toPayload(toForm(pkg), config.withClubs, config.withPathway), ...changes });
      // Showing a pathway plan on the website lists its pathway there.
      const pathway = config.withPathway && changes.isPublished ? pathwayById.get(pkg.pathwayTemplateId) : null;
      if (pathway && !pathway.website?.visible) await saveWebsite(pathway, websiteOf(pathway));
      return saved;
    },
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, "Could not update package")),
  });
  const deleteMutation = useMutation({
    mutationFn: config.remove,
    onSuccess: (result) => { refresh(); toast.success(result?.archived ? "Package archived — families are still on it" : "Package deleted"); },
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

    {editingId === "new" && <PackageForm initial={EMPTY} config={config} clubs={clubs} pathways={pathways} hubs={directoryHubs} onSubmit={(data, extra) => saveMutation.mutate({ id: null, data, extra })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />}

    {isLoading ? <p style={{ color: "#6B7280", fontSize: 13 }}>Loading packages…</p> : packages.length === 0 && editingId !== "new"
      ? <p style={{ color: "#6B7280", fontSize: 13, marginTop: 14 }}>{config.empty}</p>
      : <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {packages.map((pkg) => editingId === pkg.id
          ? <PackageForm key={pkg.id} initial={toForm(pkg)} isEdit config={config} clubs={clubs} pathways={pathways} hubs={directoryHubs} onSubmit={(data, extra) => saveMutation.mutate({ id: pkg.id, data, extra })} onCancel={() => setEditingId(null)} saving={saveMutation.isPending} />
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
                {pkg.childrenIncluded} {pkg.childrenIncluded === 1 ? "child" : "children"} · <strong style={{ color: "#25476a" }}>{pricesList(pkg).map((p) => pricePer(p.amount, p.billingPeriod)).join(" · ")}</strong>
                {pkg.allowExtraChildren && <> · extra child {pricesList(pkg).map((p) => pricePer(p.extraChildAmount, p.billingPeriod)).join(" · ")} (up to {pkg.maxChildren})</>}
                {" · "}{config.count(pkg)} {config.noun[config.count(pkg) === 1 ? 0 : 1]}
              </div>
              {config.withPathway && (() => {
                const pw = pathwayById.get(pkg.pathwayTemplateId);
                const hubCount = pw?.website?.hubIds?.length || 0;
                return <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  Sells <strong style={{ color: "#374151" }}>{pkg.pathwayName || "a removed pathway"}</strong>
                  {pw ? ` · ${hubCount ? `runs at ${hubCount} hub${hubCount === 1 ? "" : "s"}` : "at the hubs that teach it"}` : ""}
                </div>;
              })()}
              {config.withClubs && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {pkg.hubIds?.length ? `At ${pkg.hubIds.map((id) => clubNames.get(id) || "a removed club").join(", ")}` : "At every club"}
              </div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Who made and changed this package (admin side only — modules/activity). */}
              <HistoryButton type={PACKAGE_TABLE[programme]} id={pkg.id} label={pkg.name} />
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
      usageCheck={config.checkRemove ? () => config.checkRemove(deleteTarget.id) : undefined}
      onAlternative={deleteTarget?.status === "active" ? () => { quickMutation.mutate({ pkg: deleteTarget, changes: { status: "archived", isPublished: false } }); setDeleteTarget(null); } : undefined}
    />
  </section>;
}
