import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useUpdateSupplementaryAssignments } from "../hooks/useSupplementary";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";
import Breadcrumbs from "../../../components/ui/Breadcrumbs";

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

  // Only show schools that share the same base curriculum — they are the valid assignment targets
  const allSchools = schoolsData?.data || [];
  const eligibleSchools = allSchools.filter((s) => s.curriculumId === sup?.baseCurriculumId);
  const typeMeta = sup ? SUPPLEMENTARY_TYPE_META[sup.type] : null;

  useEffect(() => {
    if (sup && !initialized.current) {
      initialized.current = true;
      setSelectedSchoolIds(new Set((sup.assignments || []).map((a) => a.schoolId).filter(Boolean)));
    }
  }, [sup]);

  const toggle = (schoolId) => {
    // The creating school is always assigned — cannot be removed
    if (schoolId === sup?.schoolId) return;
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      next.has(schoolId) ? next.delete(schoolId) : next.add(schoolId);
      return next;
    });
    setDirty(true);
  };

  const filtered = eligibleSchools.filter(
    (s) => !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );
  const selectableFiltered = filtered.filter((s) => s.id !== sup?.schoolId);
  const allSelectableSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((s) => selectedSchoolIds.has(s.id));

  const toggleAll = () => {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      selectableFiltered.forEach((s) =>
        allSelectableSelected ? next.delete(s.id) : next.add(s.id)
      );
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    const assignments = allSchools
      .filter((s) => selectedSchoolIds.has(s.id))
      .map((s) => ({ schoolId: s.id, schoolName: s.name }));
    saveAssignments(assignments, {
      onSuccess: () => { setDirty(false); navigate(`/supplementary/${id}/view`); },
    });
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <Breadcrumbs items={[
            { label: "← Supplementary", to: "/supplementary" },
            { label: sup?.name, to: `/supplementary/${id}/view` },
            { label: "Assign to Schools" },
          ]} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Assign to Schools</h1>
            {typeMeta && (
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, textTransform: "uppercase" }}>{typeMeta.label}</span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>
            Showing schools that use the same base curriculum as <strong>{sup?.name}</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)}
            style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving || !dirty}
            style={{ padding: "10px 24px", backgroundColor: isSaving || !dirty ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isSaving || !dirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isSaving
              ? <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</>
              : "Save Assignments"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* School picker */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* No eligible schools at all */}
          {eligibleSchools.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#374151" }}>No other schools share this base curriculum</p>
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                Only schools assigned to the same base curriculum can receive this supplementary curriculum.
              </p>
            </div>
          ) : (
            <>
              <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search schools…"
                  style={{ flex: 1, padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", backgroundColor: "#F9FAFB" }} />
                {selectableFiltered.length > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", fontSize: "13px", color: "#374151", fontWeight: "500", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={allSelectableSelected} onChange={toggleAll}
                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#0D47A1" }} />
                    Select all
                  </label>
                )}
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", color: "#9CA3AF", fontSize: "14px" }}>
                  No schools match "{search}"
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filtered.map((school) => {
                    const isCreatingSchool = school.id === sup?.schoolId;
                    const isSelected = selectedSchoolIds.has(school.id);
                    return (
                      <label key={school.id}
                        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", backgroundColor: isSelected ? "#F0F7FF" : "#ffffff", border: `2px solid ${isSelected ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: "14px", cursor: isCreatingSchool ? "default" : "pointer", transition: "border-color 0.15s, background-color 0.15s", opacity: isCreatingSchool ? 0.75 : 1 }}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(school.id)}
                          disabled={isCreatingSchool}
                          style={{ width: "17px", height: "17px", cursor: isCreatingSchool ? "default" : "pointer", accentColor: "#0D47A1", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: isSelected ? "700" : "600", color: isSelected ? "#0D47A1" : "#111827" }}>{school.name}</p>
                          {school.address?.county && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{school.address.county} County</p>}
                        </div>
                        {isCreatingSchool && (
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                            Origin school
                          </span>
                        )}
                        {isSelected && !isCreatingSchool && (
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
            </>
          )}
        </div>

        {/* Summary panel */}
        <div style={{ width: "220px", flexShrink: 0, position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "18px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigned</p>
            <p style={{ margin: "0 0 12px", fontSize: "28px", fontWeight: "800", color: "#0D47A1", lineHeight: 1 }}>{selectedSchoolIds.size}</p>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#6B7280" }}>
              {selectedSchoolIds.size === 0
                ? "No schools assigned."
                : `out of ${eligibleSchools.length} eligible school${eligibleSchools.length !== 1 ? "s" : ""}`}
            </p>
            {selectedSchoolIds.size > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto" }}>
                {allSchools.filter((s) => selectedSchoolIds.has(s.id)).map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#0D47A1", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    {s.id === sup?.schoolId && (
                      <span style={{ fontSize: "10px", color: "#16A34A", flexShrink: 0 }}>origin</span>
                    )}
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
                  ? `Assigned schools will receive extra courses in ${sup?.termName} alongside their base curriculum.`
                  : `Assigned schools will have their ${sup?.termName} base courses replaced with this curriculum's courses.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
