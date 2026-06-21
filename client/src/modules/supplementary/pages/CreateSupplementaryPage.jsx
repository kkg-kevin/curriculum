import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateSupplementary } from "../hooks/useSupplementary";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";

const detailsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().min(1, "Code is required").max(20).regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, hyphens"),
  description: z.string().max(500).default(""),
});

const STOP_WORDS = new Set(["a", "an", "the", "of", "for", "in", "on", "and", "or", "to"]);
function generateCode(name) {
  return name.trim().split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()))
    .map((w) => w.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4)).slice(0, 3).join("-");
}

const STEPS = ["School", "Type", "Term", "Details"];

function StepBar({ current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: done ? "#0D47A1" : active ? "#EFF6FF" : "#F3F4F6", border: `2px solid ${done || active ? "#0D47A1" : "#E5E7EB"}`, flexShrink: 0 }}>
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : <span style={{ fontSize: "13px", fontWeight: "700", color: active ? "#0D47A1" : "#9CA3AF" }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active || done ? "700" : "500", color: active ? "#0D47A1" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: "2px", backgroundColor: done ? "#0D47A1" : "#E5E7EB", margin: "0 8px", marginBottom: "18px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TypeCard({ type, selected, onSelect }) {
  const meta = SUPPLEMENTARY_TYPE_META[type];
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={() => onSelect(type)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ flex: 1, padding: "24px 20px", backgroundColor: selected ? meta.bg : hov ? "#F9FAFB" : "#ffffff", border: `2px solid ${selected ? meta.color : hov ? "#D1D5DB" : "#E5E7EB"}`, borderRadius: "16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2.5px solid ${selected ? meta.color : "#D1D5DB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {selected && <div style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: meta.color }} />}
        </div>
        <span style={{ fontSize: "14px", fontWeight: "700", color: selected ? meta.color : "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>{meta.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>{meta.description}</p>
    </button>
  );
}

function TermCard({ period, index, selected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(index)}
      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", backgroundColor: selected ? "#EFF6FF" : "#ffffff", border: `2px solid ${selected ? "#0D47A1" : "#E5E7EB"}`, borderRadius: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "all 0.15s", width: "100%" }}>
      <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2.5px solid ${selected ? "#0D47A1" : "#D1D5DB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {selected && <div style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#0D47A1" }} />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: selected ? "700" : "600", color: selected ? "#0D47A1" : "#111827" }}>{period.name}</p>
        {period.startDate && (
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
            {new Date(period.startDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
            {" – "}
            {new Date(period.endDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>
    </button>
  );
}

export default function CreateSupplementaryPage() {
  const navigate = useNavigate();
  const { mutate: createSup, isPending } = useCreateSupplementary();
  const { data: schoolsData, isLoading: schoolsLoading } = useSchoolsQuery();

  const [step, setStep] = useState(0);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedTermIndex, setSelectedTermIndex] = useState(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [codeManual, setCodeManual] = useState(false);

  const schools = schoolsData?.data || [];
  const schoolsWithCurriculum = schools.filter((s) => s.curriculumId);
  const filteredSchools = schoolsWithCurriculum.filter(
    (s) => !schoolSearch || s.name?.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const { data: baseCurriculum } = useCurriculumQuery(selectedSchool?.curriculumId);
  const periods = baseCurriculum?.periods || [];

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: "", code: "", description: "" },
    mode: "onTouched",
  });

  const watchedName = watch("name");

  const handleNameChange = (e) => {
    const val = e.target.value;
    setValue("name", val, { shouldDirty: true, shouldValidate: true });
    if (!codeManual) setValue("code", generateCode(val), { shouldDirty: true });
  };

  const onSubmit = (details) => {
    createSup(
      {
        schoolId: selectedSchool.id,
        schoolName: selectedSchool.name,
        baseCurriculumId: selectedSchool.curriculumId,
        type: selectedType,
        termIndex: selectedTermIndex,
        termName: periods[selectedTermIndex]?.name,
        ...details,
      },
      { onSuccess: (sup) => navigate(`/supplementary/${sup.id}/editor`) }
    );
  };

  const inputStyle = (err) => ({
    width: "100%", padding: "11px 14px", border: `1.5px solid ${err ? "#FCA5A5" : "#E5E7EB"}`,
    borderRadius: "10px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: "#111827",
    outline: "none", backgroundColor: "#FAFAFA", boxSizing: "border-box",
  });

  const selectedMeta = selectedType ? SUPPLEMENTARY_TYPE_META[selectedType] : null;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/supplementary")} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Supplementary
            </button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>New</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Create Supplementary Curriculum</h1>
        </div>
        <button type="button" onClick={() => navigate("/supplementary")} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Cancel
        </button>
      </div>

      <div style={{ maxWidth: "680px", paddingTop: "24px" }}>
        <StepBar current={step} />

        {/* STEP 0 — School */}
        {step === 0 && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>Which school is this for?</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>Only schools with a base curriculum assigned are shown — the base curriculum is the starting canvas.</p>
            </div>

            <input type="text" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)}
              placeholder="Search schools…"
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontFamily: "Inter, sans-serif", outline: "none", marginBottom: "12px", boxSizing: "border-box", backgroundColor: "#FAFAFA" }} />

            {schoolsLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: "14px" }}>Loading schools…</div>
            ) : schoolsWithCurriculum.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #E5E7EB" }}>
                <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#374151" }}>No schools with a curriculum yet</p>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#9CA3AF" }}>Assign a base curriculum to a school first, then come back here.</p>
                <button type="button" onClick={() => navigate("/schools")} style={{ padding: "9px 20px", backgroundColor: "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  Go to Schools →
                </button>
              </div>
            ) : filteredSchools.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#9CA3AF", fontSize: "13px", backgroundColor: "#ffffff", borderRadius: "14px", border: "1px solid #E5E7EB" }}>
                No schools match "{schoolSearch}"
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredSchools.map((school) => {
                  const isSelected = selectedSchool?.id === school.id;
                  return (
                    <button key={school.id} type="button"
                      onClick={() => { setSelectedSchool(school); setSelectedTermIndex(null); }}
                      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", backgroundColor: isSelected ? "#EFF6FF" : "#ffffff", border: `2px solid ${isSelected ? "#0D47A1" : "#E5E7EB"}`, borderRadius: "12px", cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif", transition: "all 0.15s", width: "100%" }}>
                      <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2.5px solid ${isSelected ? "#0D47A1" : "#D1D5DB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <div style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#0D47A1" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: isSelected ? "700" : "600", color: isSelected ? "#0D47A1" : "#111827" }}>{school.name}</p>
                        {school.address?.county && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{school.address.county} County</p>}
                      </div>
                      <span style={{ fontSize: "11px", color: "#16A34A", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "3px 8px", whiteSpace: "nowrap" }}>Base curriculum set</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <button type="button" onClick={() => setStep(1)} disabled={!selectedSchool}
                style={{ padding: "11px 28px", backgroundColor: !selectedSchool ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: !selectedSchool ? "not-allowed" : "pointer" }}>
                Next: Type →
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — Type */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "#EFF6FF", borderRadius: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>School:</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0D47A1" }}>{selectedSchool?.name}</span>
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>What type of supplementary curriculum is this?</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>This cannot be changed after creation.</p>
            </div>

            <div style={{ display: "flex", gap: "14px" }}>
              <TypeCard type="complementary" selected={selectedType === "complementary"} onSelect={setSelectedType} />
              <TypeCard type="substitutional" selected={selectedType === "substitutional"} onSelect={setSelectedType} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
              <button type="button" onClick={() => setStep(0)} style={{ padding: "11px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Back</button>
              <button type="button" onClick={() => setStep(2)} disabled={!selectedType}
                style={{ padding: "11px 28px", backgroundColor: !selectedType ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: !selectedType ? "not-allowed" : "pointer" }}>
                Next: Term →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Term */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "#EFF6FF", borderRadius: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>School:</span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#0D47A1" }}>{selectedSchool?.name}</span>
                </div>
                {selectedMeta && (
                  <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", backgroundColor: selectedMeta.bg, borderRadius: "8px", border: `1px solid ${selectedMeta.border}` }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: selectedMeta.color, textTransform: "uppercase" }}>{selectedMeta.label}</span>
                  </div>
                )}
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>Which term does this apply to?</h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
                {selectedType === "complementary"
                  ? "You will add courses that run alongside the base curriculum courses for this term."
                  : "You will replace the base curriculum courses for this term with new courses."}
              </p>
            </div>

            {periods.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "14px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: "600", color: "#92400E" }}>No terms defined</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#B45309" }}>The base curriculum for {selectedSchool?.name} has no terms set up yet. Add terms to the base curriculum first.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {periods.map((period, idx) => (
                  <TermCard key={idx} period={period} index={idx} selected={selectedTermIndex === idx} onSelect={setSelectedTermIndex} />
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
              <button type="button" onClick={() => setStep(1)} style={{ padding: "11px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Back</button>
              <button type="button" onClick={() => setStep(3)} disabled={selectedTermIndex === null}
                style={{ padding: "11px 28px", backgroundColor: selectedTermIndex === null ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: selectedTermIndex === null ? "not-allowed" : "pointer" }}>
                Next: Details →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Details */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", backgroundColor: "#EFF6FF", borderRadius: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>School:</span>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#0D47A1" }}>{selectedSchool?.name}</span>
                </div>
                {selectedMeta && (
                  <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", backgroundColor: selectedMeta.bg, borderRadius: "8px", border: `1px solid ${selectedMeta.border}` }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: selectedMeta.color, textTransform: "uppercase" }}>{selectedMeta.label}</span>
                  </div>
                )}
                {selectedTermIndex !== null && periods[selectedTermIndex] && (
                  <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", backgroundColor: "#F9FAFB", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#374151" }}>{periods[selectedTermIndex].name}</span>
                  </div>
                )}
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>Name this supplementary curriculum</h2>
            </div>

            <form id="details-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Name <span style={{ color: "#EF4444" }}>*</span></label>
                  <input type="text" value={watchedName} onChange={handleNameChange} placeholder="e.g. CBC Enrichment Programme"
                    style={inputStyle(!!errors.name)}
                    onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
                    onBlur={(e) => { e.target.style.borderColor = errors.name ? "#FCA5A5" : "#E5E7EB"; }} />
                  {errors.name && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.name.message}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Code <span style={{ color: "#EF4444" }}>*</span></label>
                  <input {...register("code", { onChange: () => setCodeManual(true) })} type="text" placeholder="e.g. CBC-ENR"
                    style={{ ...inputStyle(!!errors.code), textTransform: "uppercase" }}
                    onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
                    onBlur={(e) => { e.target.style.borderColor = errors.code ? "#FCA5A5" : "#E5E7EB"; }} />
                  {errors.code
                    ? <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.code.message}</p>
                    : <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#9CA3AF" }}>Auto-generated from name — edit if needed.</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Description</label>
                  <textarea {...register("description")} rows={3} placeholder="Briefly describe this supplementary curriculum."
                    style={{ ...inputStyle(false), resize: "vertical", lineHeight: "1.5" }}
                    onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; }} />
                </div>
              </div>
            </form>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
              <button type="button" onClick={() => setStep(2)} style={{ padding: "11px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Back</button>
              <button type="submit" form="details-form" disabled={isPending}
                style={{ padding: "11px 28px", backgroundColor: isPending ? "#93C5FD" : "#0D47A1", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                {isPending
                  ? <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Creating…</>
                  : "Create & Edit Courses →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
