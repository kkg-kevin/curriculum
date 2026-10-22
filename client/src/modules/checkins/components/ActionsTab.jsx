import { useState } from "react";
import { useCheckinActions, useCheckinHubs, useCheckinPeople } from "../hooks/useCheckins";
import { ActionRow } from "./Rows";
import { ACTION_STATUS, CATEGORY_LABEL, Empty, Pager, card, chip, control, hint } from "../shared";

// Issues and follow-up actions from every check-in I can see — outstanding first. `onOpen` opens
// one (the page keeps it in ?action= so a notification can link straight to it).
export default function ActionsTab({ isManager, onOpen }) {
  const [scope, setScope] = useState("all");
  const [filters, setFilters] = useState({ status: "outstanding", hubId: "", assigneeId: "", category: "", overdue: "", escalated: "" });
  const [page, setPage] = useState(1);
  const { data: hubs = [] } = useCheckinHubs();
  const { data: people = [] } = useCheckinPeople();
  const params = { scope, page, limit: 30, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const { data, isLoading, isError, error } = useCheckinActions(params);
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };
  const toggle = (key) => { setFilters((f) => ({ ...f, [key]: f[key] ? "" : "true" })); setPage(1); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setScope("mine"); setPage(1); }} style={chip(scope === "mine")}>Assigned to me</button>
        <button type="button" onClick={() => { setScope("all"); setPage(1); }} style={chip(scope === "all")}>{isManager ? "Every hub" : "My hubs"}</button>
        <button type="button" onClick={() => toggle("overdue")} style={chip(filters.overdue === "true")}>Overdue</button>
        <button type="button" onClick={() => toggle("escalated")} style={chip(filters.escalated === "true")}>Escalated</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Status" style={control}>
          <option value="outstanding">Outstanding</option>
          <option value="">Any status</option>
          {Object.entries(ACTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={control}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={filters.category} onChange={setFilter("category")} aria-label="Category" style={control}>
          <option value="">Any category</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {scope === "all" && (
          <select value={filters.assigneeId} onChange={setFilter("assigneeId")} aria-label="Responsible" style={control}>
            <option value="">Anyone responsible</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Actions couldn't be loaded."}</p>}
        {data && data.actions.length === 0 && <Empty title="Nothing here">Issues and follow-ups are added from a check-in&apos;s report.</Empty>}
        {data?.actions.map((a) => <ActionRow key={a.id} action={a} onOpen={onOpen} />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
