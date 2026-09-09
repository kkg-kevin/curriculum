const CurriculumModel = require("../curriculum/curriculum.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const AssessmentModel = require("../assessments/assessment.model");
const CompetencyModel = require("../settings/competencies/competency.model");
const PublicDiagnosticAttemptModel = require("./public-diagnostic-attempt.model");
const env = require("../../config/env");
const { slugify } = require("../../shared/utils/slugify");
const {
  requiresManualGrading,
  computeAutoScore,
  computeMaxScore,
  computeIndicatorBreakdown,
} = require("../assessments/submissions/grading.utils");

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

function configError() {
  const err = new Error("Public diagnostics are not configured");
  err.statusCode = 503;
  return err;
}

// The one admin whose pathways/curricula this feature reads from — see env.js's
// PUBLIC_CONTENT_ADMIN_ID comment. Every method below calls this first so an unconfigured
// environment fails the same clean way everywhere, rather than each method separately checking.
function requireConfiguredAdminId() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) throw configError();
  return env.PUBLIC_CONTENT_ADMIN_ID;
}

// Resolves the designated admin's operational Pathway matching idOrSlug. The public site's
// /api/public/pathways now returns these same operational pathways (see public-site.service.js),
// so the website links by an operational pathway's own computed slug — no marketing-template
// indirection any more.
//
// Only looks at THIS admin's curricula — `pathways` has no ownerAdminId of its own, it's
// scoped transitively via curriculumId -> curricula.ownerAdminId (tenant-isolation migrations).
//
// Pathway names are only unique WITHIN one curriculum (competency.service.js), and the
// designated admin can own several curricula, so two of their pathways can collide on the same
// computed slug. Since only a pathway with publicDiagnosticEnabled matters here, prefer a slug
// match that has it set, then plain first-match.
async function resolveDesignatedPathway(idOrSlug) {
  const ownerAdminId = requireConfiguredAdminId();
  const curricula = await CurriculumModel.findAll({ ownerAdminId });
  const curriculumIds = new Set(curricula.map((c) => c.id));
  const allPathways = (
    await Promise.all(curricula.map((c) => PathwayModel.findByCurriculumId(c.id)))
  ).flat();

  // 1. Direct hit on an operational pathway id (the diagnostic-attempt audit trail stores this).
  let pathway = allPathways.find((p) => p.id === idOrSlug) || null;

  // 2. By computed slug — prefer a match that has the public diagnostic enabled.
  if (!pathway) {
    const slugMatches = allPathways.filter((p) => (slugify(p.name) || "pathway") === idOrSlug);
    pathway = slugMatches.find((p) => p.publicDiagnosticEnabled) || slugMatches[0] || null;
  }

  // Belt-and-suspenders — findByCurriculumId already only returns rows for ids we collected
  // above, so this can't actually fail, but it keeps the tenant boundary explicit.
  if (pathway && !curriculumIds.has(pathway.curriculumId)) return null;
  return pathway;
}

// Whether this pathway's diagnostic is actually offerable to an anonymous visitor right now.
// Requires, in order:
//   - publicDiagnosticEnabled flag on
//   - a diagnosticAssessmentId that still resolves and is fully auto-gradable (live re-check —
//     the flag and the assessment are independently editable; competency.service.js's
//     assertPublicDiagnosticAllowed only runs at SAVE time)
//   - BOTH minAge and maxAge set (see hasCompleteAgeRange). A public diagnostic with no age
//     bounds is treated as not-yet-configured rather than "open to any age" — the anonymous
//     path must fail safe. (The authenticated learner flow, which has a real learner + teacher,
//     is unaffected: it never calls this.)
async function loadOfferableAssessment(pathway) {
  if (!pathway?.publicDiagnosticEnabled || !pathway.diagnosticAssessmentId) return null;
  if (!hasCompleteAgeRange(pathway)) return null;
  const assessment = await AssessmentModel.findById(pathway.diagnosticAssessmentId);
  if (!assessment || requiresManualGrading(assessment)) return null;
  return assessment;
}

// A public diagnostic needs an explicit min AND max age — a missing bound is "not configured",
// not "unbounded" (which would let the anonymous flow serve a diagnostic to any age).
function hasCompleteAgeRange(pathway) {
  return (
    pathway?.minAge != null &&
    pathway?.maxAge != null &&
    Number(pathway.minAge) <= Number(pathway.maxAge)
  );
}

function ageInRange(pathway, age) {
  if (age == null || !hasCompleteAgeRange(pathway)) return false;
  return age >= Number(pathway.minAge) && age <= Number(pathway.maxAge);
}

// Item projection sent to an anonymous visitor — every field AssessmentTaker.jsx needs to
// RENDER the question, with every field that would let it (or a curious visitor's network tab)
// reconstruct the correct answer before grading stripped or neutralised:
//   - correctAnswer (mcqSingle/trueFalse/mcqMultiple) — dropped outright, nothing else on these
//     kinds carries the answer.
//   - blanks (fillBlank) — the array itself IS the solution text per blank (see grading.utils.js's
//     gradeItem); only its LENGTH is structural (how many input boxes to render), so each entry
//     is replaced with "" rather than dropping the array.
//   - sequence (ordering) — AssessmentTaker renders this array directly as the starting order to
//     rearrange, so sending it as-is trivially reveals the correct order; shuffled instead so the
//     visitor sees a scrambled starting point same as a real quiz would present.
//   - pairs (matching) — each {left,right} pair IS the correct match; the `right` values (not the
//     pairing) are what the picker needs to populate its dropdown options, so rights are
//     collected, shuffled, and re-paired with blank rights per left, breaking the correct
//     association while keeping every option available to choose from.
function sanitizeItem(item) {
  const { correctAnswer, ...rest } = item;
  const clean = { ...rest };
  if (item.kind === "fillBlank") {
    clean.blanks = (item.blanks || []).map(() => "");
  }
  if (item.kind === "ordering") {
    const seq = item.sequence || [];
    clean.sequence = [...seq].sort(() => Math.random() - 0.5);
  }
  if (item.kind === "matching") {
    clean.pairs = (item.pairs || []).map((p) => ({ left: p.left, right: "" }));
    clean.rightOptions = (item.pairs || []).map((p) => p.right).sort(() => Math.random() - 0.5);
  }
  return clean;
}

// { indicatorId -> name }, resolved once per request. Indicator names are plain display strings,
// not sensitive/scoped data — same posture as assessment-submission.service.js's own
// resolveIndicator, which also reads the global competency catalog unscoped for exactly this
// "resolve a name for display" purpose.
async function buildIndicatorNameMap() {
  const competencies = await CompetencyModel.findAll();
  const map = new Map();
  competencies.forEach((c) => (c.indicators || []).forEach((i) => map.set(i.id, i.name)));
  return map;
}

const PublicDiagnosticService = {
  // GET /api/public/diagnostics/:pathwayIdOrSlug?age=<int> — returns null (-> the controller's
  // bare-object 404, matching public-site.service.js's getPathway convention exactly) rather
  // than throwing, for every "nothing to show" case: unknown pathway, age out of range, no
  // diagnostic configured/offerable. Distinguishing WHY isn't useful to an anonymous caller and
  // would risk leaking which pathways exist vs. which ones simply lack a public diagnostic.
  async getDiagnostic(pathwayIdOrSlug, age) {
    const pathway = await resolveDesignatedPathway(pathwayIdOrSlug);
    if (!pathway) return null;
    if (!ageInRange(pathway, age)) return null;
    const assessment = await loadOfferableAssessment(pathway);
    if (!assessment) return null;

    const indicatorNames = await buildIndicatorNameMap();
    return {
      pathwayId: pathway.id,
      pathwayName: pathway.name,
      assessmentId: assessment.id,
      name: assessment.name,
      instructions: assessment.instructions || "",
      // Echoed so the website can bound its age input to the offered range (both are guaranteed
      // set — loadOfferableAssessment requires a complete range).
      minAge: Number(pathway.minAge),
      maxAge: Number(pathway.maxAge),
      items: (assessment.items || []).map((item) => ({
        ...sanitizeItem(item),
        indicatorNames: (item.indicatorMarks || [])
          .map((m) => indicatorNames.get(m.indicatorId))
          .filter(Boolean),
      })),
    };
  },

  // Availability check for PathwayDetailPage's CTA — returns whether a diagnostic is offerable
  // AND (when it is) the age range, so the detail page can render "for ages 8–14" and the
  // website can pre-bound the age field. `null` age range only when no diagnostic is offerable.
  async diagnosticInfo(pathwayIdOrSlug) {
    const pathway = await resolveDesignatedPathway(pathwayIdOrSlug);
    if (!pathway) return { available: false, minAge: null, maxAge: null };
    const assessment = await loadOfferableAssessment(pathway);
    if (!assessment) return { available: false, minAge: null, maxAge: null };
    return { available: true, minAge: Number(pathway.minAge), maxAge: Number(pathway.maxAge) };
  },

  // Existence-only check — kept for the current /availability route's { diagnosticAvailable }
  // shape. Thin wrapper over diagnosticInfo so there's one code path.
  async hasDiagnostic(pathwayIdOrSlug) {
    return (await this.diagnosticInfo(pathwayIdOrSlug)).available;
  },

  // POST /api/public/diagnostics/:pathwayIdOrSlug/submit — grades and returns the report ONLY.
  // No contact info is asked for: the anonymous visitor submits their answers and sees the graded
  // report straight away, with a shareable link to it. NO LEAD is created here — the visitor
  // enrols later via the normal /enroll form (which collects name/email), pre-filled with this
  // pathway. Every attempt is still stored (public_diagnostic_attempts, now with a nullable
  // leadId) for the shareable report link and for completion analytics.
  async submitDiagnostic(pathwayIdOrSlug, body, ipHash) {
    const { answers, childName, childAge } = body;
    const pathway = await resolveDesignatedPathway(pathwayIdOrSlug);
    if (!pathway) throw notFound("Pathway not found");
    if (!ageInRange(pathway, childAge)) throw notFound("No diagnostic available for this age");
    const assessment = await loadOfferableAssessment(pathway);
    if (!assessment) throw notFound("No public diagnostic configured for this pathway");

    // No AssessmentSubmissionModel row, no AssessmentIssueModel row, no
    // CompetencyService.placeLearner* call — those exist only to attach a result to a real,
    // enrolled learner, which doesn't exist here (see the migration's own comment on
    // public_diagnostic_attempts for why). Grading reuses the exact same utilities the
    // authenticated learner flow uses, imported directly — no fork.
    const { autoScore, itemResults } = computeAutoScore(assessment, answers);
    const maxScore = computeMaxScore(assessment);
    const indicatorBreakdown = computeIndicatorBreakdown(assessment, itemResults, []);

    const indicatorNames = await buildIndicatorNameMap();

    // The exact SANITIZED items the visitor answered — stored alongside `answers` so the
    // permanent report link (getAttemptReport below) renders the per-question section identically
    // even after an admin later edits/reorders/deletes questions on the live assessment.
    const itemsSnapshot = (assessment.items || []).map((item) => ({
      ...sanitizeItem(item),
      indicatorNames: (item.indicatorMarks || [])
        .map((m) => indicatorNames.get(m.indicatorId))
        .filter(Boolean),
    }));

    const attempt = await PublicDiagnosticAttemptModel.create({
      pathwayId: pathway.id,
      assessmentId: assessment.id,
      leadId: null, // no lead — enrolment happens later via /enroll
      childAge,
      childName: childName || null,
      answers,
      itemsSnapshot,
      itemResults, // stored, not re-derived — see the migration comment (sanitizeItem shuffles/blanks)
      totalScore: autoScore,
      maxScore,
      indicatorBreakdown,
      ipHash: ipHash || null,
    });

    return {
      attemptId: attempt.id,
      pathwayName: pathway.name,
      assessmentName: assessment.name,
      totalScore: autoScore,
      maxScore,
      itemResults,
      indicatorBreakdown: indicatorBreakdown.map((row) => ({
        ...row,
        name: indicatorNames.get(row.indicatorId) || null,
      })),
    };
  },

  // GET /api/public/diagnostics/attempts/:attemptId — the permanent, shareable report link.
  // `:attemptId` is the opaque uuid the submit response returned; it's unguessable, so the id in
  // the URL is the only access control (same posture as the QR-code learner-profile route). The
  // row is write-once and kept indefinitely, so this link never expires.
  //
  // Deliberately NARROW: pathway/assessment name, the child's first name + age (both may be
  // null — childName was optional at submit), score, per-competency breakdown, and the
  // per-question feedback rebuilt from the stored `answers` + `itemsSnapshot` pair. Never the
  // parent's name/email/phone (those live on the lead, admin-only), never the raw ipHash, never
  // anything that resolves the visitor's identity. Returns null → the controller's 404.
  async getAttemptReport(attemptId) {
    const attempt = await PublicDiagnosticAttemptModel.findById(attemptId);
    if (!attempt) return null;

    const [pathway, assessment, indicatorNames] = await Promise.all([
      PathwayModel.findById(attempt.pathwayId),
      AssessmentModel.findById(attempt.assessmentId),
      buildIndicatorNameMap(),
    ]);

    // The per-question section is rebuilt from the stored snapshot + stored results (NOT
    // re-graded — sanitizeItem shuffled/blanked the snapshot). A pre-snapshot attempt has
    // neither → empty arrays → the page shows score + competency breakdown only, still a valid
    // report.
    const items = Array.isArray(attempt.itemsSnapshot) ? attempt.itemsSnapshot : [];
    const itemResults = Array.isArray(attempt.itemResults) ? attempt.itemResults : [];

    return {
      attemptId: attempt.id,
      pathwayName: pathway?.name || "Pathway",
      assessmentName: assessment?.name || "Diagnostic",
      childName: attempt.childName || null,
      childAge: attempt.childAge ?? null,
      completedAt: attempt.createdAt,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      items, // the sanitized question set — carries `question`/`kind`, needed to render each row
      answers: attempt.answers || [], // the visitor's own responses, for "Your answer: …"
      itemResults,
      indicatorBreakdown: (attempt.indicatorBreakdown || []).map((row) => ({
        ...row,
        name: indicatorNames.get(row.indicatorId) || null,
      })),
    };
  },
};

module.exports = PublicDiagnosticService;
