import { useState } from "react";
import { useCheckinTasks } from "../hooks/useCheckins";
import { TaskRow } from "./Tasks";
import { Empty, Pager, Segmented, card, hint, toolbar } from "../shared";

const VIEWS = [
  { key: "open", label: "To do" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

// Tasks from check-ins' resolutions. scope "mine": the ones given to me. scope "all" (managers):
// everyone's.
export default function TasksTab({ scope }) {
  const [view, setView] = useState("open");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useCheckinTasks({ scope, view, page, limit: 30 });
  const counts = data?.counts || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented
          label="Show"
          options={VIEWS.map((v) => ({ ...v, count: counts[v.key] }))}
          value={view}
          onChange={(key) => { setView(key); setPage(1); }}
        />
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Tasks couldn't be loaded."}</p>}
        {data && data.tasks.length === 0 && (
          <Empty title={view === "done" ? "Nothing done yet." : view === "open" ? "Nothing to do." : "No tasks yet."}>
            {scope === "mine" ? "Tasks given to you from a check-in's resolutions appear here." : null}
          </Empty>
        )}
        {data?.tasks.map((t) => <TaskRow key={t.id} task={t} showCheckin />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
