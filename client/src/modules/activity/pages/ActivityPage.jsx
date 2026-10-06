import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiDownload, FiSearch, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { useActivity, useActivityCounts, useActivityFacets } from "../hooks/useActivity";
import { activityApi } from "../services/activityApi";
import { PERIODS, VIEWS, areaLabel, dayOf } from "../labels";
import ActivityEntry from "../components/ActivityEntry";

const control = { padding: "8px 10px", borderRadius: 9, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", background: "#fff", outline: "none", minWidth: 0 };
const card = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)" };
const chip = (on) => ({ padding: "5px 12px", borderRadius: 999, border: `1.5px solid ${on ? "#25476a" : "#E5E7EB"}`, background: on ? "#25476a" : "#fff", color: on ? "#fff" : "#374151", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" });

// Who did what, and when. Every change anyone makes in the workspace is recorded as it happens;
// this page reads that record. Nothing here can be edited or removed.
//
// The log is split by KIND of event into tabs — sign-ins, things added, edited, deleted, and
// what was refused or failed — each with its count, so the common questions ("who signed in?",
// "what was deleted?") are one click. Who, when, where and a search narrow whichever tab is open.
export default function ActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Opened from a staff member's row (Settings → People & sharing) with ?actor=<id>.
  const [view, setView] = useState(VIEWS.some((v) => v.key === searchParams.get("view")) ? searchParams.get("view") : "");
  const [narrow, setNarrow] = useState(null); // the tab's own second choice, e.g. "Failed attempts"
  const [actor, setActor] = useState(searchParams.get("actor") || "");
  const [area, setArea] = useState("");
  const [period, setPeriod] = useState("");
  const [dates, setDates] = useState({ from: "", to: "" }); // only for "Choose dates…"
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const tab = VIEWS.find((v) => v.key === view) || VIEWS[0];
  const range = period === "custom" ? dates : { from: PERIODS.find((p) => p.key === period)?.from() || "", to: "" };
  // What narrows every tab alike — the tab counts are worked out from these alone.
  const shared = useMemo(() => ({ actor, module: view === "signins" ? "" : area, from: range.from, to: range.to, q }), [actor, area, view, range.from, range.to, q]);
  const filters = useMemo(() => ({ ...shared, view, action: narrow?.action || "", outcome: narrow?.outcome || "" }), [shared, view, narrow]);

  const { data: facets } = useActivityFacets();
  const { data: counts } = useActivityCounts(shared);
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } = useActivity(filters);
  const entries = useMemo(() => (data?.pages || []).flatMap((page) => page.items), [data]);
  const narrowed = !!(actor || area || period || q || narrow);

  const openTab = (key) => { setView(key); setNarrow(null); };
  const applySearch = () => setQ(search.trim());
  const clear = () => {
    setNarrow(null); setActor(""); setArea(""); setPeriod(""); setDates({ from: "", to: "" }); setQ(""); setSearch("");
    if (searchParams.get("actor")) setSearchParams({}, { replace: true });
  };

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
      link.download = `activity-${view || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
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
            type="button" onClick={download} disabled={exporting || entries.length === 0} title="Downloads what this tab is showing"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: exporting || entries.length === 0 ? "not-allowed" : "pointer", opacity: entries.length === 0 ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            <FiDownload size={14} /> {exporting ? "Preparing…" : "Export to spreadsheet"}
          </button>
        </div>
      </div>

      {/* What kind of thing happened */}
      <div role="tablist" aria-label="Kind of activity" style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "2px solid #EEF0F3", marginBottom: 14 }}>
        {VIEWS.map((v) => {
          const on = v.key === view;
          const count = counts?.[v.key || "all"];
          const alert = v.key === "problems" && count > 0;
          return (
            <button
              key={v.key || "all"} type="button" role="tab" aria-selected={on} onClick={() => openTab(v.key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", marginBottom: -2, border: "none", borderBottom: `2px solid ${on ? "#25476a" : "transparent"}`, background: "none", color: on ? "#25476a" : "#6B7280", fontSize: 13.5, fontWeight: on ? 800 : 600, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {v.label}
              {count != null && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, fontVariantNumeric: "tabular-nums", background: alert ? "#FEF3C7" : on ? "#E0ECF7" : "#F3F4F6", color: alert ? "#B45309" : on ? "#25476a" : "#6B7280" }}>{count.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Who, when, where — the same for every tab */}
      <div style={{ ...card, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "2 1 240px", minWidth: 0 }}>
            <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input
              aria-label="Search" style={{ ...control, width: "100%", boxSizing: "border-box", paddingLeft: 34 }} value={search}
              placeholder="Search a record or person, then press Enter"
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }} onBlur={applySearch}
            />
          </div>
          <select aria-label="Person" style={{ ...control, flex: "1 1 140px" }} value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            {(facets?.actors || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="When" style={{ ...control, flex: "1 1 130px" }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {/* Sign-ins all belong to one area, so the choice would do nothing there. */}
          {view !== "signins" && (
            <select aria-label="Area" style={{ ...control, flex: "1 1 140px" }} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {(facets?.modules || []).filter((m) => m !== "account").map((m) => <option key={m} value={m}>{areaLabel(m)}</option>)}
            </select>
          )}
          {narrowed && (
            <button type="button" onClick={clear} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              <FiX size={14} /> Clear
            </button>
          )}
        </div>

        {period === "custom" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>From
              <input type="date" aria-label="From date" style={control} value={dates.from} max={dates.to || undefined} onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>To
              <input type="date" aria-label="To date" style={control} value={dates.to} min={dates.from || undefined} onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))} />
            </label>
          </div>
        )}

        {/* The open tab's own second choice, e.g. Sign-ins → Failed attempts */}
        {tab.narrow && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" aria-pressed={!narrow} onClick={() => setNarrow(null)} style={chip(!narrow)}>All</button>
            {tab.narrow.map((n) => (
              <button key={n.label} type="button" aria-pressed={narrow?.label === n.label} onClick={() => setNarrow(n)} style={chip(narrow?.label === n.label)}>{n.label}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, padding: "6px 18px 14px", opacity: isFetching && !isFetchingNextPage ? 0.7 : 1, transition: "opacity 0.15s" }}>
        {isLoading && <p style={{ margin: "18px 0", fontSize: 13, color: "#9CA3AF" }}>Loading activity…</p>}
        {isError && <p style={{ margin: "18px 0", fontSize: 13, color: "#DC2626" }}>Couldn&rsquo;t load the activity: {error?.message}</p>}
        {!isLoading && !isError && entries.length === 0 && (
          <div style={{ padding: "36px 12px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: "#374151" }}>{narrowed ? "Nothing matches" : tab.empty.replace(" in this period", "")}</p>
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
              {narrowed ? "Try a longer period, another person, or clear the choices above." : view ? "When it happens, it will be listed here." : "Changes made from now on appear here as they happen."}
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
