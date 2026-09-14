const BootcampModel = require("./bootcamp.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CourseCurriculumLinkModel = require("../courses/course-curriculum-link.model");

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

const BootcampHubService = require("./bootcamp-hub.service");

const BootcampService = {
  async createBootcamp(data) {
    await assertCurriculumOwnedBy(data.curriculumId, data.ownerAdminId);
    await assertCoursePricingValid(data.coursePricing, data.curriculumId);
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
    }
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
