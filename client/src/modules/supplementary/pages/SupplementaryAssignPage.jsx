import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useUpdateSupplementaryAssignments } from "../hooks/useSupplementary";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";

export default function SupplementaryAssignPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading: supLoading } = useSupplementaryQuery(id);
  const { data: schoolsData, isLoading: schoolsLoading } = useSchoolsQuery();
  const { mutate: saveAssignments, isPending: isSaving } = useUpdateSupplementaryAssignments(id);

  const [selectedSchoolIds, setSelectedSchoolIds] = useState(new Set());
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const initialized = useRef(false);

  const schools = schoolsData?.data || [];
  const typeMeta = sup ? SUPPLEMENTARY_TYPE_META[sup.type] : null;

  useEffect(() => {
    if (sup && !initialized.current) {
      initialized.current = true;
      setSelectedSchoolIds(new Set((sup.assignments || []).map((a) => a.schoolId).filter(Boolean)));
    }
  }, [sup]);

  const toggle = (schoolId) => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      next.has(schoolId) ? next.delete(schoolId) : next.add(schoolId);
      return next;
    });
    setDirty(true);
  };

  const filtered = schools.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()));
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedSchoolIds.has(s.id));

  const toggleAll = () => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((s) => allFilteredSelected ? next.delete(s.id) : next.add(s.id));
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    const assignments = schools.filter((s) => selectedSchoolIds.has(s.id)).map((s) => ({ schoolId: s.id, schoolName: s.name }));
    saveAssignments(assignments, { onSuccess: () => { setDirty(false); navigate(`/supplementary/${id}/view`); } });
  };

  if (supLoading || schoolsLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "60px", backgroundColor: "#EEF2F7", borderRadius: "12px", marginBottom: "20px" }} />
        <div style={{ height: "400px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/supplementary")} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Supplementary</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{sup?.name}</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Assign to Schools</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Assign to Schools</h1>
            {typeMeta && (
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, textTransform: "uppercase" }}>{typeMeta.label}</span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Select which schools receive <strong>{sup?.name}</strong> for <strong>{sup?.termName}</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={isSaving || !dirty}
            style={{ padding: "10px 24px", backgroundColor: isSaving || !dirty ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isSaving || !dirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isSaving ? <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</> : "Save Assignments"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* School picker */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search schools…"
              style={{ flex: 1, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#F9FAFB" }} />
            {filtered.length > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", fontSize: "13px", color: "#374151", fontWeight: "500", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#0D47A1" }} />
                Select all
              </label>
            )}
          </div>

          {schools.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#374151" }}>No schools found</p>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF" }}>Create schools first before assigning.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", color: "#9CA3AF", fontSize: "14px" }}>No schools match "{search}"</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map((school) => {
                const isSelected = selectedSchoolIds.has(school.id);
                return (
                  <label key={school.id}
                    style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", backgroundColor: isSelected ? "#F0F7FF" : "#ffffff", border: `2px solid ${isSelected ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: "14px", cursor: "pointer", transition: "border-color 0.15s, background-color 0.15s" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(school.id)} style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: "#0D47A1", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: isSelected ? "700" : "600", color: isSelected ? "#0D47A1" : "#111827" }}>{school.name}</p>
                      {school.address?.county && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{school.address.county} County</p>}
                    </div>
                    {isSelected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#0D47A1" />
                        <path d="M8 12l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary panel */}
        <div style={{ width: "220px", flexShrink: 0, position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "18px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected</p>
            <p style={{ margin: "0 0 12px", fontSize: "28px", fontWeight: "800", color: "#0D47A1", lineHeight: 1 }}>{selectedSchoolIds.size}</p>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#6B7280" }}>
              {selectedSchoolIds.size === 0 ? "No schools selected." : `out of ${schools.length} school${schools.length !== 1 ? "s" : ""}`}
            </p>
            {selectedSchoolIds.size > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
                {schools.filter((s) => selectedSchoolIds.has(s.id)).map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#0D47A1", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {typeMeta && (
            <div style={{ padding: "14px", backgroundColor: typeMeta.bg, border: `1px solid ${typeMeta.border}`, borderRadius: "12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: typeMeta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{typeMeta.label}</p>
              <p style={{ margin: 0, fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>
                {sup?.type === "complementary"
                  ? `Selected schools will receive extra courses in ${sup?.termName} alongside their base curriculum.`
                  : `Selected schools will have their ${sup?.termName} base courses replaced with this curriculum's courses.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
