import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiCpu, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { techClubApi } from "../services/techClubApi";
import MembershipCard from "../components/MembershipCard";
import { HOUSEHOLD_STATUS, errorMessage, inputStyle, panelStyle, primaryButton, thisMonth } from "../../home-learning/components/ui";

const STATUS_FILTERS = ["all", "pending", "active", "paused", "cancelled"];

const searchText = (m) => [
  m.guardianName, m.guardianPhone, m.guardianEmail, m.club?.name, m.package?.name,
  ...(m.children || []).map((c) => (c.learner ? `${c.learner.firstName} ${c.learner.lastName} ${c.learner.username || ""}` : "")),
].filter(Boolean).join(" ").toLowerCase();

// Estate Tech Clubs: the families who joined a club (mostly from the website's sign-up), placing
// each child in one of the club's classes, and monthly invoices. The Home Learning page's
// counterpart for clubs.
export default function TechClubsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Raising invoices needs Billing → Add; approving a sign-up records a payment (Billing → Edit);
  // declining one removes accounts (Tech Clubs → Delete).
  const canBill = can(user, "billing", "create");
  const canApprove = can(user, "billing", "edit");
  const canDecline = can(user, "tech-clubs", "delete");
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("membership");
  const focusRef = useRef(null);
  const [clubFilter, setClubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [bulkPeriod, setBulkPeriod] = useState(thisMonth());

  const { data: membershipRows = [], isLoading } = useQuery({ queryKey: ["tech-clubs", "memberships"], queryFn: () => techClubApi.getAll() });
  const { data: clubRows } = useQuery({ queryKey: ["tech-clubs", "clubs"], queryFn: techClubApi.getClubs });
  const { data: packageRows, isLoading: packagesLoading } = useQuery({ queryKey: ["tech-clubs", "packages"], queryFn: techClubApi.getPackages });
  const memberships = Array.isArray(membershipRows) ? membershipRows : [];
  const clubs = Array.isArray(clubRows) ? clubRows : [];
  const packages = Array.isArray(packageRows) ? packageRows : [];
  const classesByClub = useMemo(() => new Map(clubs.map((club) => [club.id, club.classes || []])), [clubs]);

  const inClub = useMemo(() => memberships.filter((m) => clubFilter === "all" || m.hubId === clubFilter), [memberships, clubFilter]);
  const statusCounts = useMemo(() => inClub.reduce((counts, m) => ({ ...counts, [m.status]: (counts[m.status] || 0) + 1 }), { all: inClub.length }), [inClub]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inClub.filter((m) => (statusFilter === "all" || m.status === statusFilter) && (!query || searchText(m).includes(query)));
  }, [inClub, search, statusFilter]);
  const awaitingPayment = memberships.filter((m) => m.status === "pending" && m.source === "website").length;
  const awaitingPlacement = memberships.reduce((n, m) => n + (m.status !== "cancelled" ? (m.children || []).filter((c) => c.status === "active" && !c.classId).length : 0), 0);

  const focusLoaded = memberships.some((m) => m.id === focusId);
  useEffect(() => {
    if (focusId && focusLoaded) focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusId, focusLoaded]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tech-clubs"] });
  const mutation = (mutationFn, success, failure) => ({ mutationFn, onSuccess: (data) => { refresh(); toast.success(typeof success === "function" ? success(data) : success); }, onError: (error) => toast.error(errorMessage(error, failure)) });
  const updateMutation = useMutation(mutation(({ id, data }) => techClubApi.updateMembership(id, data), "Membership updated", "Could not update membership"));
  const placeMutation = useMutation(mutation(({ id, learnerId, classId }) => techClubApi.placeChild(id, learnerId, classId), "Child placed", "Could not place child"));
  const removeMutation = useMutation(mutation(({ id, learnerId }) => techClubApi.removeChild(id, learnerId), "Removed — they can be added back later", "Could not remove child"));
  const restoreMutation = useMutation(mutation(({ id, learnerId }) => techClubApi.restoreChild(id, learnerId), "Child added back", "Could not add child back"));
  const invoiceMutation = useMutation(mutation(({ id, period, dueDate }) => techClubApi.generateInvoice(id, { period, dueDate }), ({ created, invoice }) => (created ? `Invoice ${invoice.invoiceNumber} issued` : `Already invoiced (${invoice.invoiceNumber})`), "Could not raise invoice"));
  const approveMutation = useMutation(mutation(({ id, data }) => techClubApi.approveSignup(id, data), "Payment approved — the family can now log in", "Could not approve the payment"));
  const declineMutation = useMutation(mutation((id) => techClubApi.declineSignup(id), "Sign-up declined", "Could not decline the sign-up"));
  const bulkMutation = useMutation(mutation((data) => techClubApi.generateMonthlyInvoices(data), ({ created, skipped }) => `${created} invoice${created === 1 ? "" : "s"} issued${skipped ? `, ${skipped} already invoiced` : ""}`, "Could not raise invoices"));

  // Handed to every card; `done` runs only when the request succeeds (e.g. to close a form).
  const actions = {
    updateMembership: (id, data, done) => updateMutation.mutate({ id, data }, { onSuccess: done }),
    placeChild: (id, learnerId, classId, done) => placeMutation.mutate({ id, learnerId, classId }, { onSuccess: done }),
    removeChild: (id, learnerId) => removeMutation.mutate({ id, learnerId }),
    restoreChild: (id, learnerId) => restoreMutation.mutate({ id, learnerId }),
    invoice: (data) => invoiceMutation.mutate(data),
    approveSignup: (id, data, done) => approveMutation.mutate({ id, data }, { onSuccess: done }),
    declineSignup: (id) => declineMutation.mutate(id),
  };
  const pendingFor = (id) => ({
    updating: updateMutation.isPending && updateMutation.variables?.id === id,
    child: (placeMutation.isPending && placeMutation.variables?.id === id) || (restoreMutation.isPending && restoreMutation.variables?.id === id),
    invoicing: invoiceMutation.isPending && invoiceMutation.variables?.id === id,
    approving: approveMutation.isPending && approveMutation.variables?.id === id,
    declining: declineMutation.isPending && declineMutation.variables === id,
  });

  const chip = (selected) => ({ border: `1px solid ${selected ? "#25476a" : "#E5E7EB"}`, background: selected ? "#25476a" : "#fff", color: selected ? "#fff" : "#374151", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 });

  return <div style={{ width: "100%", fontFamily: "Inter, sans-serif", color: "#111827" }}>
    <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F5FB", color: "#25476a", display: "grid", placeItems: "center" }}><FiCpu size={23} /></div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>Tech Clubs</h1>
        <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>Families who joined an Estate Tech Club on the website. Approve their first payment, place each child in one of the club's classes — from then on attendance, assessments and reports work as usual — and invoice them monthly. Packages are set up in <Link to="/billing?tab=packages" style={{ color: "#25476a", fontWeight: 700 }}>Billing → Packages</Link>.</p>
      </div>
      {canBill && <form onSubmit={(e) => { e.preventDefault(); bulkMutation.mutate({ period: bulkPeriod, ...(clubFilter !== "all" ? { hubId: clubFilter } : {}) }); }} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", maxWidth: "100%" }}>
        <input aria-label="Month to invoice" type="month" required value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px", fontSize: 13 }} />
        <button disabled={bulkMutation.isPending} style={{ ...primaryButton, padding: "9px 14px", fontSize: 13 }}>{bulkMutation.isPending ? "Invoicing…" : clubFilter === "all" ? "Invoice all active members" : "Invoice this club's active members"}</button>
      </form>}
    </header>

    {!packagesLoading && !packages.some((p) => p.status === "active" && p.isPublished) && (
      <div role="status" style={{ ...panelStyle, marginBottom: 18, padding: "14px 18px", background: "#FFF7E8", borderColor: "#FDE3B0", color: "#92400E", fontSize: 13 }}>
        No club package is on the website yet, so families can't sign up. Create one in{" "}
        <Link to="/billing?tab=packages" style={{ color: "#92400E", fontWeight: 800 }}>Billing → Packages</Link> and tick "Show on the website".
      </div>
    )}
    {(awaitingPayment > 0 || awaitingPlacement > 0) && <div role="status" style={{ ...panelStyle, marginBottom: 18, padding: "12px 18px", background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E3A8A", fontSize: 13 }}>
      {awaitingPayment > 0 && <><strong>{awaitingPayment}</strong> sign-up{awaitingPayment === 1 ? "" : "s"} awaiting payment. </>}
      {awaitingPlacement > 0 && <><strong>{awaitingPlacement}</strong> child{awaitingPlacement === 1 ? "" : "ren"} waiting for a class.</>}
    </div>}

    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Members <span style={{ color: "#6B7280", fontSize: 13, fontWeight: 500 }}>· {memberships.length} famil{memberships.length === 1 ? "y" : "ies"}</span></h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: "0 1 560px" }}>
          <select aria-label="Club" value={clubFilter} onChange={(e) => setClubFilter(e.target.value)} style={{ ...inputStyle, flex: "1 1 180px", width: "auto", fontSize: 13 }}>
            <option value="all">All clubs</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <FiSearch style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input type="search" aria-label="Search members" placeholder="Search parent, phone or child…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((key) => {
          const tone = HOUSEHOLD_STATUS[key];
          return <button key={key} type="button" onClick={() => setStatusFilter(key)} style={chip(statusFilter === key)}>
            {tone && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tone.color }} />}
            {tone ? tone.label : "All"} <span style={{ opacity: 0.7 }}>{statusCounts[key] || 0}</span>
          </button>;
        })}
      </div>
      {isLoading
        ? <div style={{ ...panelStyle, color: "#6B7280" }}>Loading members…</div>
        : memberships.length === 0
          ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No families have joined a club yet. When a parent signs up on the website's club page, they appear here for you to approve.</div>
          : visible.length === 0
            ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No members match these filters.</div>
            : visible.map((membership) => <MembershipCard
              key={membership.id}
              membership={membership}
              focused={membership.id === focusId}
              cardRef={membership.id === focusId ? focusRef : undefined}
              classes={classesByClub.get(membership.hubId) || []}
              packages={packages}
              canBill={canBill}
              canApprove={canApprove}
              canDecline={canDecline}
              actions={actions}
              pending={pendingFor(membership.id)}
            />)}
    </section>
  </div>;
}
