import { useMemo, useState } from "react";
import { FiActivity, FiChevronDown } from "react-icons/fi";
import { useSupervisorActivity } from "../hooks/useSupervisorPortal";
import { useSupervisorClaims } from "../../claims/hooks/useClaims";
import ActivityEntry from "../../activity/components/ActivityEntry";
import { T, cardStyle } from "../../claims/shared";

// The supervisor portal's Team activity (/supervisor-portal/activity, 17 Nov 2026): what their
// educators did in the system — signed in, took attendance, marked work, published reports, wrote
// check-ins — newest first, from the activity log. Pick one educator, a kind, or dates.
const VIEWS = [
  { key: "", label: "Everything" },
  { key: "added", label: "Added" },
  { key: "edited", label: "Changed" },
  { key: "signins", label: "Sign-ins" },
  { key: "problems", label: "Problems" },
];
const dayOf = (iso) => new Date(iso).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function TeamActivityPage() {
  const { data: claimsData } = useSupervisorClaims();
  const educators = claimsData?.educators || [];
  const [educator, setEducator] = useState("");
  const [view, setView] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useSupervisorActivity({ educator, view, from, to });
  const items = useMemo(() => (query.data?.pages || []).flatMap((p) => p.items || []), [query.data]);
  const byDay = useMemo(() => {
    const groups = [];
    for (const e of items) {
      const day = dayOf(e.createdAt);
      if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, entries: [] });
      groups[groups.length - 1].entries.push(e);
    }
    return groups;
  }, [items]);
  const control = { padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13, fontFamily: "inherit", color: T.ink, background: "#fff" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ borderRadius: 20, padding: "24px 28px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 45%, ${T.accentMid} 80%, ${T.accentLight} 100%)` }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><FiActivity size={22} /> Team activity</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", maxWidth: 660, lineHeight: 1.5 }}>
          What your educators have been doing in the system — attendance taken, work marked, reports published, check-ins written — newest first.
        </p>
      </section>

      <section style={{ ...cardStyle, padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <select value={educator} onChange={(e) => setEducator(e.target.value)} aria-label="Educator" style={{ ...control, minWidth: 200 }}>
          <option value="">All my educators</option>
          {educators.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div role="group" aria-label="Kind" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button key={v.key || "all"} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)}
              style={{ padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${view === v.key ? T.accent : T.border}`, background: view === v.key ? T.accent : "#fff", color: view === v.key ? "#fff" : T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {v.label}
            </button>
          ))}
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.inkMuted }}>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={control} /></label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.inkMuted }}>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={control} /></label>
      </section>

      <section style={{ ...cardStyle, padding: "6px 16px 14px" }}>
        {query.isLoading && <p style={{ fontSize: 13, color: T.inkMuted }}>Loading…</p>}
        {query.isError && <p style={{ fontSize: 13, color: "#B91C1C" }}>{query.error?.response?.data?.message || "The activity couldn't be loaded."}</p>}
        {!query.isLoading && !query.isError && items.length === 0 && <p style={{ fontSize: 13, color: T.inkMuted, padding: "14px 0" }}>Nothing here for these choices.</p>}
        {byDay.map((g) => (
          <div key={g.day}>
            <h2 style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>{g.day}</h2>
            {g.entries.map((entry) => <ActivityEntry key={entry.id} entry={entry} />)}
          </div>
        ))}
        {query.hasNextPage && (
          <button type="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            <FiChevronDown size={14} /> {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        )}
      </section>
    </div>
  );
}
