import { useState } from "react";
import { useCheckinHubs, useCheckinSessions } from "../hooks/useCheckins";
import { SessionRow } from "./Rows";
import { Empty, FREQUENCY_LABEL, Pager, SESSION_STATUS, card, chip, control, hint } from "../shared";

const VIEWS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending reports" },
  { key: "overdue", label: "Overdue / missed" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

const EMPTY_TEXT = {
  today: "No check-ins today.",
  upcoming: "Nothing coming up.",
  pending: "No reports waiting to be finished.",
  overdue: "Nothing overdue or missed.",
  rescheduled: "Nothing moved.",
  completed: "No completed check-ins yet.",
  all: "No check-ins yet.",
};

// My Check-ins: the check-ins I'm on (Account Manager or Training Lead). A manager can switch to
// everyone's, across every hub.
export default function MyCheckins({ isManager }) {
  const [view, setView] = useState("today");
  const [scope, setScope] = useState("mine");
  const [filters, setFilters] = useState({ hubId: "", frequency: "", status: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const { data: hubs = [] } = useCheckinHubs();
  const params = { scope, view, page, limit: 30, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, isLoading, isError, error } = useCheckinSessions(params);
  const counts = data?.counts || {};
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => { setView(v.key); setPage(1); }} style={chip(view === v.key)}>
            {v.label}{scope === "mine" && counts[v.key] ? ` · ${counts[v.key]}` : ""}
          </button>
        ))}
        {isManager && (
          <select value={scope} onChange={(e) => { setScope(e.target.value); setPage(1); }} aria-label="Whose check-ins" style={{ ...control, marginLeft: "auto" }}>
            <option value="mine">Mine</option>
            <option value="all">Everyone&apos;s</option>
          </select>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={control}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={filters.frequency} onChange={setFilter("frequency")} aria-label="Frequency" style={control}>
          <option value="">Any frequency</option>
          {Object.entries(FREQUENCY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Status" style={control}>
          <option value="">Any status</option>
          {Object.entries(SESSION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={setFilter("from")} aria-label="From" style={control} />
        <input type="date" value={filters.to} onChange={setFilter("to")} aria-label="To" style={control} />
      </div>

      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Check-ins couldn't be loaded."}</p>}
        {data && data.sessions.length === 0 && <Empty title={EMPTY_TEXT[view]}>{scope === "mine" ? "Check-ins you're assigned to appear here." : null}</Empty>}
        {data?.sessions.map((s) => <SessionRow key={s.id} session={s} />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
