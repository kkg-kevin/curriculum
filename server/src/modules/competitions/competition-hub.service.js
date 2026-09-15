const CompetitionHubModel = require("./competition-hub.model");
const CompetitionModel = require("./competition.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const { computeStatus, classIdsArray, cohortClassPayload } = require("../../shared/utils/hub-offering.utils");

// Lazy require, not a top-level one — see bootcamp-hub.service.js's identical getClassService()
// for the full explanation: class.service.js -> curriculum-versions.service.js ->
// timetable.service.js -> this file -> class.service.js is a real circular require, and a
// top-level require here can resolve to class.service.js's pre-export {} depending on load order.
function getClassService() {
  return require("../classes/class.service");
}

const CompetitionHubService = {
  // Runs an already-authored competition (linked to a curriculum from the Curriculum module) at
  // a hub as real Classes — one per cohort already defined in curriculum.classes. Direct
  // successor to event.service.js's createEvent.
  async createOffering({ competitionId, hubId, ownerAdminId }) {
    const competition = await CompetitionModel.findById(competitionId);
    if (!competition || competition.ownerAdminId !== ownerAdminId) {
      const err = new Error("Competition not found");
      err.statusCode = 404;
      throw err;
    }
    if (!competition.startDate || !competition.endDate) {
      const err = new Error("Set this competition's start and end dates before running it at a hub.");
      err.statusCode = 400;
      throw err;
    }
    if (!competition.curriculumId) {
      const err = new Error("Link this competition to a curriculum before running it at a hub.");
      err.statusCode = 400;
      throw err;
    }
    const curriculum = await CurriculumModel.findById(competition.curriculumId);
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
    // One competition can run at a given hub only once — its dates are now uniform across
    // every hub it runs at, so a second run at the same hub would always overlap the first.
    if (await CompetitionHubModel.findByCompetitionAndHub(competitionId, hubId)) {
      const err = new Error("This competition already runs at that hub.");
      err.statusCode = 409;
      throw err;
    }

    // The competition's own name is passed as the stream label so a second, different
    // competition (or bootcamp) built on this SAME curriculum can still run at this same hub
    // without colliding with this one's cohort classes — see cohortClassPayload's own comment.
    const classes = await getClassService().bulkCreateClasses(cohortClassPayload(hub, curriculum, competition.startDate, competition.name));

    const offering = await CompetitionHubModel.create({
      ownerAdminId,
      competitionId,
      hubId,
      classIds: classes.map((c) => c.id),
    });
    return this.enrich(offering);
  },

  async enrich(offering) {
    const competition = await CompetitionModel.findById(offering.competitionId);
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
      status: competition?.startDate && competition?.endDate ? computeStatus(competition.startDate, competition.endDate) : null,
      hubName: hub?.name || null,
      classes: classesWithCounts,
      learnerCount,
    };
  },

  async getOfferingsForCompetition(competitionId) {
    const offerings = await CompetitionHubModel.findByCompetitionId(competitionId);
    return Promise.all(offerings.map((o) => this.enrich(o)));
  },

  // Removing an offering deletes the Classes it created too — same posture as
  // bootcamp-hub.service.js's deleteOffering.
  async deleteOffering(id) {
    const offering = await CompetitionHubModel.findById(id);
    if (!offering) {
      const err = new Error("Offering not found");
      err.statusCode = 404;
      throw err;
    }
    for (const classId of classIdsArray(offering.classIds)) {
      // eslint-disable-next-line no-await-in-loop
      if (await ClassModel.findById(classId)) await getClassService().deleteClass(classId);
    }
    await CompetitionHubModel.delete(id);
    return { message: "Offering removed successfully" };
  },

  async deleteByCompetitionId(competitionId) {
    const offerings = await CompetitionHubModel.findByCompetitionId(competitionId);
    for (const offering of offerings) {
      // eslint-disable-next-line no-await-in-loop
      for (const classId of classIdsArray(offering.classIds)) {
        // eslint-disable-next-line no-await-in-loop
        if (await ClassModel.findById(classId)) await getClassService().deleteClass(classId);
      }
    }
    await CompetitionHubModel.deleteByCompetitionId(competitionId);
  },

  // classId -> {startDate, endDate} | null, for the timetable engine.
  async getDateWindowForClass(classId) {
    const offering = await CompetitionHubModel.findByClassId(classId);
    if (!offering) return null;
    const competition = await CompetitionModel.findById(offering.competitionId);
    if (!competition?.startDate || !competition?.endDate) return null;
    return { startDate: competition.startDate, endDate: competition.endDate };
  },
};

module.exports = CompetitionHubService;
