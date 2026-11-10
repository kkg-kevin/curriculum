// What a learner's report says, worked out once from its stored content — shared by the on-screen
// report (ReportView) and the printable one (ReportPrintDocument), so both read the same.
//
// Families read words and bars, not marks: every percentage gets one of four plain level words
// (the same scale as the website diagnostic), the report opens with one sentence saying how it
// went, then what went well and what to practise next. Raw marks ("28.8 / 49.6") are for staff
// only (`showMarks`).

// In the system's colours: gold → light sky → mid blue → navy. `fill` is for rings and bars,
// `color` for the words (a darker step of the same colour), `soft`/`border` for pills.
export const LEVELS = [
  { key: "early", label: "Early days", min: 0, max: 39, fill: "#feb139", color: "#9A6300", soft: "#FFF5E1", border: "#FDD89A" },
  { key: "starting", label: "Getting started", min: 40, max: 59, fill: "#9BD7F2", color: "#2e7db5", soft: "#EAF6FD", border: "#BFE3F7" },
  { key: "track", label: "On track", min: 60, max: 79, fill: "#2e7db5", color: "#25476a", soft: "#E3EEF8", border: "#B9D3EA" },
  { key: "strong", label: "Strong start", min: 80, max: 100, fill: "#25476a", color: "#1a3550", soft: "#E6ECF3", border: "#A9BCD2" },
];

export function levelFor(percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return LEVELS.find((l) => p >= l.min && p <= l.max) || LEVELS[0];
}

const pct = (earned, possible) => (possible > 0 ? Math.round((earned / possible) * 100) : 0);
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export const marks = (earned, possible) => `${round1(earned)} / ${round1(possible)}`;

// Who the report talks to: the learner ("You did well"), their parent ("Ama did well") or staff
// (the learner's name, like a parent).
export function voice(audience, firstName) {
  if (audience === "learner") return { name: "You", is: "You're", did: "You did", has: "You have", their: "your" };
  const n = firstName || "Your child";
  return { name: n, is: `${n} is`, did: `${n} did`, has: `${n} has`, their: "their" };
}

export function summarySentence(level, v, scope) {
  switch (level.key) {
    case "strong": return `${v.did} really well in ${scope} — most of the work was right.`;
    case "track": return `${v.is} on track in ${scope}, with a few things still to firm up.`;
    case "starting": return `${v.is} getting the hang of ${scope} — a bit more practice will help.`;
    default: return `${v.is} just starting out with ${scope}. Practising the points below will help.`;
  }
}

const list = (names) => (names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * report: the stored report (content, remarks, homeNote, sessionId…).
 * audience: "learner" | "parent" | "staff". firstName: the learner's first name.
 */
export function buildReportView(report, { audience = "learner", firstName = "" } = {}) {
  const content = report?.content || {};
  const isSession = Boolean(report?.sessionId);
  const overall = content.overall || { totalScore: 0, maxScore: 0, percent: 0 };
  const percent = Math.round(Number(overall.percent) || 0);
  const level = levelFor(percent);
  const v = voice(audience, firstName);
  const scope = isSession ? "this session" : "this course";

  const assessments = (content.assessments || []).map((a) => ({ ...a, level: levelFor(a.percent) }));
  const indicators = (content.indicatorBreakdown || []).map((i) => ({
    id: i.indicatorId,
    name: i.indicatorName || "Skill",
    competencyId: i.competencyId,
    competencyName: i.competencyName || "",
    earned: Number(i.marksEarned) || 0,
    possible: Number(i.marksPossible) || 0,
    percent: Number.isFinite(Number(i.percent)) ? Math.round(Number(i.percent)) : pct(i.marksEarned, i.marksPossible),
  }));

  // One card per competency: the curriculum's own score where there is one, else its indicators'
  // marks put together; its indicators underneath.
  const scores = new Map((content.competencyScores || []).map((cs) => [cs.competencyId, cs]));
  const byId = new Map();
  for (const ind of indicators) {
    const key = ind.competencyId || ind.competencyName;
    if (!byId.has(key)) byId.set(key, { id: key, name: ind.competencyName || "Skills", indicators: [], earned: 0, possible: 0 });
    const c = byId.get(key);
    c.indicators.push({ ...ind, level: levelFor(ind.percent) });
    c.earned += ind.earned;
    c.possible += ind.possible;
  }
  for (const cs of content.competencyScores || []) {
    if (!byId.has(cs.competencyId)) byId.set(cs.competencyId, { id: cs.competencyId, name: cs.name, indicators: [], earned: 0, possible: 0 });
  }
  const competencies = [...byId.values()].map((c) => {
    const cs = scores.get(c.id);
    const p = cs && Number.isFinite(Number(cs.score)) ? Math.round(Number(cs.score)) : pct(c.earned, c.possible);
    return { ...c, name: cs?.name || c.name, percent: p, level: levelFor(p), band: cs?.band?.name || null, curriculumLevel: cs?.level?.name || null };
  });

  // The curriculum's band (e.g. "Explorer") once, when every competency is in the same one.
  const bands = [...new Set(competencies.map((c) => c.band).filter(Boolean))];
  const band = bands.length === 1 ? bands[0] : null;
  const bandDescription = band ? (content.competencyScores || []).find((cs) => cs.band?.name === band)?.band?.description || null : null;

  // Doing well / to practise next: the indicators (else the competencies) at either end.
  const pool = indicators.length ? indicators : competencies;
  const strengths = pool.filter((x) => x.percent >= 75).sort((a, b) => b.percent - a.percent).slice(0, 3);
  const practise = pool.filter((x) => x.percent < 50).sort((a, b) => a.percent - b.percent).slice(0, 3);

  let sentence = assessments.length || indicators.length ? summarySentence(level, v, scope) : "";
  if (strengths.length) sentence += ` Strongest in ${list(strengths.slice(0, 2).map((s) => s.name))}.`;

  // What the teacher said: the report's own remarks, then each marked piece's comment.
  const comments = [];
  if (report?.remarks?.trim()) comments.push({ key: "remarks", text: report.remarks.trim(), about: isSession ? "This session" : "This course", by: report.publishedByName?.replace(/\s+/g, " ").trim() || null, photo: report.publishedByPhoto || null });
  for (const a of assessments) {
    if (a.feedback?.trim()) comments.push({ key: a.assessmentId, text: a.feedback.trim(), about: a.name, by: a.gradedByName?.replace(/\s+/g, " ").trim() || null, photo: a.gradedByPhoto || null, at: a.gradedAt || null });
  }

  const marked = assessments.length;
  const pending = isSession && content.complete === false ? Number(content.pendingCount) || 0 : 0;

  return {
    isSession,
    notSubmitted: Boolean(content.notSubmitted),
    notSubmittedAssessments: content.notSubmittedAssessments || [],
    percent,
    level,
    overall,
    sentence,
    band,
    bandDescription,
    strengths,
    practise,
    competencies,
    assessments,
    comments,
    homeNote: report?.homeNote?.trim() || "",
    marked,
    pending,
    sessionNumber: content.sessionNumber || null,
    sessionCount: content.sessionCount || null,
    nextSessionTitle: content.nextSessionTitle || null,
    sessionReports: (content.sessionReports || []).map((s) => ({ ...s, level: levelFor(s.percent) })),
    courseName: content.courseName || null,
    sessionName: content.sessionName || null,
    voice: v,
  };
}
