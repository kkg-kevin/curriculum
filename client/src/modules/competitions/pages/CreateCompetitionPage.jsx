import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi";
import ImageUploadField from "../../../components/ImageUploadField";
import CoursePricingField from "../../../components/CoursePricingField";
import { Editor as RichTextEditorControlled } from "../../courses/components/RichTextEditor";
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
  EMPTY_ENTRY,
  EMPTY_INFO,
  ENTRY_MODES,
  COMPETITION_MODES,
  COMPETITION_STATUSES,
  COMPETITION_CADENCES,
} from "../schemas/competition.schema";

const ACCENT = "#25476a";

const S = {
  card:      { backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 },
  cardTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" },
  subTitle:  { margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" },
  // Side by side while each field gets 220px, stacked on a phone.
  row:       { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  row3:      { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 },
  field:     { display: "flex", flexDirection: "column", gap: 6 },
  label:     { fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 },
  input:     { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", minWidth: 0 },
  select:    { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", cursor: "pointer" },
  textarea:  { padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", outline: "none", background: "#fff", resize: "vertical", minHeight: 64 },
  hint:      { fontSize: 12, color: "#6B7280" },
  error:     { fontSize: 12, color: "#DC2626" },
  divider:   { height: 1, backgroundColor: "#F3F4F6", margin: "2px 0" },
  check:     { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#111827", cursor: "pointer" },
  addBtn:    { alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1.5px dashed #a8d5ee", backgroundColor: "#F8FAFF", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" },
};

const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

const toTrack = (t) => ({
  id: t.id,
  name: t.name || "",
  subtitle: t.subtitle || "",
  description: t.description || "",
  highlights: t.highlights || [],
  ageMin: t.ageMin ?? null,
  ageMax: t.ageMax ?? null,
  entry: { ...EMPTY_ENTRY, ...(t.entry || {}) },
  coverImage: t.coverImage || null,
  overview: t.overview || "",
  whatToDo: t.whatToDo || "",
  rules: t.rules || "",
  judging: (t.judging || []).map((j) => ({ name: j.name || "", weight: j.weight ?? null, description: j.description || "" })),
  prizes: t.prizes || [],
  timeline: (t.timeline || []).map((m) => ({ label: m.label || "", date: m.date || "" })),
  resources: (t.resources || []).map((r) => ({ label: r.label || "", url: r.url || "" })),
  faqs: (t.faqs || []).map((f) => ({ question: f.question || "", answer: f.answer || "" })),
  registerUrl: t.registerUrl || "",
  knowMoreUrl: t.knowMoreUrl || "",
});

const toFormValues = (c) => ({
  name: c?.name || "",
  description: c?.description || "",
  edition: c?.edition || "",
  format: c?.format || null,
  level: c?.level || "",
  cadence: c?.cadence || null,
  startDate: c?.startDate || "",
  endDate: c?.endDate || "",
  registrationOpenDate: c?.registrationOpenDate || "",
  registrationCloseDate: c?.registrationCloseDate || "",
  coverImage: c?.coverImage || null,
  curriculumId: c?.curriculumId || null,
  status: c?.status || "draft",
  isPublic: !!c?.isPublic,
  info: {
    ...EMPTY_INFO,
    ...(c?.info || {}),
    ageMin: c?.info?.ageMin ?? null,
    ageMax: c?.info?.ageMax ?? null,
    entryModes: c?.info?.entryModes?.length ? c.info.entryModes : ["individual", "group"],
    milestones: (c?.info?.milestones || []).map((m) => ({ label: m.label || "", date: m.date || "" })),
    prizes: c?.info?.prizes || [],
    extras: (c?.info?.extras || []).map((x) => ({ label: x.label || "", value: x.value || "" })),
    // Fees set per track before 20 Nov 2026 become the competition's (the first track priced).
    individualPrice: c?.info?.individualPrice ?? (c?.tracks || []).map((t) => t.entry?.individualPrice).find((v) => v != null) ?? null,
    teamPrice: c?.info?.teamPrice ?? (c?.tracks || []).map((t) => t.entry?.teamPrice).find((v) => v != null) ?? null,
    currency: c?.info?.currency || "KES",
  },
  tracks: (c?.tracks || []).map(toTrack),
  coursePricing: c?.coursePricing || [],
});

// The API rejects unknown/empty enum strings — send null, not "".
const clean = (v) => {
  const out = { ...v };
  out.format = out.format || null;
  out.cadence = out.cadence || null;
  out.curriculumId = out.curriculumId || null;
  out.info = {
    ...out.info, mode: out.info?.mode || null, ageMin: numOrNull(out.info?.ageMin), ageMax: numOrNull(out.info?.ageMax),
    individualPrice: numOrNull(out.info?.individualPrice), teamPrice: numOrNull(out.info?.teamPrice),
  };
  out.tracks = (out.tracks || []).map((t) => ({
    ...t,
    highlights: (t.highlights || []).map((h) => h.trim()).filter(Boolean),
    prizes: (t.prizes || []).map((h) => h.trim()).filter(Boolean),
    ageMin: numOrNull(t.ageMin),
    ageMax: numOrNull(t.ageMax),
    // Fees are the competition's (Entry fees) — a track keeps none of its own.
    entry: { ...t.entry, individualPrice: null, teamPrice: null },
    judging: (t.judging || []).map((j) => ({ ...j, weight: numOrNull(j.weight) })),
  }));
  // Without a curriculum there's nothing coursePricing's courseIds could validly belong to.
  out.coursePricing = out.curriculumId ? out.coursePricing || [] : [];
  return out;
};

// ── Small editors ───────────────────────────────────────────────────────────

function ChipsInput({ value, onChange, placeholder = "Add one and press Enter" }) {
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
              <button type="button" aria-label={`Remove ${h}`} onClick={() => onChange(value.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#25476a", display: "flex", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
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
          placeholder={placeholder}
        />
        <button type="button" onClick={add} style={{ padding: "9px 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Add
        </button>
      </div>
    </div>
  );
}

// Rows of small fields (milestones, judging criteria, resources, FAQs, other details) — each row
// an object; `columns` say which fields and how wide.
function RowsEditor({ name, control, register, errors, columns, empty, addLabel, emptyText }) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const errAt = (i, key) => name.split(".").reduce((o, k) => o?.[k], errors)?.[i]?.[key]?.message;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {fields.length === 0 && emptyText && <span style={S.hint}>{emptyText}</span>}
      {fields.map((f, i) => (
        <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap", padding: 10, borderRadius: 10, backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6" }}>
          {columns.map((c) => (
            <div key={c.key} style={{ ...S.field, flex: c.flex || 1, minWidth: c.minWidth || 140, gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6B7280" }}>{c.label}</span>
              {c.type === "textarea"
                ? <textarea {...register(`${name}.${i}.${c.key}`)} style={S.textarea} placeholder={c.placeholder} rows={2} />
                : <input type={c.type || "text"} {...register(`${name}.${i}.${c.key}`)} style={S.input} placeholder={c.placeholder} min={c.min} max={c.max} />}
              {errAt(i, c.key) && <span style={S.error}>{errAt(i, c.key)}</span>}
            </div>
          ))}
          <button type="button" onClick={() => remove(i)} aria-label="Remove" title="Remove" style={{ marginTop: 22, padding: 8, background: "none", border: "none", color: "#EF4444", cursor: "pointer", display: "flex" }}>
            <FiTrash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append({ ...empty })} style={S.addBtn}>
        <FiPlus size={13} /> {addLabel}
      </button>
    </div>
  );
}

const MILESTONE_COLUMNS = [
  { key: "label", label: "What happens", placeholder: "Projects due", flex: 2, minWidth: 180 },
  { key: "date", label: "Date", type: "date", flex: 1, minWidth: 150 },
];

// ── A track: its card, how it's entered, its own page ──────────────────────

const TRACK_TABS = [
  { key: "card", label: "Card" },
  { key: "entry", label: "Entry" },
  { key: "page", label: "Track page" },
];

function TrackEditor({ index, control, register, setValue, errors, onRemove, allowedModes }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("card");
  const err = errors?.tracks?.[index] || {};
  const name = useWatch({ control, name: `tracks.${index}.name` });
  const entry = useWatch({ control, name: `tracks.${index}.entry` }) || {};
  const registerUrl = useWatch({ control, name: `tracks.${index}.registerUrl` });
  // An outside form while it has a link, or once chosen; choosing our form empties the link.
  const [wantsOutside, setWantsOutside] = useState(false);
  const outside = wantsOutside || Boolean(registerUrl);
  const useOurForm = () => {
    setWantsOutside(false);
    if (registerUrl) setValue(`tracks.${index}.registerUrl`, "", { shouldDirty: true, shouldValidate: true });
  };
  const groupAllowed = allowedModes.includes("group");
  const individualAllowed = allowedModes.includes("individual");
  const tabHasError = { card: err.name || err.subtitle || err.description || err.highlights, entry: err.entry || err.ageMin || err.ageMax || err.registerUrl, page: err.judging || err.timeline || err.resources || err.faqs || err.knowMoreUrl };

  return (
    <div style={{ border: "1.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", backgroundColor: "#F9FAFB", borderBottom: open ? "1.5px solid #E5E7EB" : "none" }}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Fold track" : "Open track"} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "flex" }}>
          {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Track {index + 1}{name ? ` · ${name}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: "Inter, sans-serif" }}>
          <FiTrash2 size={14} /> Remove
        </button>
      </div>

      {open && (
        <>
          <div role="tablist" style={{ display: "flex", gap: 4, padding: "8px 10px 0", borderBottom: "1px solid #F3F4F6", overflowX: "auto" }}>
            {TRACK_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "8px 14px", border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
                  fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif",
                  color: tab === t.key ? ACCENT : "#6B7280",
                  borderBottom: `2.5px solid ${tab === t.key ? ACCENT : "transparent"}`,
                }}
              >
                {t.label}{tabHasError[t.key] ? <span style={{ color: "#DC2626" }}> •</span> : null}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "card" && (
              <>
                <span style={S.hint}>What shows on the track&rsquo;s card on the competition page.</span>
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
                  <label style={S.label}>Short summary</label>
                  <Controller control={control} name={`tracks.${index}.description`} render={({ field }) => <RichTextEditorControlled value={field.value} onChange={field.onChange} size="md" />} />
                  {err.description && <span style={S.error}>{err.description.message}</span>}
                </div>
                <div style={S.field}>
                  <label style={S.label}>Highlights</label>
                  <Controller control={control} name={`tracks.${index}.highlights`} render={({ field }) => <ChipsInput value={field.value || []} onChange={field.onChange} placeholder="Add a bullet and press Enter" />} />
                  {err.highlights && <span style={S.error}>{err.highlights.message || "Check the highlights"}</span>}
                </div>
              </>
            )}

            {tab === "entry" && (
              <>
                <div style={S.field}>
                  <label style={S.label}>Who can enter this track</label>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <label style={{ ...S.check, opacity: individualAllowed ? 1 : 0.5 }}>
                      <input type="checkbox" disabled={!individualAllowed} {...register(`tracks.${index}.entry.individual`)} /> Individuals
                    </label>
                    <label style={{ ...S.check, opacity: groupAllowed ? 1 : 0.5 }}>
                      <input type="checkbox" disabled={!groupAllowed} {...register(`tracks.${index}.entry.group`)} /> Teams
                    </label>
                  </div>
                  {(!individualAllowed || !groupAllowed) && (
                    <span style={S.hint}>The competition takes {individualAllowed ? "individuals" : "teams"} only — change that under Competition information.</span>
                  )}
                  {err.entry?.individual && <span style={S.error}>{err.entry.individual.message}</span>}
                </div>

                {groupAllowed && entry.group !== false && (
                  <div style={S.row3}>
                    <div style={S.field}>
                      <label style={S.label}>Smallest team</label>
                      <input type="number" min={2} max={50} {...register(`tracks.${index}.entry.teamMin`)} style={S.input} />
                      {err.entry?.teamMin && <span style={S.error}>{err.entry.teamMin.message}</span>}
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>Largest team</label>
                      <input type="number" min={2} max={50} {...register(`tracks.${index}.entry.teamMax`)} style={S.input} />
                      {err.entry?.teamMax && <span style={S.error}>{err.entry.teamMax.message}</span>}
                    </div>
                  </div>
                )}
                <span style={S.hint}>The entry fees are the same for every track — set them once under Competition information → Entry fees.</span>

                <div style={S.row3}>
                  <div style={S.field}>
                    <label style={S.label}>Youngest age</label>
                    <input type="number" min={3} max={100} {...register(`tracks.${index}.ageMin`)} style={S.input} placeholder="As the competition" />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>Oldest age</label>
                    <input type="number" min={3} max={100} {...register(`tracks.${index}.ageMax`)} style={S.input} placeholder="As the competition" />
                    {err.ageMax && <span style={S.error}>{err.ageMax.message}</span>}
                  </div>
                </div>

                <div style={S.divider} />
                <div style={S.field}>
                  <label style={S.label}>Register Now opens</label>
                  <label style={S.check}>
                    <input type="radio" checked={!outside} onChange={useOurForm} /> Our registration form, with payment
                  </label>
                  <label style={S.check}>
                    <input type="radio" checked={outside} onChange={() => setWantsOutside(true)} /> An outside form (a partner runs this track)
                  </label>
                  {outside && <input {...register(`tracks.${index}.registerUrl`)} style={S.input} placeholder="https://…" />}
                  {outside && err.registerUrl && <span style={S.error}>{err.registerUrl.message}</span>}
                </div>
              </>
            )}

            {tab === "page" && (
              <>
                <span style={S.hint}>The track&rsquo;s own page on the website — opened by its Know More button. Leave any part empty to leave it out.</span>
                <div style={S.field}>
                  <label style={S.label}>Cover image</label>
                  <Controller control={control} name={`tracks.${index}.coverImage`} render={({ field }) => <ImageUploadField value={field.value || ""} onChange={field.onChange} width="260px" height="150px" />} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Overview</label>
                  <Controller control={control} name={`tracks.${index}.overview`} render={({ field }) => <RichTextEditorControlled value={field.value} onChange={field.onChange} size="md" />} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>What participants do</label>
                  <span style={S.hint}>What they build or make, and what they hand in.</span>
                  <Controller control={control} name={`tracks.${index}.whatToDo`} render={({ field }) => <RichTextEditorControlled value={field.value} onChange={field.onChange} size="md" />} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Rules</label>
                  <Controller control={control} name={`tracks.${index}.rules`} render={({ field }) => <RichTextEditorControlled value={field.value} onChange={field.onChange} size="md" />} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>How entries are judged</label>
                  <RowsEditor
                    name={`tracks.${index}.judging`} control={control} register={register} errors={errors}
                    columns={[
                      { key: "name", label: "Criterion", placeholder: "Creativity", flex: 2, minWidth: 160 },
                      { key: "weight", label: "Weight %", type: "number", min: 0, max: 100, flex: 1, minWidth: 90 },
                      { key: "description", label: "What judges look for", placeholder: "An original idea…", flex: 3, minWidth: 200 },
                    ]}
                    empty={{ name: "", weight: null, description: "" }} addLabel="Add a criterion"
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Prizes</label>
                  <Controller control={control} name={`tracks.${index}.prizes`} render={({ field }) => <ChipsInput value={field.value || []} onChange={field.onChange} placeholder="Winner: trophy and a robotics kit" />} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Timeline</label>
                  <RowsEditor name={`tracks.${index}.timeline`} control={control} register={register} errors={errors} columns={MILESTONE_COLUMNS} empty={{ label: "", date: "" }} addLabel="Add a date" />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Resources</label>
                  <RowsEditor
                    name={`tracks.${index}.resources`} control={control} register={register} errors={errors}
                    columns={[
                      { key: "label", label: "Name", placeholder: "Starter guide (PDF)", flex: 2, minWidth: 160 },
                      { key: "url", label: "Link", placeholder: "https://…", flex: 3, minWidth: 200 },
                    ]}
                    empty={{ label: "", url: "" }} addLabel="Add a resource"
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Questions families ask</label>
                  <RowsEditor
                    name={`tracks.${index}.faqs`} control={control} register={register} errors={errors}
                    columns={[
                      { key: "question", label: "Question", placeholder: "Can my child enter on their own?", flex: 2, minWidth: 200 },
                      { key: "answer", label: "Answer", type: "textarea", flex: 3, minWidth: 220 },
                    ]}
                    empty={{ question: "", answer: "" }} addLabel="Add a question"
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Outside page (optional)</label>
                  <input {...register(`tracks.${index}.knowMoreUrl`)} style={S.input} placeholder="https://… — linked from the track page" />
                  {err.knowMoreUrl && <span style={S.error}>{err.knowMoreUrl.message}</span>}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const backToCompetition = (compId) => `/events/competitions/${compId}/view`;
const backToList = "/events";

export default function CreateCompetitionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  // Optional: /events/competitions/create?curriculumId=<id> pre-selects the curriculum (used by
  // a curriculum view's "+ New Competition").
  const presetCurriculumId = searchParams.get("curriculumId") || null;
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Every curriculum, for the "Curriculum" dropdown — a competition can link to any curriculum
  // or stand alone.
  const { data: curriculaData } = useCurriculaQuery();
  const curricula = curriculaData?.data || [];

  const { data: existing, isLoading: loadingExisting } = useCompetitionQuery(id);
  const { mutate: createCompetition, isPending: creating } = useCreateCompetition();
  const { mutate: updateCompetition, isPending: updating } = useUpdateCompetition();

  const {
    register, handleSubmit, control, setValue,
    formState: { isDirty, errors },
  } = useForm({
    resolver: zodResolver(competitionSchema),
    defaultValues: { ...toFormValues(null), curriculumId: presetCurriculumId },
    mode: "onTouched",
    values: isEdit && existing ? toFormValues(existing) : undefined,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "tracks" });
  const isPending = creating || updating;
  const selectedCurriculumId = useWatch({ control, name: "curriculumId" });
  const entryModes = useWatch({ control, name: "info.entryModes" }) || [];
  const mode = useWatch({ control, name: "info.mode" });

  const toggleMode = (value, on) => {
    const next = on ? [...new Set([...entryModes, value])] : entryModes.filter((m) => m !== value);
    setValue("info.entryModes", next, { shouldDirty: true, shouldValidate: true });
  };

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <button type="button" onClick={handleCancel} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← Events
            </button>
            <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{isEdit ? "Edit competition" : "New competition"}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" }}>{isEdit ? "Edit Competition" : "New Competition"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            The competition, who can enter and how, and its tracks — each with its fees, its own page on the website and a Register Now button.
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

      <div style={{ width: "100%" }}>
        <form id="competition-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Basics</h3>
            <div style={S.field}>
              <label style={S.label}>Name <span style={{ color: "#EF4444" }}>*</span></label>
              <input {...register("name")} style={S.input} placeholder="Digifunzi Robotics Challenge" />
              {errors.name && <span style={S.error}>{errors.name.message}</span>}
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Edition</label>
                <input {...register("edition")} style={S.input} placeholder="2027 / 3rd edition" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Level</label>
                <input {...register("level")} style={S.input} placeholder="Primary & Secondary" />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <RichTextEditorControlled value={field.value} onChange={field.onChange} size="md" />
                )}
              />
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
              <span style={S.hint}>The curriculum whose cohorts and course structure this competition runs. Required to run it at a hub.</span>
            </div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Status</label>
                <select {...register("status")} style={S.select}>
                  {COMPETITION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <span style={S.hint}>Registration is taken only while it&rsquo;s Open (and inside the registration dates).</span>
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
            <h3 style={S.cardTitle}>Competition information</h3>
            <span style={S.hint}>Shown on the website straight after the description.</span>

            <p style={S.subTitle}>Who can enter</p>
            <div style={S.row3}>
              <div style={S.field}>
                <label style={S.label}>Youngest age</label>
                <input type="number" min={3} max={100} {...register("info.ageMin")} style={S.input} placeholder="7" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Oldest age</label>
                <input type="number" min={3} max={100} {...register("info.ageMax")} style={S.input} placeholder="18" />
                {errors.info?.ageMax && <span style={S.error}>{errors.info.ageMax.message}</span>}
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Eligibility note</label>
              <input {...register("info.eligibilityNote")} style={S.input} placeholder="Open to primary and secondary school learners across Kenya" />
            </div>

            <div style={S.divider} />
            <p style={S.subTitle}>How you can enter</p>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {ENTRY_MODES.map((m) => (
                <label key={m.value} style={S.check}>
                  <input type="checkbox" checked={entryModes.includes(m.value)} onChange={(e) => toggleMode(m.value, e.target.checked)} /> {m.label}
                </label>
              ))}
            </div>
            {errors.info?.entryModes && <span style={S.error}>{errors.info.entryModes.message}</span>}
            <span style={S.hint}>Each track sets who can enter it and its team size under Entry.</span>

            <div style={S.divider} />
            <p style={S.subTitle}>Entry fees</p>
            <div style={S.row3}>
              {entryModes.includes("individual") && (
                <div style={S.field}>
                  <label style={S.label}>Fee per individual (KES)</label>
                  <input type="number" min={0} {...register("info.individualPrice")} style={S.input} placeholder="Free" />
                  {errors.info?.individualPrice && <span style={S.error}>{errors.info.individualPrice.message}</span>}
                </div>
              )}
              {entryModes.includes("group") && (
                <div style={S.field}>
                  <label style={S.label}>Fee per team (KES)</label>
                  <input type="number" min={0} {...register("info.teamPrice")} style={S.input} placeholder="Free" />
                  {errors.info?.teamPrice && <span style={S.error}>{errors.info.teamPrice.message}</span>}
                </div>
              )}
            </div>
            <span style={S.hint}>The same for every track. A team pays one fee, whatever its size. Leave a fee empty for a free entry.</span>

            <div style={S.divider} />
            <p style={S.subTitle}>Where and when</p>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Where it happens</label>
                <select {...register("info.mode")} style={S.select}>
                  <option value="">—</option>
                  {COMPETITION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              {mode && mode !== "online" && (
                <div style={S.field}>
                  <label style={S.label}>Venue</label>
                  <input {...register("info.venue")} style={S.input} placeholder="Finals at Strathmore University, Nairobi" />
                </div>
              )}
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
                <label style={S.label}>Registration opens</label>
                <input type="date" {...register("registrationOpenDate")} style={S.input} />
                {errors.registrationOpenDate && <span style={S.error}>{errors.registrationOpenDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>Registration closes</label>
                <input type="date" {...register("registrationCloseDate")} style={S.input} />
                {errors.registrationCloseDate && <span style={S.error}>{errors.registrationCloseDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>Starts</label>
                <input type="date" {...register("startDate")} style={S.input} />
                {errors.startDate && <span style={S.error}>{errors.startDate.message}</span>}
              </div>
              <div style={S.field}>
                <label style={S.label}>Ends</label>
                <input type="date" {...register("endDate")} style={S.input} />
                {errors.endDate && <span style={S.error}>{errors.endDate.message}</span>}
              </div>
            </div>
            <span style={S.hint}>Start and end dates are required before this competition can be run at a hub.</span>
            <div style={S.field}>
              <label style={S.label}>Other key dates</label>
              <RowsEditor name="info.milestones" control={control} register={register} errors={errors} columns={MILESTONE_COLUMNS} empty={{ label: "", date: "" }} addLabel="Add a date" emptyText="e.g. Projects due, Regional round, Finals." />
            </div>

            <div style={S.divider} />
            <p style={S.subTitle}>Prizes</p>
            <Controller control={control} name="info.prizes" render={({ field }) => <ChipsInput value={field.value || []} onChange={field.onChange} placeholder="Trophies and certificates for the top 3 in each track" />} />

            <div style={S.divider} />
            <p style={S.subTitle}>Anything else</p>
            <RowsEditor
              name="info.extras" control={control} register={register} errors={errors}
              columns={[
                { key: "label", label: "Label", placeholder: "Kit needed", flex: 1, minWidth: 140 },
                { key: "value", label: "Details", placeholder: "A laptop and a micro:bit", flex: 3, minWidth: 200 },
              ]}
              empty={{ label: "", value: "" }} addLabel="Add a detail"
            />
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>Course pricing</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
              Optionally price individual courses from this competition&rsquo;s curriculum, grouped by pathway.
            </p>
            <Controller
              control={control}
              name="coursePricing"
              render={({ field }) => (
                <CoursePricingField
                  curriculumId={selectedCurriculumId}
                  value={field.value || []}
                  onChange={field.onChange}
                  color={ACCENT}
                />
              )}
            />
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h3 style={S.cardTitle}>Tracks</h3>
              <button
                type="button"
                onClick={() => append({ ...EMPTY_TRACK, entry: { ...EMPTY_ENTRY, individual: entryModes.includes("individual"), group: entryModes.includes("group") } })}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1.5px solid #a8d5ee", backgroundColor: "#F8FAFF", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                <FiPlus size={13} /> Add track
              </button>
            </div>

            {fields.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
                No tracks yet. Each track has a card on the competition page (Register Now · Know More), its own fees and team size, and its own page on the website.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {fields.map((field, index) => (
                  <TrackEditor
                    key={field.id}
                    index={index}
                    control={control}
                    register={register}
                    setValue={setValue}
                    errors={errors}
                    onRemove={() => remove(index)}
                    allowedModes={entryModes}
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
