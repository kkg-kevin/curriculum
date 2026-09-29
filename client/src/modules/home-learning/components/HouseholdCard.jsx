import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiAlertTriangle, FiBookOpen, FiCalendar, FiEdit2, FiFileText, FiFlag, FiKey, FiMail, FiMapPin, FiPackage, FiPhone,
  FiUser, FiUserPlus, FiUsers, FiX,
} from "react-icons/fi";
import HomeLocation from "./HomeLocation";
import { EnrollmentFields, HouseholdFields } from "./HouseholdFields";
import {
  ENROLLMENT_STATUS, HOUSEHOLD_STATUS, Initials, Pill, formatDate, formatMoney, inputStyle, labelStyle, panelStyle,
  primaryButton, secondaryButton, thisMonth, toDateInput,
} from "./ui";

const EMPTY_CHILD = { firstName: "", lastName: "", gender: "", dateOfBirth: "", username: "", password: "", learnerPassword: "", curriculumId: "", gradeId: "", educatorId: "" };
const INVOICE_STATUS_COLORS = { paid: "#047857", partially_paid: "#C2410C", overdue: "#B91C1C", issued: "#1D4ED8" };
const tileStyle = { border: "1px solid #EEF1F5", borderRadius: 12, padding: 16, background: "#FBFCFE", minWidth: 0 };
const mutedText = { color: "#6B7280", fontSize: 13 };
const linkText = { color: "#25476a", textDecoration: "none", fontWeight: 600, overflowWrap: "anywhere" };
const formGrid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap: 12, alignItems: "end" });

function Tile({ icon: Icon, title, action, children }) {
  return <section style={tileStyle}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
      <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, color: "#25476a", letterSpacing: ".04em", textTransform: "uppercase" }}><Icon /> {title}</h4>
      {action}
    </div>
    <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#374151" }}>{children}</div>
  </section>;
}

function IconLine({ icon: Icon, children }) {
  return <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}><Icon style={{ flexShrink: 0, marginTop: 2, color: "#9CA3AF" }} /><div style={{ minWidth: 0 }}>{children}</div></div>;
}

// Can the parent sign in to see their children and this household's invoices?
const PORTAL_STATES = {
  active: { tone: { color: "#047857", background: "#ECFDF5" }, label: "Parent portal active", hint: "They sign in with this email to see invoices." },
  missing: { tone: { color: "#B45309", background: "#FFFBEB" }, label: "Parent portal not set up", hint: "Set a portal password so they can see invoices.", action: "Set password" },
  no_email: { tone: { color: "#6B7280", background: "#F3F4F6" }, label: "No parent portal", hint: "Add the parent's email and a password so they can see invoices.", action: "Add email" },
  conflict: { tone: { color: "#B91C1C", background: "#FEF2F2" }, label: "Email belongs to a staff account", hint: "Use a different email for the parent's portal login." },
};

function ParentPortal({ status, onSetUp }) {
  const state = PORTAL_STATES[status];
  if (!state) return null;
  return <div style={{ marginTop: 4, padding: "8px 10px", borderRadius: 8, ...state.tone, fontSize: 12 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiKey /> {state.label}</strong>
      {state.action && <button type="button" onClick={onSetUp} style={{ ...secondaryButton, padding: "3px 8px", fontSize: 11 }}>{state.action}</button>}
    </div>
    <div style={{ marginTop: 3, opacity: 0.9 }}>{state.hint}</div>
  </div>;
}

// Children whose profile names a different parent email from the household's — grouped by that
// parent. Their portal login reaches the child but not this household's invoices.
function profileParentMismatches(household, children) {
  const same = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  const byEmail = new Map();
  for (const item of children) {
    const learner = item.learner;
    if (item.status === "removed" || !learner?.guardianEmail || same(learner.guardianEmail, household.guardianEmail)) continue;
    const key = learner.guardianEmail.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, { name: learner.guardianName, email: learner.guardianEmail, phone: learner.guardianPhone, children: [] });
    byEmail.get(key).children.push(learner.firstName);
  }
  return [...byEmail.values()];
}

function ParentMismatch({ household, parent, onUse, saving }) {
  const names = parent.children.join(" and ");
  return <div style={{ margin: "16px 22px 0", padding: "12px 14px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#78350F", fontSize: 13, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
    <FiAlertTriangle style={{ flexShrink: 0 }} />
    <div style={{ flex: "1 1 320px" }}>
      <strong>{names}'s profile lists a different parent:</strong> {parent.name || "Unnamed"} · {parent.email}{parent.phone ? ` · ${parent.phone}` : ""}.{" "}
      {household.guardianEmail ? `Invoices are only visible to this household's parent (${household.guardianEmail}).` : "This household has no parent email, so no one can see its invoices in the portal."}
    </div>
    <button type="button" disabled={saving} onClick={() => {
      if (window.confirm(`Make ${parent.name || parent.email} this household's parent? Invoices will be addressed to them and visible in their portal.`)) onUse(parent);
    }} style={{ ...secondaryButton, borderColor: "#D97706", color: "#92400E" }}>Use {parent.name || "this parent"} for the household</button>
  </div>;
}

function PlacesBar({ filled, total }) {
  const pct = total ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 5 }}>
      <span><strong style={{ color: "#111827" }}>{filled}</strong> of {total} places filled</span>
      <span>{Math.max(0, total - filled)} free</span>
    </div>
    <div style={{ height: 6, borderRadius: 999, background: "#E5E7EB", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#047857" : "#2E7DB5" }} /></div>
  </div>;
}

function BillingTile({ household, canBill, onInvoice, invoicing }) {
  const [period, setPeriod] = useState(thisMonth());
  const [dueDate, setDueDate] = useState("");
  const [showAll, setShowAll] = useState(false);
  const billing = household.billing || { outstanding: 0, overdue: false, invoices: [] };
  const invoices = showAll ? billing.invoices : billing.invoices.slice(0, 3);
  return <Tile icon={FiFileText} title="Billing" action={billing.overdue && <Pill tone={{ color: "#B91C1C", background: "#FEF2F2" }}><FiAlertTriangle /> Overdue</Pill>}>
    <div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>Outstanding</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: billing.outstanding > 0 ? "#B45309" : "#047857" }}>{formatMoney(billing.outstanding)}</div>
    </div>
    {billing.invoices.length === 0
      ? <span style={mutedText}>No invoices yet.</span>
      : <div style={{ display: "grid", gap: 4 }}>
        {invoices.map((invoice) => <Link key={invoice.id} to={`/billing/${invoice.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, textDecoration: "none", color: "#374151", fontSize: 12, padding: "5px 8px", borderRadius: 7, background: "#fff", border: "1px solid #EEF1F5" }}>
          <span>{invoice.periodLabel?.replace("Home Learning · ", "") || invoice.invoiceNumber}</span>
          <span>{formatMoney(invoice.total)} · <strong style={{ color: INVOICE_STATUS_COLORS[invoice.status] || "#6B7280", textTransform: "capitalize" }}>{invoice.status.replace("_", " ")}</strong></span>
        </Link>)}
        {billing.invoices.length > 3 && <button type="button" onClick={() => setShowAll((v) => !v)} style={{ ...secondaryButton, border: 0, padding: 0, background: "none", color: "#25476a" }}>{showAll ? "Show fewer" : `Show ${billing.invoices.length - 3} more`}</button>}
      </div>}
    {canBill && household.status === "active" && <form onSubmit={(e) => { e.preventDefault(); onInvoice({ id: household.id, period, dueDate }); }} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      <input aria-label="Invoice month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required style={{ ...inputStyle, flex: "1 1 120px", width: "auto", padding: "6px 8px", fontSize: 12 }} />
      <input aria-label="Due date" title="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px", width: "auto", padding: "6px 8px", fontSize: 12 }} />
      <button disabled={invoicing} style={{ ...secondaryButton, flex: "1 1 100%", justifyContent: "center", borderColor: "#2E7DB5", color: "#2E7DB5" }}>{invoicing ? "Invoicing…" : "Invoice month"}</button>
    </form>}
    {canBill && household.status !== "active" && <span style={{ ...mutedText, fontSize: 12 }}>Set the household to Active to raise invoices.</span>}
  </Tile>;
}

function ChildCard({ household, item, curricula, educators, onSave, onRemove, saving, canAddActive }) {
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
  return <div style={{ gridColumn: editing ? "1/-1" : undefined, border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, background: removed ? "#FAFAFA" : "#fff", opacity: removed && !editing ? 0.75 : 1, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Initials name={name} photo={item.learner?.photo} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>{name}</strong>
          <Pill tone={ENROLLMENT_STATUS[item.status] || ENROLLMENT_STATUS.paused}>{ENROLLMENT_STATUS[item.status]?.label || item.status}</Pill>
        </div>
        <div style={{ display: "grid", gap: 3, marginTop: 6, fontSize: 12, color: "#4B5563" }}>
          <IconLine icon={FiBookOpen}>{item.curriculum?.name || "Curriculum"} · {item.gradeName || <span style={{ color: "#B45309", fontWeight: 700 }}>Grade not set — edit to create this child's class</span>}</IconLine>
          <IconLine icon={FiUser}>{item.educator ? `${item.educator.firstName} ${item.educator.lastName}` : <span style={{ color: "#B45309" }}>Educator not assigned</span>}</IconLine>
        </div>
      </div>
    </div>
    {!editing && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {item.learner && <Link to={`/learners/${item.learnerId}/view`} style={{ ...secondaryButton, textDecoration: "none" }}>Profile</Link>}
      {removed
        ? <button type="button" disabled={!canAddActive} title={canAddActive ? "" : "No free places in this package"} onClick={() => startEdit("active")} style={secondaryButton}>Re-add</button>
        : <>
          <button type="button" onClick={() => startEdit(item.status)} style={secondaryButton}><FiEdit2 /> Edit</button>
          <button type="button" onClick={() => onRemove({ householdId: household.id, learnerId: item.learnerId, name })} style={{ ...secondaryButton, color: "#B91C1C" }}>Remove</button>
        </>}
    </div>}
    {editing && <form onSubmit={submit} style={formGrid(180)}>
      <EnrollmentFields values={draft} setValue={setValue} curricula={curricula} educators={educators} />
      <label style={labelStyle}>Status<select style={inputStyle} value={draft.status} onChange={(e) => setValue("status", e.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={saving} style={{ ...primaryButton, padding: "10px 14px" }}>{saving ? "Saving…" : removed ? "Re-add" : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} style={secondaryButton}>Cancel</button>
      </div>
    </form>}
  </div>;
}

// "Add a child": either place a learner already in the workspace, or register a new one.
// How the picked learner's profile parent compares with this household's parent — the parent's
// portal login is keyed on the email, so a mismatch means they won't see this child's invoices.
function parentNote(learner, household) {
  if (!learner) return null;
  const same = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
  if (!learner.guardianEmail) {
    return household.guardianEmail
      ? { tone: "info", text: `${learner.firstName}'s profile has no parent email — it will be given ${household.guardianEmail}, so the parent sees them in the portal.` }
      : null;
  }
  if (!household.guardianEmail) {
    return { tone: "warn", text: `${learner.firstName}'s profile lists ${learner.guardianName || "a parent"} (${learner.guardianEmail}). Add that email to this household if they are the parent who pays, so they can see the invoices.` };
  }
  if (!same(learner.guardianEmail, household.guardianEmail)) {
    return { tone: "warn", text: `${learner.firstName}'s profile lists a different parent — ${learner.guardianName || "unnamed"} (${learner.guardianEmail}). Their profile is left as is, and that parent won't see this household's invoices.` };
  }
  return { tone: "ok", text: `The parent on ${learner.firstName}'s profile matches this household.` };
}
const NOTE_TONES = { info: { color: "#1D4ED8", background: "#EFF6FF" }, warn: { color: "#92400E", background: "#FFFBEB" }, ok: { color: "#047857", background: "#ECFDF5" } };

function AddChildPanel({ household, availableLearners, curricula, educators, actions, pending, onClose, initialLearnerId }) {
  const [mode, setMode] = useState("existing");
  const [assignment, setAssignment] = useState(initialLearnerId ? { learnerId: initialLearnerId } : {});
  const [child, setChild] = useState(EMPTY_CHILD);
  const setAssign = (key, value) => setAssignment((current) => ({ ...current, [key]: value }));
  const setChildValue = (key, value) => setChild((current) => ({ ...current, [key]: value }));
  const tab = (key, label) => <button type="button" onClick={() => setMode(key)} style={{ border: 0, borderBottom: `2px solid ${mode === key ? "#25476a" : "transparent"}`, background: "none", padding: "8px 2px", fontSize: 13, fontWeight: 700, color: mode === key ? "#25476a" : "#6B7280", cursor: "pointer" }}>{label}</button>;

  return <div style={{ marginTop: 12, border: "1px dashed #A8D5EE", background: "#F8FBFE", borderRadius: 12, padding: 16 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #E5E7EB", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 18 }}>{tab("existing", "Existing learner")}{tab("new", "Register new learner")}</div>
      <button type="button" onClick={onClose} aria-label="Close" style={{ ...secondaryButton, border: 0, background: "none" }}><FiX size={16} /></button>
    </div>
    {mode === "existing"
      ? <form onSubmit={(event) => { event.preventDefault(); actions.saveEnrollment({ householdId: household.id, ...assignment, status: "active" }, onClose); }} style={formGrid(170)}>
        <label style={labelStyle}>Learner<select style={inputStyle} value={assignment.learnerId || ""} onChange={(e) => setAssign("learnerId", e.target.value)}><option value="">{availableLearners.length ? "Choose learner" : "No unplaced learners"}</option>{availableLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}</option>)}</select></label>
        <EnrollmentFields values={assignment} setValue={setAssign} curricula={curricula} educators={educators} />
        {(() => {
          const note = parentNote(availableLearners.find((l) => l.id === assignment.learnerId), household);
          return note && <div style={{ gridColumn: "1/-1", ...NOTE_TONES[note.tone], borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>{note.text}</div>;
        })()}
        <button disabled={pending.enrolling} style={{ ...primaryButton, background: "#2E7DB5", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><FiUsers /> {pending.enrolling ? "Assigning…" : "Assign learner"}</button>
      </form>
      : <form onSubmit={(event) => {
        event.preventDefault();
        if (!child.curriculumId || !child.gradeId) return toast.error("Choose a curriculum and grade first");
        const { curriculumId, gradeId, educatorId, ...learner } = child;
        actions.createLearner({ householdId: household.id, curriculumId, gradeId, educatorId, learner }, onClose);
      }} style={formGrid(190)}>
        <label style={labelStyle}>First name<input style={inputStyle} required value={child.firstName} onChange={(e) => setChildValue("firstName", e.target.value)} /></label>
        <label style={labelStyle}>Last name<input style={inputStyle} required value={child.lastName} onChange={(e) => setChildValue("lastName", e.target.value)} /></label>
        <label style={labelStyle}>Gender<select style={inputStyle} required value={child.gender} onChange={(e) => setChildValue("gender", e.target.value)}><option value="">Choose</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
        <label style={labelStyle}>Date of birth<input style={inputStyle} type="date" value={child.dateOfBirth} onChange={(e) => setChildValue("dateOfBirth", e.target.value)} /></label>
        <label style={labelStyle}>Learner username (optional)<input style={inputStyle} value={child.username} onChange={(e) => setChildValue("username", e.target.value)} /></label>
        <label style={labelStyle}>Guardian portal password (optional; sets or resets login)<input style={inputStyle} type="password" minLength={8} disabled={!household.guardianEmail} placeholder={household.guardianEmail ? "" : "Add a guardian email first"} value={child.password} onChange={(e) => setChildValue("password", e.target.value)} /></label>
        {child.username && <label style={labelStyle}>Learner portal password<input style={inputStyle} type="password" minLength={8} value={child.learnerPassword} onChange={(e) => setChildValue("learnerPassword", e.target.value)} /></label>}
        <EnrollmentFields values={child} setValue={setChildValue} curricula={curricula} educators={educators} />
        <button disabled={pending.creatingLearner} style={primaryButton}>{pending.creatingLearner ? "Registering…" : "Register and assign"}</button>
      </form>}
  </div>;
}

export default function HouseholdCard({ household, focused, cardRef, packages, curricula, educators, availableLearners, canBill, actions, pending, prefillLearnerId }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  // A household just created from an existing learner opens with that learner ready to assign.
  const [adding, setAdding] = useState(Boolean(prefillLearnerId));
  const children = household.learners || [];
  const activeCount = children.filter((item) => item.status === "active").length;
  const remaining = Math.max(0, Number(household.childCount) - activeCount);
  const status = HOUSEHOLD_STATUS[household.status] || HOUSEHOLD_STATUS.pending;
  const address = [household.addressLine, household.town, household.subCounty, household.county].filter(Boolean).join(", ");

  const startEdit = () => {
    setDraft({ ...household, startDate: toDateInput(household.startDate), locationPhotos: household.locationPhotos || [], portalPassword: "" });
    setEditing(true);
  };
  const saveDetails = (event) => {
    event.preventDefault();
    // Only send the package when it actually changed — re-sending it re-prices the household at
    // the package's current price, which should only happen on purpose.
    const packageChanged = draft.packageId !== household.packageId || Number(draft.childCount || 0) !== Number(household.childCount);
    actions.updateHousehold(household.id, {
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
      mapUrl: draft.mapUrl || "",
      locationPhotos: draft.locationPhotos || [],
      notes: draft.notes || "",
      ...(draft.portalPassword ? { portalPassword: draft.portalPassword } : {}),
    }, () => setEditing(false));
  };

  return <article ref={cardRef} style={{ ...panelStyle, padding: 0, overflow: "hidden", ...(focused ? { borderColor: "#2E7DB5", boxShadow: "0 0 0 3px rgba(46,125,181,.18)" } : {}) }}>
    <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 22px", background: "#F8FAFC", borderBottom: "1px solid #EEF1F5", borderLeft: `4px solid ${status.color}` }}>
      <Initials name={household.guardianName} size={46} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{household.guardianName}</h3>
          <Pill tone={status}>{status.label}</Pill>
        </div>
        <div style={{ ...mutedText, marginTop: 3 }}>
          {household.package?.name || "No package"} · {children.length === 0 ? "No children yet" : `${activeCount} ${activeCount === 1 ? "child" : "children"} learning`}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#25476a" }}>{formatMoney(household.monthlyAmount)}<span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>/month</span></div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select aria-label="Household status" value={household.status} onChange={(event) => actions.updateHousehold(household.id, { status: event.target.value })} style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
          <option value="pending">Pending</option><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option>
        </select>
        <button type="button" onClick={editing ? () => setEditing(false) : startEdit} style={{ ...secondaryButton, padding: "8px 12px", fontSize: 13 }}>{editing ? <><FiX /> Close</> : <><FiEdit2 /> Edit details</>}</button>
      </div>
    </header>

    {profileParentMismatches(household, children).map((parent) => <ParentMismatch key={parent.email} household={household} parent={parent} saving={pending.updating}
      onUse={(p) => actions.updateHousehold(household.id, { guardianName: p.name || household.guardianName, guardianEmail: p.email, guardianPhone: p.phone || household.guardianPhone })} />)}

    {editing && <form onSubmit={saveDetails} style={{ ...formGrid(200), padding: "18px 22px", borderBottom: "1px solid #EEF1F5", background: "#FCFDFE" }}>
      <HouseholdFields values={draft} setValue={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} packages={packages} currentPackageId={household.packageId} />
      <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={() => setEditing(false)} style={{ ...secondaryButton, padding: "10px 14px", fontSize: 13 }}>Cancel</button>
        <button disabled={pending.updating} style={primaryButton}>{pending.updating ? "Saving…" : "Save household details"}</button>
      </div>
    </form>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14, padding: "18px 22px" }}>
      <Tile icon={FiPhone} title="Contact">
        <IconLine icon={FiPhone}><a href={`tel:${household.guardianPhone}`} style={linkText}>{household.guardianPhone}</a></IconLine>
        <IconLine icon={FiMail}>{household.guardianEmail ? <a href={`mailto:${household.guardianEmail}`} style={linkText}>{household.guardianEmail}</a> : <span style={mutedText}>No email — add one to give the guardian portal access</span>}</IconLine>
        <IconLine icon={FiCalendar}>{household.startDate ? `Started ${formatDate(household.startDate)}` : <span style={mutedText}>Start date not set</span>}</IconLine>
        <ParentPortal status={household.parentPortal} onSetUp={startEdit} />
      </Tile>

      <Tile icon={FiMapPin} title="Home location">
        <IconLine icon={FiMapPin}>{address || <span style={mutedText}>Home address not recorded</span>}</IconLine>
        {household.landmark && <IconLine icon={FiFlag}><span style={mutedText}>Landmark:</span> {household.landmark}</IconLine>}
        {household.mapUrl || household.locationPhotos?.length
          ? <HomeLocation mapUrl={household.mapUrl} photos={household.locationPhotos} />
          : <button type="button" onClick={startEdit} style={{ ...secondaryButton, justifySelf: "start" }}>Add map link &amp; photos</button>}
      </Tile>

      <Tile icon={FiPackage} title="Package">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{household.package?.name || "No package"}{household.package?.status === "archived" && <span style={{ ...mutedText, fontWeight: 500, fontSize: 12 }}> (archived)</span>}</div>
        <div style={mutedText}>{formatMoney(household.monthlyAmount)} per month</div>
        <PlacesBar filled={activeCount} total={Number(household.childCount)} />
      </Tile>

      <BillingTile household={household} canBill={canBill} onInvoice={actions.invoice} invoicing={pending.invoicing} />
    </div>

    {household.notes && <div style={{ margin: "-4px 22px 16px", padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 13, color: "#78350F", whiteSpace: "pre-wrap" }}><strong>Notes: </strong>{household.notes}</div>}

    <section style={{ padding: "0 22px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><FiUsers style={{ color: "#25476a" }} /> Children <span style={{ ...mutedText, fontWeight: 500 }}>· {activeCount} of {household.childCount} places filled</span></h4>
        {remaining > 0 && !adding && <button type="button" onClick={() => setAdding(true)} style={{ ...secondaryButton, borderColor: "#2E7DB5", color: "#2E7DB5", padding: "8px 12px", fontSize: 13 }}><FiUserPlus /> Add a child</button>}
        {remaining === 0 && <span style={{ ...mutedText, fontSize: 12 }}>All places filled — change the package to add more children.</span>}
      </div>
      {children.length === 0 && !adding && <div style={{ ...mutedText, textAlign: "center", padding: 18, border: "1px dashed #D1D5DB", borderRadius: 12 }}>No children in this household yet.</div>}
      {children.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
        {children.map((item) => <ChildCard key={item.id} household={household} item={item} curricula={curricula} educators={educators} onSave={actions.saveEnrollment} onRemove={actions.removeLearner} saving={pending.enrolling} canAddActive={remaining > 0} />)}
      </div>}
      {adding && remaining > 0 && <AddChildPanel household={household} availableLearners={availableLearners} curricula={curricula} educators={educators} actions={actions} pending={pending} onClose={() => setAdding(false)} initialLearnerId={prefillLearnerId} />}
    </section>
  </article>;
}
