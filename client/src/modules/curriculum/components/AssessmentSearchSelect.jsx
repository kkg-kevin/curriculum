import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment", observation: "Teacher Observation", survey: "Survey" };

// A single-assessment picker with a search box — the assessments library grows quickly, so a
// plain <select> stops being usable. `value`/`onChange` carry an assessment id ("" for none).
// `note(a)` returns an extra line for an option (e.g. why it can't be used), or nothing.
export default function AssessmentSearchSelect({ assessments, value, onChange, note, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const selected = assessments.find((a) => a.id === value);
  // Every word typed must appear in the name or the type, in any order.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = words.length
    ? assessments.filter((a) => {
        const text = `${a.name || ""} ${TYPE_LABELS[a.type] || a.type || ""}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : assessments;
  // "None" is only offered while not searching — it never matches a typed word.
  const options = words.length ? filtered : [null, ...filtered];

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(a) {
    onChange(a ? a.id : "");
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (options.length) pick(options[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="cp-select"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", textAlign: "left", color: selected ? "#111827" : "#6B7280" }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : value ? "Assessment no longer available" : "— None —"}
        </span>
        <FiChevronDown size={14} style={{ flexShrink: 0, color: "#9CA3AF" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          maxHeight: "340px", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <FiSearch size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Search ${assessments.length} assessment${assessments.length !== 1 ? "s" : ""}…`}
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div ref={listRef} role="listbox" style={{ overflowY: "auto", padding: "6px" }}>
            {options.length === 0 && (
              <p style={{ margin: 0, padding: "18px 12px", textAlign: "center", fontSize: "12px", color: "#9CA3AF" }}>
                No assessment matches “{query.trim()}”.
              </p>
            )}
            {options.map((a, idx) => {
              const isSelected = a ? a.id === value : !value;
              const extra = a && note ? note(a) : null;
              return (
                <button
                  key={a ? a.id : "__none"}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-idx={idx}
                  onClick={() => pick(a)}
                  onMouseEnter={() => setActive(idx)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1px", width: "100%",
                    padding: "7px 10px", border: "none", borderRadius: "8px",
                    background: idx === active ? "#F3F4F6" : isSelected ? "#F5F3FF" : "transparent",
                    fontFamily: "Inter, sans-serif", textAlign: "left", cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: isSelected ? 700 : 600, color: a ? "#374151" : "#6B7280", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a ? a.name : "— None —"}
                  </span>
                  {a && (
                    <span style={{ fontSize: "11px", color: extra ? "#B45309" : "#9CA3AF" }}>
                      {[TYPE_LABELS[a.type] || a.type, extra].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
