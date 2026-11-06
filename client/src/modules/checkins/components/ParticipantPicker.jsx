import { useMemo, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import { useCheckinHubPeople } from "../hooks/useCheckins";
import { T, font, hint, input } from "../shared";

// Who takes part in a hub's check-ins (6 Nov 2026), chosen when they're set up: four groups —
// our team (admins and staff), the hub's own login, its mentors, and parents of its learners
// (server: checkin.access.js's participantOptions). Each group has an "everyone" box and a box per
// person; a long group (parents) can be searched. The hub's Account Manager and Training Lead run
// every check-in, so they're always involved and aren't listed.

export const GROUPS = [
  { key: "team", label: "Our team", help: "Admins and staff of this workspace" },
  { key: "hub", label: "The hub", help: "The hub's own login — its admin or manager" },
  { key: "mentors", label: "Mentors", help: "Educators of this hub" },
  { key: "parents", label: "Parents", help: "Parents of learners enrolled at this hub" },
];

function Group({ group, people, selected, onToggle, onSetMany, leads }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = people.filter((p) => !leads.has(p.userId));
  const shown = query.trim()
    ? list.filter((p) => `${p.name} ${p.email} ${p.detail}`.toLowerCase().includes(query.trim().toLowerCase()))
    : list;
  const picked = list.filter((p) => selected.has(p.userId)).length;
  const all = list.length > 0 && picked === list.length;
  const some = picked > 0 && !all;

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: all || some ? T.tint : "#fff" }}>
        <input
          type="checkbox"
          aria-label={`Everyone in ${group.label}`}
          checked={all}
          ref={(el) => { if (el) el.indeterminate = some; }}
          disabled={!list.length}
          onChange={(e) => onSetMany(list.map((p) => p.userId), e.target.checked)}
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={!list.length}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: 0, background: "none", padding: 0, cursor: list.length ? "pointer" : "default", fontFamily: font, textAlign: "left" }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: T.ink }}>{group.label}</span>
            <span style={{ display: "block", fontSize: 11.5, color: T.inkMuted }}>{list.length ? `${group.help} · ${picked} of ${list.length} chosen` : `${group.help} — nobody to choose`}</span>
          </span>
          {list.length > 0 && <FiChevronDown size={16} color={T.inkMuted} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />}
        </button>
      </div>
      {open && list.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {list.length > 8 && (
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #F3F4F6", position: "relative" }}>
              <FiSearch size={13} color={T.inkFaint} style={{ position: "absolute", left: 22, top: 19 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${group.label.toLowerCase()}`} aria-label={`Search ${group.label}`} style={{ ...input, paddingLeft: 30 }} />
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {shown.map((p) => (
              <label key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #F7F7F8", cursor: "pointer" }}>
                <input type="checkbox" checked={selected.has(p.userId)} onChange={() => onToggle(p.userId)} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.ink }}>{p.name}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[p.detail, p.email].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            ))}
            {shown.length === 0 && <p style={{ ...hint, padding: "10px 12px", margin: 0 }}>Nobody matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParticipantPicker({ hubId, value = [], onChange, leads = [] }) {
  const { data, isLoading, isError } = useCheckinHubPeople(hubId);
  const selected = useMemo(() => new Set(value), [value]);
  const leadSet = useMemo(() => new Set(leads.filter(Boolean)), [leads]);
  if (!hubId) return <p style={{ ...hint, margin: 0 }}>Choose the hub first.</p>;
  if (isLoading) return <p style={{ ...hint, margin: 0 }}>Loading the hub&apos;s people…</p>;
  if (isError || !data) return <p style={{ ...hint, margin: 0, color: "#B91C1C" }}>The hub&apos;s people couldn&apos;t be loaded.</p>;

  const toggle = (id) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const setMany = (ids, on) => onChange(on ? [...new Set([...value, ...ids])] : value.filter((v) => !ids.includes(v)));
  const total = GROUPS.reduce((n, g) => n + (data[g.key] || []).filter((p) => selected.has(p.userId)).length, 0);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {GROUPS.map((g) => (
        <Group key={g.key} group={g} people={data[g.key] || []} selected={selected} onToggle={toggle} onSetMany={setMany} leads={leadSet} />
      ))}
      <p style={{ ...hint, margin: 0 }}>
        {total ? `${total} ${total === 1 ? "person" : "people"} chosen` : "Nobody else chosen"} — besides the Account Manager and Training Lead, who run every check-in. Everyone chosen is told now, gets a reminder as each check-in comes round, and the report afterwards.
      </p>
    </div>
  );
}
