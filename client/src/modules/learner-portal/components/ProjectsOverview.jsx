import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FiCheckCircle, FiChevronDown, FiChevronUp, FiClipboard, FiClock, FiExternalLink, FiFlag, FiLayers, FiMessageCircle, FiPackage, FiTool } from "react-icons/fi";
import { usePortalNavigate } from "../utils/usePortalNavigate";
import { useIssuedForLearner } from "../../assessments/hooks/useAssessmentSubmission";
import { useAssessmentCompetencies } from "../../assessments/hooks/useAssessment";
import { useLearnerCompetencyScores } from "../../curriculum/hooks/useCompetencies";
import { normalizeLegacyItem } from "../../assessments/schemas/assessment.schema";
import RichContent, { isEmptyHtml } from "../../assessments/components/RichContent";
import { levelFor } from "../../reports/utils/reportView";
import AssessmentResultView, { Answer } from "./AssessmentResultView";
import { T, KID, cardStyle, EmptyState, KidHeading } from "./profile/theme";

// The learner profile's Projects tab (16 Nov 2026): every project (assessment type "project") the
// learner has been given, as a portfolio — what the project was (its description and instructions,
// what to hand in, its milestones), where it stands, what they handed in, and everything the
// educator gave back: each milestone's marks and note, and once marked the whole result as the
// learner's own assessment page shows it (AssessmentResultView — level, doing well, to practise,
// skills, rubric, the teacher's feedback). Projects follow the same workflow as every other
// assessment; this is only another way to see them.
//
// The same list as the Assessments tab (useIssuedForLearner), so it shows what the learner may see:
// marks and feedback only once released. `classId` scopes to one hub's class (rows with no class of
// their own — reissues — always show); `staffLearnerId` is staff viewing (no learner-portal link).

const STATUS = {
  not_started: { label: "Not started", color: T.inkMuted, bg: "#F3F4F6", border: "#E5E7EB" },
  in_progress: { label: "Being worked on", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  submitted: { label: "Handed in — waiting to be marked", color: T.accent, bg: T.tintBg, border: T.tintBorder },
  graded: { label: "Marked", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
};

const pct = (earned, possible) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);
const lastActivity = (r) => new Date(r.submission?.gradedAt || r.submission?.submittedAt || r.submission?.updatedAt || r.issue.createdAt || 0).getTime();

export default function ProjectsOverview({ classId, staffLearnerId, learner }) {
  const { viewOnly } = useOutletContext() || {};
  const audience = staffLearnerId || viewOnly ? "parent" : "learner";
  const { data, isLoading } = useIssuedForLearner(staffLearnerId);
  const projects = useMemo(() => {
    const rows = (data?.data || []).filter((r) => r.assessment?.type === "project");
    const scoped = classId ? rows.filter((r) => r.issue.classId === classId || !r.issue.classId) : rows;
    return [...scoped].sort((a, b) => lastActivity(b) - lastActivity(a));
  }, [data, classId]);
  const [openId, setOpenId] = useState(null);

  if (isLoading) return <div style={{ padding: "60px 20px", textAlign: "center", color: T.inkFaint, fontSize: 14 }}>Loading…</div>;

  const marked = projects.filter((r) => r.submission.status === "graded");
  const working = projects.filter((r) => ["in_progress", "submitted"].includes(r.submission.status)).length;
  const average = marked.length ? Math.round(marked.reduce((s, r) => s + pct(Number(r.submission.totalScore) || 0, Number(r.submission.maxScore) || 0), 0) / marked.length) : null;
  const you = audience === "learner";
  const name = learner?.firstName || "They";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...cardStyle(), padding: "20px 22px" }}>
        <KidHeading icon={FiTool} tone={KID.sky} sub={you ? "Everything you've built — what each project asked, what you handed in and what your teacher said." : `Everything ${name} has built — what each project asked, what was handed in and the educator's feedback.`}>
          {you ? "My projects" : "Projects"}
        </KidHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Tile icon={FiPackage} value={projects.length} label={projects.length === 1 ? "Project" : "Projects"} />
          <Tile icon={FiClock} value={working} label="Being worked on" />
          <Tile icon={FiCheckCircle} value={marked.length} label="Marked" sub={average != null ? `${levelFor(average).label} on average` : null} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{ ...cardStyle(), padding: "12px 24px" }}>
          <EmptyState icon={FiTool}>{you ? "No projects yet — when your teacher gives you one, it shows up here." : `No projects yet — once ${name} is given one, it shows up here.`}</EmptyState>
        </div>
      ) : projects.map((row) => (
        <ProjectCard key={row.issue.id} row={row} learner={learner} audience={audience} staff={!!staffLearnerId}
          open={openId === row.issue.id} onToggle={() => setOpenId((id) => (id === row.issue.id ? null : row.issue.id))} />
      ))}
    </div>
  );
}

function Tile({ icon: Icon, value, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, backgroundColor: "#FAFCFE", border: `1.5px solid ${T.border}` }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", backgroundColor: KID.sky.soft, color: KID.sky.color, flexShrink: 0 }}><Icon size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.accentDeep, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.inkMuted }}>{label}</p>
        {sub && <p style={{ margin: "1px 0 0", fontSize: 11.5, color: T.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}

function ProjectCard({ row, learner, audience, staff, open, onToggle }) {
  const navigate = usePortalNavigate();
  const { issue, assessment, submission } = row;
  const status = STATUS[submission.status] || STATUS.not_started;
  const graded = submission.status === "graded";
  const percent = graded ? pct(Number(submission.totalScore) || 0, Number(submission.maxScore) || 0) : null;
  const level = percent != null ? levelFor(percent) : null;
  const dates = [
    issue.createdAt ? `Given ${fmtDate(issue.createdAt)}` : null,
    issue.dueDate && !graded ? `Due ${fmtDate(issue.dueDate)}` : null,
    submission.submittedAt ? `Handed in ${fmtDate(submission.submittedAt)}` : null,
    graded && submission.gradedAt ? `Marked ${fmtDate(submission.gradedAt)}` : null,
  ].filter(Boolean);

  return (
    <div style={{ ...cardStyle(), overflow: "hidden" }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", backgroundColor: KID.navy.soft, color: KID.navy.color, flexShrink: 0 }}><FiTool size={20} /></span>
        <span style={{ flex: "1 1 220px", minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: T.ink, overflowWrap: "anywhere" }}>{assessment.name}</span>
          <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: T.inkMuted }}>{dates.join(" · ") || "Project"}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {level && (
            <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: level.color, backgroundColor: level.soft, border: `1.5px solid ${level.border}` }}>{level.label}</span>
          )}
          <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: status.color, backgroundColor: status.bg, border: `1.5px solid ${status.border}` }}>{status.label}</span>
          {open ? <FiChevronUp size={18} color={T.inkMuted} /> : <FiChevronDown size={18} color={T.inkMuted} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: "4px 20px 20px", display: "flex", flexDirection: "column", gap: 14, borderTop: `1px solid ${T.border}` }}>
          <ProjectBrief assessment={assessment} />
          {!graded && <MilestoneProgress milestones={assessment.milestones} progress={submission.milestoneProgress} />}
          {!graded && submission.status === "submitted" && <HandedIn assessment={assessment} submission={submission} />}
          {!graded && submission.status !== "submitted" && (
            <p style={{ margin: 0, fontSize: 13.5, color: T.inkMuted }}>
              {submission.status === "in_progress"
                ? (audience === "learner" ? "You've started — hand it in when it's ready, and your teacher's feedback appears here." : "Started — the feedback appears here once it's handed in and marked.")
                : "Not started yet."}
            </p>
          )}
          {graded && <ProjectResult row={row} learner={learner} audience={audience} />}
          {!staff && (
            <button type="button" onClick={() => navigate(`/learner-portal/assessments/${issue.id}`)}
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 12, border: "none", backgroundColor: T.accent, color: "#fff", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
              {audience === "learner" && !graded && submission.status !== "submitted" ? (submission.status === "in_progress" ? "Carry on" : "Start it") : "Open the project"} <FiExternalLink size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// What the project was: its description, the instructions, what to hand in, its milestones.
function ProjectBrief({ assessment }) {
  const deliverables = assessment.deliverables || [];
  const milestones = [...(assessment.milestones || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      {!isEmptyHtml(assessment.description) && (
        <Block icon={FiLayers} title="About the project"><RichContent html={assessment.description} /></Block>
      )}
      {!isEmptyHtml(assessment.instructions) && (
        <Block icon={FiClipboard} title="Instructions"><RichContent html={assessment.instructions} /></Block>
      )}
      {deliverables.length > 0 && (
        <Block icon={FiPackage} title="What to hand in">
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {deliverables.map((d) => (
              <li key={d.id} style={{ fontSize: 13.5, color: T.ink }}>
                <strong>{d.name}</strong>{d.description ? <span style={{ color: T.inkMuted }}> — {d.description}</span> : null}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {milestones.length > 0 && (
        <Block icon={FiFlag} title="Milestones">
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {milestones.map((m) => (
              <li key={m.id} style={{ fontSize: 13.5, color: T.ink }}>
                <strong>{m.name}</strong>{m.description ? <span style={{ color: T.inkMuted }}> — {m.description}</span> : null}
              </li>
            ))}
          </ol>
        </Block>
      )}
    </div>
  );
}

function Block({ icon: Icon, title, children }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 16, backgroundColor: "#FAFCFE", border: `1.5px solid ${T.border}` }}>
      <p style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", color: KID.sky.color }}>
        <Icon size={14} /> {title}
      </p>
      <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

// Before the project is marked: each milestone the educator has marked so far, with their note.
function MilestoneProgress({ milestones, progress }) {
  if (!milestones?.length) return null;
  const byId = new Map((progress || []).map((p) => [p.milestoneId, p]));
  if (!byId.size) return null;
  const sorted = [...milestones].sort((a, b) => (a.order || 0) - (b.order || 0));
  return (
    <Block icon={FiFlag} title={`Milestones marked · ${byId.size} of ${milestones.length}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((m) => {
          const p = byId.get(m.id);
          const max = Number(m.points) || 0;
          const level = p ? levelFor(pct(Number(p.marks) || 0, max)) : null;
          return (
            <div key={m.id} style={{ padding: "10px 12px", borderRadius: 12, backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>{m.name}</span>
                {level
                  ? <span style={{ fontSize: 12, fontWeight: 800, color: level.color }}>{level.label}</span>
                  : <span style={{ fontSize: 12, color: T.inkFaint, fontStyle: "italic" }}>Not marked yet</span>}
              </div>
              {p?.feedback && (
                <p style={{ margin: "8px 0 0", padding: "8px 10px", borderRadius: 10, backgroundColor: "#F7FAFD", border: `1px solid ${T.tintBorder}`, fontSize: 13, color: T.ink, whiteSpace: "pre-line" }}>
                  <FiMessageCircle size={12} style={{ verticalAlign: "-1px", marginRight: 6, color: T.accent }} />{p.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Block>
  );
}

// Handed in, not marked yet: what they handed in.
function HandedIn({ assessment, submission }) {
  const deliverables = assessment.deliverables || [];
  if (!deliverables.length) return null;
  const answers = new Map((submission.answers || []).map((a) => [a.itemId, a.response]));
  return (
    <Block icon={FiPackage} title="Handed in">
      {deliverables.map((d) => (
        <div key={d.id} style={{ padding: "6px 0" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{d.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13.5, color: T.inkMuted, overflowWrap: "anywhere" }}><Answer response={answers.get(d.id)} /></p>
        </div>
      ))}
    </Block>
  );
}

// Marked: the whole result, as the learner's own assessment page shows it.
function ProjectResult({ row, learner, audience }) {
  const { cls, selectedHub } = useOutletContext() || {};
  const { submission, assessment } = row;
  const items = useMemo(() => (assessment.items || []).map(normalizeLegacyItem), [assessment.items]);
  const autoByItem = useMemo(() => new Map((submission.autoItemResults || []).map((r) => [r.itemId, r])), [submission.autoItemResults]);
  const feedbackByKey = useMemo(() => new Map((submission.itemFeedback || []).map((f) => [f.itemId, f])), [submission.itemFeedback]);
  const answersByItem = useMemo(() => new Map((submission.answers || []).map((a) => [a.itemId, a.response])), [submission.answers]);
  const { data: linked = [] } = useAssessmentCompetencies(assessment.id, { enabled: !!assessment.id });
  const indicatorNameById = useMemo(() => {
    const map = new Map();
    linked.forEach((comp) => (comp.indicators || []).forEach((ind) => map.set(ind.id, { name: ind.name, competencyName: comp.name, competencyId: comp.id })));
    return map;
  }, [linked]);
  const { data: scoreRows = [] } = useLearnerCompetencyScores(cls?.curriculumId, learner?.id, selectedHub?.id);
  const scoreByCompetencyId = useMemo(() => new Map(scoreRows.map((r) => [r.competencyId, r])), [scoreRows]);
  return (
    <AssessmentResultView
      row={row}
      submission={submission}
      items={items}
      answersByItem={answersByItem}
      autoByItem={autoByItem}
      feedbackByKey={feedbackByKey}
      indicatorNameById={indicatorNameById}
      scoreByCompetencyId={scoreByCompetencyId}
      audience={audience}
      firstName={learner?.firstName || ""}
      milestones={assessment.milestones || []}
      milestoneProgress={submission.milestoneProgress || []}
    />
  );
}
