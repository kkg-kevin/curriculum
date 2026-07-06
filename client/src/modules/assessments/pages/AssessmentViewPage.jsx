import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAssessmentQuery, useDeleteItem, useDeleteRubricCriterion, useDeleteIndicator, useAssessmentCompetencies, useAssessmentLearningAreas } from "../hooks/useAssessment";
import { QUESTION_BASED_TYPES, TASK_BASED_TYPES, OBSERVATION_BASED_TYPES } from "../schemas/assessment.schema";
import QuestionModal, { QUESTION_TYPE_LABELS } from "../components/QuestionModal";
import RubricCriterionModal from "../components/RubricCriterionModal";
import IndicatorModal from "../components/IndicatorModal";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import RichContent, { isEmptyHtml } from "../../courses/components/RichContent";

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment", observation: "Teacher Observation" };
const TYPE_ICONS = { quiz: "📝", exam: "🎓", project: "🛠️", assignment: "📄", observation: "👁️" };

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

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px", backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee", borderRadius: "8px", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
    >
      <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> {label}
    </button>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
      <button type="button" onClick={onEdit} style={{ background: "none", border: "none", color: "#38aae1", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
        Edit
      </button>
      <button type="button" onClick={onDelete} style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
        Delete
      </button>
    </div>
  );
}

function QuestionsSection({ assessmentId, items }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteItem } = useDeleteItem();

  const totalPoints = items.reduce((sum, i) => sum + (Number(i.points) || 0), 0);

  return (
    <Section
      title={`Questions${items.length ? ` · ${totalPoints} pts` : ""}`}
      action={<AddButton label="Add Question" onClick={() => { setEditTarget(null); setModalOpen(true); }} />}
    >
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No questions added yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {items.map((item, index) => (
            <div key={item.id} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827", flexShrink: 0 }}>{index + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <RichContent html={item.question} emptyText="No question text" />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#b07800", backgroundColor: "#fff8e6", border: "1px solid #fcd97a", borderRadius: "20px", padding: "2px 8px" }}>
                      {QUESTION_TYPE_LABELS[item.questionType] || item.questionType}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>{item.points} pts</span>
                  </div>
                </div>
                <RowActions
                  onEdit={() => { setEditTarget(item); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(item)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <QuestionModal assessmentId={assessmentId} editTarget={editTarget} onClose={() => setModalOpen(false)} />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Question"
        message="This question will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          deleteItem({ assessmentId, itemId: deleteTarget.id });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </Section>
  );
}

function RubricSection({ assessmentId, rubric }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteCriterion } = useDeleteRubricCriterion();

  const totalPoints = rubric.reduce((sum, c) => sum + (Number(c.points) || 0), 0);

  return (
    <Section
      title={`Rubric${rubric.length ? ` · ${totalPoints} pts` : ""}`}
      action={<AddButton label="Add Criterion" onClick={() => { setEditTarget(null); setModalOpen(true); }} />}
    >
      {rubric.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No rubric criteria added yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rubric.map((c) => (
            <div key={c.id} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                    {c.criterion} <span style={{ fontWeight: "500", color: "#6B7280" }}>· {c.points} pts</span>
                  </p>
                  {!isEmptyHtml(c.description) && <RichContent html={c.description} />}
                </div>
                <RowActions
                  onEdit={() => { setEditTarget(c); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(c)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RubricCriterionModal assessmentId={assessmentId} editTarget={editTarget} onClose={() => setModalOpen(false)} />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Criterion"
        message="This rubric criterion will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          deleteCriterion({ assessmentId, criterionId: deleteTarget.id });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </Section>
  );
}

function IndicatorsSection({ assessmentId, indicators }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteIndicator } = useDeleteIndicator();

  return (
    <Section
      title="Indicators"
      action={<AddButton label="Add Indicator" onClick={() => { setEditTarget(null); setModalOpen(true); }} />}
    >
      {indicators.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No indicators added yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {indicators.map((ind) => (
            <div key={ind.id} style={{ padding: "12px 14px", backgroundColor: "#FAFBFF", border: "1px solid #F3F4F6", borderRadius: "12px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "600", color: "#111827" }}>{ind.text}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(ind.ratingScale || []).map((r) => (
                      <span key={r} style={{ fontSize: "11px", fontWeight: "700", color: "#25476a", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "2px 8px" }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <RowActions
                  onEdit={() => { setEditTarget(ind); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(ind)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <IndicatorModal assessmentId={assessmentId} editTarget={editTarget} onClose={() => setModalOpen(false)} />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Indicator"
        message="This indicator will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          deleteIndicator({ assessmentId, indicatorId: deleteTarget.id });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </Section>
  );
}

export default function AssessmentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: assessment, isLoading, isError } = useAssessmentQuery(id);
  const { data: competencies = [] } = useAssessmentCompetencies(id);
  const { data: learningAreas = [] } = useAssessmentLearningAreas(id);

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

  const isQuestionBased = QUESTION_BASED_TYPES.includes(assessment.type);
  const isTaskBased = TASK_BASED_TYPES.includes(assessment.type);
  const isObservationBased = OBSERVATION_BASED_TYPES.includes(assessment.type);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button type="button" onClick={() => navigate("/assessments")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Assessments
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>{assessment.name}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", flexShrink: 0 }}>
                {TYPE_ICONS[assessment.type] || "📋"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {assessment.name}
                  </h1>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  {TYPE_LABELS[assessment.type] || assessment.type}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/assessments/${id}/edit`)}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Edit Assessment
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="Description">
            {assessment.description ? (
              <p style={{ margin: 0, fontSize: "14px", color: "#374151", lineHeight: "1.65" }}>{assessment.description}</p>
            ) : (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>No description added</p>
            )}
          </Section>

          {!isEmptyHtml(assessment.instructions) && (
            <Section title="Content">
              <RichContent html={assessment.instructions} />
            </Section>
          )}

          {isQuestionBased && <QuestionsSection assessmentId={id} items={assessment.items || []} />}
          {isTaskBased && <RubricSection assessmentId={id} rubric={assessment.rubric || []} />}
          {isObservationBased && <IndicatorsSection assessmentId={id} indicators={assessment.indicators || []} />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow label="Type" value={TYPE_LABELS[assessment.type] || assessment.type} />
            </div>
          </Section>

          <Section title="Competencies">
            {competencies.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
                No competencies tagged.{" "}
                <Link to={`/assessments/${id}/edit`} style={{ color: "#38aae1", fontWeight: "600", textDecoration: "none" }}>Add some →</Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {competencies.map((comp, idx) => {
                  const color = ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706"][idx % 6];
                  return (
                    <span
                      key={comp.id}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700",
                        backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      }}
                    >
                      {comp.name}
                    </span>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Learning Areas">
            {learningAreas.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>
                No learning areas tagged.{" "}
                <Link to={`/assessments/${id}/edit`} style={{ color: "#38aae1", fontWeight: "600", textDecoration: "none" }}>Add some →</Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {learningAreas.map((area, idx) => {
                  const color = area.color || ["#25476a", "#38aae1", "#059669", "#7C3AED", "#DC2626", "#D97706"][idx % 6];
                  return (
                    <span
                      key={area.id}
                      style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: "700",
                        backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      }}
                    >
                      {area.name}
                    </span>
                  );
                })}
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
    </div>
  );
}
