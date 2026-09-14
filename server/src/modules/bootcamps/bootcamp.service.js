const BootcampModel = require("./bootcamp.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CourseCurriculumLinkModel = require("../courses/course-curriculum-link.model");
const ModuleModel = require("../courses/module.model");
const AssessmentModel = require("../assessments/assessment.model");
const { requiresManualGrading } = require("../assessments/submissions/grading.utils");

// A bootcamp links directly to a curriculum (any curriculum from the Curriculum module — no
// special flag required) to inherit its pathway/course hierarchy. Kept as a display-only
// enrichment, never stored, so it can't drift.
async function resolveCurriculumName(curriculumId) {
  if (!curriculumId) return null;
  const curriculum = await CurriculumModel.findById(curriculumId);
  return curriculum?.name || null;
}

// createRecord/updateRecord return the record with a JSON field as whatever was written — a
// JSON string on create (it returns the stringified insert payload), a real array on a
// re-read. Normalise to an array so the response shape is consistent either way.
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function enrich(bootcamp) {
  if (!bootcamp) return bootcamp;
  return {
    ...bootcamp,
    highlights: asArray(bootcamp.highlights),
    coursePricing: asArray(bootcamp.coursePricing),
    priceNotes: asArray(bootcamp.priceNotes),
    curriculumName: await resolveCurriculumName(bootcamp.curriculumId),
  };
}

// A bootcamp's curriculumId, when set, must point at a curriculum the SAME admin owns — a
// bootcamp can't be attached to another tenant's curriculum. Mirrors
// competition.service.js's assertCurriculumOwnedBy.
async function assertCurriculumOwnedBy(curriculumId, ownerAdminId) {
  if (!curriculumId) return;
  const curriculum = await CurriculumModel.findById(curriculumId);
  if (!curriculum || curriculum.ownerAdminId !== ownerAdminId) {
    const err = new Error("That curriculum doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
}

// Every priced course must actually belong to the (effective) curriculum — a Zod string alone
// can't confirm that, and without this check a bootcamp could carry a stale/foreign courseId
// once its curriculum is unset or swapped. Mirrors competition.service.js's version.
//
// Also validates each course entry's modulePricing (the per-course "price by module instead"
// addition, see coursePriceSchema's comment): every moduleId must actually belong to THAT
// specific course — two hops from the curriculum (curriculum -> linked course -> that course's
// own modules), since there's no direct curriculum-to-module link table to query.
async function assertCoursePricingValid(coursePricing, curriculumId) {
  if (!coursePricing || coursePricing.length === 0) return;
  if (!curriculumId) {
    const err = new Error("Course pricing requires a curriculum to be selected");
    err.statusCode = 400;
    throw err;
  }
  const links = await CourseCurriculumLinkModel.findByCurriculumId(curriculumId);
  const validCourseIds = new Set(links.map((l) => l.courseId));
  const unknown = coursePricing.find((cp) => !validCourseIds.has(cp.courseId));
  if (unknown) {
    const err = new Error("One or more priced courses don't belong to the selected curriculum");
    err.statusCode = 400;
    throw err;
  }

  const withModulePricing = coursePricing.filter((cp) => (cp.modulePricing || []).length > 0);
  if (withModulePricing.length === 0) return;
  const modulesByCourse = await Promise.all(withModulePricing.map((cp) => ModuleModel.findByCourseId(cp.courseId)));
  withModulePricing.forEach((cp, i) => {
    const validModuleIds = new Set(modulesByCourse[i].map((m) => m.id));
    const unknownModule = cp.modulePricing.find((mp) => !validModuleIds.has(mp.moduleId));
    if (unknownModule) {
      const err = new Error("One or more priced modules don't belong to their course");
      err.statusCode = 400;
      throw err;
    }
  });
}

// A bootcamp is priced ONE way, not both: either a single whole-bootcamp price, or individual
// course prices — never both at once, so a buyer never sees two conflicting numbers for the same
// bootcamp. `coursePricing` "in use" means at least one course has been checked on in the
// builder, even before an amount is typed in (see CoursePricingField.jsx — checking the box adds
// a {courseId, priceAmount: null} entry immediately), so this checks array length, not whether
// any entry actually carries a priceAmount yet.
function assertPricingModeExclusive(priceAmount, coursePricing) {
  if (priceAmount != null && (coursePricing || []).length > 0) {
    const err = new Error("Price the whole bootcamp or individual courses, not both — clear one before setting the other");
    err.statusCode = 400;
    throw err;
  }
}

// Same either/or, one level down: a priced course entry carries EITHER its own priceAmount OR a
// non-empty modulePricing (priced by module instead), never both. Zod's superRefine already
// catches this on create/update (bootcamp.validation.js), but service-level callers (e.g. a
// direct API integration bypassing the client form) still need it enforced here too.
function assertCourseEntryPricingValid(coursePricing) {
  const conflict = (coursePricing || []).find((cp) => cp.priceAmount != null && (cp.modulePricing || []).length > 0);
  if (conflict) {
    const err = new Error("Price the whole course or its modules, not both — clear one before setting the other");
    err.statusCode = 400;
    throw err;
  }
}

// publicDiagnosticEnabled can only be true if the EFFECTIVE diagnosticAssessmentId (the incoming
// value if this request sets one, else whatever the bootcamp already has) resolves to an
// assessment that's fully auto-gradable — a public website visitor has no teacher relationship to
// route a manually-graded attempt to. Mirrors competency.service.js's
// assertPublicDiagnosticAllowed for pathways exactly, including why this lives here rather than
// in bootcamp.validation.js's Zod schema (an update patch can flip publicDiagnosticEnabled on
// without touching diagnosticAssessmentId — only the service layer has both the existing row and
// the incoming patch to resolve the effective value from).
async function assertPublicDiagnosticAllowed(data, existingBootcamp) {
  if (!data.publicDiagnosticEnabled) return;
  const effectiveAssessmentId =
    "diagnosticAssessmentId" in data ? data.diagnosticAssessmentId : existingBootcamp?.diagnosticAssessmentId;
  if (!effectiveAssessmentId) {
    const err = new Error("Set a diagnostic assessment before offering it publicly");
    err.statusCode = 400;
    throw err;
  }
  const assessment = await AssessmentModel.findById(effectiveAssessmentId);
  if (!assessment) {
    const err = new Error("Diagnostic assessment not found");
    err.statusCode = 404;
    throw err;
  }
  if (requiresManualGrading(assessment)) {
    const err = new Error("This assessment includes manually-graded items and can't be used for the public diagnostic");
    err.statusCode = 400;
    throw err;
  }
}

const BootcampHubService = require("./bootcamp-hub.service");

const BootcampService = {
  async createBootcamp(data) {
    await assertCurriculumOwnedBy(data.curriculumId, data.ownerAdminId);
    await assertCoursePricingValid(data.coursePricing, data.curriculumId);
    assertPricingModeExclusive(data.priceAmount, data.coursePricing);
    assertCourseEntryPricingValid(data.coursePricing);
    await assertPublicDiagnosticAllowed(data, null);
    const record = await BootcampModel.create(data);
    return enrich(record);
  },

  async getAllBootcamps(filters) {
    const records = await BootcampModel.findAll(filters);
    return Promise.all(records.map(enrich));
  },

  async getBootcampById(id) {
    const record = await BootcampModel.findById(id);
    if (!record) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(record);
  },

  async updateBootcamp(id, data, ownerAdminId) {
    const existing = await BootcampModel.findById(id);
    if (!existing) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    // curriculumId may be absent from a partial patch — only re-check when it's actually changing.
    if ("curriculumId" in data) await assertCurriculumOwnedBy(data.curriculumId, ownerAdminId);
    if ("coursePricing" in data) {
      const effectiveCurriculumId = "curriculumId" in data ? data.curriculumId : existing.curriculumId;
      await assertCoursePricingValid(data.coursePricing, effectiveCurriculumId);
      assertCourseEntryPricingValid(data.coursePricing);
    }
    // Same "effective value" pattern as curriculumId above — a patch touching only ONE of the two
    // pricing modes still needs to be checked against whichever value the other one already has.
    if ("priceAmount" in data || "coursePricing" in data) {
      const effectivePriceAmount = "priceAmount" in data ? data.priceAmount : existing.priceAmount;
      const effectiveCoursePricing = "coursePricing" in data ? data.coursePricing : existing.coursePricing;
      assertPricingModeExclusive(effectivePriceAmount, effectiveCoursePricing);
    }
    await assertPublicDiagnosticAllowed(data, existing);
    const record = await BootcampModel.update(id, data);
    return enrich(record);
  },

  // Deleting a bootcamp must not orphan its hub-offerings (and the Classes those created) —
  // same "clean up everything this record's own life depended on" posture as
  // CurriculumService.deleteCurriculum's cascade.
  async deleteBootcamp(id) {
    await BootcampHubService.deleteByBootcampId(id);
    const deleted = await BootcampModel.delete(id);
    if (!deleted) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Bootcamp deleted successfully" };
  },

  // Every bootcamp linked to a given curriculum — feeds the curriculum view's "Bootcamps"
  // section and CurriculumService.deleteCurriculum's cascade.
  async getByCurriculum(curriculumId) {
    const records = await BootcampModel.findAll({ curriculumId });
    return Promise.all(records.map(enrich));
  },

  // Called from CurriculumService.deleteCurriculum when a curriculum is deleted — detach its
  // bootcamps rather than orphan them with a dangling curriculumId. A bootcamp survives its
  // curriculum (it's a sellable listing with a life of its own); only its hub-offerings and the
  // Classes those created are cascade-deleted (see deleteBootcamp/BootcampHubService above).
  async unlinkCurriculum(curriculumId) {
    if (!curriculumId) return;
    const records = await BootcampModel.findAll({ curriculumId });
    await Promise.all(records.map((b) => BootcampModel.update(b.id, { curriculumId: null })));
  },
};

module.exports = BootcampService;
