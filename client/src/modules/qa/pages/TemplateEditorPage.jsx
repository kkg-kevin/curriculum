import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowDown, FiArrowLeft, FiArrowUp, FiBookOpen, FiChevronDown, FiPlus, FiTrash2 } from "react-icons/fi";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { reportHtml } from "../../checkins/shared";
import { useQaMutation, useQaTemplate } from "../hooks/useQa";
import { qaApi } from "../services/qaApi";
import { KIND_LABEL, QaStyles, T, btn, card, font, hint, input, label, useQaBase } from "../shared";

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const DEFAULT_SCALE = [
  { score: 1, label: "Needs support" },
  { score: 2, label: "Developing" },
  { score: 3, label: "Good" },
  { score: 4, label: "Excellent" },
];
const blankItem = (kind = "yes_no") => ({ id: newId(), text: "", help: "", kind, descriptors: {} });
const blankSection = () => ({ id: newId(), title: "", criteria: [blankItem()] });

// A ready template to start from — a classroom observation.
function example() {
  const item = (text, kind, help = "") => ({ ...blankItem(kind), text, help: help ? `<p>${help}</p>` : "" });
  return {
    name: "Classroom observation",
    description: "<p>How a lesson is prepared, taught and managed. Sit in for the whole lesson where you can.</p>",
    scale: DEFAULT_SCALE,
    sections: [
      { id: newId(), title: "Preparation", criteria: [
        item("Lesson plan is ready and follows the curriculum", "yes_no"),
        item("Materials, devices and kits are ready before learners arrive", "yes_no"),
        item("The lesson's objective is shared with learners", "yes_no"),
      ] },
      { id: newId(), title: "Teaching", criteria: [
        item("Explains concepts clearly, at the learners' level", "rubric"),
        item("Checks understanding during the lesson", "rubric", "Questions, quick checks, walking round."),
        item("Every learner gets hands-on time", "rubric"),
      ] },
      { id: newId(), title: "Class management", criteria: [
        item("Starts and ends on time", "yes_no"),
        item("Learners are engaged and on task", "rubric"),
        item("Devices and kits are handled safely and packed away", "yes_no"),
      ] },
      { id: newId(), title: "Notes", criteria: [item("Anything else observed", "comment")] },
    ],
  };
}

const fresh = () => ({ name: "", description: "", scale: DEFAULT_SCALE, sections: [blankSection()] });
// An existing template as a form; `copy` gives everything new ids and a new name. The description
// and guidance are rich text; any written as plain text before 29 Oct 2026 become paragraphs.
function toForm(t, copy = false) {
  return {
    name: copy ? `Copy of ${t.name}` : t.name,
    description: reportHtml(t.description || ""),
    scale: t.scale?.length ? t.scale : DEFAULT_SCALE,
    sections: (t.sections || []).map((s) => ({
      id: copy ? newId() : s.id,
      title: s.title,
      criteria: (s.criteria || []).map((c) => ({ id: copy ? newId() : c.id, text: c.text, help: reportHtml(c.help || ""), kind: c.kind, descriptors: c.descriptors || {} })),
    })),
  };
}
const move = (list, i, delta) => {
  const to = i + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[i], next[to]] = [next[to], next[i]];
  return next;
};

function IconButton({ onClick, label: text, disabled, children, danger }) {
  return (
    <button type="button" className="ci-btn" onClick={onClick} disabled={disabled} aria-label={text} title={text}
      style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1.5px solid ${danger ? "#FECACA" : "#E5E7EB"}`, background: "#fff", color: danger ? "#B91C1C" : T.inkMuted, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}

// Makes or changes a QA template: its name, the rubric's levels, and sections of items — each
// answered yes / no, on the rubric (with what each level looks like for it, optionally), or with a
// comment. /templates/new (?from=<id> copies one), /templates/:id. Someone who can't change it sees
// it read only, and can copy it.
export default function TemplateEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const fromId = params.get("from");
  const base = useQaBase();
  const navigate = useNavigate();
  const isNew = !id;
  const { data: existing, isLoading } = useQaTemplate(id || fromId);
  const [form, setForm] = useState(isNew && !fromId ? fresh() : null);
  const [problems, setProblems] = useState([]);
  const [openDescriptors, setOpenDescriptors] = useState({});
  const [openGuidance, setOpenGuidance] = useState({});

  useEffect(() => {
    if (existing && !form) setForm(toForm(existing, isNew));
  }, [existing, form, isNew]);

  const save = useQaMutation((body) => (isNew ? qaApi.createTemplate(body) : qaApi.updateTemplate(id, body)), isNew ? "Template made" : "Template saved");
  const readOnly = !isNew && existing && !existing.canEdit;
  const usesRubric = form?.sections.some((s) => s.criteria.some((c) => c.kind === "rubric"));

  if ((id || fromId) && isLoading) return <p style={{ ...hint, fontFamily: font }}>Loading…</p>;
  if (!form) return <p style={{ ...hint, fontFamily: font }}>This template couldn't be found.</p>;

  const setSection = (si, patch) => setForm((f) => ({ ...f, sections: f.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));
  const setItem = (si, ci, patch) => setSection(si, { criteria: form.sections[si].criteria.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const setLevel = (li, patch) => setForm((f) => ({ ...f, scale: f.scale.map((l, i) => (i === li ? { ...l, ...patch } : l)) }));

  const submit = () => {
    setProblems([]);
    const body = { ...form, scale: form.scale.map((l, i) => ({ score: i + 1, label: l.label })) };
    save.mutate(body, {
      onSuccess: (saved) => navigate(`${base}/templates/${saved.id}`, { replace: true }),
      onError: (err) => setProblems((err.errors || []).map((e) => e.message)),
    });
  };

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0 }}>
      <QaStyles />
      <Link to={`${base}?tab=templates`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Templates</Link>

      <section style={{ ...card, padding: "18px 20px", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: T.ink }}>{isNew ? "New template" : readOnly ? form.name : "Edit template"}</h1>
          {isNew && !fromId && (
            <button type="button" className="ci-btn" onClick={() => { if (form.sections.every((s) => !s.title && s.criteria.every((c) => !c.text)) || window.confirm("Replace what you've written with the example?")) setForm(example()); }} style={btn("secondary", { size: "sm" })}>
              Start from an example
            </button>
          )}
          {readOnly && <button type="button" className="ci-btn" onClick={() => navigate(`${base}/templates/new?from=${id}`)} style={btn("secondary", { size: "sm" })}>Copy to change it</button>}
        </div>
        {readOnly && <p style={{ ...hint, marginTop: -6 }}>Made by someone else — only they (or an admin) can change it. Copy it to make your own version.</p>}
        <div>
          <label htmlFor="qa-t-name" style={label}>Name</label>
          <input id="qa-t-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={readOnly} placeholder="e.g. Classroom observation" style={input} maxLength={150} />
        </div>
        <div>
          <p style={label}>Description <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></p>
          {readOnly ? (
            <RichContent html={form.description} emptyText="No description." />
          ) : (
            <>
              <p style={{ ...hint, margin: "0 0 6px" }}>What this template is for and how to use it — reviewers see it at the top of every review.</p>
              <RichTextEditor value={form.description} onChange={(html) => setForm((f) => ({ ...f, description: html }))} minHeight={90} maxHeight={320} />
            </>
          )}
        </div>
        {!isNew && !readOnly && <p style={{ ...hint, margin: 0 }}>Changes apply to visits whose review hasn&apos;t been started. Reports already begun keep the version they were written on.</p>}
      </section>

      {usesRubric && (
        <section style={{ ...card, padding: "18px 20px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.ink }}>Rubric levels</h2>
          <p style={{ ...hint, margin: "0 0 12px" }}>Every rubric item is rated on these, lowest first. The top level is full marks.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {form.scale.map((level, li) => (
              <div key={li} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: T.tint, color: T.accent, fontWeight: 900, fontSize: 13, display: "grid", placeItems: "center", flexShrink: 0 }}>{li + 1}</span>
                <input value={level.label} onChange={(e) => setLevel(li, { label: e.target.value })} disabled={readOnly} aria-label={`Level ${li + 1}`} style={{ ...input, flex: 1 }} maxLength={60} />
                {!readOnly && <IconButton label="Remove level" danger disabled={form.scale.length <= 2} onClick={() => setForm((f) => ({ ...f, scale: f.scale.filter((_, i) => i !== li) }))}><FiTrash2 size={13} /></IconButton>}
              </div>
            ))}
          </div>
          {!readOnly && form.scale.length < 10 && (
            <button type="button" className="ci-btn" onClick={() => setForm((f) => ({ ...f, scale: [...f.scale, { score: f.scale.length + 1, label: "" }] }))} style={{ ...btn("secondary", { size: "sm" }), marginTop: 10 }}><FiPlus size={13} /> Add a level</button>
          )}
        </section>
      )}

      {form.sections.map((section, si) => (
        <section key={section.id} style={{ ...card, padding: "16px 20px", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: T.inkFaint, textTransform: "uppercase", flexShrink: 0 }}>Section {si + 1}</span>
            <input value={section.title} onChange={(e) => setSection(si, { title: e.target.value })} disabled={readOnly} placeholder="e.g. Preparation" aria-label={`Section ${si + 1} title`} style={{ ...input, fontWeight: 700, flex: 1 }} maxLength={150} />
            {!readOnly && (
              <>
                <IconButton label="Move section up" disabled={si === 0} onClick={() => setForm((f) => ({ ...f, sections: move(f.sections, si, -1) }))}><FiArrowUp size={13} /></IconButton>
                <IconButton label="Move section down" disabled={si === form.sections.length - 1} onClick={() => setForm((f) => ({ ...f, sections: move(f.sections, si, 1) }))}><FiArrowDown size={13} /></IconButton>
                <IconButton label="Remove section" danger disabled={form.sections.length <= 1} onClick={() => setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== si) }))}><FiTrash2 size={13} /></IconButton>
              </>
            )}
          </div>

          {section.criteria.map((item, ci) => (
            <div key={item.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #EEF1F4", background: "#FBFCFD", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <input value={item.text} onChange={(e) => setItem(si, ci, { text: e.target.value })} disabled={readOnly} placeholder="What to check — e.g. Starts the lesson on time" aria-label="Item" style={{ ...input, flex: "1 1 320px" }} maxLength={500} />
                <select value={item.kind} onChange={(e) => setItem(si, ci, { kind: e.target.value })} disabled={readOnly} aria-label="Answered with" style={{ ...input, width: "auto", flex: "0 0 auto" }}>
                  {Object.entries(KIND_LABEL).map(([k, text]) => <option key={k} value={k}>{text}</option>)}
                </select>
                {!readOnly && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <IconButton label="Move item up" disabled={ci === 0} onClick={() => setSection(si, { criteria: move(section.criteria, ci, -1) })}><FiArrowUp size={13} /></IconButton>
                    <IconButton label="Move item down" disabled={ci === section.criteria.length - 1} onClick={() => setSection(si, { criteria: move(section.criteria, ci, 1) })}><FiArrowDown size={13} /></IconButton>
                    <IconButton label="Remove item" danger disabled={section.criteria.length <= 1} onClick={() => setSection(si, { criteria: section.criteria.filter((_, i) => i !== ci) })}><FiTrash2 size={13} /></IconButton>
                  </div>
                )}
              </div>
              {/* Guidance for the reviewer — rich text, opened only when wanted. */}
              {readOnly ? (
                !isEmptyHtml(item.help) && <div style={{ fontSize: 12.5 }}><RichContent html={item.help} /></div>
              ) : openGuidance[item.id] || !isEmptyHtml(item.help) ? (
                <div>
                  <p style={{ ...hint, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 5 }}><FiBookOpen size={12} /> Guidance for the reviewer — what to look for, examples, what good looks like</p>
                  <RichTextEditor value={item.help} onChange={(html) => { setOpenGuidance((o) => (o[item.id] ? o : { ...o, [item.id]: true })); setItem(si, ci, { help: html }); }} minHeight={70} maxHeight={260} />
                </div>
              ) : (
                <button type="button" onClick={() => setOpenGuidance((o) => ({ ...o, [item.id]: true }))} style={{ justifySelf: "start", border: 0, background: "none", padding: 0, color: T.accentMid, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: font }}>
                  <FiPlus size={12} /> Add guidance for the reviewer
                </button>
              )}
              {item.kind === "rubric" && (
                <div>
                  <button type="button" onClick={() => setOpenDescriptors((o) => ({ ...o, [item.id]: !o[item.id] }))} aria-expanded={!!openDescriptors[item.id]} style={{ border: 0, background: "none", padding: 0, color: T.accentMid, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: font }}>
                    What each level looks like for this item{Object.keys(item.descriptors || {}).length ? ` (${Object.keys(item.descriptors).length})` : " (optional)"}
                    <FiChevronDown size={14} style={{ transform: openDescriptors[item.id] ? "rotate(180deg)" : "none" }} />
                  </button>
                  {openDescriptors[item.id] && (
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      {form.scale.map((level, li) => (
                        <div key={li} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ width: 120, fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }}>{li + 1}. {level.label || "—"}</span>
                          <input value={item.descriptors?.[li + 1] || ""} onChange={(e) => setItem(si, ci, { descriptors: { ...item.descriptors, [li + 1]: e.target.value } })} disabled={readOnly} aria-label={`What level ${li + 1} looks like`} style={{ ...input, fontSize: 12.5 }} maxLength={500} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!readOnly && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(KIND_LABEL).map(([k, text]) => (
                <button key={k} type="button" className="ci-btn" onClick={() => setSection(si, { criteria: [...section.criteria, blankItem(k)] })} style={btn("secondary", { size: "sm" })}><FiPlus size={13} /> {text}</button>
              ))}
            </div>
          )}
        </section>
      ))}

      {!readOnly && (
        <>
          <button type="button" className="ci-btn" onClick={() => setForm((f) => ({ ...f, sections: [...f.sections, blankSection()] }))} style={{ ...btn("secondary"), alignSelf: "flex-start" }}><FiPlus size={14} /> Add a section</button>
          {problems.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, color: "#B91C1C", fontSize: 13 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", position: "sticky", bottom: 0, padding: "12px 0", background: "linear-gradient(180deg, rgba(248,250,252,0) 0%, #F8FAFC 40%)" }}>
            <button type="button" className="ci-btn" onClick={() => navigate(`${base}?tab=templates`)} style={btn("secondary")}>Cancel</button>
            <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending} style={btn("primary", { disabled: save.isPending })}>{save.isPending ? "Saving…" : isNew ? "Make template" : "Save template"}</button>
          </div>
        </>
      )}
    </div>
  );
}
