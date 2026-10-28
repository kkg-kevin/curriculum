import { useState } from "react";
import { useCheckinHubs, useCheckinPeople, useCheckinSessions } from "../hooks/useCheckins";
import { SessionRow } from "./Rows";
import { Empty, Pager, Segmented, card, hint, toolbar, toolbarSelect } from "../shared";

const VIEWS = [
  { key: "due", label: "Report due" },
  { key: "upcoming", label: "Upcoming" },
  { key: "reported", label: "Reported" },
  { key: "all", label: "All" },
];

const EMPTY_TEXT = {
  due: "No reports due.",
  upcoming: "Nothing coming up.",
  reported: "No reports yet.",
  all: "No check-ins yet.",
};

// The hub's own view: its reports first; nothing to write, so no "Report due" tab of its own.
const HUB_VIEWS = [
  { key: "reported", label: "Reports" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
];

// A list of check-ins. scope "mine": the ones I'm on (Account Manager or Training Lead). scope
// "all" (managers): every hub's, with a filter by person too. `hubView`: the hub's own login —
// its own check-ins (the server keeps it to them), no filters.
export default function CheckinList({ scope, hubView = false, hubId = "" }) {
  const views = hubView ? HUB_VIEWS : VIEWS;
  const [view, setView] = useState(views[0].key);
  const [filters, setFilters] = useState({ hubId: "", staffId: "" });
  const [page, setPage] = useState(1);
  const { data: hubs = [] } = useCheckinHubs({ enabled: !hubView });
  const { data: people = [] } = useCheckinPeople({ enabled: !hubView });
  // The hub view names the hub it's on, so switching hubs in the portal loads that hub's list.
  const params = { scope, view, page, limit: 30, ...Object.fromEntries(Object.entries(hubView ? { hubId } : filters).filter(([, v]) => v)) };
  const { data, isLoading, isError, error } = useCheckinSessions(params);
  const counts = data?.counts || {};
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented
          label="Show"
          options={views.map((v) => ({ ...v, count: counts[v.key] }))}
          value={view}
          onChange={(key) => { setView(key); setPage(1); }}
        />
        {!hubView && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={toolbarSelect}>
            <option value="">All hubs</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {scope === "all" && (
            <select value={filters.staffId} onChange={setFilter("staffId")} aria-label="Person" style={toolbarSelect}>
              <option value="">Everyone</option>
              {people.filter((p) => p.canUseCheckins).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>}
      </div>

      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Check-ins couldn't be loaded."}</p>}
        {data && data.sessions.length === 0 && (
          <Empty title={EMPTY_TEXT[view]}>
            {hubView ? "Reports from your hub's check-ins appear here once they're written." : scope === "mine" ? "Check-ins you're put on appear here." : null}
          </Empty>
        )}
        {data?.sessions.map((s) => <SessionRow key={s.id} session={s} showHub={!hubView} />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
