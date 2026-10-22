import { useState } from "react";
import { useCheckinHubs, useCheckinOverview, useCheckinPeople } from "../hooks/useCheckins";
import { ActionRow, SessionRow } from "./Rows";
import { Empty, FREQUENCY_LABEL, SESSION_STATUS, T, card, control, hint } from "../shared";

function Tile({ label, value, tone }) {
  const color = { danger: "#B91C1C", warn: "#B45309", good: "#047857" }[tone] || T.accent;
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.inkMuted }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</p>
    </div>
  );
}

function Panel({ title, children, empty, count }) {
  return (
    <section style={{ ...card, overflow: "hidden" }}>
      <h3 style={{ margin: 0, padding: "14px 18px 10px", fontSize: 14, fontWeight: 800, color: T.ink }}>{title}{count ? <span style={{ color: T.inkFaint, fontWeight: 600 }}> · {count}</span> : null}</h3>
      {count === 0 ? <Empty title={empty} /> : children}
    </section>
  );
}

// Check-in activity across every hub (managers): the indicators for the period, then what needs
// looking at. Every row opens the check-in or the action.
export default function OverviewTab({ onOpenAction }) {
  const [filters, setFilters] = useState({ from: "", to: "", hubId: "", staffId: "", frequency: "", status: "" });
  const { data: hubs = [] } = useCheckinHubs();
  const { data: people = [] } = useCheckinPeople();
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const { data, isLoading, isError, error } = useCheckinOverview(params);
  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const ind = data?.indicators || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={filters.from} onChange={setFilter("from")} aria-label="From" style={control} />
        <input type="date" value={filters.to} onChange={setFilter("to")} aria-label="To" style={control} />
        <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={control}>
          <option value="">All hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={filters.staffId} onChange={setFilter("staffId")} aria-label="Staff" style={control}>
          <option value="">All staff</option>
          {people.filter((p) => p.canUseCheckins).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.frequency} onChange={setFilter("frequency")} aria-label="Frequency" style={control}>
          <option value="">Any frequency</option>
          {Object.entries(FREQUENCY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter("status")} aria-label="Status" style={control}>
          <option value="">Any status</option>
          {Object.entries(SESSION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {data && <span style={{ fontSize: 12, color: T.inkMuted }}>Period {data.period.from} to {data.period.to}</span>}
      </div>

      {isLoading && <p style={hint}>Loading…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>{error?.message || "The overview couldn't be loaded."}</p>}
      {data && (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Tile label="Scheduled" value={ind.scheduled} />
            <Tile label="Completed" value={ind.completed} tone="good" />
            <Tile label="Pending / overdue reports" value={ind.pending} tone={ind.pending ? "warn" : undefined} />
            <Tile label="Missed" value={ind.missed} tone={ind.missed ? "danger" : undefined} />
            <Tile label="Open issues & actions" value={ind.openIssues} tone={ind.openIssues ? "warn" : undefined} />
            <Tile label="Overdue actions" value={ind.overdueActions} tone={ind.overdueActions ? "danger" : undefined} />
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
            <Panel title="Needs attention: missed, pending, rescheduled" count={data.attention.length} empty="Nothing missed or waiting">
              {data.attention.map((s) => <SessionRow key={s.id} session={s} />)}
            </Panel>
            <Panel title="Hubs marked Needs attention or Critical" count={data.flaggedHubs.length} empty="No hub is flagged in its latest report">
              {data.flaggedHubs.map((s) => <SessionRow key={s.id} session={s} />)}
            </Panel>
            <Panel title="Upcoming check-ins" count={data.upcoming.length} empty="Nothing scheduled">
              {data.upcoming.map((s) => <SessionRow key={s.id} session={s} />)}
            </Panel>
            <Panel title="Recently completed reports" count={data.recentReports.length} empty="No reports yet">
              {data.recentReports.map((s) => <SessionRow key={s.id} session={s} />)}
            </Panel>
            <Panel title="Overdue actions" count={data.overdue.length} empty="Nothing overdue">
              {data.overdue.map((a) => <ActionRow key={a.id} action={a} onOpen={onOpenAction} />)}
            </Panel>
            <Panel title="Outstanding issues & actions" count={data.outstanding.length} empty="Nothing outstanding">
              {data.outstanding.map((a) => <ActionRow key={a.id} action={a} onOpen={onOpenAction} />)}
            </Panel>
            <Panel title="Recent escalations" count={data.escalations.length} empty="No escalations">
              {data.escalations.map((a) => <ActionRow key={a.id} action={a} onOpen={onOpenAction} />)}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
