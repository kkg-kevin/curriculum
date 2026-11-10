import { useMemo } from "react";
import { FiArrowRight, FiCheckCircle, FiClipboard, FiClock, FiFileText, FiFlag, FiMessageCircle, FiStar, FiTarget } from "react-icons/fi";
import RichContent from "../../assessments/components/RichContent";
import { entryMarks, canDoLevelFor } from "../../assessments/schemas/assessment.schema";
import {
  REPORT_T as T, reportCard as card, REPORT_STYLES, KID_FONT, fmtDate,
  Ring, Bar, LevelPill, CardTitle, LevelScale, GlanceList, CompetencyCard, TeacherNote as TeacherCard,
} from "../../reports/components/ReportView";
import { LEVELS, levelFor, voice, summarySentence } from "../../reports/utils/reportView";

/*
 * A marked assessment, as its learner (or their parent) reads it — laid out like their reports
 * (reports/components/ReportView.jsx), from the same building blocks:
 *   1. how it went — a score ring, its plain level word and one sentence;
 *   2. the teacher's comment;
 *   3. doing well / to practise next (the indicators this assessment checked);
 *   4. skills — one card per competency, its indicators one tap away;
 *   5. their answers, each with how it went and the teacher's note on it; then work handed in and
 *      the rubric;
 *   6. what's next.
 * Two columns on a large screen, one on a phone. Like the reports, the headline is a level word and
 * a percentage, never a raw total; each question still says how many marks it got.
 * A survey isn't marked: it says the answers were recorded and lists them.
 */

// Marked automatically from the learner's answer — mirrors the server's grading.utils.js.
const AUTO_GRADABLE_KINDS = ["mcqSingle", "mcqMultiple", "trueFalse", "matching", "ordering", "fillBlank", "canDo"];
const pct = (earned, possible) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const marksOf = (earned, possible) => `${round1(earned)} / ${round1(possible)} ${round1(possible) === 1 ? "mark" : "marks"}`;

// How one question went, in words: all its marks, some, or none yet.
const RESULT = {
  full: { label: "Got it", look: LEVELS[3] },
  part: { label: "Partly there", look: LEVELS[1] },
  none: { label: "Not yet", look: LEVELS[0] },
};
const resultFor = (earned, possible) => (possible > 0 && earned >= possible ? RESULT.full : earned > 0 ? RESULT.part : RESULT.none);

function Answer({ response }) {
  if (response == null || response === "" || (Array.isArray(response) && !response.length)) {
    return <em style={{ color: T.faint }}>No answer given</em>;
  }
  if (Array.isArray(response)) {
    if (typeof response[0] === "object") return response.map((p) => `${p.left} → ${p.right}`).join(", ");
    return response.join(", ");
  }
  // Uploads and project deliverables are {url, filename, …}.
  if (typeof response === "object" && response.url) {
    return <a href={response.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2e7db5", fontWeight: 700 }}>{response.filename || "View the file"}</a>;
  }
  return String(response);
}

function TeacherNote({ text }) {
  if (!text?.trim()) return null;
  return (
    <p style={{ margin: "10px 0 0", padding: "9px 12px", borderRadius: 12, backgroundColor: "#F7FAFD", border: `1px solid ${T.tintBorder}`, fontSize: 13.5, lineHeight: 1.5, color: T.ink, whiteSpace: "pre-line" }}>
      <FiMessageCircle size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: T.navy }} />
      {text.trim()}
    </p>
  );
}

function QuestionRow({ number, item, response, autoResult, feedback, survey }) {
  const head = (aside) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ width: 26, height: 26, borderRadius: 9, display: "grid", placeItems: "center", backgroundColor: T.tint, color: T.navy, fontSize: 12.5, fontWeight: 900, flexShrink: 0 }}>{number}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: T.ink }}><RichContent html={item.question} /></div>
      {aside}
    </div>
  );
  const answer = (content, color = T.muted) => (
    <p style={{ margin: "8px 0 0 36px", fontSize: 13.5, lineHeight: 1.5, color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      <span style={{ fontWeight: 800, color: T.faint, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 6 }}>Answer</span>
      {content}
    </p>
  );
  const box = { padding: "14px 0", borderTop: `1px solid ${T.border}` };

  if (survey) return <div style={box}>{head(null)}{answer(<Answer response={response} />)}</div>;

  // A can-do check: the level they picked, in its own colour.
  if (item.kind === "canDo") {
    const picked = canDoLevelFor(item, response);
    return (
      <div style={box}>
        {head(autoResult ? <span style={{ fontSize: 12, color: T.faint, whiteSpace: "nowrap" }}>{marksOf(autoResult.marksAwarded, autoResult.maxMarks ?? entryMarks(item))}</span> : null)}
        {answer(picked ? <strong style={{ color: picked.color }}>{picked.label}</strong> : <em style={{ color: T.faint }}>No answer given</em>)}
      </div>
    );
  }

  const isAuto = AUTO_GRADABLE_KINDS.includes(item.kind);
  const earned = isAuto ? Number(autoResult?.marksAwarded ?? 0) : Number(feedback?.marks ?? 0);
  const possible = isAuto ? Number(autoResult?.maxMarks ?? entryMarks(item)) : Number(entryMarks(item));
  const result = isAuto && autoResult?.correct ? RESULT.full : resultFor(earned, possible);
  return (
    <div style={box}>
      {head(
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
          <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, color: result.look.color, backgroundColor: result.look.soft, border: `1px solid ${result.look.border}`, whiteSpace: "nowrap" }}>{result.label}</span>
          {possible > 0 && <span style={{ fontSize: 11.5, color: T.faint, whiteSpace: "nowrap" }}>{marksOf(earned, possible)}</span>}
        </span>,
      )}
      {answer(<Answer response={response} />)}
      <div style={{ marginLeft: 36 }}><TeacherNote text={feedback?.comment} /></div>
    </div>
  );
}

/**
 * row: the issued row ({ issue, assessment, submission }); submission: the graded submission.
 * items: the assessment's questions (normalised); answersByItem / autoByItem / feedbackByKey: maps
 * by item id (rubric criteria as `rubric:<id>`). indicatorNameById: indicator id → { name,
 * competencyName, competencyId }; scoreByCompetencyId: the curriculum's band per competency.
 * milestones / milestoneProgress: a project's checkpoints and the marks given for each.
 * audience: "learner" | "parent"; firstName: the learner's. onOpenReports(): "See all reports".
 */
export default function AssessmentResultView({
  row, submission, items, answersByItem, autoByItem, feedbackByKey,
  indicatorNameById, scoreByCompetencyId, audience = "learner", firstName = "", onOpenReports,
  milestones = [], milestoneProgress = [],
}) {
  const assessment = row.assessment;
  const survey = assessment?.type === "survey";
  const rubric = assessment?.rubric || [];
  const deliverables = assessment?.deliverables || [];
  const v = useMemo(() => voice(audience, firstName), [audience, firstName]);

  const view = useMemo(() => {
    const percent = pct(Number(submission.totalScore) || 0, Number(submission.maxScore) || 0);
    const level = levelFor(percent);
    const indicators = (submission.indicatorBreakdown || []).map((e) => {
      const resolved = indicatorNameById.get(e.indicatorId);
      return {
        id: e.indicatorId,
        name: resolved?.name || "Skill",
        competencyId: resolved?.competencyId || null,
        competencyName: resolved?.competencyName || "",
        earned: Number(e.marksEarned) || 0,
        possible: Number(e.marksPossible) || 0,
        percent: pct(e.marksEarned, e.marksPossible),
      };
    });
    // One card per competency (this assessment's marks), its indicators underneath; the
    // curriculum's band for it, when there is one.
    const byId = new Map();
    for (const ind of indicators) {
      const key = ind.competencyId || ind.competencyName || "skills";
      if (!byId.has(key)) byId.set(key, { id: key, name: ind.competencyName || "Skills", indicators: [], earned: 0, possible: 0 });
      const c = byId.get(key);
      c.indicators.push({ ...ind, level: levelFor(ind.percent) });
      c.earned += ind.earned;
      c.possible += ind.possible;
    }
    const competencies = [...byId.values()].map((c) => {
      const p = pct(c.earned, c.possible);
      return { ...c, percent: p, level: levelFor(p), band: scoreByCompetencyId.get(c.id)?.band?.name || null };
    });
    const pool = indicators.length ? indicators : competencies;
    const strengths = pool.filter((x) => x.percent >= 75).sort((a, b) => b.percent - a.percent).slice(0, 3);
    const practise = pool.filter((x) => x.percent < 50).sort((a, b) => a.percent - b.percent).slice(0, 3);
    let sentence = summarySentence(level, v, "this assessment");
    if (strengths.length) sentence += ` Strongest in ${strengths.slice(0, 2).map((s) => s.name).join(" and ")}.`;
    // How many of the marked questions got all their marks.
    const scored = items.filter((it) => it.kind !== "canDo");
    const full = scored.filter((it) => {
      const auto = AUTO_GRADABLE_KINDS.includes(it.kind);
      const r = autoByItem.get(it.id);
      if (auto) return Boolean(r?.correct);
      const max = Number(entryMarks(it)) || 0;
      return max > 0 && Number(feedbackByKey.get(it.id)?.marks || 0) >= max;
    }).length;
    return { percent, level, competencies, strengths, practise, sentence, scoredCount: scored.length, fullCount: full };
  }, [submission, items, autoByItem, feedbackByKey, indicatorNameById, scoreByCompetencyId, v]);

  const markedOn = fmtDate(submission.gradedAt || submission.submittedAt);
  const by = submission.gradedByName?.replace(/\s+/g, " ").trim() || null;
  const hasTeacher = Boolean(submission.overallFeedback?.trim());
  const nextLines = [];
  if (!survey && view.practise.length) nextLines.push(`${audience === "learner" ? "Practise" : "Practising"} ${view.practise[0].name} will help most.`);
  if (!survey && !view.practise.length && view.percent >= 80) nextLines.push(audience === "learner" ? "Great work — keep it up in your next session." : `Great work — ${v.name} can keep it up in the next session.`);
  if (!nextLines.length) nextLines.push(audience === "learner" ? "Your reports show how this fits with the rest of your work." : `The reports show how this fits with the rest of ${v.name}'s work.`);

  const questions = items.length > 0 && (
    <div className="rv-o4" style={card}>
      <CardTitle icon={<FiFileText size={16} />} aside={!survey && view.scoredCount > 0 ? <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>{view.fullCount} of {view.scoredCount} got full marks</span> : null}>
        {audience === "learner" ? "Your answers" : `${v.name}'s answers`}
      </CardTitle>
      <div style={{ marginTop: -4 }}>
        {items.map((item, i) => (
          <QuestionRow key={item.id} number={i + 1} item={item} survey={survey}
            response={answersByItem.get(item.id)} autoResult={autoByItem.get(item.id)} feedback={feedbackByKey.get(item.id)} />
        ))}
      </div>
    </div>
  );

  const handedIn = deliverables.length > 0 && (
    <div className="rv-o5" style={card}>
      <CardTitle icon={<FiClipboard size={16} />}>Work handed in</CardTitle>
      {deliverables.map((d) => (
        <div key={d.id} style={{ padding: "11px 0", borderTop: `1px solid ${T.border}` }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>{d.name}</p>
          <p style={{ margin: "3px 0 0", fontSize: 13.5, color: T.muted, overflowWrap: "anywhere" }}><Answer response={answersByItem.get(d.id)} /></p>
        </div>
      ))}
    </div>
  );

  const rubricCard = !survey && rubric.length > 0 && (
    <div className="rv-o5" style={card}>
      <CardTitle icon={<FiCheckCircle size={16} />}>How it was marked</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rubric.map((c) => {
          const fb = feedbackByKey.get(`rubric:${c.id}`);
          const max = Number(entryMarks(c)) || 0;
          const p = pct(Number(fb?.marks || 0), max);
          const level = levelFor(p);
          return (
            <div key={c.id} style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.border}`, backgroundColor: "#FBFCFE" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, minWidth: 0 }}>{c.criterion}</span>
                <LevelPill level={level} small />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
                <Bar percent={p} color={level.fill} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>{marksOf(fb?.marks || 0, max)}</span>
              </div>
              <TeacherNote text={fb?.comment} />
            </div>
          );
        })}
      </div>
    </div>
  );

  const progressBy = new Map((milestoneProgress || []).map((p) => [p.milestoneId, p]));
  const milestonesCard = milestones.length > 0 && (
    <div className="rv-o5" style={card}>
      <CardTitle icon={<FiFlag size={16} />} aside={<span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted }}>{progressBy.size} of {milestones.length} marked</span>}>Milestones</CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...milestones].sort((a, b) => (a.order || 0) - (b.order || 0)).map((m) => {
          const p = progressBy.get(m.id);
          const max = Number(m.points) || 0;
          const percent = p ? pct(Number(p.marks) || 0, max) : 0;
          const level = levelFor(percent);
          return (
            <div key={m.id} style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.border}`, backgroundColor: "#FBFCFE" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, minWidth: 0 }}>{m.name}</span>
                {p ? <LevelPill level={level} small /> : <span style={{ fontSize: 12, color: T.faint }}>Not marked yet</span>}
              </div>
              {m.description && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.muted }}>{m.description}</p>}
              {p && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
                  <Bar percent={percent} color={level.fill} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>{marksOf(p.marks, max)}</span>
                </div>
              )}
              <TeacherNote text={p?.feedback} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // A survey: recorded, never marked — just the answers.
  if (survey) {
    return (
      <div className="rv rv-one" style={{ fontFamily: KID_FONT }}>
        <style>{REPORT_STYLES}</style>
        <div className="rv-summary" style={{ ...card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", backgroundColor: T.tint, color: T.navy, flexShrink: 0 }}><FiCheckCircle size={24} /></span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.navy }}>Answers recorded</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: T.muted }}>Sent {markedOn}. A survey isn&rsquo;t marked — thank you for sharing.</p>
          </div>
        </div>
        <div className="rv-col">{questions}{handedIn}</div>
      </div>
    );
  }

  return (
    <div className="rv" style={{ fontFamily: KID_FONT }}>
      <style>{REPORT_STYLES}</style>

      {/* 1. How it went */}
      <div className="rv-summary" style={{ ...card, padding: "22px 24px" }}>
        <div className="rv-hero">
          <Ring percent={view.percent} color={view.level.fill} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.faint }}>How this assessment went</p>
            <div style={{ margin: "6px 0 8px" }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: view.level.color, lineHeight: 1.1 }}>{view.level.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: T.ink }}>{view.sentence}</p>
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.muted }}>
              Marked {markedOn}{by ? ` by ${by}` : ""}
            </p>
          </div>
        </div>
        <LevelScale current={view.level} />
      </div>

      <div className="rv-col">
        {view.competencies.length > 0 && (
          <div className="rv-pair rv-o3">
            <div style={card}>
              <CardTitle icon={<FiStar size={16} />}>Doing well</CardTitle>
              <GlanceList items={view.strengths} color="#2e7db5" empty={`Nothing stands out yet — keep going and ${v.their} strengths will show here.`} />
            </div>
            <div style={card}>
              <CardTitle icon={<FiTarget size={16} />} color="#9A6300">To practise next</CardTitle>
              <GlanceList items={view.practise} color="#feb139" empty="Nothing below halfway — nice work. Keep practising to stay sharp." />
            </div>
          </div>
        )}
        {view.competencies.length > 0 && (
          <div className="rv-o4" style={card}>
            <CardTitle icon={<FiCheckCircle size={16} />}>Skills</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {view.competencies.map((c) => <CompetencyCard key={c.id} c={c} showMarks={false} showBand />)}
            </div>
          </div>
        )}
        {questions}
        {milestonesCard}
        {handedIn}
        {rubricCard}
      </div>

      <div className="rv-col">
        {hasTeacher && (
          <div className="rv-o1" style={{ ...card, backgroundColor: "#F7FAFD", borderColor: T.tintBorder }}>
            <CardTitle icon={<FiMessageCircle size={16} />}>From the teacher</CardTitle>
            <TeacherCard name={by} photo={submission.gradedByPhoto || null} text={submission.overallFeedback.trim()} audience={audience} meta={markedOn ? `Marked ${markedOn}` : null} />
          </div>
        )}
        <div className="rv-o6" style={card}>
          <CardTitle icon={<FiClock size={16} />}>What’s next</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {nextLines.map((l) => <p key={l} style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T.ink }}>{l}</p>)}
          </div>
          {onOpenReports && (
            <button type="button" onClick={onOpenReports}
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: "none", backgroundColor: T.navy, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
              {audience === "learner" ? "See my reports" : "See the reports"} <FiArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
