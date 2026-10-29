const crypto = require("crypto");

// The rules for quality assurance — pure, no database, tested on their own (test/qa.test.js).
//
// A template is { name, scale: [{ score, label }], sections: [{ id, title, criteria: [{ id, text,
// help, kind, descriptors }] }] } — `kind` yes_no | rubric | comment; a rubric criterion is answered
// on the template's scale, and its `descriptors` ({ [score]: text }) say what each level looks like
// for it. Answers are { [criterionId]: { value, comment } } — value "yes" | "no" | "na" for yes / no,
// a level's score or "na" for a rubric, nothing for a comment.

const newId = () => crypto.randomUUID();
const trim = (v, max) => String(v ?? "").trim().slice(0, max);
const richOrNull = (v, max) => (hasContent(v) ? trim(v, max) : null);

// Tidies a template as typed: trims text, gives new sections and criteria an id, keeps the scale in
// score order and only the descriptors of levels it has. The description and each item's guidance
// are rich text (HTML from the editor, shown through the client's sanitizeHtml); an empty editor is
// kept as nothing.
function normaliseTemplate({ name, description, scale, sections }) {
  const levels = (Array.isArray(scale) ? scale : [])
    .map((l, i) => ({ score: Number.isFinite(Number(l?.score)) ? Number(l.score) : i + 1, label: trim(l?.label, 60) }))
    .sort((a, b) => a.score - b.score);
  const scores = new Set(levels.map((l) => String(l.score)));
  return {
    name: trim(name, 150),
    description: richOrNull(description, 20000),
    scale: levels,
    sections: (Array.isArray(sections) ? sections : []).map((s) => ({
      id: trim(s?.id, 36) || newId(),
      title: trim(s?.title, 150),
      criteria: (Array.isArray(s?.criteria) ? s.criteria : []).map((c) => ({
        id: trim(c?.id, 36) || newId(),
        text: trim(c?.text, 500),
        help: richOrNull(c?.help, 10000),
        kind: c?.kind,
        ...(c?.kind === "rubric" ? {
          descriptors: Object.fromEntries(Object.entries(c?.descriptors || {})
            .filter(([score, text]) => scores.has(String(score)) && trim(text, 500))
            .map(([score, text]) => [String(score), trim(text, 500)])),
        } : {}),
      })),
    })),
  };
}

// What a template still needs, every problem at once.
function templateProblems(template) {
  const problems = [];
  if (!template.name) problems.push("Name the template");
  if (!template.sections.length) problems.push("Add at least one section");
  const usesRubric = template.sections.some((s) => s.criteria.some((c) => c.kind === "rubric"));
  if (usesRubric) {
    if (template.scale.length < 2) problems.push("A rubric needs at least two levels");
    if (template.scale.some((l) => !l.label)) problems.push("Name every level of the rubric");
    if (new Set(template.scale.map((l) => l.score)).size !== template.scale.length) problems.push("Each rubric level needs its own score");
  }
  template.sections.forEach((s, i) => {
    const where = s.title || `Section ${i + 1}`;
    if (!s.title) problems.push(`Give section ${i + 1} a title`);
    if (!s.criteria.length) problems.push(`Add at least one thing to check in "${where}"`);
    s.criteria.forEach((c, j) => {
      if (!c.text) problems.push(`Write item ${j + 1} of "${where}"`);
      if (!["yes_no", "rubric", "comment"].includes(c.kind)) problems.push(`Choose how item ${j + 1} of "${where}" is answered`);
    });
  });
  if (!template.sections.some((s) => s.criteria.some((c) => c.kind !== "comment"))) {
    if (template.sections.length) problems.push("Add at least one yes / no or rubric item, so the visit has a score");
  }
  return [...new Set(problems)];
}

const maxScore = (scale) => Math.max(...scale.map((l) => l.score));

// One criterion's answer as a share of full marks (0–1), or null when it isn't scored (a comment,
// "not applicable", or not answered yet).
function criterionShare(criterion, answer, scale) {
  const value = answer?.value;
  if (criterion.kind === "yes_no") return value === "yes" ? 1 : value === "no" ? 0 : null;
  if (criterion.kind === "rubric") {
    if (value === "na" || value === null || value === undefined || value === "") return null;
    const level = scale.find((l) => String(l.score) === String(value));
    return level ? level.score / maxScore(scale) : null;
  }
  return null;
}

const round1 = (n) => Math.round(n * 1000) / 10;

// The visit's score: each scored item counts equally (yes = full marks, no = none, a rubric level
// its share of the top level); "not applicable" is left out. Per section too. null when nothing is
// scored.
function scoreReview(template, answers = {}) {
  const all = [];
  const sectionScores = template.sections.map((s) => {
    const shares = s.criteria.map((c) => criterionShare(c, answers[c.id], template.scale)).filter((x) => x !== null);
    all.push(...shares);
    return { id: s.id, title: s.title, score: shares.length ? round1(shares.reduce((a, b) => a + b, 0) / shares.length) : null, scored: shares.length };
  });
  return { score: all.length ? round1(all.reduce((a, b) => a + b, 0) / all.length) : null, sectionScores };
}

// Whether a summary part says anything (rich text: tags don't count, a picture does).
function hasContent(value) {
  const html = String(value || "");
  if (/<img[\s>]/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

// What a review still needs before it can be sent: every yes / no and rubric item answered ("not
// applicable" counts), the strengths and the areas to improve written.
function reviewProblems(template, answers = {}, summary = {}) {
  const problems = [];
  for (const s of template.sections) {
    const missing = s.criteria.filter((c) => {
      if (c.kind === "comment") return false;
      const value = answers[c.id]?.value;
      if (c.kind === "yes_no") return !["yes", "no", "na"].includes(value);
      return value !== "na" && !template.scale.some((l) => String(l.score) === String(value));
    });
    if (missing.length) problems.push(`Answer ${missing.length === 1 ? "1 item" : `${missing.length} items`} in "${s.title}"`);
  }
  if (!hasContent(summary.strengths)) problems.push("Write the strengths");
  if (!hasContent(summary.improvements)) problems.push("Write the areas to improve");
  return problems;
}

// Keeps only answers to this template's items, in the shape each kind takes.
function cleanAnswers(template, answers = {}) {
  const out = {};
  for (const s of template.sections) {
    for (const c of s.criteria) {
      const a = answers[c.id];
      if (!a) continue;
      const comment = trim(a.comment, 2000);
      let value;
      if (c.kind === "yes_no" && ["yes", "no", "na"].includes(a.value)) value = a.value;
      if (c.kind === "rubric") {
        if (a.value === "na") value = "na";
        else if (template.scale.some((l) => String(l.score) === String(a.value))) value = Number(a.value);
      }
      if (value !== undefined || comment) out[c.id] = { ...(value !== undefined ? { value } : {}), ...(comment ? { comment } : {}) };
    }
  }
  return out;
}

// Where a visit stands today: cancelled, submitted, or open — "due" from its day on, "upcoming"
// before it.
function visitState(visit, today) {
  if (visit.status === "cancelled") return "cancelled";
  if (visit.status === "submitted") return "submitted";
  return visit.scheduledDate <= today ? "due" : "upcoming";
}

// What the educator (and the hub) may know of a visit: a report once it's in; an announced visit
// beforehand; a surprise visit, or a cancelled one, not at all until then.
function visibleToVisited(visit) {
  if (visit.status === "submitted") return true;
  return visit.status === "open" && visit.visitType === "announced";
}

module.exports = {
  normaliseTemplate, templateProblems, scoreReview, reviewProblems, cleanAnswers, visitState, visibleToVisited, hasContent,
};
