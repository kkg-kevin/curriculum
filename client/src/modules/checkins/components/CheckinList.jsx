import { useState } from "react";
import { useCheckinHubs, useCheckinPeople, useCheckinSessions } from "../hooks/useCheckins";
import { SessionRow } from "./Rows";
import { Empty, Pager, card, chip, control, hint } from "../shared";

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

// A list of check-ins. scope "mine": the ones I'm on (Account Manager or Training Lead). scope
// "all" (managers): every hub's, with a filter by person too.
export default function CheckinList({ scope }) {
  const [view, setView] = useState("due");
  const [filters, setFilters] = useState({ hubId: "", staffId: "" });
  const [page, setPage] = useState(1);
  const { data: hubs = [] } = useCheckinHubs();
  const { data: people = [] } = useCheckinPeople();
  const params = { scope, view, page, limit: 30, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, isLoading, isError, error } = useCheckinSessions(params);
  const counts = data?.counts || {};
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {VIEWS.map((v) => (
          <button key={v.key} type="button" onClick={() => { setView(v.key); setPage(1); }} style={chip(view === v.key)}>
            {v.label}{counts[v.key] ? ` · ${counts[v.key]}` : ""}
          </button>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
          <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={control}>
            <option value="">All hubs</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {scope === "all" && (
            <select value={filters.staffId} onChange={setFilter("staffId")} aria-label="Person" style={control}>
              <option value="">Everyone</option>
              {people.filter((p) => p.canUseCheckins).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Check-ins couldn't be loaded."}</p>}
        {data && data.sessions.length === 0 && <Empty title={EMPTY_TEXT[view]}>{scope === "mine" ? "Check-ins you're put on appear here." : null}</Empty>}
        {data?.sessions.map((s) => <SessionRow key={s.id} session={s} />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
