import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi";
import ImageUploadField from "../../../components/ImageUploadField";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import {
  useCompetitionQuery,
  useCreateCompetition,
  useUpdateCompetition,
} from "../hooks/useCompetitions";
import {
  competitionSchema,
  EMPTY_TRACK,
  COMPETITION_STATUSES,
  COMPETITION_FORMATS,
  COMPETITION_CADENCES,
} from "../schemas/competition.schema";

const ACCENT = "#25476a";

const S = {
  card:      { backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 },
  cardTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" },
  row:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  field:     { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 },
  input:     { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff" },
  select:    { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  textarea:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", resize: "vertical", minHeight: 70 },
  hint:      { fontSize: 12, color: "#6B7280" },
  error:     { fontSize: 12, color: "#DC2626" },
};

const toFormValues = (c) => ({
  name: c?.name || "",
  description: c?.description || "",
  edition: c?.edition || "",
  format: c?.format || null,
  level: c?.level || "",
  cadence: c?.cadence || null,
  startDate: c?.startDate || "",
  endDate: c?.endDate || "",
  coverImage: c?.coverImage || null,
  programId: c?.programId || null,
  status: c?.status || "draft",
  isPublic: !!c?.isPublic,
  tracks: (c?.tracks || []).map((t) => ({
    id: t.id,
    name: t.name || "",
    subtitle: t.subtitle || "",
    description: t.description || "",
    highlights: t.highlights || [],
    registerUrl: t.registerUrl || "",
    knowMoreUrl: t.knowMoreUrl || "",
  })),
});

// The API rejects unknown/empty enum strings — send null, not "".
const clean = (v) => {
  const out = { ...v };
  out.format = out.format || null;
  out.cadence = out.cadence || null;
  out.programId = out.programId || null;
  out.tracks = (out.tracks || []).map((t) => ({
    ...t,
    highlights: (t.highlights || []).map((h) => h.trim()).filter(Boolean),
  }));
  return out;
};

function TrackEditor({ index, control, register, errors, onRemove, isOnly }) {
  const [open, setOpen] = useState(true);
  const err = errors?.tracks?.[index] || {};
  return (
    <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", backgroundColor: "#F9FAFB", borderBottom: open ? "1.5px solid #E5E7EB" : "none" }}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "flex" }}>
          {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Track {index + 1}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onRemove}
          disabled={isOnly}
          title={isOnly ? "A competition needs at least one track once you add one" : "Remove track"}
          style={{ background: "none", border: "none", cursor: isOnly ? "not-allowed" : "pointer", color: isOnly ? "#D1D5DB" : "#EF4444", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "Inter, sans-serif" }}
        >
          <FiTrash2 size={14} /> Remove
        </button>
      </div>

      {open && (
        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Name <span style={{ color: "#EF4444" }}>*</span></label>
              <input {...register(`tracks.${index}.name`)} style={S.input} placeholder="Innovation & Entrepreneurship" />
              {err.name && <span style={S.error}>{err.name.message}</span>}
            </div>
            <div style={S.field}>
              <label style={S.label}>Subtitle</label>
              <input {...register(`tracks.${index}.subtitle`)} style={S.input} placeholder="Build a startup idea" />
              {err.subtitle && <span style={S.error}>{err.subtitle.message}</span>}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Description</label>
            <textarea {...register(`tracks.${index}.description`)} style={S.textarea} placeholder="What this track is about, who it's for…" />
            {err.description && <span style={S.error}>{err.description.message}</span>}
          </div>

          <div style={S.field}>
            <label style={S.label}>Highlights</label>
            <Controller
              control={control}
              name={`tracks.${index}.highlights`}
              render={({ field }) => <HighlightsInput value={field.value || []} onChange={field.onChange} />}
            />
            {err.highlights && <span style={S.error}>{err.highlights.message || "Check the highlights"}</span>}
          </div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Register URL</label>
              <input {...register(`tracks.${index}.registerUrl`)} style={S.input} placeholder="https://…" />
              {err.registerUrl && <span style={S.error}>{err.registerUrl.message}</span>}
            </div>
            <div style={S.field}>
              <label style={S.label}>Know-more URL</label>
              <input {...register(`tracks.${index}.knowMoreUrl`)} style={S.input} placeholder="https://…" />
              {err.knowMoreUrl && <span style={S.error}>{err.knowMoreUrl.message}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HighlightsInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
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
          placeholder="Add a bullet and press Enter"
        />
        <button type="button" onClick={add} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

const backToCompetition = (compId) => `/programs/competitions/${compId}/view`;
const backToList = "/programs";

export default function CreateCompetitionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  // Optional: /programs/competitions/create?programId=<curriculumId> pre-selects the program
  // (used by a Program view's "+ New Competition").
  const presetProgramId = searchParams.get("programId") || null;
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Program-curricula for the "Linked Program" dropdown — a competition can belong to one or
  // stand alone.
  const { data: curriculaData } = useCurriculaQuery();
  const programs = (curriculaData?.data || []).filter((c) => c.isProgram);

  const { data: existing, isLoading: loadingExisting } = useCompetitionQuery(id);
  const { mutate: createCompetition, isPending: creating } = useCreateCompetition();
  const { mutate: updateCompetition, isPending: updating } = useUpdateCompetition();

  const {
    register, handleSubmit, control,
    formState: { isDirty, errors },
  } = useForm({
    resolver: zodResolver(competitionSchema),
    defaultValues: { ...toFormValues(null), programId: presetProgramId },
    mode: "onTouched",
    values: isEdit && existing ? toFormValues(existing) : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tracks" });
  const isPending = creating || updating;

  const onSubmit = (raw) => {
    const data = clean(raw);
    if (isEdit) {
      updateCompetition({ id, data }, { onSuccess: () => navigate(backToCompetition(id)) });
    } else {
      createCompetition(data, { onSuccess: (record) => navigate(backToCompetition(record.id)) });
    }
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(isEdit ? backToCompetition(id) : backToList);
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
              ← Programs &amp; Competitions
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{isEdit ? "Edit competition" : "New competition"}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>{isEdit ? "Edit Competition" : "New Competition"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            The edition, its tracks, and where people register. Optionally link it to a Program. Publish it to feature it on the website.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="competition-form"
            disabled={isPending}
            style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 780 }}>
        <form id="competition-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Basics</h3>
            <div style={S.field}>
              <label style={S.label}>Name <span style={{ color: "#EF4444" }}>*</span></label>
              <input {...register("name")} style={S.input} placeholder="Codeavour 8.0" />
              {errors.name && <span style={S.error}>{errors.name.message}</span>}
            </div>

            <div style={S.field}>
              <label style={S.label}>Description</label>
              <textarea {...register("description")} style={S.textarea} placeholder="What the competition is, who it's for…" />
              {errors.description && <span style={S.error}>{errors.description.message}</span>}
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Edition</label>
                <input {...register("edition")} style={S.input} placeholder="2026 / 8.0" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Level</label>
                <input {...register("level")} style={S.input} placeholder="Ages 7–18" />
              </div>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Format</label>
                <select {...register("format")} style={S.select}>
                  <option value="">—</option>
                  {COMPETITION_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>Cadence</label>
                <select {...register("cadence")} style={S.select}>
                  <option value="">—</option>
                  {COMPETITION_CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

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
              <label style={S.label}>Linked Program</label>
              <select {...register("programId")} style={S.select}>
                <option value="">Standalone — not linked to a program</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span style={S.hint}>Optional. A competition can belong to a Program or stand on its own.</span>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Status</label>
                <select {...register("status")} style={S.select}>
                  {COMPETITION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ ...S.field, justifyContent: "flex-end" }}>
                <label style={{ ...S.label, cursor: "pointer" }}>
                  <input type="checkbox" {...register("isPublic")} style={{ width: 16, height: 16, cursor: "pointer" }} />
                  Show on the website
                </label>
                <span style={S.hint}>A draft never appears publicly, even if this is on.</span>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={S.cardTitle}>Tracks</h3>
              <button
                type="button"
                onClick={() => append({ ...EMPTY_TRACK })}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1.5px solid #a8d5ee", backgroundColor: "#F8FAFF", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                <FiPlus size={13} /> Add track
              </button>
            </div>

            {fields.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
                No tracks yet. Each track shows as its own card on the website — name, subtitle, description, highlights and a Register button.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fields.map((field, index) => (
                  <TrackEditor
                    key={field.id}
                    index={index}
                    control={control}
                    register={register}
                    errors={errors}
                    onRemove={() => remove(index)}
                    isOnly={false}
                  />
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(isEdit ? backToCompetition(id) : backToList)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
