import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { T } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";

// Choosing a supervisor's educators (People → Supervisors, 17 Nov 2026): the workspace's
// educators with a search, "without a supervisor" to find the unassigned, and — for one who has
// another supervisor now — a note that ticking them moves them here.
//   options     [{ id, name, email, photo, status, supervisorId, supervisorName }]
//   selected    Set of educator ids
//   onChange    (Set) => void
//   supervisorId  the supervisor being edited (none while creating)
//   excludeEmail  the supervisor's own email — their own educator record is left out (no one supervises themselves)
const STATUS = { inactive: "Inactive", on_leave: "On leave", in_training: "In training" };

export default function EducatorPicker({ options: allOptions = [], selected, onChange, supervisorId = null, loading = false, excludeEmail = "" }) {
  const self = String(excludeEmail || "").trim().toLowerCase();
  const options = useMemo(() => (self ? allOptions.filter((o) => String(o.email || "").toLowerCase() !== self) : allOptions), [allOptions, self]);
  const [search, setSearch] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const q = search.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => (!onlyFree || !o.supervisorId || o.supervisorId === supervisorId)
    && (!q || `${o.name} ${o.email || ""}`.toLowerCase().includes(q))), [options, onlyFree, q, supervisorId]);
  const toggle = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); onChange(n); };
  const allShownOn = shown.length > 0 && shown.every((o) => selected.has(o.id));
  const toggleShown = () => { const n = new Set(selected); shown.forEach((o) => (allShownOn ? n.delete(o.id) : n.add(o.id))); onChange(n); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <label style={{ position: "relative", flex: "1 1 220px" }}>
          <FiSearch size={14} aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.inkFaint }} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search educators…" aria-label="Search educators"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px 9px 30px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "inherit" }} />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Without a supervisor
        </label>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.accent }}>{selected.size} chosen</span>
      </div>
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, maxHeight: 360, overflowY: "auto", background: "#fff" }}>
        {loading && <p style={{ margin: 0, padding: 14, fontSize: 13, color: T.inkMuted }}>Loading educators…</p>}
        {!loading && shown.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 13, color: T.inkMuted }}>{options.length ? "No educator matches." : "No educators in your workspace yet."}</p>}
        {!loading && shown.length > 1 && (
          <button type="button" onClick={toggleShown} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: 0, borderBottom: `1px solid ${T.border}`, background: "#F8FAFC", color: T.accentMid, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {allShownOn ? "Untick all shown" : `Tick all ${shown.length} shown`}
          </button>
        )}
        {shown.map((o) => {
          const on = selected.has(o.id);
          const elsewhere = o.supervisorId && o.supervisorId !== supervisorId;
          return (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid #F3F4F6", cursor: "pointer", background: on ? "#F3F8FC" : "#fff" }}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.id)} aria-label={o.name} />
              <Avatar name={o.name} photo={o.photo} size={30} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                  {o.name}{STATUS[o.status] && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#B45309" }}>{STATUS[o.status]}</span>}
                </span>
                <span style={{ display: "block", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.email || "No email"}</span>
              </span>
              {elsewhere && (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? "#B45309" : T.inkFaint, textAlign: "right", flexShrink: 0 }}>
                  {on ? `Moves from ${o.supervisorName || "another supervisor"}` : `With ${o.supervisorName || "another supervisor"}`}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
