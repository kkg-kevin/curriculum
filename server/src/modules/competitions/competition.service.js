const CompetitionModel = require("./competition.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CourseCurriculumLinkModel = require("../courses/course-curriculum-link.model");

// A competition links directly to a curriculum (any curriculum from the Curriculum module — no
// special flag required) to inherit its pathway/course hierarchy. Kept as a display-only
// enrichment, never stored, so it can't drift.
async function resolveCurriculumName(curriculumId) {
  if (!curriculumId) return null;
  const curriculum = await CurriculumModel.findById(curriculumId);
  return curriculum?.name || null;
}

// createRecord/updateRecord return the record with `tracks` as whatever was written — a JSON
// string on create (it returns the stringified insert payload), a real array on a re-read.
// Normalise to an array so trackCount and the response shape are consistent either way.
function tracksArray(tracks) {
  if (Array.isArray(tracks)) return tracks;
  if (typeof tracks === "string") {
    try {
      const parsed = JSON.parse(tracks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Same JSON-column normalisation as tracksArray, reused for coursePricing.
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

async function enrich(competition) {
  if (!competition) return competition;
  const tracks = tracksArray(competition.tracks);
  return {
    ...competition,
    tracks,
    trackCount: tracks.length,
    coursePricing: asArray(competition.coursePricing),
    curriculumName: await resolveCurriculumName(competition.curriculumId),
  };
}

// A competition's curriculumId, when set, must point at a curriculum the SAME admin owns — a
// competition can't be attached to another tenant's curriculum. Mirrors
// bootcamp.service.js's assertCurriculumOwnedBy.
async function assertCurriculumOwnedBy(curriculumId, ownerAdminId) {
  if (!curriculumId) return;
  const curriculum = await CurriculumModel.findById(curriculumId);
  if (!curriculum || curriculum.ownerAdminId !== ownerAdminId) {
    const err = new Error("That curriculum doesn't exist or belongs to a different admin");
    err.statusCode = 400;
    throw err;
  }
}

// Every priced course must actually belong to the (effective) curriculum. Mirrors
// bootcamp.service.js's assertCoursePricingValid.
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
}

const CompetitionHubService = require("./competition-hub.service");

const CompetitionService = {
  async createCompetition(data) {
    await assertCurriculumOwnedBy(data.curriculumId, data.ownerAdminId);
    await assertCoursePricingValid(data.coursePricing, data.curriculumId);
    const record = await CompetitionModel.create(data);
    return enrich(record);
  },

  async getAllCompetitions(filters) {
    const records = await CompetitionModel.findAll(filters);
    return Promise.all(records.map(enrich));
  },

  async getCompetitionById(id) {
    const record = await CompetitionModel.findById(id);
    if (!record) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    return enrich(record);
  },

  async updateCompetition(id, data, ownerAdminId) {
    const existing = await CompetitionModel.findById(id);
    if (!existing) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    // curriculumId may be absent from a partial patch — only re-check when it's actually changing.
    if ("curriculumId" in data) await assertCurriculumOwnedBy(data.curriculumId, ownerAdminId);
    if ("coursePricing" in data) {
      const effectiveCurriculumId = "curriculumId" in data ? data.curriculumId : existing.curriculumId;
      await assertCoursePricingValid(data.coursePricing, effectiveCurriculumId);
    }
    const record = await CompetitionModel.update(id, data);
    return enrich(record);
  },

  // Deleting a competition must not orphan its hub-offerings (and the Classes those created) —
  // same posture as CurriculumService.deleteCurriculum's cascade.
  async deleteCompetition(id) {
    await CompetitionHubService.deleteByCompetitionId(id);
    const deleted = await CompetitionModel.delete(id);
    if (!deleted) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Competition deleted successfully" };
  },

  // Every competition linked to a given curriculum — feeds the curriculum view's
  // "Competitions" section and CurriculumService.deleteCurriculum's cascade.
  async getByCurriculum(curriculumId) {
    const records = await CompetitionModel.findAll({ curriculumId });
    return Promise.all(records.map(enrich));
  },

  // Called from CurriculumService.deleteCurriculum when a curriculum is deleted — detach its
  // competitions rather than orphan them with a dangling curriculumId. A competition survives
  // its curriculum; only its hub-offerings and the Classes those created are cascade-deleted.
  async unlinkCurriculum(curriculumId) {
    if (!curriculumId) return;
    const records = await CompetitionModel.findAll({ curriculumId });
    await Promise.all(records.map((c) => CompetitionModel.update(c.id, { curriculumId: null })));
  },
};

module.exports = CompetitionService;
