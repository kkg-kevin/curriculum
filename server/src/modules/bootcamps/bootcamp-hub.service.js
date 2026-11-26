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

// The stream label on a bootcamp's cohort classes. A bootcamp run more than once ("Schedule another
// run", a shared seriesId) adds the run's start date — its runs share a name, and two in the same
// year at the same hub would otherwise make the same class twice (classes are unique by hub,
// cohort, year and stream). Kept within classes.streamName's 100 characters.
function streamLabelFor(bootcamp) {
  if (!bootcamp.seriesId) return bootcamp.name;
  const day = new Date(`${bootcamp.startDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const suffix = ` · ${day}`;
  return `${bootcamp.name.slice(0, 100 - suffix.length)}${suffix}`;
}

// The curriculum's cohorts (Structure step) that have no class among these.
function missingCohortsOf(curriculum, classes) {
  const have = new Set(classes.map((c) => c.gradeId).filter(Boolean));
  return (curriculum?.classes || []).filter((cohort) => cohort?.id && !have.has(cohort.id));
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
    // record instead — "Schedule another run" (BootcampService.scheduleRun) makes one. Replaces event.service.js's date-overlap check, which is no longer
    // structurally possible to violate.
    if (await BootcampHubModel.findByBootcampAndHub(bootcampId, hubId)) {
      const err = new Error("This bootcamp already runs at that hub.");
      err.statusCode = 409;
      throw err;
    }

    // Routed through ClassService (same path as "Set Up Year" / the old Event deployment) so
    // the tag/stream uniqueness checks run here too. The bootcamp's own name is passed as the
    // stream label so a second, different bootcamp built on this SAME curriculum can still run
    // at this same hub without colliding with this one's cohort classes — see
    // cohortClassPayload's own comment for why that's otherwise a false "already exists" error.
    const classes = await getClassService().bulkCreateClasses(cohortClassPayload(hub, curriculum, bootcamp.startDate, streamLabelFor(bootcamp)));

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
    const curriculum = bootcamp?.curriculumId ? await CurriculumModel.findById(bootcamp.curriculumId) : null;
    return {
      ...offering,
      status: bootcamp?.startDate && bootcamp?.endDate ? computeStatus(bootcamp.startDate, bootcamp.endDate) : null,
      hubName: hub?.name || null,
      classes: classesWithCounts,
      learnerCount,
      // Cohorts on the curriculum's Structure step with no class here yet ("Add missing classes").
      missingCohorts: missingCohortsOf(curriculum, classes).map((c) => ({ id: c.id, name: c.name })),
    };
  },

  // A cohort added to the curriculum after the bootcamp was put at this hub gets no class there by
  // itself (classes are made once, when the hub is added). This makes the missing ones — the same
  // way, with the run's stream label — and adds them to the hub's run. Nothing else changes: the
  // classes and learners already there stay as they are. Safe to repeat.
  async addMissingClasses(offeringId, bootcampId) {
    const offering = await BootcampHubModel.findById(offeringId);
    if (!offering || offering.bootcampId !== bootcampId) {
      const err = new Error("This bootcamp doesn't run at that hub");
      err.statusCode = 404;
      throw err;
    }
    const bootcamp = await BootcampModel.findById(offering.bootcampId);
    const curriculum = bootcamp?.curriculumId ? await CurriculumModel.findById(bootcamp.curriculumId) : null;
    if (!curriculum) {
      const err = new Error("Link this bootcamp to a curriculum first");
      err.statusCode = 400;
      throw err;
    }
    const hub = await LearningHubModel.findById(offering.hubId);
    const classIds = classIdsArray(offering.classIds);
    const current = (await Promise.all(classIds.map((id) => ClassModel.findById(id)))).filter(Boolean);
    const missing = missingCohortsOf(curriculum, current);
    if (!missing.length) return { added: [], offering: await this.enrich(offering) };
    const created = await getClassService().bulkCreateClasses(
      cohortClassPayload(hub, { ...curriculum, classes: missing }, bootcamp.startDate, streamLabelFor(bootcamp)),
    );
    await BootcampHubModel.update(offering.id, { classIds: [...classIds, ...created.map((c) => c.id)] });
    return {
      added: created.map((c) => ({ id: c.id, gradeName: c.gradeName })),
      offering: await this.enrich(await BootcampHubModel.findById(offering.id)),
    };
  },

  // bootcampId -> how many hubs it runs at, for a list of bootcamps (a bootcamp's runs).
  async countByBootcampIds(bootcampIds) {
    const counts = new Map();
    for (const id of bootcampIds) {
      // eslint-disable-next-line no-await-in-loop
      counts.set(id, (await BootcampHubModel.findByBootcampId(id)).length);
    }
    return counts;
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

// A run's classes named with the bare bootcamp name (made before it had a second run) take the
// run's date too, once it has — so two runs of one bootcamp at one hub never read the same.
// Only ever renames a stream still exactly the bootcamp's name; safe to repeat.
BootcampHubService.dateRunClasses = async function dateRunClasses(bootcampId) {
  const bootcamp = await BootcampModel.findById(bootcampId);
  if (!bootcamp?.seriesId || !bootcamp.startDate) return 0;
  const label = streamLabelFor(bootcamp);
  let renamed = 0;
  for (const offering of await BootcampHubModel.findByBootcampId(bootcampId)) {
    for (const classId of classIdsArray(offering.classIds)) {
      // eslint-disable-next-line no-await-in-loop
      const cls = await ClassModel.findById(classId);
      if (!cls || cls.streamName !== bootcamp.name || cls.streamName === label) continue;
      // eslint-disable-next-line no-await-in-loop
      await ClassModel.update(cls.id, { streamName: label });
      renamed += 1;
    }
  }
  return renamed;
};

module.exports = BootcampHubService;
module.exports.streamLabelFor = streamLabelFor;
