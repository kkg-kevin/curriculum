import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import ImageUploadField from "../../../components/ImageUploadField";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import {
  useBootcampQuery,
  useCreateBootcamp,
  useUpdateBootcamp,
} from "../hooks/useBootcamps";
import { bootcampSchema, BOOTCAMP_FORMATS } from "../schemas/bootcamp.schema";

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
  eventId: b?.eventId || null,
  saleStatus: b?.saleStatus || "internal",
  format: b?.format || null,
  durationLabel: b?.durationLabel || "",
  ageMin: b?.ageMin ?? null,
  ageMax: b?.ageMax ?? null,
  priceAmount: b?.priceAmount ?? null,
  priceCurrency: b?.priceCurrency || "KES",
  priceNote: b?.priceNote || "",
  highlights: b?.highlights || [],
});

// The API rejects unknown/empty enum strings — send null, not "".
const clean = (v) => {
  const out = { ...v };
  out.format = out.format || null;
  out.eventId = out.eventId || null;
  out.highlights = (out.highlights || []).map((h) => h.trim()).filter(Boolean);
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

const backToBootcamp = (id) => `/events/bootcamps/${id}/view`;
const backToList = "/events";

export default function CreateBootcampPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  // Optional: /events/bootcamps/create?eventId=<curriculumId> pre-selects the event
  // (used by an Event view's "+ New Bootcamp").
  const presetEventId = searchParams.get("eventId") || null;
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Event-curricula for the "Linked Event" dropdown — a bootcamp can belong to one or stand
  // alone.
  const { data: curriculaData } = useCurriculaQuery();
  const events = (curriculaData?.data || []).filter((c) => c.isEvent);

  const { data: existing, isLoading: loadingExisting } = useBootcampQuery(id);
  const { mutate: createBootcamp, isPending: creating } = useCreateBootcamp();
  const { mutate: updateBootcamp, isPending: updating } = useUpdateBootcamp();

  const {
    register, handleSubmit, control,
    formState: { isDirty, errors },
  } = useForm({
    resolver: zodResolver(bootcampSchema),
    defaultValues: { ...toFormValues(null), eventId: presetEventId },
    mode: "onTouched",
    values: isEdit && existing ? toFormValues(existing) : undefined,
  });

  const isPending = creating || updating;

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
              ← Events &amp; Competitions
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{isEdit ? "Edit bootcamp" : "New bootcamp"}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>{isEdit ? "Edit Bootcamp" : "New Bootcamp"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            A sellable listing for the public website. Optionally link it to an Event to show its real run dates.
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
              <label style={S.label}>Linked Event</label>
              <select {...register("eventId")} style={S.select}>
                <option value="">Standalone — not linked to an event</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <span style={S.hint}>Optional. Linking to an Event shows its real hub run dates on the public page.</span>
            </div>

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
            <h3 style={S.cardTitle}>Format, timing &amp; pricing</h3>
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

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Price</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input {...register("priceCurrency")} style={{ ...S.input, width: 70, flexShrink: 0 }} aria-label="Currency" />
                  <input type="number" min="0" {...register("priceAmount")} style={{ ...S.input, flex: 1, minWidth: 0 }} placeholder="12000" aria-label="Amount" />
                </div>
                <span style={S.hint}>Leave blank to show &ldquo;Enquire for pricing&rdquo;</span>
              </div>
              <div style={S.field}>
                <label style={S.label}>Price note</label>
                <input {...register("priceNote")} style={S.input} placeholder="e.g. Includes all materials" />
              </div>
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
