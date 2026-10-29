import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiMapPin, FiSearch } from "react-icons/fi";
import { T, font, input } from "../shared";

const initials = (name) => String(name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

// Picks one educator, with a search box — workspaces have many. Searches name, email and hub; every
// word typed must match somewhere. The list opens in place under the field (not floating), so a
// dialog's scrolling never cuts it off. ↑ ↓ move, Enter picks, Esc closes.
//   educators  [{ id, name, email, photo, hubs: [{ id, name }] }] (GET /api/qa/educators)
export default function EducatorPicker({ id, educators, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const selected = educators.find((e) => e.id === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    requestAnimationFrame(() => searchRef.current?.focus());
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = words.length
    ? educators.filter((e) => {
        const text = [e.name, e.email, ...(e.hubs || []).map((h) => h.name)].filter(Boolean).join(" ").toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : educators;

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const pick = (educator) => { onChange(educator.id); setOpen(false); };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[active]) pick(matches[active]); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  return (
    <div ref={ref}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...input, display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: disabled ? "default" : "pointer", background: disabled ? "#F9FAFB" : "#fff", color: selected ? T.ink : T.inkFaint }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : educators.length ? `Choose the educator… (${educators.length})` : "Choose the educator…"}
        </span>
        {!disabled && <FiChevronDown size={15} style={{ flexShrink: 0, color: T.inkFaint, transform: open ? "rotate(180deg)" : "none" }} />}
      </button>

      {open && (
        <div style={{ marginTop: 6, border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(15,38,69,0.10)" }}>
          <div style={{ position: "relative", borderBottom: "1px solid #F0F2F5" }}>
            <FiSearch size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.inkFaint, pointerEvents: "none" }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by name, email or hub"
              aria-label="Search educators"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none", outline: "none", fontSize: 13, fontFamily: font, color: T.ink }}
            />
          </div>
          <div ref={listRef} role="listbox" style={{ maxHeight: 260, overflowY: "auto", padding: 6 }}>
            {matches.length === 0 && <p style={{ margin: 0, padding: "16px 12px", textAlign: "center", fontSize: 12.5, color: T.inkMuted }}>{educators.length ? `No educator matches “${query.trim()}”.` : "No educators to choose from."}</p>}
            {matches.map((e, idx) => (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={e.id === value}
                data-idx={idx}
                onClick={() => pick(e)}
                onMouseEnter={() => setActive(idx)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", border: "none", borderRadius: 9, background: idx === active ? "#F3F6FA" : e.id === value ? "#F0F7FF" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: font }}
              >
                {e.photo
                  ? <img src={e.photo} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{initials(e.name)}</span>}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: e.id === value ? 800 : 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.hubs?.length ? <><FiMapPin size={10} style={{ flexShrink: 0 }} />{e.hubs.map((h) => h.name).join(", ")}</> : e.email || "No hub yet"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
