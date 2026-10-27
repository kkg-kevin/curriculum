import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiBookOpen, FiCalendar, FiEdit2, FiFileText, FiGlobe, FiMail, FiPackage, FiPhone, FiUsers, FiX } from "react-icons/fi";
import { priceForPackage } from "../../home-learning/services/homeLearningApi";
import {
  HOUSEHOLD_STATUS, Initials, Pill, formatDate, formatMoney, inputStyle, labelStyle, panelStyle, primaryButton, secondaryButton, thisMonth,
} from "../../home-learning/components/ui";

// One family's membership of one club — the club counterpart of Home Learning's HouseholdCard,
// with the same look. Children are placed in one of the club's classes instead of getting their
// own curriculum and grade.

const INVOICE_STATUS_COLORS = { paid: "#047857", partially_paid: "#C2410C", overdue: "#B91C1C", issued: "#1D4ED8" };
const tileStyle = { border: "1px solid #EEF1F5", borderRadius: 12, padding: 16, background: "#FBFCFE", minWidth: 0 };
const mutedText = { color: "#6B7280", fontSize: 13 };
const linkText = { color: "#25476a", textDecoration: "none", fontWeight: 600, overflowWrap: "anywhere" };
const formGrid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap: 12, alignItems: "end" });
const PAYMENT_METHODS = [["cash", "Cash"], ["mpesa_manual", "M-Pesa"], ["bank_transfer", "Bank transfer"], ["cheque", "Cheque"], ["card_manual", "Card"], ["other", "Other"]];
const childName = (child) => (child.learner ? `${child.learner.firstName} ${child.learner.lastName}` : "Learner");

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

function BillingTile({ membership, canBill, onInvoice, invoicing }) {
  const [period, setPeriod] = useState(thisMonth());
  const [dueDate, setDueDate] = useState("");
  const billing = membership.billing || { outstanding: 0, overdue: false, invoices: [] };
  return <Tile icon={FiFileText} title="Billing" action={billing.overdue && <Pill tone={{ color: "#B91C1C", background: "#FEF2F2" }}><FiAlertTriangle /> Overdue</Pill>}>
    <div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>Outstanding</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: billing.outstanding > 0 ? "#B45309" : "#047857" }}>{formatMoney(billing.outstanding)}</div>
    </div>
    {billing.invoices.length === 0
      ? <span style={mutedText}>No invoices yet.</span>
      : <div style={{ display: "grid", gap: 4 }}>
        {billing.invoices.slice(0, 4).map((invoice) => <Link key={invoice.id} to={`/billing/${invoice.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, textDecoration: "none", color: "#374151", fontSize: 12, padding: "5px 8px", borderRadius: 7, background: "#fff", border: "1px solid #EEF1F5" }}>
          <span>{invoice.periodLabel?.replace("Tech Club · ", "") || invoice.invoiceNumber}</span>
          <span>{formatMoney(invoice.total)} · <strong style={{ color: INVOICE_STATUS_COLORS[invoice.status] || "#6B7280", textTransform: "capitalize" }}>{invoice.status.replace("_", " ")}</strong></span>
        </Link>)}
      </div>}
    {canBill && membership.status === "active" && <form onSubmit={(e) => { e.preventDefault(); onInvoice({ id: membership.id, period, dueDate }); }} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      <input aria-label="Invoice month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required style={{ ...inputStyle, flex: "1 1 120px", width: "auto", padding: "6px 8px", fontSize: 12 }} />
      <input aria-label="Due date" title="Due date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px", width: "auto", padding: "6px 8px", fontSize: 12 }} />
      <button disabled={invoicing} style={{ ...secondaryButton, flex: "1 1 100%", justifyContent: "center", borderColor: "#2E7DB5", color: "#2E7DB5" }}>{invoicing ? "Invoicing…" : "Invoice month"}</button>
    </form>}
    {canBill && membership.status !== "active" && <span style={{ ...mutedText, fontSize: 12 }}>Set the membership to Active to raise invoices.</span>}
  </Tile>;
}

// A family who signed up on the website: their logins stay locked until you approve their payment
// (recorded against the sign-up invoice), or you decline the sign-up.
function SignupBanner({ membership, canApprove, canDecline, actions, pending }) {
  const invoice = (membership.billing?.invoices || []).find((inv) => inv.id === membership.signupInvoiceId);
  const due = invoice ? Math.max(0, Number(invoice.total) - Number(invoice.amountPaid || 0)) : Number(membership.monthlyAmount);
  const [approving, setApproving] = useState(false);
  const [form, setForm] = useState({ amount: String(due), paymentMethod: "cash", providerReference: "" });
  const unplaced = (membership.children || []).filter((c) => c.status === "active" && !c.classId).length;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return <div style={{ margin: "16px 22px 0", padding: "14px 16px", borderRadius: 12, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1E3A8A", fontSize: 13 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <FiGlobe style={{ flexShrink: 0 }} />
      <div style={{ flex: "1 1 320px" }}>
        <strong>Signed up on the website — awaiting payment.</strong>{" "}
        {formatMoney(due)} due{invoice ? ` (${invoice.invoiceNumber})` : ""}. The parent's and children's logins unlock when you approve the payment.
        {unplaced > 0 && <> {unplaced === 1 ? "1 child needs" : `${unplaced} children need`} a class — you can place them before or after approving.</>}
      </div>
      {!approving && <div style={{ display: "flex", gap: 8 }}>
        {canApprove && <button type="button" onClick={() => setApproving(true)} style={{ ...primaryButton, padding: "8px 14px", fontSize: 13 }}>Approve payment</button>}
        {canDecline && <button type="button" disabled={pending.declining} onClick={() => {
          if (window.confirm("Decline this sign-up? Its invoice is cancelled and the family's accounts are removed (they can sign up again later).")) actions.declineSignup(membership.id);
        }} style={{ ...secondaryButton, color: "#B91C1C" }}>{pending.declining ? "Declining…" : "Decline"}</button>}
      </div>}
    </div>
    {approving && <form onSubmit={(event) => {
      event.preventDefault();
      actions.approveSignup(membership.id, { amount: Number(form.amount), paymentMethod: form.paymentMethod, providerReference: form.providerReference }, () => setApproving(false));
    }} style={{ ...formGrid(160), marginTop: 12, paddingTop: 12, borderTop: "1px solid #BFDBFE" }}>
      <label style={labelStyle}>Amount received (KSh)<input style={inputStyle} type="number" min={1} max={due || undefined} step={1} required value={form.amount} onChange={set("amount")} /></label>
      <label style={labelStyle}>Paid by<select style={inputStyle} value={form.paymentMethod} onChange={set("paymentMethod")}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label style={labelStyle}>Receipt / reference (optional)<input style={inputStyle} maxLength={120} value={form.providerReference} onChange={set("providerReference")} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={pending.approving} style={{ ...primaryButton, padding: "10px 14px" }}>{pending.approving ? "Approving…" : "Approve & activate"}</button>
        <button type="button" onClick={() => setApproving(false)} style={secondaryButton}>Cancel</button>
      </div>
    </form>}
  </div>;
}

function ChildRow({ membership, child, classes, actions, pending, canRestore }) {
  const [placing, setPlacing] = useState(false);
  const [classId, setClassId] = useState(child.classId || "");
  const removed = child.status === "removed";
  const name = childName(child);
  const liveClasses = classes.filter((cls) => cls.status === "active" || cls.id === child.classId);
  return <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, background: removed ? "#FAFAFA" : "#fff", opacity: removed ? 0.75 : 1, display: "grid", gap: 10 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <Initials name={name} photo={child.learner?.photo} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14 }}>{name}</strong>
          {removed
            ? <Pill tone={{ color: "#6B7280", background: "#F3F4F6" }}>Removed</Pill>
            : child.classId
              ? <Pill tone={{ color: "#047857", background: "#ECFDF5" }}>Placed</Pill>
              : <Pill tone={{ color: "#B45309", background: "#FFFBEB" }}>Awaiting placement</Pill>}
        </div>
        <div style={{ display: "grid", gap: 3, marginTop: 6, fontSize: 12, color: "#4B5563" }}>
          <IconLine icon={FiBookOpen}>{child.class ? child.class.name : <span style={{ color: removed ? "#6B7280" : "#B45309", fontWeight: 700 }}>{removed ? "No class" : "Not placed yet — choose one of the club's classes"}</span>}</IconLine>
          {child.learner?.username && <IconLine icon={FiUsers}>Signs in as <strong>{child.learner.username}</strong></IconLine>}
          {child.placementNotes && <IconLine icon={FiFileText}><span style={{ color: "#6B7280" }}>{child.placementNotes}</span></IconLine>}
        </div>
      </div>
    </div>
    {!placing && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {child.learner && <Link to={`/learners/${child.learnerId}`} style={{ ...secondaryButton, textDecoration: "none" }}>Profile</Link>}
      {removed
        ? <button type="button" disabled={!canRestore || pending.child} title={canRestore ? "" : "No free places in this package"} onClick={() => actions.restoreChild(membership.id, child.learnerId)} style={secondaryButton}>Add back</button>
        : <>
          <button type="button" onClick={() => { setClassId(child.classId || ""); setPlacing(true); }} style={child.classId ? secondaryButton : { ...secondaryButton, borderColor: "#B45309", color: "#B45309" }}><FiBookOpen /> {child.classId ? "Move class" : "Place child"}</button>
          <button type="button" onClick={() => {
            if (window.confirm(`Remove ${name} from this membership? They're taken out of their class; their records are kept and they can be added back.`)) actions.removeChild(membership.id, child.learnerId);
          }} style={{ ...secondaryButton, color: "#B91C1C" }}>Remove</button>
        </>}
    </div>}
    {placing && <form onSubmit={(event) => { event.preventDefault(); actions.placeChild(membership.id, child.learnerId, classId || null, () => setPlacing(false)); }} style={formGrid(180)}>
      <label style={labelStyle}>Class at {membership.club?.name || "this club"}
        <select style={inputStyle} required value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{liveClasses.length ? "Choose a class" : "This club has no classes yet"}</option>
          {liveClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}{cls.academicYear ? ` (${cls.academicYear})` : ""}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={pending.child || !classId} style={{ ...primaryButton, padding: "10px 14px" }}>{pending.child ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setPlacing(false)} style={secondaryButton}>Cancel</button>
      </div>
      {liveClasses.length === 0 && <span style={{ gridColumn: "1/-1", fontSize: 12, color: "#B45309" }}>Create a class for this club in Classes first.</span>}
      {membership.status !== "active" && <span style={{ gridColumn: "1/-1", fontSize: 12, color: "#6B7280" }}>The child joins the class once the membership is active.</span>}
    </form>}
  </div>;
}

function EditForm({ membership, packages, onSave, onCancel, saving }) {
  const [draft, setDraft] = useState({
    guardianName: membership.guardianName, guardianPhone: membership.guardianPhone || "",
    packageId: membership.packageId || "", childCount: String(membership.childCount), notes: membership.notes || "",
  });
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  // Packages this club can be sold, plus the membership's own even if since archived.
  const choices = packages.filter((p) => p.id === membership.packageId || (p.status === "active" && (!p.hubIds?.length || p.hubIds.includes(membership.hubId))));
  const pkg = packages.find((p) => p.id === draft.packageId);
  const price = priceForPackage(pkg, draft.childCount);
  const packageChanged = draft.packageId !== membership.packageId || Number(draft.childCount) !== Number(membership.childCount);
  return <form onSubmit={(event) => {
    event.preventDefault();
    onSave({
      guardianName: draft.guardianName, guardianPhone: draft.guardianPhone, notes: draft.notes,
      // Only send the package when it changed — re-sending re-prices the membership at today's price.
      ...(packageChanged && draft.packageId ? { packageId: draft.packageId, childCount: Number(draft.childCount) } : {}),
    });
  }} style={{ ...formGrid(200), padding: "18px 22px", borderBottom: "1px solid #EEF1F5", background: "#FCFDFE" }}>
    <label style={labelStyle}>Parent's name<input style={inputStyle} required maxLength={150} value={draft.guardianName} onChange={set("guardianName")} /></label>
    <label style={labelStyle}>Phone<input style={inputStyle} required value={draft.guardianPhone} onChange={set("guardianPhone")} /></label>
    <label style={labelStyle}>Package<select style={inputStyle} value={draft.packageId} onChange={set("packageId")}>
      {choices.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === "archived" ? " (archived)" : ""}</option>)}
    </select></label>
    <label style={labelStyle}>Children<input style={inputStyle} type="number" min={1} max={50} value={draft.childCount} onChange={set("childCount")} /></label>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Notes<textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} maxLength={5000} value={draft.notes} onChange={set("notes")} /></label>
    <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: price || !packageChanged ? "#6B7280" : "#B91C1C" }}>
        {packageChanged ? (price ? `New price: ${formatMoney(price.monthlyAmount)}/month for ${price.childCount} places.` : "This package can't take that many children.") : `Email (their login): ${membership.guardianEmail || "—"}`}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ ...secondaryButton, padding: "10px 14px", fontSize: 13 }}>Cancel</button>
        <button disabled={saving || (packageChanged && !price)} style={primaryButton}>{saving ? "Saving…" : "Save membership"}</button>
      </div>
    </div>
  </form>;
}

export default function MembershipCard({ membership, focused, cardRef, classes, packages, canBill, canApprove, canDecline, actions, pending }) {
  const [editing, setEditing] = useState(false);
  const children = membership.children || [];
  const activeCount = children.filter((c) => c.status === "active").length;
  const status = HOUSEHOLD_STATUS[membership.status] || HOUSEHOLD_STATUS.pending;

  return <article ref={cardRef} style={{ ...panelStyle, padding: 0, overflow: "hidden", ...(focused ? { borderColor: "#2E7DB5", boxShadow: "0 0 0 3px rgba(46,125,181,.18)" } : {}) }}>
    <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 22px", background: "#F8FAFC", borderBottom: "1px solid #EEF1F5", borderLeft: `4px solid ${status.color}` }}>
      <Initials name={membership.guardianName} size={46} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{membership.guardianName}</h3>
          <Pill tone={status}>{status.label}</Pill>
          {membership.source === "website" && <Pill tone={{ color: "#1D4ED8", background: "#EFF6FF" }}><FiGlobe /> Website sign-up</Pill>}
        </div>
        <div style={{ ...mutedText, marginTop: 3 }}>
          <strong style={{ color: "#25476a" }}>{membership.club?.name || "Club"}</strong> · {membership.package?.name || "No package"} · {activeCount} {activeCount === 1 ? "child" : "children"}
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#25476a" }}>{formatMoney(membership.monthlyAmount)}<span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>/month</span></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select aria-label="Membership status" value={membership.status} onChange={(event) => actions.updateMembership(membership.id, { status: event.target.value })} style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
          <option value="pending">Pending</option><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option>
        </select>
        <button type="button" onClick={() => setEditing((v) => !v)} style={{ ...secondaryButton, padding: "8px 12px", fontSize: 13 }}>{editing ? <><FiX /> Close</> : <><FiEdit2 /> Edit</>}</button>
      </div>
    </header>

    {membership.source === "website" && membership.status === "pending" && <SignupBanner membership={membership} canApprove={canApprove} canDecline={canDecline} actions={actions} pending={pending} />}

    {editing && <EditForm membership={membership} packages={packages} saving={pending.updating} onCancel={() => setEditing(false)} onSave={(data) => actions.updateMembership(membership.id, data, () => setEditing(false))} />}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14, padding: "18px 22px" }}>
      <Tile icon={FiPhone} title="Contact">
        {membership.guardianPhone && <IconLine icon={FiPhone}><a href={`tel:${membership.guardianPhone}`} style={linkText}>{membership.guardianPhone}</a></IconLine>}
        <IconLine icon={FiMail}>{membership.guardianEmail ? <a href={`mailto:${membership.guardianEmail}`} style={linkText}>{membership.guardianEmail}</a> : <span style={mutedText}>No email</span>}</IconLine>
        <IconLine icon={FiCalendar}>{membership.startDate ? `Member since ${formatDate(membership.startDate)}` : <span style={mutedText}>Starts when the first payment is approved</span>}</IconLine>
      </Tile>
      <Tile icon={FiPackage} title="Package">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{membership.package?.name || "No package"}{membership.package?.status === "archived" && <span style={{ ...mutedText, fontWeight: 500, fontSize: 12 }}> (archived)</span>}</div>
        <div style={mutedText}>{formatMoney(membership.monthlyAmount)} per month</div>
        <PlacesBar filled={activeCount} total={Number(membership.childCount)} />
      </Tile>
      <BillingTile membership={membership} canBill={canBill} onInvoice={actions.invoice} invoicing={pending.invoicing} />
    </div>

    {membership.notes && <div style={{ margin: "-4px 22px 16px", padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 13, color: "#78350F", whiteSpace: "pre-wrap" }}><strong>Notes: </strong>{membership.notes}</div>}

    <section style={{ padding: "0 22px 20px" }}>
      <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}><FiUsers style={{ color: "#25476a" }} /> Children <span style={{ ...mutedText, fontWeight: 500 }}>· {activeCount} of {membership.childCount} places filled</span></h4>
      {children.length === 0
        ? <div style={{ ...mutedText, textAlign: "center", padding: 18, border: "1px dashed #D1D5DB", borderRadius: 12 }}>No children in this membership yet. Parents add children from their account (My Family).</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
          {children.map((child) => <ChildRow key={child.id} membership={membership} child={child} classes={classes} actions={actions} pending={pending} canRestore={activeCount < Number(membership.childCount)} />)}
        </div>}
    </section>
  </article>;
}
