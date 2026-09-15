import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ImageUploadField from "../../../components/ImageUploadField";
import CoursePricingField from "../../../components/CoursePricingField";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import { usePathways } from "../../curriculum/hooks/useCompetencies";
import { useAssessmentsQuery } from "../../assessments/hooks/useAssessment";
import {
  useBootcampQuery,
  useCreateBootcamp,
  useUpdateBootcamp,
} from "../hooks/useBootcamps";
import { bootcampSchema, BOOTCAMP_FORMATS, BOOTCAMP_DESCRIPTION_MAX_WORDS, wordCount } from "../schemas/bootcamp.schema";

const ACCENT = "#25476a";

const S = {
  card:      { backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 },
  cardTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" },
  row:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  row3:      { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  field:     { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 },
  input:     { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:    { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  textarea:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", resize: "vertical", minHeight: 64 },
  hint:      { fontSize: 12, color: "#6B7280" },
  error:     { fontSize: 12, color: "#DC2626" },
};

const toFormValues = (b) => ({
  name: b?.name || "",
  description: b?.description || "",
  tagline: b?.tagline || "",
  coverImage: b?.coverImage || null,
  curriculumId: b?.curriculumId || null,
  pathwayIds: b?.pathwayIds || [],
  startDate: b?.startDate || "",
  endDate: b?.endDate || "",
  registrationOpenDate: b?.registrationOpenDate || "",
  registrationCloseDate: b?.registrationCloseDate || "",
  saleStatus: b?.saleStatus || "internal",
  format: b?.format || null,
  durationLabel: b?.durationLabel || "",
  ageMin: b?.ageMin ?? null,
  ageMax: b?.ageMax ?? null,
  priceAmount: b?.priceAmount ?? null,
  priceCurrency: b?.priceCurrency || "KES",
  priceNotes: b?.priceNotes || [],
  highlights: b?.highlights || [],
  coursePricing: b?.coursePricing || [],
  diagnosticAssessmentId: b?.diagnosticAssessmentId || null,
  publicDiagnosticEnabled: !!b?.publicDiagnosticEnabled,
});

// The API rejects unknown/empty enum strings — send null, not "".
const clean = (v) => {
  const out = { ...v };
  out.format = out.format || null;
  out.curriculumId = out.curriculumId || null;
  out.highlights = (out.highlights || []).map((h) => h.trim()).filter(Boolean);
  out.priceNotes = (out.priceNotes || []).map((n) => n.trim()).filter(Boolean);
  // Without a curriculum there's nothing coursePricing's courseIds (or pathwayIds) could validly
  // belong to.
  out.coursePricing = out.curriculumId ? out.coursePricing || [] : [];
  out.pathwayIds = out.curriculumId ? out.pathwayIds || [] : [];
  out.diagnosticAssessmentId = out.diagnosticAssessmentId || null;
  // Can only ever be true alongside an assessment — the checkbox is disabled without one (see
  // the form below), but guard here too in case state gets out of sync.
  out.publicDiagnosticEnabled = out.diagnosticAssessmentId ? out.publicDiagnosticEnabled : false;
  return out;
};

function HighlightsInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || (value || []).length >= 20) return;
    onChange([...(value || []), v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {value.map((h, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: "#EEF6FC", border: "1px solid #a8d5ee", color: "#25476a" }}>
              {h}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#25476a", display: "flex", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          style={{ ...S.input, flex: 1 }}
          placeholder="Add a selling point and press Enter"
        />
        <button type="button" onClick={add} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// "Included in the package" list — same add/remove shape as HighlightsInput, but a stacked list
// rather than wrapping pills, since these read as short sentences ("Certificate on completion"),
// not single-word tags. Applies regardless of pricing mode (see the Pricing card below) since it
// isn't part of either mode's own fields — still called priceNotes in the data model/API
// (bootcamp.validation.js), just relabelled here and on the public site.
function NotesInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || (value || []).length >= 20) return;
    onChange([...(value || []), v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {value.map((n, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
              <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{n}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", padding: 0, fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          style={{ ...S.input, flex: 1 }}
          placeholder="e.g. Includes all materials"
        />
        <button type="button" onClick={add} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// Which of the linked curriculum's pathways this bootcamp actually runs — a curriculum can carry
// several pathways and not all of them are relevant to a given bootcamp (e.g. a robotics holiday
// camp built on a curriculum that also has an unrelated digital-literacy pathway). Checking none
// means "every pathway" (the pre-existing behaviour before this field existed) — made explicit
// here rather than defaulting to "none selected" reading as "nothing included".
function PathwaysField({ curriculumId, value, onChange }) {
  const { data: pathways, isLoading } = usePathways(curriculumId);

  if (!curriculumId) {
    return <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>Select a curriculum above to choose its pathways.</p>;
  }
  if (isLoading) {
    return <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>Loading pathways…</p>;
  }
  if (!pathways || pathways.length === 0) {
    return <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>This curriculum has no pathways yet.</p>;
  }

  const selected = value || [];
  const toggle = (pathwayId, checked) => {
    onChange(checked ? [...selected, pathwayId] : selected.filter((id) => id !== pathwayId));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pathways.map((p) => (
        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={selected.includes(p.id)}
            onChange={(e) => toggle(p.id, e.target.checked)}
            style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
          />
          {p.color && <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: p.color, flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</span>
        </label>
      ))}
    </div>
  );
}

const backToBootcamp = (id) => `/events/bootcamps/${id}/view`;
const backToList = "/events";

export default function CreateBootcampPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  // Optional: /events/bootcamps/create?curriculumId=<id> pre-selects the curriculum (used by a
  // curriculum view's "+ New Bootcamp").
  const presetCurriculumId = searchParams.get("curriculumId") || null;
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Every curriculum, for the "Curriculum" dropdown — a bootcamp can link to any curriculum or
  // stand alone.
  const { data: curriculaData } = useCurriculaQuery();
  const curricula = curriculaData?.data || [];

  // Teacher Observation assessments have no learner-facing "take" step (a teacher records them
  // directly), so they can't be offered as a public diagnostic — mirrors CompetenciesPage.jsx's
  // own filter exactly (the real enforcement is server-side, this is just the picker's hint).
  const { data: assessmentsData } = useAssessmentsQuery();
  const diagnosticAssessments = (assessmentsData?.data || []).filter((a) => a.type !== "observation");

  const { data: existing, isLoading: loadingExisting } = useBootcampQuery(id);
  const { mutate: createBootcamp, isPending: creating } = useCreateBootcamp();
  const { mutate: updateBootcamp, isPending: updating } = useUpdateBootcamp();

  const {
    register, handleSubmit, control, setValue,
    formState: { isDirty, errors },
  } = useForm({
    resolver: zodResolver(bootcampSchema),
    defaultValues: { ...toFormValues(null), curriculumId: presetCurriculumId },
    mode: "onTouched",
    values: isEdit && existing ? toFormValues(existing) : undefined,
  });

  const isPending = creating || updating;
  const selectedCurriculumId = useWatch({ control, name: "curriculumId" });
  const selectedPathwayIds = useWatch({ control, name: "pathwayIds" });
  const descriptionWordCount = wordCount(useWatch({ control, name: "description" }));
  const watchedDiagnosticAssessmentId = useWatch({ control, name: "diagnosticAssessmentId" });

  // Price the whole bootcamp OR individual courses, never both (see
  // bootcamp.service.js's assertPricingModeExclusive) — but which one is ACTIVE is a real choice
  // the admin needs to be able to switch, both when creating and when editing an already-priced
  // bootcamp. This can't be derived purely from "which field currently has a value" (that's what
  // the earlier version did, and it meant an already-priced field was the one that got disabled —
  // unreachable to clear it and switch modes). So it's its own piece of state: seeded from
  // whichever mode the loaded bootcamp is actually using, then fully admin-controlled from then
  // on. Switching modes clears the OTHER field's form value immediately, so the two can never
  // both be submitted populated regardless of what the toggle shows.
  const [pricingMode, setPricingMode] = useState("bootcamp");
  useEffect(() => {
    if (isEdit && existing) {
      setPricingMode((existing.coursePricing || []).length > 0 ? "course" : "bootcamp");
    }
  }, [isEdit, existing]);

  const switchPricingMode = (mode) => {
    if (mode === pricingMode) return;
    setPricingMode(mode);
    if (mode === "bootcamp") {
      setValue("coursePricing", [], { shouldDirty: true });
    } else {
      setValue("priceAmount", null, { shouldDirty: true });
    }
  };

  const onSubmit = (raw) => {
    const data = clean(raw);
    if (isEdit) {
      updateBootcamp({ id, data }, { onSuccess: () => navigate(backToBootcamp(id)) });
    } else {
      createBootcamp(data, { onSuccess: (record) => navigate(backToBootcamp(record.id)) });
    }
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(isEdit ? backToBootcamp(id) : backToList);
  };

  if (isEdit && loadingExisting) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: 24, color: "#6B7280" }}>Loading…</div>;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Events
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{isEdit ? "Edit bootcamp" : "New bootcamp"}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>{isEdit ? "Edit Bootcamp" : "New Bootcamp"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Link it to a curriculum, set its dates, then run it at one or more hubs.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="bootcamp-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 780 }}>
        <form id="bootcamp-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Basics</h3>
            <div style={S.field}>
              <label style={S.label}>Name <span style={{ color: "#EF4444" }}>*</span></label>
              <input {...register("name")} style={S.input} placeholder="Robot Builders Holiday Bootcamp" />
              {errors.name && <span style={S.error}>{errors.name.message}</span>}
            </div>

            <div style={S.field}>
              <label style={S.label}>Short tagline</label>
              <input {...register("tagline")} style={S.input} placeholder="e.g. A full robot build, coded and driven, in one week" />
            </div>

            <div style={S.field}>
              <label style={S.label}>Description</label>
              <textarea {...register("description")} style={S.textarea} placeholder="What learners build, who it's for…" />
              <span style={{ ...S.hint, alignSelf: "flex-end", color: descriptionWordCount > BOOTCAMP_DESCRIPTION_MAX_WORDS ? "#DC2626" : "#9CA3AF" }}>
                {descriptionWordCount} / {BOOTCAMP_DESCRIPTION_MAX_WORDS} words
              </span>
              {errors.description && <span style={S.error}>{errors.description.message}</span>}
            </div>

            <div style={S.field}>
              <label style={S.label}>Cover image</label>
              <Controller
                control={control}
                name="coverImage"
                render={({ field }) => (
                  <ImageUploadField value={field.value || ""} onChange={field.onChange} width="260px" height="150px" />
                )}
              />
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Placement &amp; visibility</h3>
            <div style={S.field}>
              <label style={S.label}>Curriculum</label>
              <select {...register("curriculumId")} style={S.select}>
                <option value="">Standalone — not linked to a curriculum</option>
                {curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span style={S.hint}>The curriculum whose cohorts and course structure this bootcamp runs. Required to run it at a hub.</span>
            </div>

            {selectedCurriculumId && (
              <div style={S.field}>
                <label style={S.label}>Pathways</label>
                <Controller
                  control={control}
                  name="pathwayIds"
                  render={({ field }) => (
                    <PathwaysField curriculumId={selectedCurriculumId} value={field.value} onChange={field.onChange} />
                  )}
                />
                <span style={S.hint}>Which of this curriculum&rsquo;s pathways this bootcamp actually runs. Leave all unchecked to include every pathway.</span>
              </div>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
              <Controller
                control={control}
                name="saleStatus"
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value === "for_sale"}
                    onChange={(e) => field.onChange(e.target.checked ? "for_sale" : "internal")}
                    style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0 }}
                  />
                )}
              />
              <span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>List on the website</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>
                  Off = internal use only. Appears at africa.digifunzi.com/bootcamps once on.
                </span>
              </span>
            </label>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Dates</h3>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Start date</label>
                <input type="date" {...register("startDate")} style={S.input} />
                {errors.startDate && <span style={S.error}>{errors.startDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>End date</label>
                <input type="date" {...register("endDate")} style={S.input} />
                {errors.endDate && <span style={S.error}>{errors.endDate.message}</span>}
              </div>
            </div>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Registration opens</label>
                <input type="date" {...register("registrationOpenDate")} style={S.input} />
                {errors.registrationOpenDate && <span style={S.error}>{errors.registrationOpenDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>Registration closes</label>
                <input type="date" {...register("registrationCloseDate")} style={S.input} />
                {errors.registrationCloseDate && <span style={S.error}>{errors.registrationCloseDate.message}</span>}
              </div>
            </div>
            <span style={S.hint}>Start and end dates are required before this bootcamp can be run at a hub.</span>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Format &amp; timing</h3>
            <div style={S.row3}>
              <div style={S.field}>
                <label style={S.label}>Format</label>
                <select {...register("format")} style={S.select}>
                  <option value="">—</option>
                  {BOOTCAMP_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>Duration</label>
                <input {...register("durationLabel")} style={S.input} placeholder="e.g. 1 week" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Age range <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="0" max="25" {...register("ageMin")} style={{ ...S.input, width: "100%", minWidth: 0, padding: "9px 8px" }} placeholder="Min" />
                  <span style={{ color: "#9CA3AF", fontSize: 12, flexShrink: 0 }}>–</span>
                  <input type="number" min="0" max="25" {...register("ageMax")} style={{ ...S.input, width: "100%", minWidth: 0, padding: "9px 8px" }} placeholder="Max" />
                </div>
                {errors.ageMax && <span style={S.error}>{errors.ageMax.message}</span>}
              </div>
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Pricing</h3>

            {/* Mode toggle — which one is ACTIVE is deliberately its own explicit choice (see
                pricingMode state above), not derived from which field happens to hold a value.
                That's what makes switching modes on an already-priced bootcamp actually possible:
                the inactive mode's field is fully cleared on switch, and the active one is always
                editable, never the one left disabled-and-unreachable. */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => switchPricingMode("bootcamp")}
                style={{
                  flex: 1, padding: "9px 14px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
                  border: `1.5px solid ${pricingMode === "bootcamp" ? ACCENT : "#E5E7EB"}`,
                  backgroundColor: pricingMode === "bootcamp" ? "#EEF6FC" : "#fff",
                  color: pricingMode === "bootcamp" ? ACCENT : "#6B7280",
                }}
              >
                Price the whole bootcamp
              </button>
              <button
                type="button"
                onClick={() => switchPricingMode("course")}
                style={{
                  flex: 1, padding: "9px 14px", borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
                  border: `1.5px solid ${pricingMode === "course" ? ACCENT : "#E5E7EB"}`,
                  backgroundColor: pricingMode === "course" ? "#EEF6FC" : "#fff",
                  color: pricingMode === "course" ? ACCENT : "#6B7280",
                }}
              >
                Price by course
              </button>
            </div>

            {pricingMode === "bootcamp" ? (
              <div style={S.field}>
                <label style={S.label}>Price</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input {...register("priceCurrency")} style={{ ...S.input, width: 70, flexShrink: 0 }} aria-label="Currency" />
                  <input type="number" min="0" {...register("priceAmount")} style={{ ...S.input, flex: 1, minWidth: 0 }} placeholder="12000" aria-label="Amount" />
                </div>
                <span style={S.hint}>Leave blank to show &ldquo;Enquire for pricing&rdquo;</span>
                {errors.priceAmount && <span style={S.error}>{errors.priceAmount.message}</span>}
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6B7280" }}>
                  Price individual courses from this bootcamp&rsquo;s curriculum, grouped by pathway.
                </p>
                {errors.coursePricing && <span style={S.error}>{errors.coursePricing.message}</span>}
                <Controller
                  control={control}
                  name="coursePricing"
                  render={({ field }) => (
                    <CoursePricingField
                      curriculumId={selectedCurriculumId}
                      pathwayIds={selectedPathwayIds}
                      value={field.value || []}
                      onChange={field.onChange}
                      color={ACCENT}
                    />
                  )}
                />
              </div>
            )}

            {/* Applies to whichever pricing mode is active above — e.g. "Certificate on
                completion" reads the same whether the bootcamp has one price or is priced by
                course, so it lives here once rather than being duplicated per mode. */}
            <div style={S.field}>
              <label style={S.label}>Included in the package <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></label>
              <Controller
                control={control}
                name="priceNotes"
                render={({ field }) => <NotesInput value={field.value || []} onChange={field.onChange} />}
              />
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>What you&rsquo;ll build / learn</h3>
            <Controller
              control={control}
              name="highlights"
              render={({ field }) => <HighlightsInput value={field.value || []} onChange={field.onChange} />}
            />
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Diagnostic test</h3>
            <div style={S.field}>
              <label style={S.label}>Diagnostic assessment <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></label>
              <p style={{ margin: "2px 0 8px", fontSize: 11, color: "#9CA3AF" }}>
                Let anonymous website visitors take a short auto-graded quiz before enrolling in this bootcamp, and see an instant report. Requires the bootcamp&rsquo;s age range above to be fully set.
              </p>
              <Controller
                control={control}
                name="diagnosticAssessmentId"
                render={({ field }) => (
                  <select
                    style={S.select}
                    value={field.value || ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      field.onChange(next);
                      if (!next) setValue("publicDiagnosticEnabled", false, { shouldDirty: true });
                    }}
                  >
                    <option value="">— None —</option>
                    {diagnosticAssessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              />
            </div>

            <label
              style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: watchedDiagnosticAssessmentId ? "pointer" : "not-allowed", opacity: watchedDiagnosticAssessmentId ? 1 : 0.5 }}
              title={watchedDiagnosticAssessmentId ? undefined : "Choose a diagnostic assessment first"}
            >
              <Controller
                control={control}
                name="publicDiagnosticEnabled"
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={!!field.value}
                    disabled={!watchedDiagnosticAssessmentId}
                    onChange={(e) => field.onChange(e.target.checked)}
                    style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0 }}
                  />
                )}
              />
              <span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Offer this diagnostic to anonymous visitors</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>
                  Shows a &ldquo;Take the diagnostic&rdquo; option on this bootcamp&rsquo;s public page.
                </span>
              </span>
            </label>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(isEdit ? backToBootcamp(id) : backToList)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
