import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle, FiChevronRight, FiHome, FiPlus, FiSearch, FiX } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { HOUSEHOLD_STATUS, Initials, Pill, formatMoney, inputStyle, panelStyle, primaryButton, secondaryButton, statusFilterOptions } from "../components/ui";
import { FLAGS, FLAG_TONES, householdFlags } from "../components/householdFlags";
import { useHouseholds, useInvoiceDueNow, usePackages } from "../hooks/useHomeLearning";
import { Segmented } from "../../../components/ui/TabBar";
import { pricePer } from "../../../utils/billingPeriods";

/*
 * Home Learning (19 Nov 2026): one short row per family — click one to open it (HouseholdPage,
 * /home-learning/:id). Above the list, "Needs attention" counts what's waiting (sign-ups to
 * approve, children to place, missing timetables, overdue bills, parent mismatches) and filters
 * to it. Search, status, attention and sort live in the address, so Back from a family returns
 * to the list as it was left.
 */
const STATUS_FILTERS = ["all", "active", "pending", "paused", "cancelled"];
const SORTS = [
  ["name", "Name A–Z"],
  ["attention", "Needs attention first"],
  ["newest", "Newest first"],
  ["owed", "Most owed"],
];
const PAGE = 50;

// Everything a household can be found by: guardian, contact, area, package and children's names.
const searchText = (household) => [
  household.guardianName, household.guardianPhone, household.guardianEmail, household.town, household.subCounty,
  household.county, household.addressLine, household.package?.name,
  ...(household.learners || []).map((item) => (item.learner ? `${item.learner.firstName} ${item.learner.lastName}` : "")),
].filter(Boolean).join(" ").toLowerCase();

const flagTotal = (flags) => Object.values(flags).reduce((sum, n) => sum + n, 0);

// Desktop: a table-like grid. Phones: each row stacks into a small card (no sideways scroll).
const STYLES = `
  .hl-list { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; box-shadow: 0 2px 8px rgba(15,23,42,.04); overflow: hidden; }
  .hl-grid { display: grid; grid-template-columns: minmax(0,2.4fr) minmax(0,1.7fr) minmax(0,1.4fr) minmax(0,1fr) 96px 16px; grid-template-areas: "fam kids pkg bal status chev"; gap: 16px; align-items: center; padding: 13px 18px; }
  .hl-head { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #6B7280; background: #F8FAFC; border-bottom: 1px solid #EEF1F5; padding-top: 10px; padding-bottom: 10px; }
  .hl-row { text-decoration: none; color: inherit; border-top: 1px solid #EEF1F5; transition: background .12s; }
  .hl-head + .hl-row { border-top: 0; }
  .hl-row:hover { background: #F8FAFC; }
  .hl-row:focus-visible { outline: 2px solid #2E7DB5; outline-offset: -2px; }
  .hl-fam { grid-area: fam; } .hl-kids { grid-area: kids; } .hl-pkg { grid-area: pkg; } .hl-bal { grid-area: bal; } .hl-status { grid-area: status; } .hl-chev { grid-area: chev; color: #9CA3AF; }
  .hl-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hl-page .ui-tab-scroll { flex-wrap: wrap; }
  .hl-chip { border: 1px solid transparent; cursor: pointer; font-family: inherit; }
  .hl-chip:hover { filter: brightness(.97); }
  .hl-chip:focus-visible { outline: 2px solid #2E7DB5; outline-offset: 2px; }
  @media (max-width: 760px) {
    .hl-head { display: none; }
    .hl-grid { grid-template-columns: minmax(0,1fr) auto; grid-template-areas: "fam status" "kids kids" "pkg bal"; gap: 8px 12px; padding: 14px 16px; }
    .hl-chev { display: none; }
    .hl-bal { text-align: right; }
    .hl-kids, .hl-pkg { padding-left: 50px; }
  }
`;

function FlagChips({ flags }) {
  const shown = FLAGS.filter((flag) => flags[flag.key] > 0);
  if (!shown.length) return null;
  return <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
    {shown.map((flag) => <Pill key={flag.key} tone={FLAG_TONES[flag.key]}>{flag.count && flags[flag.key] > 1 ? `${flags[flag.key]} ` : ""}{flag.short.toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Pill>)}
  </div>;
}

function HouseholdRow({ household, flags, from }) {
  const status = HOUSEHOLD_STATUS[household.status] || HOUSEHOLD_STATUS.pending;
  const children = (household.learners || []).filter((item) => item.status !== "removed");
  const activeCount = children.filter((item) => item.status === "active").length;
  const outstanding = Number(household.billing?.outstanding) || 0;
  const overdue = !!household.billing?.overdue;
  const area = household.town || household.subCounty || household.county;
  const per = pricePer(0, household.billingPeriod).split("/")[1];
  return <Link to={`/home-learning/${household.id}`} state={{ from }} className="hl-grid hl-row" aria-label={`Open ${household.guardianName}'s household`}>
    <div className="hl-fam" style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
      <Initials name={household.guardianName} size={38} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="hl-ellipsis" style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{household.guardianName}</div>
        <div className="hl-ellipsis" style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{[household.guardianPhone, area].filter(Boolean).join(" · ") || "No contact details"}</div>
        <FlagChips flags={flags} />
      </div>
    </div>
    <div className="hl-kids" style={{ minWidth: 0 }}>
      <div className="hl-ellipsis" style={{ fontSize: 13, color: children.length ? "#374151" : "#9CA3AF" }}>{children.length ? children.map((item) => item.learner?.firstName || "Learner").join(", ") : "No children yet"}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{activeCount} of {household.childCount} places</div>
    </div>
    <div className="hl-pkg" style={{ minWidth: 0 }}>
      <div className="hl-ellipsis" style={{ fontSize: 13, color: "#374151" }}>{household.package?.name || "No package"}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{formatMoney(household.amount)}{per ? ` / ${per}` : ""}</div>
    </div>
    <div className="hl-bal">
      {outstanding > 0
        ? <><div style={{ fontSize: 13, fontWeight: 800, color: overdue ? "#B91C1C" : "#B45309" }}>{formatMoney(outstanding)}</div><div style={{ fontSize: 11, color: overdue ? "#B91C1C" : "#6B7280", marginTop: 2 }}>{overdue ? "Overdue" : "Owed"}</div></>
        : <div style={{ fontSize: 12, color: "#047857", fontWeight: 600 }}>Paid up</div>}
    </div>
    <div className="hl-status"><Pill tone={status}>{status.label}</Pill></div>
    <FiChevronRight className="hl-chev" aria-hidden size={16} />
  </Link>;
}

export default function HomeLearningPage() {
  const { user } = useAuth();
  const location = useLocation();
  // Raising invoices needs Billing → Add (staff roles; always true for the workspace owner).
  const canBill = can(user, "billing", "create");
  const canAdd = can(user, "home-learning", "create");
  const [searchParams, setSearchParams] = useSearchParams();
  const [limit, setLimit] = useState(PAGE);
  const { households, isLoading } = useHouseholds();
  const { isLoading: packagesLoading, hasActive } = usePackages();
  const invoiceDue = useInvoiceDueNow();

  const search = searchParams.get("q") || "";
  const statusFilter = STATUS_FILTERS.includes(searchParams.get("status")) ? searchParams.get("status") : "all";
  const flagFilter = FLAGS.some((f) => f.key === searchParams.get("flag")) ? searchParams.get("flag") : null;
  const sort = SORTS.some(([key]) => key === searchParams.get("sort")) ? searchParams.get("sort") : "name";
  const setParam = (key, value, fallback) => {
    setLimit(PAGE);
    setSearchParams((params) => {
      const out = new URLSearchParams(params);
      if (!value || value === fallback) out.delete(key); else out.set(key, value);
      return out;
    }, { replace: true });
  };

  const flagsById = useMemo(() => new Map(households.map((h) => [h.id, householdFlags(h)])), [households]);
  const flagCounts = useMemo(() => Object.fromEntries(FLAGS.map((f) => [f.key, households.filter((h) => flagsById.get(h.id)[f.key] > 0).length])), [households, flagsById]);
  const statusCounts = useMemo(() => households.reduce((counts, h) => ({ ...counts, [h.status]: (counts[h.status] || 0) + 1 }), { all: households.length }), [households]);
  const childrenLearning = useMemo(() => households.reduce((n, h) => n + (h.learners || []).filter((item) => item.status === "active").length, 0), [households]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = households.filter((h) => (statusFilter === "all" || h.status === statusFilter)
      && (!flagFilter || flagsById.get(h.id)[flagFilter] > 0)
      && (!query || searchText(h).includes(query)));
    const byName = (a, b) => (a.guardianName || "").localeCompare(b.guardianName || "");
    const compare = {
      name: byName,
      newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      owed: (a, b) => (Number(b.billing?.outstanding) || 0) - (Number(a.billing?.outstanding) || 0) || byName(a, b),
      attention: (a, b) => flagTotal(flagsById.get(b.id)) - flagTotal(flagsById.get(a.id)) || byName(a, b),
    }[sort];
    return [...rows].sort(compare);
  }, [households, search, statusFilter, flagFilter, sort, flagsById]);

  // Old links (Billing invoices, Enquiries, notifications) used ?household=<id>.
  const legacyId = searchParams.get("household");
  if (legacyId) return <Navigate replace to={`/home-learning/${legacyId}`} />;

  const anyAttention = FLAGS.some((f) => flagCounts[f.key] > 0);
  const filtered = search || statusFilter !== "all" || flagFilter;

  return <div className="hl-page" style={{ width: "100%", fontFamily: "Inter, sans-serif", color: "#111827", display: "grid", gridTemplateColumns: "100%", gap: 16 }}>
    <style>{STYLES}</style>
    <header style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E8F5FB", color: "#25476a", display: "grid", placeItems: "center", flexShrink: 0 }}><FiHome size={23} /></div>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800 }}>Home Learning</h1>
        <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>
          {households.length} {households.length === 1 ? "family" : "families"} · {childrenLearning} {childrenLearning === 1 ? "child" : "children"} learning. Open a family to place children, see invoices and edit details. Packages are set up in <Link to="/billing?tab=packages" style={{ color: "#25476a", fontWeight: 700 }}>Billing → Packages</Link>.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canBill && <button type="button" title="Invoices are raised automatically every hour — this does it now" disabled={invoiceDue.isPending} onClick={() => invoiceDue.mutate()} style={{ ...secondaryButton, padding: "10px 14px", fontSize: 13 }}>{invoiceDue.isPending ? "Invoicing…" : "Invoice what's due now"}</button>}
        {canAdd && <Link to="/home-learning/new" style={{ ...primaryButton, padding: "10px 16px", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><FiPlus /> Add household</Link>}
      </div>
    </header>

    {!packagesLoading && !hasActive && <div role="status" style={{ ...panelStyle, padding: "14px 18px", background: "#FFF7E8", borderColor: "#FDE3B0", color: "#92400E", fontSize: 13 }}>
      There are no active packages yet, so households can&apos;t be added. Create one in{" "}
      <Link to="/billing?tab=packages" style={{ color: "#92400E", fontWeight: 800 }}>Billing → Packages</Link>.
    </div>}

    {!isLoading && households.length > 0 && <section aria-label="Needs attention" style={{ ...panelStyle, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {anyAttention
        ? <>
          <strong style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "#92400E" }}><FiAlertCircle /> Needs attention</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FLAGS.filter((f) => flagCounts[f.key] > 0).map((flag) => {
              const on = flagFilter === flag.key;
              const tone = FLAG_TONES[flag.key];
              return <button key={flag.key} type="button" className="hl-chip" aria-pressed={on} onClick={() => setParam("flag", on ? null : flag.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: on ? "#fff" : tone.color, background: on ? tone.color : tone.background, borderColor: on ? tone.color : "transparent" }}>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{flagCounts[flag.key]}</span> {flag.label.toLowerCase()}{on && <FiX aria-label="clear" />}
              </button>;
            })}
          </div>
        </>
        : <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: "#047857", fontWeight: 700 }}><FiCheckCircle /> All caught up — no sign-ups, placements, timetables or overdue bills waiting.</span>}
    </section>}

    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
        <FiSearch style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
        <input type="search" aria-label="Search households" placeholder="Search guardian, phone, area or child…" value={search} onChange={(e) => setParam("q", e.target.value)} style={{ ...inputStyle, paddingLeft: 32, fontSize: 13 }} />
      </div>
      <Segmented label="Status" options={statusFilterOptions(STATUS_FILTERS, statusCounts)} value={statusFilter} onChange={(value) => setParam("status", value, "all")} />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280", fontWeight: 600, marginLeft: "auto" }}>
        Sort
        <select value={sort} onChange={(e) => setParam("sort", e.target.value, "name")} style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
          {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </div>

    {isLoading
      ? <div style={{ ...panelStyle, color: "#6B7280" }}>Loading households…</div>
      : households.length === 0
        ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No Home Learning households yet.{canAdd && <div style={{ marginTop: 12 }}><Link to="/home-learning/new" style={{ ...primaryButton, textDecoration: "none", display: "inline-block" }}>Add the first household</Link></div>}</div>
        : visible.length === 0
          ? <div style={{ ...panelStyle, textAlign: "center", color: "#6B7280", padding: 36 }}>No households match.{filtered && <div style={{ marginTop: 12 }}><button type="button" onClick={() => { setLimit(PAGE); setSearchParams(sort === "name" ? {} : { sort }, { replace: true }); }} style={{ ...secondaryButton, fontSize: 13 }}>Clear search and filters</button></div>}</div>
          : <>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{filtered ? `${visible.length} of ${households.length} households` : `${households.length} households`}</div>
            <nav className="hl-list" aria-label="Households">
              <div className="hl-grid hl-head" aria-hidden><span className="hl-fam">Family</span><span className="hl-kids">Children</span><span className="hl-pkg">Package</span><span className="hl-bal">Balance</span><span className="hl-status">Status</span><span /></div>
              {visible.slice(0, limit).map((household) => <HouseholdRow key={household.id} household={household} flags={flagsById.get(household.id)} from={location.search} />)}
            </nav>
            {visible.length > limit && <button type="button" onClick={() => setLimit((n) => n + PAGE)} style={{ ...secondaryButton, justifySelf: "center", padding: "9px 16px", fontSize: 13 }}>Show {Math.min(PAGE, visible.length - limit)} more of {visible.length - limit}</button>}
          </>}
  </div>;
}
