const BootcampHubModel = require("./bootcamp-hub.model");
const BootcampModel = require("./bootcamp.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const { computeStatus, classIdsArray, cohortClassPayload } = require("../../shared/utils/hub-offering.utils");

// Lazy require, not a top-level one: class.service.js -> curriculum-versions.service.js ->
// timetable.service.js -> this file -> class.service.js is a real circular require (timetable
// needs this file's getDateWindowForClass, this file needs ClassService.bulkCreateClasses/
// deleteClass). Whichever of these files starts loading first becomes the outer frame, and a
// top-level `require("../classes/class.service")` here would then resolve to class.service.js's
// *pre-export* module.exports (still `{}`) partway through its own initialization — same failure
// mode curriculum.service.js's own header comment documents for its symmetrical case. Requiring
// inside each function instead defers the lookup until Node has finished populating the real
// module.exports object, by which point every caller in the app has already finished loading.
function getClassService() {
  return require("../classes/class.service");
}

const BootcampHubService = {
  // Runs an already-authored bootcamp (linked to a curriculum from the Curriculum module) at a
  // hub as real Classes — one per cohort already defined in curriculum.classes, same idea as
  // "Set Up Year" bulk-creating a class per grade for a regular curriculum, and a direct
  // successor to event.service.js's createEvent. Nothing is authored here.
  async createOffering({ bootcampId, hubId, ownerAdminId }) {
    const bootcamp = await BootcampModel.findById(bootcampId);
    if (!bootcamp || bootcamp.ownerAdminId !== ownerAdminId) {
      const err = new Error("Bootcamp not found");
      err.statusCode = 404;
      throw err;
    }
    if (!bootcamp.startDate || !bootcamp.endDate) {
      const err = new Error("Set this bootcamp's start and end dates before running it at a hub.");
      err.statusCode = 400;
      throw err;
    }
    if (!bootcamp.curriculumId) {
      const err = new Error("Link this bootcamp to a curriculum before running it at a hub.");
      err.statusCode = 400;
      throw err;
    }
    const curriculum = await CurriculumModel.findById(bootcamp.curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    if (!(curriculum.classes || []).length) {
      const err = new Error("This curriculum has no cohorts defined yet — add one on its Structure step first");
      err.statusCode = 400;
      throw err;
    }
    const hub = await LearningHubModel.findById(hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    // One bootcamp can run at a given hub only once — its dates are now uniform across every
    // hub it runs at (no per-hub override), so a second run at the same hub would always
    // overlap the first. Re-running the bootcamp there in a later term needs a new bootcamp
    // record instead. Replaces event.service.js's date-overlap check, which is no longer
    // structurally possible to violate.
    if (await BootcampHubModel.findByBootcampAndHub(bootcampId, hubId)) {
      const err = new Error("This bootcamp already runs at that hub.");
      err.statusCode = 409;
      throw err;
    }

    // Routed through ClassService (same path as "Set Up Year" / the old Event deployment) so
    // the tag/stream uniqueness checks run here too.
    const classes = await getClassService().bulkCreateClasses(cohortClassPayload(hub, curriculum, bootcamp.startDate));

    const offering = await BootcampHubModel.create({
      ownerAdminId,
      bootcampId,
      hubId,
      classIds: classes.map((c) => c.id),
    });
    return this.enrich(offering);
  },

  // Merges in display-only data — resolved fresh each read, never stored, so it can't drift.
  // Status comes from the PARENT bootcamp's dates (uniform across every hub), not from
  // anything stored on the offering row itself.
  async enrich(offering) {
    const bootcamp = await BootcampModel.findById(offering.bootcampId);
    const hub = await LearningHubModel.findById(offering.hubId);
    const classIds = classIdsArray(offering.classIds);
    const resolvedClasses = await Promise.all(classIds.map((id) => ClassModel.findById(id)));
    const classes = resolvedClasses.filter(Boolean);
    const classesWithCounts = await Promise.all(classes.map(async (cls) => ({
      id: cls.id,
      gradeName: cls.gradeName,
      learnerCount: (await LearnerHubLinkModel.findByClassId(cls.id)).length,
    })));
    const learnerCount = classesWithCounts.reduce((sum, cls) => sum + cls.learnerCount, 0);
    return {
      ...offering,
      status: bootcamp?.startDate && bootcamp?.endDate ? computeStatus(bootcamp.startDate, bootcamp.endDate) : null,
      hubName: hub?.name || null,
      classes: classesWithCounts,
      learnerCount,
    };
  },

  async getOfferingsForBootcamp(bootcampId) {
    const offerings = await BootcampHubModel.findByBootcampId(bootcampId);
    return Promise.all(offerings.map((o) => this.enrich(o)));
  },

  // Removing an offering deletes the Classes it created too (a change from the old Event
  // un-deploy, which left them standing) — there's no longer any UI path to a "detached" class
  // once its offering is gone, and the curriculum-delete cascade already deletes them this way.
  async deleteOffering(id) {
    const offering = await BootcampHubModel.findById(id);
    if (!offering) {
      const err = new Error("Offering not found");
      err.statusCode = 404;
      throw err;
    }
    for (const classId of classIdsArray(offering.classIds)) {
      // eslint-disable-next-line no-await-in-loop
      if (await ClassModel.findById(classId)) await getClassService().deleteClass(classId);
    }
    await BootcampHubModel.delete(id);
    return { message: "Offering removed successfully" };
  },

  // Called from BootcampService.deleteBootcamp / CurriculumService.deleteCurriculum's cascade
  // — a bootcamp being deleted (or detached from a deleted curriculum) must not leave its
  // hub-offerings and their Classes orphaned.
  async deleteByBootcampId(bootcampId) {
    const offerings = await BootcampHubModel.findByBootcampId(bootcampId);
    for (const offering of offerings) {
      // eslint-disable-next-line no-await-in-loop
      for (const classId of classIdsArray(offering.classIds)) {
        // eslint-disable-next-line no-await-in-loop
        if (await ClassModel.findById(classId)) await getClassService().deleteClass(classId);
      }
    }
    await BootcampHubModel.deleteByBootcampId(bootcampId);
  },

  // classId -> {startDate, endDate} | null, for the timetable engine — replaces
  // EventModel.findByClassId + reading dates straight off the event row. Dates come from the
  // PARENT bootcamp, not the offering.
  async getDateWindowForClass(classId) {
    const offering = await BootcampHubModel.findByClassId(classId);
    if (!offering) return null;
    const bootcamp = await BootcampModel.findById(offering.bootcampId);
    if (!bootcamp?.startDate || !bootcamp?.endDate) return null;
    return { startDate: bootcamp.startDate, endDate: bootcamp.endDate };
  },
};

module.exports = BootcampHubService;
