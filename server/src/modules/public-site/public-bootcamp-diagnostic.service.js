const AssessmentModel = require("../assessments/assessment.model");
const BootcampModel = require("../bootcamps/bootcamp.model");
const CompetencyModel = require("../settings/competencies/competency.model");
const PublicBootcampDiagnosticAttemptModel = require("./public-bootcamp-diagnostic-attempt.model");
const LeadModel = require("../leads/lead.model");
const LeadService = require("../leads/lead.service");
const { slugify } = require("../../shared/utils/slugify");
const { resolveForSaleBootcamp } = require("./public-bootcamp.service");
const {
  requiresManualGrading,
  computeAutoScore,
  computeMaxScore,
  computeIndicatorBreakdown,
} = require("../assessments/submissions/grading.utils");

// The Bootcamp counterpart to public-diagnostic.service.js (Pathways) — same feature (an
// anonymous website visitor takes a short auto-graded quiz before enrolling, gets an instant
// "learner profile" report), scoped to a Bootcamp instead of a Pathway. Deliberately a PARALLEL
// implementation, not a generalization of the pathway one — see the
// 20260914130100_create_public_bootcamp_diagnostic_attempts migration's header comment for why:
// a bootcamp isn't a pathway (curriculumId may point at zero/one/many pathways), so it needed its
// own gating fields (bootcamps.diagnosticAssessmentId/publicDiagnosticEnabled, added by
// 20260914130000) rather than borrowing a pathway's. Every grading/report/sanitization function
// below is copied verbatim from public-diagnostic.service.js (not pathway-specific to begin with
// — see that file's own functions), only the resolution/gating layer differs.

function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

// Whether this bootcamp's diagnostic is actually offerable to an anonymous visitor right now.
// Same posture as public-diagnostic.service.js's loadOfferableAssessment: live re-check (the flag
// and the assessment are independently editable), fails safe on an incomplete age range.
async function loadOfferableAssessment(bootcamp) {
  if (!bootcamp?.publicDiagnosticEnabled || !bootcamp.diagnosticAssessmentId) return null;
  if (!hasCompleteAgeRange(bootcamp)) return null;
  const assessment = await AssessmentModel.findById(bootcamp.diagnosticAssessmentId);
  if (!assessment || requiresManualGrading(assessment)) return null;
  return assessment;
}

// A public diagnostic needs an explicit min AND max age — a missing bound is "not configured",
// not "unbounded". Reads the bootcamp's own EXISTING ageMin/ageMax columns (same fields the
// bootcamp already uses for its own marketing age-range chip), not a second range.
function hasCompleteAgeRange(bootcamp) {
  return (
    bootcamp?.ageMin != null &&
    bootcamp?.ageMax != null &&
    Number(bootcamp.ageMin) <= Number(bootcamp.ageMax)
  );
}

function ageInRange(bootcamp, age) {
  if (age == null || !hasCompleteAgeRange(bootcamp)) return false;
  return age >= Number(bootcamp.ageMin) && age <= Number(bootcamp.ageMax);
}

// Item projection sent to an anonymous visitor — identical to public-diagnostic.service.js's
// sanitizeItem (see that file's own comment for the per-kind reasoning): strips/neutralises every
// field that would let a visitor reconstruct the correct answer before grading.
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

// { indicatorId -> { name, competencyId, competencyName } } — identical to
// public-diagnostic.service.js's buildIndicatorMeta.
async function buildIndicatorMeta() {
  const competencies = await CompetencyModel.findAll();
  const map = new Map();
  competencies.forEach((c) =>
    (c.indicators || []).forEach((i) =>
      map.set(i.id, { name: i.name, competencyId: c.id, competencyName: c.name }),
    ),
  );
  return map;
}

// Identical to public-diagnostic.service.js's groupByCompetency.
function groupByCompetency(indicatorBreakdown, indicatorMeta) {
  const byCompetency = new Map();
  for (const row of indicatorBreakdown || []) {
    const meta = indicatorMeta.get(row.indicatorId);
    const competencyId = meta?.competencyId || `indicator:${row.indicatorId}`;
    const competencyName = meta?.competencyName || "Other";
    if (!byCompetency.has(competencyId)) {
      byCompetency.set(competencyId, { competencyId, name: competencyName, marksEarned: 0, marksPossible: 0, indicators: [] });
    }
    const bucket = byCompetency.get(competencyId);
    bucket.marksEarned = Math.round((bucket.marksEarned + (Number(row.marksEarned) || 0)) * 100) / 100;
    bucket.marksPossible += Number(row.marksPossible) || 0;
    bucket.indicators.push({
      indicatorId: row.indicatorId,
      name: meta?.name || null,
      marksEarned: Number(row.marksEarned) || 0,
      marksPossible: Number(row.marksPossible) || 0,
    });
  }
  return [...byCompetency.values()];
}

const PublicBootcampDiagnosticService = {
  // GET /api/public/bootcamp-diagnostics/:bootcampIdOrSlug?age=<int> — same "return null for
  // every nothing-to-show case" posture as the pathway version: unknown bootcamp, age out of
  // range, no diagnostic offerable are all indistinguishable to an anonymous caller.
  async getDiagnostic(bootcampIdOrSlug, age) {
    const bootcamp = await resolveForSaleBootcamp(bootcampIdOrSlug);
    if (!bootcamp) return null;
    if (!ageInRange(bootcamp, age)) return null;
    const assessment = await loadOfferableAssessment(bootcamp);
    if (!assessment) return null;

    const indicatorMeta = await buildIndicatorMeta();
    return {
      bootcampId: bootcamp.id,
      bootcampName: bootcamp.name,
      assessmentId: assessment.id,
      name: assessment.name,
      instructions: assessment.instructions || "",
      minAge: Number(bootcamp.ageMin),
      maxAge: Number(bootcamp.ageMax),
      items: (assessment.items || []).map((item) => ({
        ...sanitizeItem(item),
        indicatorNames: (item.indicatorMarks || [])
          .map((m) => indicatorMeta.get(m.indicatorId)?.name)
          .filter(Boolean),
      })),
    };
  },

  // Availability check for BootcampDetailPage's CTA — same shape as the pathway version's
  // diagnosticInfo.
  async diagnosticInfo(bootcampIdOrSlug) {
    const bootcamp = await resolveForSaleBootcamp(bootcampIdOrSlug);
    if (!bootcamp) return { available: false, minAge: null, maxAge: null };
    const assessment = await loadOfferableAssessment(bootcamp);
    if (!assessment) return { available: false, minAge: null, maxAge: null };
    return { available: true, minAge: Number(bootcamp.ageMin), maxAge: Number(bootcamp.ageMax) };
  },

  async hasDiagnostic(bootcampIdOrSlug) {
    return (await this.diagnosticInfo(bootcampIdOrSlug)).available;
  },

  // POST /api/public/bootcamp-diagnostics/:bootcampIdOrSlug/submit — grades, creates a lead,
  // returns the report. Same shape as the pathway version's submitDiagnostic.
  async submitDiagnostic(bootcampIdOrSlug, body, ipHash) {
    const { answers, parentName, parentPhone, childName, childAge } = body;
    const bootcamp = await resolveForSaleBootcamp(bootcampIdOrSlug);
    if (!bootcamp) throw notFound("Bootcamp not found");
    if (!ageInRange(bootcamp, childAge)) throw notFound("No diagnostic available for this age");
    const assessment = await loadOfferableAssessment(bootcamp);
    if (!assessment) throw notFound("No public diagnostic configured for this bootcamp");

    const { autoScore, itemResults } = computeAutoScore(assessment, answers);
    const maxScore = computeMaxScore(assessment);
    const indicatorBreakdown = computeIndicatorBreakdown(assessment, itemResults, []);

    const indicatorMeta = await buildIndicatorMeta();

    const itemsSnapshot = (assessment.items || []).map((item) => ({
      ...sanitizeItem(item),
      indicatorNames: (item.indicatorMarks || [])
        .map((m) => indicatorMeta.get(m.indicatorId)?.name)
        .filter(Boolean),
    }));

    let leadId = null;
    try {
      const bootcampSlug = slugify(bootcamp.name) || "bootcamp";
      const lead = await LeadModel.create({
        source: "diagnostic",
        name: parentName,
        email: null,
        phone: parentPhone,
        learnerName: childName || null,
        learnerAge: childAge,
        interestedIn: "bootcamp",
        referenceId: bootcampSlug,
        message:
          `Completed the ${bootcamp.name} diagnostic — scored ${autoScore}/${maxScore}` +
          `${childName ? ` for ${childName}` : ""} (age ${childAge}).`,
      });
      leadId = lead.id;
      await LeadService._notifyAdmins(lead);
    } catch {
      /* lead capture failed — the report still goes out */
    }

    const attempt = await PublicBootcampDiagnosticAttemptModel.create({
      bootcampId: bootcamp.id,
      assessmentId: assessment.id,
      leadId,
      childAge,
      childName: childName || null,
      answers,
      itemsSnapshot,
      itemResults,
      totalScore: autoScore,
      maxScore,
      indicatorBreakdown,
      ipHash: ipHash || null,
    });

    return {
      attemptId: attempt.id,
      bootcampName: bootcamp.name,
      assessmentName: assessment.name,
      totalScore: autoScore,
      maxScore,
      itemResults,
      indicatorBreakdown: indicatorBreakdown.map((row) => ({
        ...row,
        name: indicatorMeta.get(row.indicatorId)?.name || null,
      })),
      competencyBreakdown: groupByCompetency(indicatorBreakdown, indicatorMeta),
    };
  },

  // GET /api/public/bootcamp-diagnostics/attempts/:attemptId — the permanent shareable report
  // link. Same narrow field selection as the pathway version — never parent name/phone/leadId/
  // ipHash.
  async getAttemptReport(attemptId) {
    const attempt = await PublicBootcampDiagnosticAttemptModel.findById(attemptId);
    if (!attempt) return null;

    const [bootcamp, assessment, indicatorMeta] = await Promise.all([
      BootcampModel.findById(attempt.bootcampId),
      AssessmentModel.findById(attempt.assessmentId),
      buildIndicatorMeta(),
    ]);

    const storedBreakdown = Array.isArray(attempt.indicatorBreakdown) ? attempt.indicatorBreakdown : [];

    return {
      attemptId: attempt.id,
      bootcampName: bootcamp?.name || "Bootcamp",
      assessmentName: assessment?.name || "Diagnostic",
      childName: attempt.childName || null,
      childAge: attempt.childAge ?? null,
      completedAt: attempt.createdAt,
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      indicatorBreakdown: storedBreakdown.map((row) => ({
        ...row,
        name: indicatorMeta.get(row.indicatorId)?.name || null,
      })),
      competencyBreakdown: groupByCompetency(storedBreakdown, indicatorMeta),
    };
  },
};

module.exports = PublicBootcampDiagnosticService;
