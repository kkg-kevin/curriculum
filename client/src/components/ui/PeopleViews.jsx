import { useMemo, useState } from "react";
import { TableRows as TableIcon, ViewList as ListIcon, ViewModule as CardsIcon } from "@mui/icons-material";
import { readLocal, writeLocal } from "../../utils/safeStorage";

// Ways to look at a list of people (learners, educators): Cards (the original grid), List (one
// row each, the key facts in a line) and Table (columns, sortable). Each page remembers its own
// choice in this browser (`view.<key>`). The cards, rows and table rows of one kind of person share
// the same actions menu, so every view can do the same things.

export const VIEW_MODES = [
  { key: "cards", label: "Cards", Icon: CardsIcon },
  { key: "list", label: "List", Icon: ListIcon },
  { key: "table", label: "Table", Icon: TableIcon },
];

export function useViewMode(key, fallback = "cards") {
  const storageKey = `view.${key}`;
  const [mode, setMode] = useState(() => {
    const saved = readLocal(storageKey);
    return VIEW_MODES.some((m) => m.key === saved) ? saved : fallback;
  });
  const change = (next) => {
    setMode(next);
    writeLocal(storageKey, next);
  };
  return [mode, change];
}

export function ViewSwitcher({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="View as" style={{ display: "inline-flex", padding: 3, gap: 2, borderRadius: 10, backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB", flexShrink: 0 }}>
      {VIEW_MODES.map(({ key, label, Icon }) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} title={`View as ${label.toLowerCase()}`} onClick={() => onChange(key)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 700,
              backgroundColor: on ? "#ffffff" : "transparent", color: on ? "#25476a" : "#6B7280", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <Icon sx={{ fontSize: 16 }} /> <span className="people-view-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PersonAvatar({ person, size = 36 }) {
  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();
  const initials = `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`.toUpperCase();
  if (person.photo) return <img src={person.photo} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, color: "#fff", flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

// The frame for List view: one white panel, a row per person, divided by hairlines.
export function PeopleList({ children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {children}
    </div>
  );
}

// Table view. `columns`: [{ key, label, sortValue?(row) → string | number, align?, width? }] — a
// column with sortValue sorts on a click of its heading (again to reverse). `renderRow(row)` returns
// the <tr>. Scrolls sideways inside its own panel on narrow screens, never the page.
export function PeopleTable({ columns, rows, renderRow, initialSort = null }) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const value = (r) => {
      const v = col.sortValue(r);
      return v == null || v === "" ? null : v;
    };
    return [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // blanks last, whichever way
      if (y === null) return -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true });
      return sort.dir === "desc" ? -cmp : cmp;
    });
  }, [rows, columns, sort]);

  const toggle = (col) => {
    if (!col.sortValue) return;
    setSort((s) => (s?.key === col.key ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" }));
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th key={col.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  style={{ textAlign: col.align || "left", padding: "10px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: active ? "#25476a" : "#6B7280", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap", width: col.width }}>
                  {col.sortValue ? (
                    <button type="button" onClick={() => toggle(col)}
                      style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.label}
                      <span aria-hidden="true" style={{ fontSize: 10, opacity: active ? 1 : 0.35 }}>{active && sort.dir === "desc" ? "▼" : "▲"}</span>
                    </button>
                  ) : col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{sorted.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

export const cellStyle = { padding: "10px 14px", borderBottom: "1px solid #F3F4F6", color: "#374151", verticalAlign: "middle" };
export const mutedText = { color: "#9CA3AF" };
