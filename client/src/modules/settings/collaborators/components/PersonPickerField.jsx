import { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch, FiUser } from "react-icons/fi";
import { useAllTeachersQuery } from "../../../teachers/hooks/useTeacher";
import { useAllLearningHubsQuery } from "../../../learning-hubs/hooks/useLearningHub";

// Merges Teachers and Learning Hub contacts into one searchable list of real people already in
// the system — an admin picking who to invite as a collaborator almost always means someone they
// already work with, not a stranger's email typed from memory. Search-only, no free text: picking
// an entry just pre-fills the invite form's name/email (see CollaboratorsPanel), which still
// creates a SEPARATE collaborator login — a teacher's existing account can't itself become a
// collaborator (role is one column per user, same limitation curriculumAdmin already has), so
// this is a shortcut to the right email, not a role upgrade.
function buildPeople(teachers, hubs) {
  const people = [];
  for (const t of teachers || []) {
    const name = `${t.firstName || ""} ${t.lastName || ""}`.trim();
    if (!name || !t.email) continue;
    people.push({ key: `teacher-${t.id}`, name, email: t.email, subtitle: "Teacher" });
  }
  for (const h of hubs || []) {
    const name = h.contactPerson?.trim() || h.name;
    if (!name || !h.email) continue;
    people.push({ key: `hub-${h.id}`, name, email: h.email, subtitle: `Hub contact at ${h.name}` });
  }
  return people;
}

export default function PersonPickerField({ onPick }) {
  const { data: teachersResponse } = useAllTeachersQuery();
  const { data: hubsResponse } = useAllLearningHubsQuery({ status: "active" });
  const people = useMemo(
    () => buildPeople(teachersResponse?.data, hubsResponse?.data),
    [teachersResponse, hubsResponse]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

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

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? people.filter((p) => p.name.toLowerCase().includes(trimmed) || p.email.toLowerCase().includes(trimmed))
    : people;

  const pick = (person) => {
    onPick({ name: person.name, email: person.email });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px",
          backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee",
          borderRadius: "9px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        <FiUser size={13} strokeWidth={2.2} /> Pick an existing teacher or hub contact
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1100,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          width: "320px", maxHeight: "320px", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <FiSearch size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", color: "#9CA3AF", marginBottom: "4px" }}><FiSearch size={20} /></div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {people.length === 0 ? "No teachers or hub contacts with an email yet." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((person) => (
              <button
                key={person.key}
                type="button"
                onClick={() => pick(person)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", padding: "8px 10px",
                  border: "none", borderRadius: "8px", background: "transparent", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                  {person.name}
                </span>
                <span style={{ fontSize: "11px", color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                  {person.subtitle} · {person.email}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
