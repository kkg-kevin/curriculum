// The pathways a class runs — what its learners are placed on automatically (CompetencyService's
// getPathway) and get their pathway diagnostic for (learner.service.js's
// maybeAutoIssuePathwayDiagnostics):
//   - a bootcamp's cohort class (bootcamp_hubs.classIds): the bootcamp's picked pathways, every
//     stage of each (pathwayRowsFor — every pathway of the curriculum when none are picked);
//   - any other class: every pathway of its curriculum.
// A pathway is one row per developmental stage (same-named rows = one pathway), so a stage can
// carry several pathways; stagePathwayFor picks the learner's one among them.
const PathwayModel = require("../../modules/curriculum/competency-framework/pathway.model");
const BootcampHubModel = require("../../modules/bootcamps/bootcamp-hub.model");
const BootcampModel = require("../../modules/bootcamps/bootcamp.model");
const { pathwayRowsFor } = require("./public-content");

async function pathwaysForClass(cls) {
  if (!cls?.curriculumId) return [];
  const offering = await BootcampHubModel.findByClassId(cls.id);
  const bootcamp = offering ? await BootcampModel.findById(offering.bootcampId) : null;
  if (bootcamp && bootcamp.curriculumId === cls.curriculumId) {
    return pathwayRowsFor(cls.curriculumId, Array.isArray(bootcamp.pathwayIds) ? bootcamp.pathwayIds : []);
  }
  return PathwayModel.findByCurriculumId(cls.curriculumId);
}

// The class's pathway for a stage: the one the learner is already placed on there (a diagnostic,
// a bootcamp enrolment or an advancement — `placedIds`, never a hand-added one), else the first
// the class runs for that stage. Null when the class runs none for it.
function stagePathwayFor(rows, stageId, placedIds = new Set()) {
  if (!stageId) return null;
  const atStage = rows.filter((p) => p.ageCategoryId === stageId);
  return atStage.find((p) => placedIds.has(p.id)) || atStage[0] || null;
}

module.exports = { pathwaysForClass, stagePathwayFor };
