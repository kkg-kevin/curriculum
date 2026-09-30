import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiChevronDown, FiHome, FiPlus, FiSearch } from "react-icons/fi";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { homeLearningApi } from "../services/homeLearningApi";
import HouseholdCard from "../components/HouseholdCard";
import { HouseholdFields } from "../components/HouseholdFields";
import { HOUSEHOLD_STATUS, errorMessage, inputStyle, labelStyle, panelStyle, primaryButton, thisMonth } from "../components/ui";

const EMPTY_HOUSEHOLD = { guardianName: "", guardianEmail: "", guardianPhone: "", county: "", subCounty: "", town: "", addressLine: "", landmark: "", mapUrl: "", locationPhotos: [], packageId: "", childCount: "", status: "pending", startDate: "", notes: "", portalPassword: "", fromLearnerId: "" };
const STATUS_FILTERS = ["all", "active", "pending", "paused", "cancelled"];

// Everything a household can be found by: guardian, contact, area and children's names.
const searchText = (household) => [
  household.guardianName, household.guardianPhone, household.guardianEmail, household.town, household.subCounty,
  household.county, household.addressLine, household.package?.name,
  ...(household.learners || []).map((item) => (item.learner ? `${item.learner.firstName} ${item.learner.lastName}` : "")),
].filter(Boolean).join(" ").toLowerCase();

export default function HomeLearningPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Raising invoices needs Billing → Add (staff roles; always true for the workspace owner).
  const canBill = can(user, "billing", "create");
  // Website sign-ups: approving records a payment (Billing → Edit); declining removes accounts.
  const canApprove = can(user, "billing", "edit");
  const canDecline = can(user, "home-learning", "delete");
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("household");
  const focusRef = useRef(null);
  const [form, setForm] = useState(EMPTY_HOUSEHOLD);
  const [bulkPeriod, setBulkPeriod] = useState(thisMonth());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  // The household just created from an existing learner: its card opens with that learner
  // ready to assign, and the page scrolls to it.
  const [pendingChild, setPendingChild] = useState(null);

  const { data: households = [], isLoading } = useQuery({ queryKey: ["home-learning"], queryFn: homeLearningApi.getAll });
  // Packages are created and priced in Billing → Packages; here they're only picked from.
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
  const availableLearners = learners.filter((learner) => !placedLearnerIds.has(learner.id));

  const statusCounts = useMemo(() => households.reduce((counts, h) => ({ ...counts, [h.status]: (counts[h.status] || 0) + 1 }), { all: households.length }), [households]);
  const visibleHouseholds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return households.filter((h) => (statusFilter === "all" || h.status === statusFilter) && (!query || searchText(h).includes(query)));
  }, [households, search, statusFilter]);

  const focusTarget = pendingChild?.householdId || focusId;
  const focusLoaded = households.some((h) => h.id === focusTarget);
  useEffect(() => {
    if (focusTarget && focusLoaded) focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusTarget, focusLoaded]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["home-learning"] });
  const createMutation = useMutation({
    mutationFn: homeLearningApi.createHousehold,
    onSuccess: (created, { fromLearnerId }) => {
      refresh();
      toast.success(fromLearnerId ? "Household added — now choose the learner's curriculum and grade" : "Household added");
      setForm(EMPTY_HOUSEHOLD);
      setAddOpen(false);
      setSearch("");
      setStatusFilter("all");
      setPendingChild(fromLearnerId ? { householdId: created.id, learnerId: fromLearnerId } : null);
    },
    onError: (error) => toast.error(errorMessage(error, "Could not add household")),
  });
  const enrollmentMutation = useMutation({
    mutationFn: ({ householdId, ...data }) => homeLearningApi.enrollLearner(householdId, data),
    onSuccess: () => { refresh(); toast.success("Home Learning assignment saved"); },
    onError: (error) => toast.error(errorMessage(error, "Could not save assignment")),
  });
  const updateHouseholdMutation = useMutation({
    mutationFn: ({ id, data }) => homeLearningApi.updateHousehold(id, data),
    onSuccess: () => { refresh(); toast.success("Household updated"); },
    onError: (error) => toast.error(errorMessage(error, "Could not update household")),
  });
  const createLearnerMutation = useMutation({
    mutationFn: ({ householdId, ...data }) => homeLearningApi.createLearner(householdId, data),
    onSuccess: () => { refresh(); toast.success("Learner registered and assigned"); },
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
  const approveSignupMutation = useMutation({
    mutationFn: ({ id, data }) => homeLearningApi.approveSignup(id, data),
    onSuccess: () => { refresh(); toast.success("Payment approved — the family can now log in"); },
    onError: (error) => toast.error(errorMessage(error, "Could not approve the payment")),
  });
  const declineSignupMutation = useMutation({
    mutationFn: homeLearningApi.declineSignup,
    onSuccess: () => { refresh(); toast.success("Sign-up declined"); },
    onError: (error) => toast.error(errorMessage(error, "Could not decline the sign-up")),
  });
  const bulkInvoiceMutation = useMutation({
    mutationFn: homeLearningApi.generateMonthlyInvoices,
    onSuccess: ({ created, skipped }) => { refresh(); toast.success(`${created} invoice${created === 1 ? "" : "s"} issued${skipped ? `, ${skipped} already invoiced` : ""}`); },
    onError: (error) => toast.error(errorMessage(error, "Could not raise invoices")),
  });

  // Handed to every card; `done` runs only when the request succeeds (e.g. to close a form).
  const actions = {
    updateHousehold: (id, data, done) => updateHouseholdMutation.mutate({ id, data }, { onSuccess: done }),
    saveEnrollment: (data, done) => {
      if (!data.learnerId || !data.curriculumId || !data.gradeId) return toast.error("Choose a learner, curriculum and grade first");
      enrollmentMutation.mutate(data, { onSuccess: done });
    },
    createLearner: (data, done) => createLearnerMutation.mutate(data, { onSuccess: done }),
    removeLearner: ({ householdId, learnerId, name }) => {
      if (window.confirm(`Remove ${name} from this household? Their records are kept and they can be re-added later.`)) removeMutation.mutate({ householdId, learnerId });
    },
    invoice: (data) => invoiceMutation.mutate(data),
    approveSignup: (id, data, done) => approveSignupMutation.mutate({ id, data }, { onSuccess: done }),
    declineSignup: (id) => declineSignupMutation.mutate(id),
  };
  const pendingFor = (id) => ({
    updating: updateHouseholdMutation.isPending && updateHouseholdMutation.variables?.id === id,
    enrolling: enrollmentMutation.isPending && enrollmentMutation.variables?.householdId === id,
    creatingLearner: createLearnerMutation.isPending && createLearnerMutation.variables?.householdId === id,
    invoicing: invoiceMutation.isPending && invoiceMutation.variables?.id === id,
    approving: approveSignupMutation.isPending && approveSignupMutation.variables?.id === id,
    declining: declineSignupMutation.isPending && declineSignupMutation.variables === id,
  });

  const submitHousehold = (event) => {
    event.preventDefault();
    createMutation.mutate({ ...form, childCount: form.childCount === "" ? undefined : Number(form.childCount) });
  };
  // Picking a learner who's already in the system fills in the parent from their profile.
  const startFromLearner = (learnerId) => {
    const learner = learners.find((l) => l.id === learnerId);
    setForm((current) => ({
      ...current,
      fromLearnerId: learnerId,
      ...(learner ? { guardianName: learner.guardianName || "", guardianPhone: learner.guardianPhone || "", guardianEmail: learner.guardianEmail || "" } : {}),
    }));
  };

  return <div style={{ width: "100%", fontFamily: "Inter, sans-serif", color: "#111827" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F5FB", color: "#25476a", display: "grid", placeItems: "center" }}><FiHome size={23} /></div>
      <div style={{ flex: 1, minWidth: 240 }}><h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>Home Learning</h1><p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>Families, each child's curriculum, grade and educator, and monthly invoices. Every child gets their own class in the Home Learning hub, so assessments, attendance and reports work as usual. Packages are set up in <Link to="/billing?tab=packages" style={{ color: "#25476a", fontWeight: 700 }}>Billing → Packages</Link>.</p></div>
      {canBill && <form onSubmit={(e) => { e.preventDefault(); bulkInvoiceMutation.mutate({ period: bulkPeriod }); }} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input aria-label="Month to invoice" type="month" required value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px", fontSize: 13 }} />
        <button disabled={bulkInvoiceMutation.isPending} style={{ ...primaryButton, padding: "9px 14px", fontSize: 13 }}>{bulkInvoiceMutation.isPending ? "Invoicing…" : "Invoice all active households"}</button>
      </form>}
    </header>

    {!packagesLoading && !packages.some((p) => p.status === "active") && (
      <div role="status" style={{ ...panelStyle, marginBottom: 22, padding: "14px 18px", background: "#FFF7E8", borderColor: "#FDE3B0", color: "#92400E", fontSize: 13 }}>
        There are no active packages yet, so households can't be added. Create one in{" "}
        <Link to="/billing?tab=packages" style={{ color: "#92400E", fontWeight: 800 }}>Billing → Packages</Link>.
      </div>
    )}

    <section style={{ ...panelStyle, marginBottom: 22, padding: 0, overflow: "hidden" }}>
      <button type="button" aria-expanded={addOpen} onClick={() => setAddOpen((open) => !open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 22px", border: 0, background: addOpen ? "#F8FAFC" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "#E8F5FB", color: "#25476a", flexShrink: 0 }}><FiPlus size={18} /></span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 17, fontWeight: 700, color: "#111827" }}>Add a household</span>
          <span style={{ display: "block", fontSize: 13, color: "#6B7280", marginTop: 2 }}>Register a family, their package and home location. Add the children after saving.</span>
        </span>
        <FiChevronDown size={20} style={{ color: "#6B7280", transition: "transform .2s", transform: addOpen ? "rotate(180deg)" : "none", flexShrink: 0 }} />
      </button>
      {addOpen && <form onSubmit={submitHousehold} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14, padding: "4px 22px 22px", borderTop: "1px solid #EEF1F5" }}>
        <div style={{ gridColumn: "1/-1", marginTop: 14, padding: 14, borderRadius: 12, background: "#F8FBFE", border: "1px dashed #A8D5EE" }}>
          <label style={labelStyle}>
            Is one of the children already in the system? (optional)
            <select style={inputStyle} value={form.fromLearnerId} onChange={(e) => startFromLearner(e.target.value)}>
              <option value="">No — I'll type the parent's details</option>
              {availableLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.firstName} {learner.lastName}{learner.guardianName ? ` · parent: ${learner.guardianName}` : ""}</option>)}
            </select>
          </label>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280" }}>Picking a learner fills in the parent's details from their profile. After saving, the household opens with that learner ready to assign.</p>
        </div>
        <HouseholdFields values={form} setValue={(key, value) => setForm((current) => ({ ...current, [key]: value }))} packages={packages} showStatus />
        <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#6B7280", fontSize: 12 }}>The household is billed at the package price shown above. Its parent's details are also added to each child's profile where missing.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ ...primaryButton, background: "#fff", color: "#4B5563", border: "1px solid #D1D5DB" }}>Cancel</button>
            <button disabled={createMutation.isPending || !packages.some((p) => p.status === "active")} style={primaryButton}>{createMutation.isPending ? "Saving…" : "Add household"}</button>
          </div>
        </div>
      </form>}
    </section>

    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Households <span style={{ color: "#6B7280", fontSize: 13, fontWeight: 500 }}>· {households.length} registered</span></h2>
        <div style={{ position: "relative", flex: "0 1 340px", minWidth: 220 }}>
          <FiSearch style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
          <input type="search" aria-label="Search households" placeholder="Search guardian, phone, area or child…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((key) => {
          const selected = statusFilter === key;
          const tone = HOUSEHOLD_STATUS[key];
          return <button key={key} type="button" onClick={() => setStatusFilter(key)} style={{ border: `1px solid ${selected ? "#25476a" : "#E5E7EB"}`, background: selected ? "#25476a" : "#fff", color: selected ? "#fff" : "#374151", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {tone && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tone.color }} />}
            {tone ? tone.label : "All"} <span style={{ opacity: 0.7 }}>{statusCounts[key] || 0}</span>
          </button>;
        })}
      </div>
      {isLoading
        ? <div style={{ ...panelStyle, color: "#6B7280" }}>Loading households…</div>
        : households.length === 0
          ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No Home Learning households yet.{!addOpen && <div style={{ marginTop: 12 }}><button type="button" onClick={() => setAddOpen(true)} style={primaryButton}>Add the first household</button></div>}</div>
          : visibleHouseholds.length === 0
            ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No households match this search.</div>
            : visibleHouseholds.map((household) => <HouseholdCard
              key={household.id}
              household={household}
              focused={household.id === focusTarget}
              cardRef={household.id === focusTarget ? focusRef : undefined}
              prefillLearnerId={pendingChild?.householdId === household.id ? pendingChild.learnerId : undefined}
              packages={packages}
              curricula={curricula}
              educators={educators}
              availableLearners={availableLearners}
              canBill={canBill}
              canApprove={canApprove}
              canDecline={canDecline}
              actions={actions}
              pending={pendingFor(household.id)}
            />)}
    </section>
  </div>;
}
