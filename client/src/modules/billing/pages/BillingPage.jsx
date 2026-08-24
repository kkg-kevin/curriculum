import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AccountBalance as AccountBalanceIcon, Add as AddIcon, CancelOutlined as CancelOutlinedIcon, CheckCircle as CheckCircleIcon, DescriptionOutlined as DescriptionOutlinedIcon, EventNote as EventNoteIcon, Paid as PaidIcon, ReceiptLong as ReceiptLongIcon, Search as SearchIcon, Send as SendIcon, School as SchoolIcon, ViewList as ViewListIcon } from "@mui/icons-material";
import { useAuth } from "../../../context/AuthContext";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learnerApi } from "../../learners/services/learnerApi";
import { useCoursesQuery } from "../../courses/hooks/useCourse";
import { useBulkInvoicePreview, useCancelInvoice, useCreateBulkInvoices, useCreateInvoice, useIssueInvoice, useInvoicesQuery } from "../hooks/useBilling";
import { classApi } from "../../classes/services/classApi";

const TYPE_LABELS = {
  hub_subscription: "Hub subscription",
  learner_term: "Learner per term",
  course_module: "Course / module",
  bootcamp: "One-time bootcamp",
};
const TYPE_HELP = {
  hub_subscription: "Platform fees billed directly to the learning hub.",
  learner_term: "Recurring learner fees for an academic term. The guardian account is notified.",
  course_module: "Charge a learner for a specific course or module.",
  bootcamp: "A single payment for a special programme or bootcamp.",
};
const STATUS_LABELS = { draft: "Draft", issued: "Issued", partially_paid: "Partially paid", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled", void: "Void" };
const STATUS_COLORS = {
  draft: { bg: "#F3F4F6", color: "#4B5563" }, issued: { bg: "#EFF6FF", color: "#1D4ED8" }, partially_paid: { bg: "#FFF7ED", color: "#C2410C" }, paid: { bg: "#ECFDF5", color: "#047857" }, overdue: { bg: "#FEF2F2", color: "#B91C1C" }, cancelled: { bg: "#F9FAFB", color: "#6B7280" }, void: { bg: "#F9FAFB", color: "#6B7280" },
};
const inputStyle = { padding: "10px 12px", border: "1px solid #D7DEE8", borderRadius: 8, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const buttonStyle = { padding: "9px 14px", border: 0, borderRadius: 8, background: "#25476a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

function Field({ label, children }) { return <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}{children}</label>; }
function StatusPill({ status }) { const style = STATUS_COLORS[status] || STATUS_COLORS.draft; return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: style.bg, color: style.color, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{status === "paid" ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : null}{STATUS_LABELS[status] || status}</span>; }
function formatMoney(amount, currency = "KES") { return `${currency} ${Number(amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "No due date"; }

export default function BillingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLearner = user?.role === "learner";
  const isAdmin = user?.role === "admin";
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoicesQuery();
  const { data: hubsData } = useAllLearningHubsQuery({ includeDrafts: true });
  const hubs = hubsData?.data || [];
  const [hubId, setHubId] = useState("");
  const selectedHubId = isAdmin ? hubId : hubs[0]?.id || "";
  const { data: learnersData } = useQuery({
    queryKey: ["billing", "learners", selectedHubId],
    queryFn: () => learnerApi.getAll({ schoolId: selectedHubId }),
    enabled: !!selectedHubId && !isLearner,
  });
  const learners = learnersData?.data || [];
  const { data: classesData } = useQuery({
    queryKey: ["billing", "classes", selectedHubId],
    queryFn: () => classApi.getAll({ schoolId: selectedHubId }),
    enabled: !!selectedHubId && !isLearner,
  });
  const classes = classesData?.data || [];
  const activeClasses = useMemo(() => classes.filter((cls) => cls.status === "active"), [classes]);
  const { data: coursesData } = useCoursesQuery();
  const courses = coursesData?.data || [];
  const [invoiceType, setInvoiceType] = useState(isAdmin ? "hub_subscription" : "learner_term");
  const [learnerId, setLearnerId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const { mutate: createInvoice, isPending: creating } = useCreateInvoice();
  const { mutate: issueInvoice } = useIssueInvoice();
  const { mutate: cancelInvoice } = useCancelInvoice();
  const invoices = invoicesData?.data || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(!isLearner);
  const [hubBillingMode, setHubBillingMode] = useState("group");
  const [adminScope, setAdminScope] = useState("hub");
  const [adminClassId, setAdminClassId] = useState("");
  const [bulkScope, setBulkScope] = useState("class");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkType, setBulkType] = useState("learner_term");
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkPeriod, setBulkPeriod] = useState("");
  const [bulkDueAt, setBulkDueAt] = useState("");
  const [bulkPreview, setBulkPreview] = useState(null);
  const { mutate: previewBulk, isPending: previewing } = useBulkInvoicePreview();
  const { mutate: createBulk, isPending: creatingBulk } = useCreateBulkInvoices();

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesSearch = !query || `${invoice.invoiceNumber} ${TYPE_LABELS[invoice.invoiceType]}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);
  const invoiceStats = useMemo(() => ({
    total: invoices.length,
    outstanding: invoices.filter((invoice) => ["issued", "partially_paid", "overdue"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.amountDue || 0), 0),
    paid: invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    overdue: invoices.filter((invoice) => invoice.status === "overdue").length,
  }), [invoices]);
  const adminLearnerCount = useMemo(() => {
    if (!isAdmin) return 0;
    return new Set(learners.filter((learner) => (learner.accountStatus || "active") === "active" && (learner.status || "active") === "active" && (adminScope === "hub" || learner.classId === adminClassId)).map((learner) => learner.id)).size;
  }, [adminClassId, adminScope, isAdmin, learners]);

  const submit = (event) => {
    event.preventDefault();
    if (!selectedHubId || !description || !amount) return;
    createInvoice({
      hubId: selectedHubId,
      invoiceType,
      classId: isAdmin && adminScope === "class" ? adminClassId : null,
      pricingMode: isAdmin ? "per_learner" : "flat",
      unitAmount: isAdmin ? Number(amount) : null,
      learnerId: invoiceType === "hub_subscription" ? null : learnerId,
      periodLabel: periodLabel || null,
      dueAt: dueAt || null,
      notes: notes || null,
      items: [{ description, unitAmount: Number(amount), quantity: 1, learnerId: learnerId || null, courseId: invoiceType === "course_module" ? courseId || null : null }],
    }, { onSuccess: () => { setDescription(""); setAmount(""); setPeriodLabel(""); setDueAt(""); setNotes(""); setLearnerId(""); setCourseId(""); } });
  };

  const bulkRequest = () => ({ hubId: selectedHubId, scopeType: bulkScope, classId: bulkScope === "class" ? bulkClassId : null, learnerIds: [], invoiceType: bulkType, periodLabel: bulkPeriod || null });
  const previewBulkInvoices = (event) => {
    event.preventDefault();
    previewBulk(bulkRequest(), { onSuccess: setBulkPreview });
  };
  const createBulkInvoices = () => {
    createBulk({ ...bulkRequest(), description: bulkDescription, unitAmount: Number(bulkAmount), dueAt: bulkDueAt || null }, { onSuccess: () => setBulkPreview(null) });
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <div style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 48%, #2e7db5 100%)", borderRadius: 18, padding: "26px 28px", marginBottom: 16, color: "#fff", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}><ReceiptLongIcon sx={{ fontSize: 16 }} /> Finance workspace</div><h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>{isLearner ? "My invoices" : "Billing"}</h1><p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.75)" }}>{isLearner ? "Review invoices assigned to your parent account." : "Create, issue, and track hub and learner invoices."}</p></div>
        {!isLearner && <button type="button" onClick={() => setShowForm((value) => !value)} style={{ ...buttonStyle, background: "#feb139", color: "#17304B", display: "inline-flex", alignItems: "center", gap: 7 }}><AddIcon sx={{ fontSize: 18 }} />{showForm ? "Hide invoice form" : "Create invoice"}</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[{ label: "All invoices", value: invoiceStats.total, icon: <ViewListIcon fontSize="small" />, color: "#25476a" }, { label: "Outstanding", value: formatMoney(invoiceStats.outstanding), icon: <AccountBalanceIcon fontSize="small" />, color: "#C2410C" }, { label: "Paid", value: formatMoney(invoiceStats.paid), icon: <PaidIcon fontSize="small" />, color: "#047857" }, { label: "Overdue", value: invoiceStats.overdue, icon: <EventNoteIcon fontSize="small" />, color: "#B91C1C" }].map((stat) => <div key={stat.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 11 }}><div style={{ width: 36, height: 36, borderRadius: 9, background: "#F1F7FB", color: stat.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{stat.icon}</div><div><div style={{ fontSize: 18, fontWeight: 850, color: stat.color, fontVariantNumeric: "tabular-nums" }}>{stat.value}</div><div style={{ fontSize: 11, color: "#6B7280" }}>{stat.label}</div></div></div>)}
      </div>

      {!isLearner && !isAdmin && showForm && <section style={{ background: "#F8FBFD", border: "1px solid #CFE7F3", borderRadius: 14, padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 16, color: "#17304B" }}>Create learner invoices</h2><p style={{ margin: "5px 0 0", fontSize: 12, color: "#6B7280" }}>Choose whether to invoice one learner or a whole group. Group invoices remain separate for every parent.</p></div><AccountBalanceIcon sx={{ color: "#38aae1" }} /><div style={{ display: "flex", padding: 3, background: "#E8F3F8", borderRadius: 9, gap: 3, width: "100%", maxWidth: 330 }}><button type="button" onClick={() => setHubBillingMode("group")} style={{ flex: 1, padding: "8px 10px", border: 0, borderRadius: 7, background: hubBillingMode === "group" ? "#25476a" : "transparent", color: hubBillingMode === "group" ? "#fff" : "#25476a", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Invoice a group</button><button type="button" onClick={() => { setHubBillingMode("individual"); setBulkPreview(null); }} style={{ flex: 1, padding: "8px 10px", border: 0, borderRadius: 7, background: hubBillingMode === "individual" ? "#25476a" : "transparent", color: hubBillingMode === "individual" ? "#fff" : "#25476a", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>One learner</button></div></div>
        {hubBillingMode === "group" && <><form onSubmit={previewBulkInvoices}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Scope"><select value={bulkScope} onChange={(e) => { setBulkScope(e.target.value); setBulkPreview(null); }} style={inputStyle}><option value="class">Whole class</option><option value="hub">Whole hub</option></select></Field>
            {bulkScope === "class" && <Field label="Class"><select value={bulkClassId} onChange={(e) => { setBulkClassId(e.target.value); setBulkPreview(null); }} style={inputStyle}><option value="">Select a class</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.gradeName || cls.name}{cls.streamName ? ` - ${cls.streamName}` : ""}</option>)}</select></Field>}
            <Field label="Invoice type"><select value={bulkType} onChange={(e) => setBulkType(e.target.value)} style={inputStyle}><option value="learner_term">Per learner per term</option><option value="course_module">Per course / module</option><option value="bootcamp">One-time bootcamp</option></select></Field>
            <Field label="Amount per learner (KES)"><input type="number" min="0.01" step="0.01" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
            <Field label="Description"><input value={bulkDescription} onChange={(e) => setBulkDescription(e.target.value)} placeholder="Term tuition or bootcamp fee" style={inputStyle} /></Field>
            {bulkType === "learner_term" && <Field label="Term / period"><input value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)} placeholder="Term 1, 2026" style={inputStyle} /></Field>}
            <Field label="Due date"><input type="date" value={bulkDueAt} onChange={(e) => setBulkDueAt(e.target.value)} style={inputStyle} /></Field>
          </div>
          <button type="submit" disabled={previewing || !selectedHubId || (bulkScope === "class" && !bulkClassId) || !bulkAmount || !bulkDescription} style={{ ...buttonStyle, marginTop: 14, opacity: previewing ? .6 : 1 }}>{previewing ? "Checking learners…" : "Preview group invoices"}</button>
        </form>
        {bulkPreview && hubBillingMode === "group" && <div style={{ marginTop: 16, padding: 14, background: "#fff", border: "1px solid #D7EAF2", borderRadius: 10 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong style={{ fontSize: 13 }}>{bulkPreview.eligible} invoices ready</strong><div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>{bulkPreview.total} learners checked · {bulkPreview.skipped} skipped · Expected total {formatMoney(bulkPreview.eligible * Number(bulkAmount))}</div></div><button type="button" onClick={createBulkInvoices} disabled={creatingBulk || bulkPreview.eligible === 0} style={{ ...buttonStyle, opacity: creatingBulk ? .6 : 1 }}>{creatingBulk ? "Creating…" : "Create and issue"}</button></div>{bulkPreview.learners?.filter((row) => row.status === "skipped").slice(0, 5).map((row) => <div key={row.learnerId} style={{ marginTop: 8, fontSize: 11.5, color: "#B45309" }}>{row.name}: {row.reason}</div>)}{bulkPreview.skipped > 5 && <div style={{ marginTop: 6, fontSize: 11.5, color: "#9CA3AF" }}>And {bulkPreview.skipped - 5} more skipped learners.</div>}</div>}
        </>}
      </section>}

      {!isLearner && showForm && (isAdmin || hubBillingMode === "individual") && (
        <form onSubmit={submit} style={{ background: isAdmin ? "#fff" : "transparent", border: isAdmin ? "1px solid #E5E7EB" : 0, borderRadius: isAdmin ? 14 : 0, padding: isAdmin ? 20 : 0, marginBottom: isAdmin ? 18 : 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}><div><h2 style={{ margin: 0, fontSize: 16 }}>Create invoice</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{isAdmin ? "Invoice a learning hub for platform services." : "Invoice a learner; their parent account will receive the notification."}</p></div><DescriptionOutlinedIcon sx={{ color: "#38aae1" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
            {(isAdmin ? ["hub_subscription"] : ["learner_term", "course_module", "bootcamp"]).map((type) => <button key={type} type="button" onClick={() => { setInvoiceType(type); setLearnerId(""); }} style={{ textAlign: "left", padding: "12px 13px", borderRadius: 10, border: `1.5px solid ${invoiceType === type ? "#38aae1" : "#E5E7EB"}`, background: invoiceType === type ? "#F1F9FD" : "#fff", cursor: "pointer", fontFamily: "inherit" }}><div style={{ fontSize: 12.5, fontWeight: 800, color: "#25476a" }}>{TYPE_LABELS[type]}</div><div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.4, color: "#6B7280" }}>{TYPE_HELP[type]}</div></button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            {isAdmin && <Field label="Learning hub"><select value={hubId} onChange={(e) => { setHubId(e.target.value); setAdminClassId(""); setLearnerId(""); }} style={inputStyle}><option value="">Select a hub</option>{hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select></Field>}
            {isAdmin && <Field label="Charge scope"><select value={adminScope} onChange={(e) => { setAdminScope(e.target.value); setAdminClassId(""); }} style={inputStyle}><option value="hub">Whole hub</option><option value="class">Specific class</option></select></Field>}
            {isAdmin && adminScope === "class" && <Field label="Class"><select value={adminClassId} onChange={(e) => setAdminClassId(e.target.value)} style={inputStyle}><option value="">Select a class</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.gradeName || cls.name}{cls.streamName ? ` - ${cls.streamName}` : ""}</option>)}</select></Field>}
            <Field label="Invoice type"><select value={invoiceType} onChange={(e) => { setInvoiceType(e.target.value); setLearnerId(""); }} style={inputStyle}>{(isAdmin ? ["hub_subscription"] : ["learner_term", "course_module", "bootcamp"]).map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></Field>
            {invoiceType !== "hub_subscription" && <Field label="Learner"><select value={learnerId} onChange={(e) => setLearnerId(e.target.value)} style={inputStyle}><option value="">Select a learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}</option>)}</select></Field>}
            {invoiceType === "course_module" && <Field label="Course / module"><select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={inputStyle}><option value="">Optional course link</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>}
            <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={invoiceType === "bootcamp" ? "Robotics bootcamp" : "Tuition / course fee"} style={inputStyle} /></Field>
            <Field label={isAdmin ? "Amount per learner (KES)" : "Amount (KES)"}><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
            {invoiceType === "learner_term" && <Field label="Term / period"><input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="Term 1, 2026" style={inputStyle} /></Field>}
            <Field label="Due date"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 12, resize: "vertical" }} /></Field>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span style={{ fontSize: 11.5, color: "#6B7280" }}><SchoolIcon sx={{ fontSize: 15, verticalAlign: "middle", marginRight: 4 }} />{isAdmin ? `${adminLearnerCount} active learner${adminLearnerCount === 1 ? "" : "s"} · ${adminScope === "hub" ? activeClasses.length : 1} active class${(adminScope === "hub" ? activeClasses.length : 1) === 1 ? "" : "es"} · Total ${formatMoney(adminLearnerCount * Number(amount || 0))}` : "Invoices are saved as drafts before sending."}</span><button type="submit" disabled={creating || !selectedHubId || !description || !amount || (isAdmin && adminLearnerCount === 0) || (isAdmin && adminScope === "class" && !adminClassId) || (invoiceType !== "hub_subscription" && !learnerId)} style={{ ...buttonStyle, opacity: creating ? .6 : 1 }}>{creating ? "Saving…" : "Save draft"}</button></div>
        </form>
      )}

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 16 }}>Invoices</h2><p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>{filteredInvoices.length} of {invoices.length} invoice{invoices.length === 1 ? "" : "s"}</p></div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><label style={{ position: "relative" }}><SearchIcon sx={{ position: "absolute", left: 9, top: 8, fontSize: 16, color: "#9CA3AF" }} /><input aria-label="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number" style={{ ...inputStyle, width: 190, paddingLeft: 30 }} /></label><select aria-label="Filter invoice status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 145 }}><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
        {invoicesLoading ? <div style={{ padding: 24, color: "#6B7280" }}>Loading invoices…</div> : filteredInvoices.length === 0 ? <div style={{ padding: "42px 20px", textAlign: "center" }}><ReceiptLongIcon sx={{ fontSize: 36, color: "#B8C8D5", marginBottom: 8 }} /><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>{invoices.length === 0 ? "No invoices yet" : "No matching invoices"}</p><p style={{ margin: "5px 0 0", fontSize: 12, color: "#9CA3AF" }}>{invoices.length === 0 && !isLearner ? "Create a draft above to start your billing record." : "Try a different search or status filter."}</p></div> : filteredInvoices.map((invoice) => (
          <div key={invoice.id} role="button" tabIndex={0} onClick={() => navigate(`${isLearner ? "/learner-portal/invoices" : user?.role === "school" ? "/school-portal/billing" : "/billing"}/${invoice.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`${isLearner ? "/learner-portal/invoices" : user?.role === "school" ? "/school-portal/billing" : "/billing"}/${invoice.id}`); } }} style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(220px, 1fr) auto", alignItems: "center", gap: 16, cursor: "pointer", transition: "background .15s" }}>
            <div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}><strong style={{ fontSize: 13, color: "#111827" }}>{invoice.invoiceNumber}</strong><StatusPill status={invoice.status} /></div><div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>{TYPE_LABELS[invoice.invoiceType]} <span style={{ color: "#CBD5E1" }}>·</span> Created {formatDate(invoice.createdAt)} <span style={{ color: "#CBD5E1" }}>·</span> Due {formatDate(invoice.dueAt)}</div></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 14, flexWrap: "wrap" }}><div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 850, color: "#25476a" }}>{formatMoney(invoice.total, invoice.currency)}</div><div style={{ fontSize: 11, color: invoice.amountDue > 0 ? "#C2410C" : "#047857", marginTop: 3 }}>{invoice.amountDue > 0 ? `${formatMoney(invoice.amountDue, invoice.currency)} due` : "Fully paid"}</div></div>{!isLearner && <div style={{ display: "flex", gap: 7 }} onClick={(event) => event.stopPropagation()}>{invoice.status === "draft" && <button type="button" title="Issue invoice" aria-label={`Issue ${invoice.invoiceNumber}`} onClick={() => issueInvoice(invoice.id)} style={{ ...buttonStyle, display: "inline-flex", alignItems: "center", gap: 5 }}><SendIcon sx={{ fontSize: 15 }} />Issue</button>}{["draft", "issued", "overdue"].includes(invoice.status) && <button type="button" title="Cancel invoice" aria-label={`Cancel ${invoice.invoiceNumber}`} onClick={() => cancelInvoice(invoice.id)} style={{ ...buttonStyle, padding: "8px 10px", background: "#fff", color: "#B91C1C", border: "1px solid #FECACA" }}><CancelOutlinedIcon sx={{ fontSize: 17 }} /></button>}</div>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
