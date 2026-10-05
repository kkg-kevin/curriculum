import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiAlertTriangle, FiArrowDown, FiArrowRight, FiArrowUp, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiDownload, FiGrid, FiInbox, FiList, FiSearch, FiX, FiXCircle } from "react-icons/fi";
import { useSupervisorClaims } from "../hooks/useClaims";
import { CLAIM_STATUS, T, TYPE_LABEL, cardStyle, formatDate, formatMoney } from "../shared";
import ClaimReviewDialog from "../components/ClaimReviewDialog";
import { Avatar, ClaimCard, OVERDUE_DAYS, RecordChip, ago, daysSince } from "../components/supervisorParts";

// The supervisor's Claims page: every claim their educators have sent them, built to stay usable
// when claims pile up — the list can be narrowed (status, educator, hub, type, date, "waiting too
// long"), sorted, shown as compact rows instead of cards, paged, and exported. All of that works
// on the claims already loaded — a supervisor's own claims are a small set.
//
// The dashboard and the educators page link here with ?tab=, ?educator= and ?overdue=1 to open it
// already narrowed.

const TABS = [
  { key: "pending_supervisor", label: "To review", icon: FiInbox, empty: ["You're all caught up", "No claims are waiting for your review. New ones appear here as your educators send them."] },
  { key: "approved", label: "Approved", icon: FiClock, empty: ["Nothing awaiting payment", "Claims you approve wait here until the admin pays them."] },
  { key: "paid", label: "Paid", icon: FiCheckCircle, empty: ["No paid claims yet", "Once the admin pays a claim you approved, it moves here."] },
  { key: "rejected", label: "Declined", icon: FiXCircle, empty: ["No declined claims", "Claims you decline are kept here with the reason you gave."] },
];

const PAGE_SIZE = { cards: 8, table: 20 };
const VIEW_KEY = "supervisor.claims.view";

const PERIODS = [
  { key: "all", label: "Any date" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last30", label: "Last 30 days" },
  { key: "custom", label: "Custom range…" },
];

// Whether a claim was submitted inside the chosen period. "This week" starts on Monday.
function inPeriod(claim, period, from, to) {
  if (period === "all") return true;
  const sent = new Date(claim.createdAt);
  const now = new Date();
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === "week") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return sent >= start;
  }
  if (period === "month") return sent >= new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "last30") return sent >= new Date(startOfDay(now).getTime() - 30 * 24 * 60 * 60 * 1000);
  const after = !from || sent >= new Date(`${from}T00:00:00`);
  const before = !to || sent <= new Date(`${to}T23:59:59`);
  return after && before;
}

const SORT_OPTIONS = [
  { value: "date:asc", label: "Oldest first" },
  { value: "date:desc", label: "Newest first" },
  { value: "amount:desc", label: "Highest amount" },
  { value: "amount:asc", label: "Lowest amount" },
  { value: "educator:asc", label: "Educator (A–Z)" },
];
const COMPARE = {
  date: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  amount: (a, b) => a.amount - b.amount,
  educator: (a, b) => a.teacherName.localeCompare(b.teacherName) || new Date(a.createdAt) - new Date(b.createdAt),
};

// The filtered claims as a spreadsheet file (opens in Excel; the leading mark keeps accents intact).
function downloadCsv(claims, label) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const day = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");
  const header = ["Claim no.", "Educator", "Course", "Class", "Hub", "Type", "Status", "Sessions delivered", "Sessions total", "Amount", "Currency", "Submitted", "Decided", "Paid", "Payment reference", "Decline reason"];
  const rows = claims.map((c) => [c.claimNumber, c.teacherName, c.courseName, c.className, c.hubName, TYPE_LABEL[c.type], CLAIM_STATUS[c.status]?.label || c.status, c.sessionsDelivered, c.sessionsTotal, Math.round(c.amount), c.currency, day(c.createdAt), day(c.supervisorDecidedAt), day(c.paidAt), c.paymentReference, c.rejectionReason]);
  const csv = [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `claims-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const controlStyle = { padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink, background: "#fff", outline: "none", cursor: "pointer", minWidth: 0, maxWidth: "100%" };
const active = (on) => ({ ...controlStyle, borderColor: on ? T.accent : T.border });

// The same claims as compact rows — for when there are too many for cards. Column headings sort.
function ClaimTable({ claims, sort, onSort, onOpen }) {
  const heading = (label, key, align = "left") => {
    const on = sort.key === key;
    const Arrow = sort.dir === "asc" ? FiArrowUp : FiArrowDown;
    return (
      <th style={{ padding: 0, textAlign: align }} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => onSort(key)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "11px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: on ? T.accent : T.inkMuted }}>
          {label} {on && <Arrow size={12} />}
        </button>
      </th>
    );
  };
  const plain = (label, align = "left") => <th style={{ padding: "11px 14px", textAlign: align, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>{label}</th>;
  return (
    <div style={{ ...cardStyle, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1020 }}>
        <thead>
          <tr style={{ background: "#F3F7FB" }}>
            {heading("Educator", "educator")}
            {plain("Course")}
            {plain("Type")}
            {plain("Sessions", "center")}
            {plain("Records")}
            {heading("Submitted", "date")}
            {heading("Amount", "amount", "right")}
            {plain("", "right")}
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => {
            const waiting = claim.status === "pending_supervisor";
            const days = daysSince(claim.createdAt);
            const evidence = claim.evidence || {};
            return (
              <tr key={claim.id} className="supervisor-row" onClick={() => onOpen(claim.id)} style={{ borderTop: "1px solid #F1F5F9", cursor: "pointer" }}>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Avatar name={claim.teacherName} size={30} />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{claim.teacherName}</span>
                  </div>
                </td>
                <td style={{ padding: "10px 14px", maxWidth: 260 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{claim.courseName}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11.5, color: T.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[claim.className, claim.hubName].filter(Boolean).join(" · ")}</p>
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: T.inkMuted, whiteSpace: "nowrap" }}>{TYPE_LABEL[claim.type]}</td>
                <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 13, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{claim.sessionsDelivered}/{claim.sessionsTotal}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <RecordChip label="Att." done={evidence.attendanceMarked} of={evidence.sessionsDelivered} />
                    <RecordChip label="Graded" done={evidence.assignmentsGraded} of={evidence.assignmentsExpected} />
                    <RecordChip label="Rep." done={evidence.reportsDone} of={evidence.reportsExpected} />
                  </div>
                </td>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                  <p style={{ margin: 0, fontSize: 13, color: T.ink }}>{formatDate(claim.createdAt)}</p>
                  {waiting && <p style={{ margin: "1px 0 0", fontSize: 11.5, fontWeight: 700, color: days >= OVERDUE_DAYS ? "#B91C1C" : T.inkFaint }}>{ago(days)}</p>}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 14, fontWeight: 800, color: T.accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formatMoney(claim.amount, claim.currency)}</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  {/* The whole row opens the claim; this is the same action for keyboard users. */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(claim.id); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", background: waiting ? T.accent : "#F1F5F9", color: waiting ? "#fff" : T.accent }}>
                    {waiting ? "Review" : "View"} <FiArrowRight size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pager({ page, pageCount, total, pageSize, onPage }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const button = (disabled) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: disabled ? "#C3CBD5" : T.accent, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: disabled ? "default" : "pointer" });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: T.inkMuted, fontVariantNumeric: "tabular-nums" }}>{from}–{to} of {total}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={button(page <= 1)}><FiChevronLeft size={14} /> Previous</button>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkMuted, fontVariantNumeric: "tabular-nums" }}>Page {page} of {pageCount}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} style={button(page >= pageCount)}>Next <FiChevronRight size={14} /></button>
      </div>
    </div>
  );
}

// Paid claims added up by the month they were paid in — newest month first.
function MonthlyTotals({ claims, currency }) {
  const months = useMemo(() => {
    const byMonth = new Map();
    for (const claim of claims) {
      const paid = new Date(claim.paidAt || claim.updatedAt || claim.createdAt);
      const key = `${paid.getFullYear()}-${String(paid.getMonth() + 1).padStart(2, "0")}`;
      const entry = byMonth.get(key) || { key, label: paid.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += claim.amount;
      byMonth.set(key, entry);
    }
    return [...byMonth.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [claims]);
  if (!months.length) return null;
  return (
    <div style={{ ...cardStyle, padding: "14px 16px" }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>Paid, month by month</p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
        {months.map((month) => (
          <div key={month.key} style={{ flex: "0 0 auto", minWidth: 150, padding: "10px 14px", borderRadius: 12, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#166534" }}>{month.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 900, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{formatMoney(month.amount, currency)}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11.5, color: T.inkMuted }}>{month.count} {month.count === 1 ? "claim" : "claims"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupervisorClaimsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, error } = useSupervisorClaims();
  const [picked, setTab] = useState(() => (TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : null));
  const [educatorId, setEducatorId] = useState(() => searchParams.get("educator") || null);
  const [search, setSearch] = useState("");
  const [hubId, setHubId] = useState("all");
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("overdue") === "1");
  const [sortPick, setSortPick] = useState(null); // { key, dir } once the supervisor chooses one
  const [view, setViewState] = useState(() => { try { return window.localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards"; } catch { return "cards"; } });
  const [paging, setPaging] = useState({ signature: "", page: 1 });
  const setView = (next) => { setViewState(next); try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* private mode: the choice just isn't remembered */ } };

  const claims = useMemo(() => data?.claims || [], [data]);
  const educators = useMemo(() => data?.educators || [], [data]);
  const currency = claims[0]?.currency || "KES";
  const money = (value) => formatMoney(value, currency);

  // Opened from a notification with ?claim=<id>.
  const openId = searchParams.get("claim");
  const open = (id) => setSearchParams(id ? { claim: id } : {}, { replace: true });

  const tab = picked || "pending_supervisor";
  const current = TABS.find((t) => t.key === tab);

  const overdueCount = useMemo(() => claims.filter((c) => c.status === "pending_supervisor" && daysSince(c.createdAt) >= OVERDUE_DAYS).length, [claims]);
  const hubs = useMemo(() => {
    const byId = new Map();
    for (const claim of claims) if (claim.hubId && !byId.has(claim.hubId)) byId.set(claim.hubId, claim.hubName || "Hub");
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [claims]);

  // Everything but the status: the tabs count within this, so each tab's number is what opening
  // it will show.
  const scoped = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return claims
      .filter((c) => !educatorId || c.teacherId === educatorId)
      .filter((c) => hubId === "all" || c.hubId === hubId)
      .filter((c) => type === "all" || c.type === type)
      .filter((c) => inPeriod(c, period, range.from, range.to))
      .filter((c) => {
        if (!words.length) return true;
        const text = [c.teacherName, c.courseName, c.className, c.hubName, c.claimNumber].filter(Boolean).join(" ").toLowerCase();
        return words.every((word) => text.includes(word));
      });
  }, [claims, educatorId, hubId, type, period, range, search]);
  const tabCounts = useMemo(() => {
    const result = {};
    for (const claim of scoped) result[claim.status] = (result[claim.status] || 0) + 1;
    return result;
  }, [scoped]);

  // What has waited longest comes first when there's a decision to make; newest first otherwise.
  const sort = sortPick || { key: "date", dir: tab === "pending_supervisor" ? "asc" : "desc" };
  const onlyOverdue = overdueOnly && tab === "pending_supervisor";
  const filtered = useMemo(() => {
    const compare = COMPARE[sort.key];
    return scoped
      .filter((c) => c.status === tab)
      .filter((c) => !onlyOverdue || daysSince(c.createdAt) >= OVERDUE_DAYS)
      .sort((a, b) => (sort.dir === "asc" ? compare(a, b) : compare(b, a)));
  }, [scoped, tab, onlyOverdue, sort.key, sort.dir]);

  // Any change to what's listed goes back to the first page.
  const pageSize = PAGE_SIZE[view];
  const signature = [tab, educatorId, hubId, type, period, range.from, range.to, search, onlyOverdue, sort.key, sort.dir, view].join("|");
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(paging.signature === signature ? paging.page : 1, pageCount);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const goToPage = (next) => { setPaging({ signature, page: next }); window.scrollTo({ top: document.querySelector(".supervisor-grid")?.offsetTop || 0, behavior: "smooth" }); };

  const filtering = Boolean(educatorId || search.trim() || hubId !== "all" || type !== "all" || period !== "all" || onlyOverdue);
  const clearFilters = () => { setEducatorId(null); setSearch(""); setHubId("all"); setType("all"); setPeriod("all"); setRange({ from: "", to: "" }); setOverdueOnly(false); };
  const onSort = (key) => setSortPick(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "amount" ? "desc" : "asc" });

  // Past educators still have claims here, so the picker lists everyone a claim came from.
  const educatorOptions = useMemo(() => {
    const byId = new Map(educators.map((e) => [e.id, e.name]));
    for (const claim of claims) if (!byId.has(claim.teacherId)) byId.set(claim.teacherId, claim.teacherName);
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [educators, claims]);

  if (isLoading) return <p style={{ fontFamily: "Inter, sans-serif", color: T.inkMuted, fontSize: 14, padding: "60px 0", textAlign: "center" }}>Loading your claims…</p>;
  if (isError) {
    return (
      <div style={{ ...cardStyle, fontFamily: "Inter, sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Your claims couldn't be loaded</p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: T.inkMuted }}>{error?.message}</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: "-0.5px" }}>Claims</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: T.inkMuted }}>Every claim your educators have sent you. Approve one and it goes to the admin to be paid; decline it and the educator sees your reason.</p>
      </div>

      <div className="supervisor-grid">
        <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div role="tablist" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "#EAF0F6", flexWrap: "wrap" }}>
              {TABS.map((t) => {
                const on = t.key === tab;
                const Icon = t.icon;
                const count = tabCounts[t.key] || 0;
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 800, background: on ? "#fff" : "transparent", color: on ? T.accent : T.inkMuted, boxShadow: on ? "0 1px 4px rgba(15,23,42,0.12)" : "none" }}>
                    <Icon size={14} /> {t.label}
                    <span style={{ minWidth: 20, padding: "1px 6px", borderRadius: 999, fontSize: 11.5, textAlign: "center", background: on ? (t.key === "pending_supervisor" && count ? T.gold : T.tintBg) : "rgba(15,23,42,0.07)", color: on ? "#17304B" : T.inkMuted }}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1 }} />
            <div role="group" aria-label="How to show the claims" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "#EAF0F6" }}>
              {[["cards", FiGrid, "Cards"], ["table", FiList, "Table"]].map(([key, Icon, label]) => (
                <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} title={`${label} view`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 800, background: view === key ? "#fff" : "transparent", color: view === key ? T.accent : T.inkMuted, boxShadow: view === key ? "0 1px 4px rgba(15,23,42,0.12)" : "none" }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <button type="button" disabled={filtered.length === 0} onClick={() => downloadCsv(filtered, current.label.toLowerCase().replace(/\s+/g, "-"))} title="Download the claims listed here as a spreadsheet" style={{ ...controlStyle, display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, color: filtered.length ? T.accent : "#C3CBD5", cursor: filtered.length ? "pointer" : "default" }}>
              <FiDownload size={14} /> Export
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
              <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search educator, course or claim no." aria-label="Search claims" style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 11, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" }} />
            </div>
            {educatorOptions.length > 1 && (
              <select value={educatorId || ""} onChange={(e) => setEducatorId(e.target.value || null)} aria-label="Filter by educator" style={active(Boolean(educatorId))}>
                <option value="">All educators</option>
                {educatorOptions.map((educator) => <option key={educator.id} value={educator.id}>{educator.name}</option>)}
              </select>
            )}
            {hubs.length > 1 && (
              <select value={hubId} onChange={(e) => setHubId(e.target.value)} aria-label="Filter by hub" style={active(hubId !== "all")}>
                <option value="all">All hubs</option>
                {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select>
            )}
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by claim type" style={active(type !== "all")}>
              <option value="all">Advance and full</option>
              <option value="advance">Advance only</option>
              <option value="full">Full payment only</option>
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Filter by date submitted" style={active(period !== "all")}>
              {PERIODS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            {period === "custom" && (
              <>
                <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="Submitted from" style={controlStyle} />
                <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="Submitted to" style={controlStyle} />
              </>
            )}
            <select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(":"); setSortPick({ key, dir }); }} aria-label="Sort claims" style={controlStyle}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              {!SORT_OPTIONS.some((option) => option.value === `${sort.key}:${sort.dir}`) && <option value={`${sort.key}:${sort.dir}`}>Educator (Z–A)</option>}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 30 }}>
            {tab === "pending_supervisor" && overdueCount > 0 && (
              <button type="button" aria-pressed={onlyOverdue} onClick={() => setOverdueOnly(!onlyOverdue)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${onlyOverdue ? "#B91C1C" : "#FECACA"}`, background: onlyOverdue ? "#B91C1C" : "#FEF2F2", color: onlyOverdue ? "#fff" : "#B91C1C" }}>
                <FiAlertTriangle size={13} /> Waiting {OVERDUE_DAYS}+ days ({overdueCount})
              </button>
            )}
            <span style={{ fontSize: 12.5, color: T.inkMuted, fontVariantNumeric: "tabular-nums" }}>
              {filtered.length} {filtered.length === 1 ? "claim" : "claims"} · {money(filtered.reduce((total, c) => total + c.amount, 0))}
            </span>
            {filtering && (
              <button type="button" onClick={clearFilters} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "none", color: T.accentMid, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                <FiX size={13} /> Clear filters
              </button>
            )}
          </div>

          {tab === "paid" && <MonthlyTotals claims={filtered} currency={currency} />}

          {filtered.length === 0 ? (
            <div style={{ ...cardStyle, padding: "52px 24px", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, margin: "0 auto 14px", borderRadius: 18, background: T.tintBg, color: T.accent, display: "grid", placeItems: "center" }}><current.icon size={26} /></div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>{filtering ? "No claims match" : current.empty[0]}</p>
              <p style={{ margin: "6px auto 0", maxWidth: 400, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>{filtering ? "No claim here fits every filter you've set." : current.empty[1]}</p>
              {filtering && <button type="button" onClick={clearFilters} style={{ marginTop: 14, padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.accent, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear filters</button>}
            </div>
          ) : view === "table" ? (
            <ClaimTable claims={visible} sort={sort} onSort={onSort} onOpen={open} />
          ) : (
            visible.map((claim) => <ClaimCard key={claim.id} claim={claim} onOpen={() => open(claim.id)} />)
          )}

          <Pager page={page} pageCount={pageCount} total={filtered.length} pageSize={pageSize} onPage={goToPage} />
        </section>

      </div>

      {openId && <ClaimReviewDialog claimId={openId} canSupervise canApprove={false} onClose={() => open(null)} />}

      <style>{`
        .supervisor-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
        .supervisor-claim { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .supervisor-claim:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(37,71,106,0.13); }
        .supervisor-claim:focus-visible { outline: 2px solid ${T.accentLight}; outline-offset: 2px; }
        .supervisor-row:hover { background: #F8FBFE; }
      `}</style>
    </div>
  );
}
