import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiFileText, FiHome, FiMapPin, FiUsers } from "react-icons/fi";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { homeLearningApi, priceForPackage } from "../services/homeLearningApi";
import PackagesPanel from "../components/PackagesPanel";

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D1D5DB", borderRadius: 9, padding: "10px 12px", fontSize: 14, background: "#fff" };
const labelStyle = { display: "grid", gap: 6, color: "#374151", fontSize: 13, fontWeight: 600 };
const panelStyle = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 22, boxShadow: "0 2px 8px rgba(15,23,42,.04)" };
const primaryButton = { border: 0, borderRadius: 9, padding: "11px 16px", color: "white", background: "#25476a", fontWeight: 700, cursor: "pointer" };
const secondaryButton = { border: "1px solid #D1D5DB", borderRadius: 7, color: "#4B5563", background: "#fff", padding: "7px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const formatMoney = (amount) => `KSh ${Number(amount || 0).toLocaleString("en-KE")}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;
const thisMonth = () => new Date().toISOString().slice(0, 7);

const EMPTY_HOUSEHOLD = { guardianName: "", guardianEmail: "", guardianPhone: "", county: "", subCounty: "", town: "", addressLine: "", landmark: "", packageId: "", childCount: "", status: "pending", startDate: "", notes: "" };
const EMPTY_CHILD = { firstName: "", lastName: "", gender: "", dateOfBirth: "", username: "", password: "", learnerPassword: "", curriculumId: "", gradeId: "", educatorId: "" };
const ENROLLMENT_STATUS_LABELS = { active: "Active", paused: "Paused", completed: "Completed", removed: "Removed" };
const INVOICE_STATUS_COLORS = { paid: "#047857", partially_paid: "#C2410C", overdue: "#B91C1C", issued: "#1D4ED8" };

// Package + number of children. The children field only appears for a package that takes extra
// children; otherwise the household gets the package's included places.
function PackageFields({ values, setValue, packages, currentPackageId }) {
  const offered = packages.filter((pkg) => pkg.status === "active" || pkg.id === currentPackageId);
  const pkg = packages.find((p) => p.id === values.packageId);
  const price = priceForPackage(pkg, values.childCount);
  return <>
    <label style={labelStyle}>Package<select style={inputStyle} required value={values.packageId || ""} onChange={(e) => { setValue("packageId", e.target.value); setValue("childCount", ""); }}>
      <option value="">{offered.length ? "Choose package" : "Create a package first"}</option>
      {offered.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.childrenIncluded} {p.childrenIncluded === 1 ? "child" : "children"} · {formatMoney(p.monthlyAmount)}/month{p.status === "archived" ? " (archived)" : ""}</option>)}
    </select></label>
    {pkg?.allowExtraChildren && <label style={labelStyle}>Number of children<input style={inputStyle} type="number" min={pkg.childrenIncluded} max={pkg.maxChildren} value={values.childCount || pkg.childrenIncluded} onChange={(e) => setValue("childCount", e.target.value)} /></label>}
    {pkg && <div style={{ alignSelf: "end", paddingBottom: 10, fontSize: 13, color: price ? "#25476a" : "#B91C1C", fontWeight: 700 }}>
      {price ? `${formatMoney(price.monthlyAmount)}/month · ${price.childCount} places` : `Up to ${pkg.maxChildren} children on this package`}
    </div>}
  </>;
}

// The household contact/address fields, shared by "Add a household" and each card's edit form.
function HouseholdFields({ values, setValue, packages, currentPackageId, showStatus }) {
  const bind = (key) => ({ value: values[key] ?? "", onChange: (event) => setValue(key, event.target.value) });
  return <>
    <label style={labelStyle}>Parent / guardian name<input style={inputStyle} required {...bind("guardianName")} /></label>
    <label style={labelStyle}>Phone<input style={inputStyle} required minLength={7} maxLength={20} {...bind("guardianPhone")} /></label>
    <label style={labelStyle}>Email<input style={inputStyle} type="email" {...bind("guardianEmail")} /></label>
    <PackageFields values={values} setValue={setValue} packages={packages} currentPackageId={currentPackageId} />
    {showStatus && <label style={labelStyle}>Enrollment status<select style={inputStyle} {...bind("status")}><option value="pending">Pending</option><option value="active">Active</option><option value="paused">Paused</option></select></label>}
    <label style={labelStyle}>Start date<input style={inputStyle} type="date" {...bind("startDate")} /></label>
    <label style={labelStyle}>County<input style={inputStyle} {...bind("county")} /></label>
    <label style={labelStyle}>Sub-county<input style={inputStyle} {...bind("subCounty")} /></label>
    <label style={labelStyle}>Town / area<input style={inputStyle} {...bind("town")} /></label>
    <label style={labelStyle}>Home address<input style={inputStyle} {...bind("addressLine")} /></label>
    <label style={labelStyle}>Landmark / directions<input style={inputStyle} {...bind("landmark")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Internal notes<textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} {...bind("notes")} /></label>
  </>;
}

// Curriculum → grade/level → educator. The grade decides which courses the child's class gets.
function EnrollmentFields({ values, setValue, curricula, educators }) {
  const curriculum = curricula.find((c) => c.id === values.curriculumId);
  const grades = Array.isArray(curriculum?.classes) ? curriculum.classes : [];
  return <>
    <label style={labelStyle}>Curriculum<select style={inputStyle} required value={values.curriculumId || ""} onChange={(e) => { setValue("curriculumId", e.target.value); setValue("gradeId", ""); }}><option value="">Choose curriculum</option>{curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label style={labelStyle}>Grade / level<select style={inputStyle} required value={values.gradeId || ""} onChange={(e) => setValue("gradeId", e.target.value)} disabled={!grades.length}><option value="">{values.curriculumId && !grades.length ? "No grades in this curriculum" : "Choose grade"}</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label style={labelStyle}>Educator (optional)<select style={inputStyle} value={values.educatorId || ""} onChange={(e) => setValue("educatorId", e.target.value)}><option value="">Unassigned</option>{educators.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></label>
  </>;
}

function EnrollmentRow({ household, item, curricula, educators, onSave, onRemove, saving, canAddActive }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const removed = item.status === "removed";
  const name = item.learner ? `${item.learner.firstName} ${item.learner.lastName}` : "Learner";
  const startEdit = (status) => {
    setDraft({ curriculumId: item.curriculumId, gradeId: item.gradeId || "", educatorId: item.educatorId || "", status });
    setEditing(true);
  };
  const setValue = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    onSave({ householdId: household.id, learnerId: item.learnerId, ...draft }, () => setEditing(false));
  };
  return <div style={{ marginTop: 12, padding: 12, background: removed ? "#FAFAFA" : "#F8FAFC", borderRadius: 10, opacity: removed && !editing ? 0.8 : 1 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <strong style={{ fontSize: 14 }}>{name}</strong>
        {item.status !== "active" && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#6B7280", background: "#EEF1F5", borderRadius: 999, padding: "2px 8px" }}>{ENROLLMENT_STATUS_LABELS[item.status] || item.status}</span>}
        <div style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
          {item.curriculum?.name || "Curriculum"} · {item.gradeName || <span style={{ color: "#B45309", fontWeight: 700 }}>Grade not set — edit to create this child's class</span>} · {item.educator ? `${item.educator.firstName} ${item.educator.lastName}` : "Educator not assigned"}
        </div>
      </div>
      {!editing && <div style={{ display: "flex", gap: 8 }}>
        {item.learner && <Link to={`/learners/${item.learnerId}/view`} style={{ ...secondaryButton, textDecoration: "none" }}>Profile</Link>}
        {removed
          ? <button type="button" disabled={!canAddActive} title={canAddActive ? "" : "No free places in this package"} onClick={() => startEdit("active")} style={secondaryButton}>Re-add</button>
          : <>
            <button type="button" onClick={() => startEdit(item.status)} style={secondaryButton}>Edit</button>
            <button type="button" onClick={() => onRemove({ householdId: household.id, learnerId: item.learnerId, name })} style={secondaryButton}>Remove</button>
          </>}
      </div>}
    </div>
    {editing && <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 12, alignItems: "end" }}>
      <EnrollmentFields values={draft} setValue={setValue} curricula={curricula} educators={educators} />
      <label style={labelStyle}>Status<select style={inputStyle} value={draft.status} onChange={(e) => setValue("status", e.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={saving} style={{ ...primaryButton, padding: "10px 14px" }}>{saving ? "Saving…" : removed ? "Re-add" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} style={secondaryButton}>Cancel</button>
      </div>
    </form>}
  </div>;
}

function BillingStrip({ household, canBill, onInvoice, invoicing }) {
  const [period, setPeriod] = useState(thisMonth());
  const [dueDate, setDueDate] = useState("");
  const billing = household.billing || { outstanding: 0, overdue: false, invoices: [] };
  return <div style={{ marginTop: 14, borderTop: "1px solid #EEF1F5", paddingTop: 12 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FiFileText style={{ color: "#25476a" }} />
        <strong>Billing</strong>
        <span>Outstanding: <strong style={{ color: billing.outstanding > 0 ? "#B45309" : "#047857" }}>{formatMoney(billing.outstanding)}</strong></span>
        {billing.overdue && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#B91C1C", background: "#FEF2F2", borderRadius: 999, padding: "2px 8px" }}><FiAlertTriangle /> Overdue</span>}
      </div>
      {canBill && household.status === "active" && <form onSubmit={(e) => { e.preventDefault(); onInvoice({ id: household.id, period, dueDate }); }} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input aria-label="Invoice month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 12 }} />
        <input aria-label="Due date" title="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 12 }} />
        <button disabled={invoicing} style={{ ...secondaryButton, borderColor: "#2E7DB5", color: "#2E7DB5" }}>{invoicing ? "Invoicing…" : "Invoice month"}</button>
      </form>}
    </div>
    {billing.invoices.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {billing.invoices.map((invoice) => <Link key={invoice.id} to={`/billing/${invoice.id}`} style={{ textDecoration: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#374151" }}>
        {invoice.periodLabel?.replace("Home Learning · ", "") || invoice.invoiceNumber} · {formatMoney(invoice.total)} · <span style={{ fontWeight: 700, color: INVOICE_STATUS_COLORS[invoice.status] || "#6B7280" }}>{invoice.status.replace("_", " ")}</span>
      </Link>)}
    </div>}
  </div>;
}

export default function HomeLearningPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canBill = user?.role !== "collaborator";
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("household");
  const focusRef = useRef(null);
  const [form, setForm] = useState(EMPTY_HOUSEHOLD);
  const [assignments, setAssignments] = useState({});
  const [childDrafts, setChildDrafts] = useState({});
  const [householdDrafts, setHouseholdDrafts] = useState({});
  const [bulkPeriod, setBulkPeriod] = useState(thisMonth());

  const { data: households = [], isLoading } = useQuery({ queryKey: ["home-learning"], queryFn: homeLearningApi.getAll });
  const { data: packageRows, isLoading: packagesLoading } = useQuery({ queryKey: ["home-learning", "packages"], queryFn: homeLearningApi.getPackages });
  const { data: learnerRows } = useQuery({ queryKey: ["home-learning", "learners"], queryFn: () => api.get("/api/learners").then((r) => r.data.data || []) });
  const { data: curriculumRows } = useQuery({ queryKey: ["home-learning", "curricula"], queryFn: () => api.get("/api/curricula").then((r) => r.data.data || []) });
  const { data: teacherRows } = useQuery({ queryKey: ["home-learning", "educators"], queryFn: () => api.get("/api/teachers").then((r) => r.data.data || []) });
  const learners = Array.isArray(learnerRows) ? learnerRows : [];
  const curricula = Array.isArray(curriculumRows) ? curriculumRows : [];
  const educators = Array.isArray(teacherRows) ? teacherRows.filter((teacher) => (teacher.status || "active") === "active") : [];
  const packages = Array.isArray(packageRows) ? packageRows : [];
  // Children already placed in any household can't be picked again (the server refuses it too).
  const placedLearnerIds = useMemo(() => new Set(households.flatMap((h) => (h.learners || []).map((l) => l.learnerId))), [households]);

  useEffect(() => {
    if (focusId && !isLoading) focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, isLoading]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home-learning"] });
  const createMutation = useMutation({
    mutationFn: homeLearningApi.createHousehold,
    onSuccess: () => { refresh(); toast.success("Household added"); setForm(EMPTY_HOUSEHOLD); },
    onError: (error) => toast.error(errorMessage(error, "Could not add household")),
  });
  const enrollmentMutation = useMutation({
    mutationFn: ({ householdId, ...data }) => homeLearningApi.enrollLearner(householdId, data),
    onSuccess: () => { refresh(); toast.success("Home Learning assignment saved"); },
    onError: (error) => toast.error(errorMessage(error, "Could not save assignment")),
  });
  const updateHouseholdMutation = useMutation({
    mutationFn: ({ id, data }) => homeLearningApi.updateHousehold(id, data),
    onSuccess: (_, { id }) => { refresh(); setHouseholdDrafts((current) => { const next = { ...current }; delete next[id]; return next; }); toast.success("Household updated"); },
    onError: (error) => toast.error(errorMessage(error, "Could not update household")),
  });
  const createLearnerMutation = useMutation({
    mutationFn: ({ householdId, ...data }) => homeLearningApi.createLearner(householdId, data),
    onSuccess: (_, { householdId }) => { refresh(); setChildDrafts((current) => ({ ...current, [householdId]: EMPTY_CHILD })); toast.success("Learner registered and assigned"); },
    onError: (error) => toast.error(errorMessage(error, "Could not register learner")),
  });
  const removeMutation = useMutation({
    mutationFn: ({ householdId, learnerId }) => homeLearningApi.removeLearner(householdId, learnerId),
    onSuccess: () => { refresh(); toast.success("Removed from household — they can be re-added later"); },
    onError: (error) => toast.error(errorMessage(error, "Could not remove learner")),
  });
  const invoiceMutation = useMutation({
    mutationFn: ({ id, period, dueDate }) => homeLearningApi.generateInvoice(id, { period, dueDate }),
    onSuccess: ({ created, invoice }) => { refresh(); toast.success(created ? `Invoice ${invoice.invoiceNumber} issued` : `Already invoiced (${invoice.invoiceNumber})`); },
    onError: (error) => toast.error(errorMessage(error, "Could not raise invoice")),
  });
  const bulkInvoiceMutation = useMutation({
    mutationFn: homeLearningApi.generateMonthlyInvoices,
    onSuccess: ({ created, skipped }) => { refresh(); toast.success(`${created} invoice${created === 1 ? "" : "s"} issued${skipped ? `, ${skipped} already invoiced` : ""}`); },
    onError: (error) => toast.error(errorMessage(error, "Could not raise invoices")),
  });

  const saveEnrollment = (data, done) => {
    if (!data.learnerId || !data.curriculumId || !data.gradeId) return toast.error("Choose a learner, curriculum and grade first");
    enrollmentMutation.mutate(data, { onSuccess: done });
  };
  const removeLearner = ({ householdId, learnerId, name }) => {
    if (window.confirm(`Remove ${name} from this household? Their records are kept and they can be re-added later.`)) removeMutation.mutate({ householdId, learnerId });
  };
  const submitHousehold = (event) => {
    event.preventDefault();
    createMutation.mutate({ ...form, childCount: form.childCount === "" ? undefined : Number(form.childCount) });
  };
  const saveHouseholdDetails = (event, household) => {
    event.preventDefault();
    const draft = householdDrafts[household.id] || household;
    // Only send the package when it actually changed — re-sending it re-prices the household at
    // the package's current price, which should only happen on purpose.
    const packageChanged = draft.packageId !== household.packageId || Number(draft.childCount || 0) !== Number(household.childCount);
    updateHouseholdMutation.mutate({ id: household.id, data: {
      guardianName: draft.guardianName,
      guardianEmail: draft.guardianEmail || "",
      guardianPhone: draft.guardianPhone,
      ...(packageChanged && draft.packageId ? { packageId: draft.packageId, childCount: draft.childCount === "" ? undefined : Number(draft.childCount) } : {}),
      startDate: toDateInput(draft.startDate),
      county: draft.county || "",
      subCounty: draft.subCounty || "",
      town: draft.town || "",
      addressLine: draft.addressLine || "",
      landmark: draft.landmark || "",
      notes: draft.notes || "",
    } });
  };

  return <div style={{ maxWidth: 1180, margin: "0 auto", fontFamily: "Inter, sans-serif", color: "#111827" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F5FB", color: "#25476a", display: "grid", placeItems: "center" }}><FiHome size={23} /></div>
      <div style={{ flex: 1, minWidth: 240 }}><h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>Home Learning</h1><p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>Families, monthly packages, each child's curriculum, grade and educator, and monthly invoices. Every child gets their own class in the Home Learning hub, so assessments, attendance and reports work as usual.</p></div>
      {canBill && <form onSubmit={(e) => { e.preventDefault(); bulkInvoiceMutation.mutate({ period: bulkPeriod }); }} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input aria-label="Month to invoice" type="month" required value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px", fontSize: 13 }} />
        <button disabled={bulkInvoiceMutation.isPending} style={{ ...primaryButton, padding: "9px 14px", fontSize: 13 }}>{bulkInvoiceMutation.isPending ? "Invoicing…" : "Invoice all active households"}</button>
      </form>}
    </header>

    <PackagesPanel packages={packages} isLoading={packagesLoading} />

    <section style={{ ...panelStyle, marginBottom: 22 }}>
      <h2 style={{ fontSize: 17, margin: "0 0 6px" }}>Add a household</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B7280" }}>Home addresses are used for family records and shared with the assigned educator. Add the children and their learning assignments after saving.</p>
      <form onSubmit={submitHousehold} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
        <HouseholdFields values={form} setValue={(key, value) => setForm((current) => ({ ...current, [key]: value }))} packages={packages} showStatus />
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#6B7280", fontSize: 12 }}>The household is billed at the package price shown above.</span>
          <button disabled={createMutation.isPending || !packages.some((p) => p.status === "active")} style={primaryButton}>{createMutation.isPending ? "Saving…" : "Add household"}</button>
        </div>
      </form>
    </section>

    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h2 style={{ margin: 0, fontSize: 19 }}>Households</h2><span style={{ color: "#6B7280", fontSize: 13 }}>{households.length} registered</span></div>
      {isLoading ? <div style={{ ...panelStyle, color: "#6B7280" }}>Loading households…</div> : households.length === 0 ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No Home Learning households yet.</div> : households.map((household) => {
        const assignment = assignments[household.id] || {};
        const setAssignment = (key, value) => setAssignments((current) => ({ ...current, [household.id]: { ...current[household.id], [key]: value } }));
        const children = household.learners || [];
        const remaining = Math.max(0, Number(household.childCount) - children.filter((item) => item.status === "active").length);
        const focused = household.id === focusId;
        const householdDraft = householdDrafts[household.id] || { ...household, startDate: toDateInput(household.startDate) };
        const childDraft = childDrafts[household.id] || EMPTY_CHILD;
        const setChildDraft = (key, value) => setChildDrafts((current) => ({ ...current, [household.id]: { ...(current[household.id] || EMPTY_CHILD), [key]: value } }));
        return <article key={household.id} ref={focused ? focusRef : undefined} style={{ ...panelStyle, ...(focused ? { borderColor: "#2E7DB5", boxShadow: "0 0 0 3px rgba(46,125,181,.18)" } : {}) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>{household.guardianName}</h3>
              <p style={{ margin: "5px 0", color: "#6B7280", fontSize: 13 }}>{household.guardianPhone}{household.guardianEmail ? ` · ${household.guardianEmail}` : ""}</p>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}><FiMapPin style={{ verticalAlign: "-2px" }} /> {[household.addressLine, household.town, household.subCounty, household.county].filter(Boolean).join(", ") || "Home address not recorded"}</p>
              {household.startDate && <p style={{ margin: "5px 0 0", color: "#6B7280", fontSize: 12 }}>Started {formatDate(household.startDate)}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#25476a" }}>{formatMoney(household.monthlyAmount)}<span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>/month</span></div>
              <span style={{ color: "#6B7280", fontSize: 12 }}>{household.package ? `${household.package.name} · ` : ""}{household.childCount} places · {remaining} free</span>
              <div><select aria-label="Household status" value={household.status} onChange={(event) => updateHouseholdMutation.mutate({ id: household.id, data: { status: event.target.value } })} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12, marginTop: 6 }}><option value="pending">Pending</option><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select></div>
            </div>
          </div>

          <BillingStrip household={household} canBill={canBill} onInvoice={(data) => invoiceMutation.mutate(data)} invoicing={invoiceMutation.isPending && invoiceMutation.variables?.id === household.id} />

          <details style={{ marginTop: 12 }}><summary style={{ color: "#25476a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit household contact and home details</summary>
            <form onSubmit={(event) => saveHouseholdDetails(event, household)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 12, alignItems: "end" }}>
              <HouseholdFields values={householdDraft} setValue={(key, value) => setHouseholdDrafts((current) => ({ ...current, [household.id]: { ...(current[household.id] || householdDraft), [key]: value } }))} packages={packages} currentPackageId={household.packageId} />
              <button disabled={updateHouseholdMutation.isPending} style={primaryButton}>Save household details</button>
            </form>
          </details>

          {children.map((item) => <EnrollmentRow key={item.id} household={household} item={item} curricula={curricula} educators={educators} onSave={saveEnrollment} onRemove={removeLearner} saving={enrollmentMutation.isPending} canAddActive={remaining > 0} />)}

          {remaining > 0 && <form onSubmit={(event) => { event.preventDefault(); saveEnrollment({ householdId: household.id, ...assignment, status: "active" }, () => setAssignments((current) => ({ ...current, [household.id]: {} }))); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginTop: 15, alignItems: "end" }}>
            <label style={labelStyle}>Existing learner<select style={inputStyle} value={assignment.learnerId || ""} onChange={(e) => setAssignment("learnerId", e.target.value)}><option value="">Choose learner</option>{learners.filter((l) => !placedLearnerIds.has(l.id)).map((learner) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}</option>)}</select></label>
            <EnrollmentFields values={assignment} setValue={setAssignment} curricula={curricula} educators={educators} />
            <button disabled={enrollmentMutation.isPending} style={{ ...primaryButton, background: "#2E7DB5", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><FiUsers /> Assign learner</button>
          </form>}

          {remaining > 0 && <details style={{ marginTop: 12 }}><summary style={{ color: "#25476a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Register a new learner in this household</summary>
            <form onSubmit={(event) => {
              event.preventDefault();
              if (!childDraft.curriculumId || !childDraft.gradeId) return toast.error("Choose a curriculum and grade first");
              const { curriculumId, gradeId, educatorId, ...learner } = childDraft;
              createLearnerMutation.mutate({ householdId: household.id, curriculumId, gradeId, educatorId, learner });
            }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 12, alignItems: "end" }}>
              <label style={labelStyle}>First name<input style={inputStyle} required value={childDraft.firstName} onChange={(e) => setChildDraft("firstName", e.target.value)} /></label>
              <label style={labelStyle}>Last name<input style={inputStyle} required value={childDraft.lastName} onChange={(e) => setChildDraft("lastName", e.target.value)} /></label>
              <label style={labelStyle}>Gender<select style={inputStyle} required value={childDraft.gender} onChange={(e) => setChildDraft("gender", e.target.value)}><option value="">Choose</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
              <label style={labelStyle}>Date of birth<input style={inputStyle} type="date" value={childDraft.dateOfBirth} onChange={(e) => setChildDraft("dateOfBirth", e.target.value)} /></label>
              <label style={labelStyle}>Learner username (optional)<input style={inputStyle} value={childDraft.username} onChange={(e) => setChildDraft("username", e.target.value)} /></label>
              <label style={labelStyle}>Guardian portal password (optional; sets or resets login)<input style={inputStyle} type="password" minLength={8} disabled={!household.guardianEmail} placeholder={household.guardianEmail ? "" : "Add a guardian email first"} value={childDraft.password} onChange={(e) => setChildDraft("password", e.target.value)} /></label>
              {childDraft.username && <label style={labelStyle}>Learner portal password<input style={inputStyle} type="password" minLength={8} value={childDraft.learnerPassword} onChange={(e) => setChildDraft("learnerPassword", e.target.value)} /></label>}
              <EnrollmentFields values={childDraft} setValue={setChildDraft} curricula={curricula} educators={educators} />
              <button disabled={createLearnerMutation.isPending} style={primaryButton}>{createLearnerMutation.isPending ? "Registering…" : "Register and assign"}</button>
            </form>
          </details>}
        </article>;
      })}
    </section>
  </div>;
}
