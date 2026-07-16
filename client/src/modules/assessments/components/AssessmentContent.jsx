import { useNavigate } from "react-router-dom";
import { useAssessmentQuery, useAssessmentCompetencies, useAssessmentLearningAreas, useAssessmentInventory } from "../hooks/useAssessment";
import {
  BUILDER_REGISTRY, STRUCTURE_MODE_LABELS, ITEM_KIND_LABELS, OBSERVATION_ITEM_KINDS,
  TASK_TYPE_LABELS, normalizeLegacyItem, entryMarks,
} from "../schemas/assessment.schema";
import { INVENTORY_CATEGORY_COLORS, INVENTORY_CATEGORY_ICONS } from "../../settings/inventory/constants";
import RichContent, { isEmptyHtml } from "./RichContent";

export const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment", observation: "Teacher Observation" };
const TAG_PALETTE = ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2", "#BE185D"];

function Section({ title, action, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {title}
        </h2>
        {action}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 1px 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
    </div>
  );
}

function Badge({ children, color = "#25476a" }) {
  return (
    <span style={{ fontSize: "10.5px", fontWeight: "700", color, backgroundColor: `${color}12`, border: `1px solid ${color}35`, borderRadius: "20px", padding: "2px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function ItemDetail({ item }) {
  const isObservation = OBSERVATION_ITEM_KINDS.includes(item.kind);
  return (
    <>
      {(item.kind === "mcqSingle" || item.kind === "mcqMultiple") && item.options?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "8px" }}>
          {item.options.map((o, i) => (
            <div key={o} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: o === item.correctAnswer ? "#059669" : "#374151", fontWeight: o === item.correctAnswer ? 700 : 400 }}>
              <span style={{ color: "#9CA3AF", fontWeight: 700, width: "16px", flexShrink: 0 }}>{String.fromCharCode(65 + i)}.</span>
              <span>{o}</span>
              {o === item.correctAnswer && <span>✓</span>}
            </div>
          ))}
        </div>
      )}
      {item.kind === "trueFalse" && item.correctAnswer && (
        <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#059669", fontWeight: 700 }}>✓ {item.correctAnswer}</p>
      )}
      {item.kind === "matching" && item.pairs?.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {item.pairs.map((p, i) => <div key={i} style={{ fontSize: "12.5px", color: "#374151" }}>{p.left} ↔ {p.right}</div>)}
        </div>
      )}
      {item.kind === "fillBlank" && item.blanks?.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#374151" }}>Accepted answers: <strong>{item.blanks.join(", ")}</strong></p>
      )}
      {item.kind === "ordering" && item.sequence?.length > 0 && (
        <ol style={{ margin: "8px 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#374151" }}>
          {item.sequence.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      )}
      {item.kind === "shortAnswer" && item.correctAnswer && (
        <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "#6B7280", fontStyle: "italic" }}>Model answer: {item.correctAnswer}</p>
      )}
      {isObservation && item.kind === "checklist" && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>Checklist item</p>
      )}
      {isObservation && item.kind === "note" && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>Freeform observation note</p>
      )}
      {isObservation && ["rating", "practicalSkill", "behaviour"].includes(item.kind) && item.ratingScale?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
          {item.ratingScale.map((r) => <Badge key={r}>{r}</Badge>)}
        </div>
      )}
      {(item.taskType || item.submissionKinds?.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {item.taskType && <Badge color="#7C3AED">{TASK_TYPE_LABELS[item.taskType]}</Badge>}
          {item.submissionKinds?.map((k) => <Badge key={k} color="#059669">{ITEM_KIND_LABELS[k]}</Badge>)}
        </div>
      )}
    </>
  );
}

function StructureSection({ sections, entries }) {
  const sectionIds = new Set(sections.map((s) => s.id));
  const orphanEntries = entries.filter((e) => !e.sectionId || !sectionIds.has(e.sectionId));
  let counter = 0;

  const renderEntry = (entry) => {
    counter += 1;
    return (
      <div key={entry.id || counter} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827", flexShrink: 0 }}>{counter}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEmptyHtml(entry.question ?? entry.text) ? (
              <p style={{ margin: "0 0 6px", fontSize: "13.5px", color: "#D1D5DB", fontStyle: "italic" }}>Untitled item</p>
            ) : (
              <div style={{ marginBottom: "6px", fontSize: "13.5px" }}><RichContent html={entry.question ?? entry.text} /></div>
            )}
            <ItemDetail item={entry} />
          </div>
        </div>
      </div>
    );
  };

  if (sections.length === 0 && entries.length === 0) {
    return <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No items added yet</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {sections.map((section) => {
        const sectionEntries = entries.filter((e) => e.sectionId === section.id);
        if (sectionEntries.length === 0) return null;
        return (
          <div key={section.id}>
            <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "700", color: "#25476a", textTransform: "uppercase", letterSpacing: "0.04em" }}>{section.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sectionEntries.map(renderEntry)}
            </div>
          </div>
        );
      })}
      {orphanEntries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {orphanEntries.map(renderEntry)}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only assessment body (Description/Items/Rubric/… + Details/Competencies/Learning Areas sidebar),
 * shared between the standalone Assessments module view and any embedded context (e.g. a course session).
 */
export default function AssessmentContent({ id }) {
  const navigate = useNavigate();
  const { data: assessment, isLoading, isError } = useAssessmentQuery(id);
  const { data: competencies = [] } = useAssessmentCompetencies(id);
  const { data: learningAreas = [] } = useAssessmentLearningAreas(id);
  const { data: inventory = [] } = useAssessmentInventory(id);

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading assessment…
      </div>
    );
  }

  if (isError || !assessment) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Assessment not found.
      </div>
    );
  }

  const type = assessment.type;
  const isObservation = type === "observation";
  const entries = ((isObservation ? assessment.indicators : assessment.items) || []).map(
    isObservation ? (i) => i : normalizeLegacyItem
  );
  const sections = assessment.sections || [];
  const rubric = assessment.rubric || [];
  const deliverables = assessment.deliverables || [];
  const milestones = assessment.milestones || [];
  const registry = BUILDER_REGISTRY[type];

  const totalItemPoints = !isObservation ? entries.reduce((sum, e) => sum + entryMarks(e), 0) : 0;
  const totalRubricPoints = rubric.reduce((sum, c) => sum + entryMarks(c), 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Section title="Description">
          <RichContent html={assessment.description} emptyText="No description added" />
        </Section>

        {!isEmptyHtml(assessment.instructions) && (
          <Section title="Instructions">
            <RichContent html={assessment.instructions} />
          </Section>
        )}

        {registry?.supportsDeliverables && !isEmptyHtml(assessment.overview) && (
          <Section title="Project Overview">
            <RichContent html={assessment.overview} />
          </Section>
        )}

        {registry?.supportsItems !== false && (
          <Section title={`${isObservation ? "Observation Items" : "Items"}${entries.length ? ` · ${entries.length}${!isObservation ? ` · ${totalItemPoints} pts` : ""}` : ""}`}>
            <StructureSection sections={sections} entries={entries} />
          </Section>
        )}

        {registry?.supportsRubric && (
          <Section title={`Grading Rubric${rubric.length ? ` · ${totalRubricPoints} pts` : ""}`}>
            {rubric.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No rubric criteria added</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {rubric.map((c, i) => (
                  <div key={c.id || i} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                      {c.criterion} <span style={{ fontWeight: "500", color: "#6B7280" }}>· {entryMarks(c)} pts</span>
                    </p>
                    {c.description && <p style={{ margin: 0, fontSize: "12.5px", color: "#6B7280" }}>{c.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {registry?.supportsDeliverables && (
          <Section title={`Deliverables${deliverables.length ? ` · ${deliverables.length}` : ""}`}>
            {deliverables.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No deliverables added</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {deliverables.map((d, i) => (
                  <div key={d.id || i} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>📦 {d.name}</p>
                    {d.description && <p style={{ margin: "0 0 6px", fontSize: "12.5px", color: "#6B7280" }}>{d.description}</p>}
                    {d.submissionKinds?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        {d.submissionKinds.map((k) => <Badge key={k} color="#059669">{ITEM_KIND_LABELS[k]}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {registry?.supportsMilestones && milestones.length > 0 && (
          <Section title={`Milestones · ${milestones.length}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {milestones.map((m, i) => (
                <div key={m.id || i} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "600", color: "#111827" }}>🚩 {m.name}</p>
                  {m.description && <p style={{ margin: 0, fontSize: "12.5px", color: "#6B7280" }}>{m.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {registry?.supportsInventory && (
          <Section title={`Materials${inventory.length ? ` · ${inventory.length}` : ""}`}>
            {inventory.length === 0 ? (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No materials added</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {inventory.map((it) => {
                  const color = INVENTORY_CATEGORY_COLORS[it.category] || INVENTORY_CATEGORY_COLORS.Other;
                  const Icon = INVENTORY_CATEGORY_ICONS[it.category] || INVENTORY_CATEGORY_ICONS.Other;
                  return (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
                      {it.image ? (
                        <img src={it.image} alt={it.name} style={{ width: "34px", height: "34px", borderRadius: "10px", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={16} />
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.name}
                        </p>
                        <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>{it.category}</span>
                      </div>
                      <span style={{ fontSize: "12px", color, fontWeight: "700", flexShrink: 0, padding: "4px 10px", borderRadius: "999px", backgroundColor: `${color}12` }}>
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Section title="Details">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <DetailRow label="Type" value={TYPE_LABELS[type] || type} />
            <DetailRow label="Structure Type" value={STRUCTURE_MODE_LABELS[assessment.structureType] || "Mixed"} />
          </div>
        </Section>

        <Section title="Competencies">
          {competencies.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
              No competencies tagged.{" "}
              <button type="button" onClick={() => navigate(`/assessments/${id}/edit`)} style={{ background: "none", border: "none", padding: 0, color: "#38aae1", fontWeight: "600", cursor: "pointer", fontSize: "12.5px", fontFamily: "Inter, sans-serif" }}>Add some →</button>
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {competencies.map((comp, idx) => (
                <Badge key={comp.id} color={TAG_PALETTE[idx % TAG_PALETTE.length]}>{comp.name}</Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Learning Areas">
          {learningAreas.length === 0 ? (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
              No learning areas tagged.{" "}
              <button type="button" onClick={() => navigate(`/assessments/${id}/edit`)} style={{ background: "none", border: "none", padding: 0, color: "#38aae1", fontWeight: "600", cursor: "pointer", fontSize: "12.5px", fontFamily: "Inter, sans-serif" }}>Add some →</button>
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {learningAreas.map((area, idx) => (
                <Badge key={area.id} color={area.color || TAG_PALETTE[idx % TAG_PALETTE.length]}>{area.name}</Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Record Info">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <DetailRow
              label="Created"
              value={new Date(assessment.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            />
            <DetailRow
              label="Last Updated"
              value={new Date(assessment.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
