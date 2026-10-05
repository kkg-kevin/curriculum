import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiDownload, FiSearch, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { useActivity, useActivityFacets } from "../hooks/useActivity";
import { activityApi } from "../services/activityApi";
import { ACTION_OPTIONS, areaLabel, dayOf } from "../labels";
import ActivityEntry from "../components/ActivityEntry";

const control = { padding: "8px 10px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", background: "#fff", outline: "none", minWidth: 0 };
const EMPTY = { actor: "", module: "", action: "", outcome: "", from: "", to: "", q: "" };

// Settings → who did what, and when. Every change anyone makes in the workspace is recorded as
// it happens; this page reads that record. Nothing here can be edited or removed.
export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Opened from a staff member's row (Settings → People & sharing) with ?actor=<id>.
  const [filters, setFilters] = useState({ ...EMPTY, actor: searchParams.get("actor") || "" });
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data: facets } = useActivityFacets();
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useActivity(filters);
  const entries = useMemo(() => (data?.pages || []).flatMap((page) => page.items), [data]);
  const active = Object.values(filters).some(Boolean);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const applySearch = () => set("q", search.trim());
  const clear = () => { setFilters(EMPTY); setSearch(""); if (searchParams.get("actor")) setSearchParams({}, { replace: true }); };

  // Entries arrive newest first; a heading goes above the first entry of each day.
  const days = useMemo(() => {
    const groups = [];
    for (const entry of entries) {
      const day = dayOf(entry.createdAt);
      if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, entries: [] });
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [entries]);

  const download = async () => {
    setExporting(true);
    try {
      const blob = await activityApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || "Could not export the activity");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Activity</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, maxWidth: 600 }}>
              Who did what, and when. Every change made in your workspace is recorded as it happens, with what was changed, and can&rsquo;t be edited or removed.
              {facets?.retentionDays ? ` Entries are kept for ${Math.round(facets.retentionDays / 365)} years.` : ""}
            </p>
          </div>
          <button
            type="button" onClick={download} disabled={exporting || entries.length === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: exporting || entries.length === 0 ? "not-allowed" : "pointer", opacity: entries.length === 0 ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            <FiDownload size={14} /> {exporting ? "Preparing…" : "Export to spreadsheet"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <select aria-label="Person" style={control} value={filters.actor} onChange={(e) => set("actor", e.target.value)}>
            <option value="">Everyone</option>
            {(facets?.actors || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Area" style={control} value={filters.module} onChange={(e) => set("module", e.target.value)}>
            <option value="">All areas</option>
            {(facets?.modules || []).map((m) => <option key={m} value={m}>{areaLabel(m)}</option>)}
          </select>
          <select aria-label="What happened" style={control} value={filters.action} onChange={(e) => set("action", e.target.value)}>
            <option value="">Any action</option>
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="Outcome" style={control} value={filters.outcome} onChange={(e) => set("outcome", e.target.value)}>
            <option value="">Any outcome</option>
            <option value="success">Went through</option>
            <option value="refused">Refused</option>
            <option value="failed">Failed</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>From
            <input type="date" aria-label="From date" style={{ ...control, flex: 1 }} value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>To
            <input type="date" aria-label="To date" style={{ ...control, flex: 1 }} value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input
              aria-label="Search" style={{ ...control, width: "100%", boxSizing: "border-box", paddingLeft: 34 }} value={search}
              placeholder="Search a record or person, then press Enter — e.g. a learner's name"
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }} onBlur={applySearch}
            />
          </div>
          {active && (
            <button type="button" onClick={clear} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              <FiX size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "6px 18px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)", opacity: isFetching && !isFetchingNextPage ? 0.7 : 1, transition: "opacity 0.15s" }}>
        {isLoading && <p style={{ margin: "18px 0", fontSize: 13, color: "#9CA3AF" }}>Loading activity…</p>}
        {isError && <p style={{ margin: "18px 0", fontSize: 13, color: "#DC2626" }}>Couldn&rsquo;t load the activity: {error?.message}</p>}
        {!isLoading && !isError && entries.length === 0 && (
          <div style={{ padding: "36px 12px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "#374151" }}>{active ? "Nothing matches these filters" : "No activity recorded yet"}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
              {active ? "Try a wider date range or clear the filters." : "Changes made from now on appear here as they happen."}
            </p>
          </div>
        )}

        {days.map((group) => (
          <section key={group.day}>
            <h2 style={{ margin: "16px 0 4px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6B7280" }}>{group.day}</h2>
            {group.entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} />)}
          </section>
        ))}

        {hasNextPage && (
          <div style={{ textAlign: "center", paddingTop: 14 }}>
            <button type="button" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ padding: "9px 20px", borderRadius: 10, border: "1.5px solid #E5E7EB", background: "#fff", color: "#25476a", fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {isFetchingNextPage ? "Loading…" : "Show earlier activity"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
