import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSupplementaryQuery, useDeleteSupplementary } from "../hooks/useSupplementary";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import Breadcrumbs from "../../../components/ui/Breadcrumbs";

function ActionButton({ label, onClick, variant = "default", icon }) {
  const [hov, setHov] = useState(false);
  const s = {
    default: { bg: hov ? "#F3F4F6" : "#ffffff", color: hov ? "#0D47A1" : "#374151", border: "1.5px solid #E5E7EB" },
    primary: { bg: hov ? "#1565C0" : "#0D47A1", color: "#ffffff", border: "none" },
    danger:  { bg: hov ? "#FFF5F5" : "#ffffff", color: hov ? "#EF4444" : "#9CA3AF", border: "1.5px solid #E5E7EB" },
  }[variant];
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px", backgroundColor: s.bg, color: s.color, border: s.border, borderRadius: "10px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }}>
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {label}
    </button>
  );
}

export default function SupplementaryViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading, isError, error } = useSupplementaryQuery(id);
  const { mutate: deleteSup, isPending: isDeleting } = useDeleteSupplementary();
  const { data: baseCurriculum } = useCurriculumQuery(sup?.baseCurriculumId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "80px", backgroundColor: "#EEF2F7", borderRadius: "16px", marginBottom: "16px" }} />
        <div style={{ height: "200px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
      </div>
    );
  }
  if (isError) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>Failed to load: {error?.message}</div>;
  }

  const typeMeta = SUPPLEMENTARY_TYPE_META[sup?.type] || {};
  const termGrades = baseCurriculum?.structure?.[sup?.termIndex]?.grades || [];
  const supGrades  = sup?.grades || [];
  const totalSupCourses = supGrades.reduce((s, g) => s + (g.courses?.length || 0), 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "24px" }}>
        <Breadcrumbs items={[
          { label: "← Supplementary", to: "/supplementary" },
          { label: sup?.name },
        ]} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Main card */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ height: "4px", background: sup?.type === "complementary" ? "linear-gradient(90deg, #16A34A, #4ADE80)" : "linear-gradient(90deg, #D97706, #FCD34D)" }} />
          <div style={{ padding: "24px 28px" }}>
            {/* Name + meta */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#111827" }}>{sup?.name}</h2>
                  <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, textTransform: "uppercase" }}>{typeMeta.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>{sup?.code}</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "#374151", backgroundColor: "#F3F4F6", borderRadius: "6px", padding: "3px 9px", fontWeight: "600" }}>{sup?.termName}</span>
                  <span style={{ fontSize: "12px", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: "6px", padding: "3px 9px" }}>{sup?.schoolName}</span>
                  {baseCurriculum && <span style={{ fontSize: "12px", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: "6px", padding: "3px 9px" }}>Base: {baseCurriculum.name}</span>}
                </div>
                {sup?.description && <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>{sup.description}</p>}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", padding: "16px 0", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6", marginBottom: "20px" }}>
              {[
                { label: "Grades", value: termGrades.length },
                { label: sup?.type === "complementary" ? "Added courses" : "Replacement courses", value: totalSupCourses },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#0D47A1", lineHeight: 1 }}>{value}</p>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <ActionButton variant="primary" label="Edit Courses"
                onClick={() => navigate(`/supplementary/${id}/editor`)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /></svg>} />
              <ActionButton label="Edit Details"
                onClick={() => navigate(`/supplementary/${id}/edit`)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
              <ActionButton label="Map to Base"
                onClick={() => navigate(`/supplementary/${id}/map`)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
              <ActionButton label="Assign Schools"
                onClick={() => navigate(`/supplementary/${id}/assign`)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} />
              <ActionButton variant="danger" label="Delete" onClick={() => setConfirmOpen(true)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            </div>
          </div>
        </div>

        {/* Course breakdown by grade */}
        {termGrades.length > 0 && (
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{sup?.termName} — Course Breakdown</h3>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {termGrades.map((grade) => {
                const supGrade = supGrades.find((g) => g.gradeId === grade.id);
                const baseCourses = grade.courses || [];
                const supCourses = supGrade?.courses || [];
                const isComplementary = sup?.type === "complementary";

                return (
                  <div key={grade.id} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px", backgroundColor: "#F9FAFB", display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: supCourses.length > 0 ? typeMeta.color : "#D1D5DB" }} />
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{grade.name}</span>
                    </div>
                    <div style={{ padding: "10px 14px" }}>
                      {/* Base courses */}
                      {baseCourses.length > 0 && (
                        <div style={{ marginBottom: supCourses.length > 0 ? "8px" : 0 }}>
                          <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {isComplementary ? "Base (kept)" : "Base (replaced)"}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {baseCourses.map((c) => (
                              <span key={c.id} style={{ padding: "3px 8px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "11px", color: "#6B7280", textDecoration: isComplementary ? "none" : "line-through" }}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Supplementary courses */}
                      {supCourses.length > 0 && (
                        <div>
                          <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: "600", color: typeMeta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {isComplementary ? "Added" : "Replaces with"}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {supCourses.map((c) => (
                              <span key={c.id} style={{ padding: "3px 8px", backgroundColor: typeMeta.bg, border: `1px solid ${typeMeta.border}`, borderRadius: "6px", fontSize: "11px", color: typeMeta.color, fontWeight: "600" }}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {baseCourses.length === 0 && supCourses.length === 0 && (
                        <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No courses</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Type explanation */}
        <div style={{ backgroundColor: typeMeta.bg, border: `1px solid ${typeMeta.border}`, borderRadius: "12px", padding: "14px 18px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.6" }}>
            {sup?.type === "complementary"
              ? `Complementary — runs alongside the base curriculum during ${sup?.termName}. Students take both the base courses and the added courses at the same time.`
              : `Substitutional — replaces the base curriculum courses during ${sup?.termName}. Students follow the replacement courses instead of the base courses for this term.`}
          </p>
        </div>
      </div>

      <ConfirmDialog isOpen={confirmOpen} title="Delete Supplementary Curriculum"
        message={`"${sup?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteSup(id, { onSuccess: () => navigate("/supplementary") }); }}
        onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}
