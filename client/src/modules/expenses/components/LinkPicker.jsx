import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiBriefcase, FiLink2, FiSearch, FiX } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";
import { GENERAL_LINK, LINK_PATHS, expensesApi } from "../services/expensesApi";
import { btn, hint, input, label } from "./ui";

// "What was it for?" on each expense (server expense.links.js): the kind of record — a Home
// Learning family, a class, a bootcamp, a QA visit… — then which one, searched by name. Only the
// records this person may claim for are offered (an educator's own families, classes and visits;
// admins and staff anything). "General work" says it wasn't for one record.
// value = { linkType, linkId, linkLabel } (all null = not said yet).

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function linkTypeLabel(types, key) {
  if (key === GENERAL_LINK) return "General work";
  return types?.find((t) => t.key === key)?.label || null;
}

export default function LinkPicker({ types = [], value, onChange, required = false, idPrefix = "lk" }) {
  const linkType = value?.linkType || "";
  const chosen = linkType && (linkType === GENERAL_LINK || value?.linkId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const q = useDebounced(query);
  const searching = !!linkType && linkType !== GENERAL_LINK && !value?.linkId;
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["expenses", "link-options", linkType, q],
    queryFn: () => expensesApi.linkOptions(linkType, q),
    enabled: searching,
    staleTime: 60 * 1000,
  });
  useEffect(() => {
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  const groups = useMemo(() => {
    const out = new Map();
    for (const t of types) (out.get(t.group) || out.set(t.group, []).get(t.group)).push(t);
    return [...out.entries()];
  }, [types]);
  const typeName = linkTypeLabel(types, linkType);

  const setType = (next) => {
    setQuery("");
    setOpen(!!next && next !== GENERAL_LINK);
    onChange({ linkType: next || null, linkId: null, linkLabel: null });
  };

  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
      <span style={{ ...label, display: "flex", alignItems: "center", gap: 6 }}>
        <FiLink2 size={13} /> Linked to {required ? <span style={{ color: BRAND.danger }}>*</span> : <span style={{ fontWeight: 500, color: BRAND.muted }}>(so everyone can see what it was for)</span>}
      </span>
      {chosen ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${BRAND.skyBorder}`, background: BRAND.skyTint, minWidth: 0 }}>
          <FiBriefcase size={15} color={BRAND.navy} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.04em" }}>{typeName}</span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.ink, overflowWrap: "anywhere" }}>{linkType === GENERAL_LINK ? "Not for one particular record" : value.linkLabel || "Chosen"}</span>
          </span>
          <button type="button" style={{ ...btn, padding: "5px 10px" }} onClick={() => setType(linkType === GENERAL_LINK ? "" : linkType)}>Change</button>
          <button type="button" style={{ ...btn, padding: "5px 8px" }} aria-label="Remove the link" onClick={() => setType("")}><FiX size={13} /></button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
          <select id={`${idPrefix}-type`} aria-label="What kind of record it was for" style={input} value={linkType} onChange={(e) => setType(e.target.value)}>
            <option value="">Choose what it was for…</option>
            {groups.map(([group, list]) => (
              <optgroup key={group} label={group}>{list.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</optgroup>
            ))}
            <optgroup label="Other"><option value={GENERAL_LINK}>General work (not one record)</option></optgroup>
          </select>
          {searching && (
            <div ref={boxRef} style={{ position: "relative", minWidth: 0 }}>
              <FiSearch size={14} color={BRAND.muted} style={{ position: "absolute", left: 11, top: 12, pointerEvents: "none" }} />
              <input id={`${idPrefix}-search`} style={{ ...input, paddingLeft: 32 }} value={query} autoFocus
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                placeholder={`Search ${String(typeName || "").toLowerCase()}…`} aria-label={`Which ${String(typeName || "record").toLowerCase()}`} aria-expanded={open} role="combobox" aria-controls={`${idPrefix}-list`} />
              {open && (
                <ul id={`${idPrefix}-list`} role="listbox" style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, width: "100%", maxHeight: 260, overflowY: "auto", margin: 0, padding: 4, listStyle: "none", background: "#fff", border: `1px solid ${BRAND.border}`, borderRadius: 10, boxShadow: "0 12px 28px rgba(15,23,42,0.14)", fontFamily: FONT, boxSizing: "border-box" }}>
                  {isFetching && !results.length && <li style={{ ...hint, padding: 10 }}>Searching…</li>}
                  {!isFetching && !results.length && <li style={{ ...hint, padding: 10 }}>{q ? "Nothing matches." : `No ${String(typeName || "").toLowerCase()} you can claim for.`}</li>}
                  {results.map((r) => (
                    <li key={r.id} role="option" aria-selected={false}>
                      <button type="button" onClick={() => { onChange({ linkType, linkId: r.id, linkLabel: r.label }); setOpen(false); }}
                        style={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = BRAND.skyTint; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{r.label}</span>
                        {r.sub && <span style={{ display: "block", fontSize: 12, color: BRAND.muted }}>{r.sub}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A line's link, read only: "Home Learning family · Otieno family" — a link to the record for
// people who see the team's expenses.
export function LinkChip({ item, linkable = false }) {
  if (!item?.linkType) return null;
  const general = item.linkType === GENERAL_LINK;
  const text = general ? "General work" : `${item.linkTypeLabel || "Linked"} · ${item.linkLabel || "a record"}`;
  const style = { display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", padding: "3px 9px", borderRadius: 999, background: general ? BRAND.greyTint : BRAND.skyTint, color: general ? BRAND.greyText : BRAND.skyText, fontSize: 12, fontWeight: 700, textDecoration: "none", overflowWrap: "anywhere" };
  const path = !general && linkable && item.linkId && LINK_PATHS[item.linkType]?.(item.linkId);
  return path ? <Link to={path} style={style}><FiLink2 size={11} /> {text}</Link> : <span style={style}><FiLink2 size={11} /> {text}</span>;
}
