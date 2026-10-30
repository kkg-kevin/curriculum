// Places every learner already on record by age (30 Oct 2026), then exits.
//   npm run learners:place-by-age            — only reports what it would do
//   npm run learners:place-by-age -- --apply — does it
//
//  1. A learner with no date of birth and no age gets what their website enquiry kept: its date of
//     birth, else the age it gave (as statedAge, on the day it was given).
//  2. A stage already set that matches their age is marked as worked out from the age, so it
//     follows a corrected date of birth from now on. Any other stage is left as it is.
//  3. Each class enrolment with no stage yet is placed by age (LearnerService.placeByAge — the
//     stage, its pathway and its diagnostic; nothing is emailed). Safe to run again.
require("dotenv").config({ quiet: true });

const db = require("../config/db");
const LearnerModel = require("../modules/learners/learner.model");
const LearnerHubLinkModel = require("../modules/learners/learner-hub-link.model");
const LearnerService = require("../modules/learners/learner.service");
const ClassModel = require("../modules/classes/class.model");
const AgeCategoryModel = require("../modules/curriculum/competency-framework/age-category.model");
const { ageFrom, kenyaToday, learnerAge } = require("../shared/utils/age");

const apply = process.argv.includes("--apply");

const stageFor = (categories, age) =>
  categories.find((c) => (c.minAge == null || age >= c.minAge) && (c.maxAge == null || age <= c.maxAge)) || null;

(async () => {
  const counts = { learners: 0, ageFromEnquiry: 0, birthDateFromEnquiry: 0, markedAsAge: 0, placed: 0, noAge: 0, noStageForAge: 0 };
  const categoriesByCurriculum = new Map();
  const categoriesFor = async (curriculumId) => {
    if (!categoriesByCurriculum.has(curriculumId)) categoriesByCurriculum.set(curriculumId, await AgeCategoryModel.findByCurriculumId(curriculumId));
    return categoriesByCurriculum.get(curriculumId);
  };

  const learners = await db("learners").select("id", "firstName", "lastName", "dateOfBirth", "statedAge", "statedAgeOn");
  for (let learner of learners) {
    counts.learners += 1;
    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim();

    if (learnerAge(learner) === null) {
      const lead = await db("leads").where({ learnerId: learner.id })
        .where((q) => q.whereNotNull("learnerDateOfBirth").orWhereNotNull("learnerAge"))
        .orderBy("createdAt", "desc").first("learnerDateOfBirth", "learnerAge", "createdAt");
      let patch = null;
      if (lead?.learnerDateOfBirth && ageFrom(lead.learnerDateOfBirth) !== null) {
        patch = { dateOfBirth: String(lead.learnerDateOfBirth).slice(0, 10) };
        counts.birthDateFromEnquiry += 1;
      } else if (lead?.learnerAge != null) {
        patch = { statedAge: Number(lead.learnerAge), statedAgeOn: kenyaToday(new Date(lead.createdAt)) };
        counts.ageFromEnquiry += 1;
      }
      if (patch) {
        console.log(`${apply ? "" : "would "}take from their enquiry: ${name} — ${patch.dateOfBirth ? `born ${patch.dateOfBirth}` : `age ${patch.statedAge} on ${patch.statedAgeOn}`}`);
        if (apply) await LearnerModel.update(learner.id, patch);
        learner = { ...learner, ...patch };
      }
    }

    const age = learnerAge(learner);
    const links = (await LearnerHubLinkModel.findByLearnerId(learner.id)).filter((l) => l.classId);
    if (!links.length) continue;
    if (age === null) { counts.noAge += 1; continue; }

    let toPlace = false;
    for (const link of links) {
      const cls = await ClassModel.findById(link.classId);
      if (!cls?.curriculumId) continue;
      const stage = stageFor(await categoriesFor(cls.curriculumId), age);
      if (!stage) { counts.noStageForAge += 1; console.log(`no stage for age ${age}: ${name} (class ${[cls.gradeName, cls.streamName].filter(Boolean).join(" ")})`); continue; }
      if (link.currentStageId && !link.stageSource && link.currentStageId === stage.id) {
        counts.markedAsAge += 1;
        if (apply) await LearnerHubLinkModel.update(link.id, { stageSource: "age" });
      } else if (!link.currentStageId) {
        counts.placed += 1;
        toPlace = true;
        console.log(`${apply ? "placed" : "would place"}: ${name} — age ${age} → ${stage.name} (class ${[cls.gradeName, cls.streamName].filter(Boolean).join(" ")})`);
      }
    }
    if (apply && toPlace) await LearnerService.placeByAge(learner.id);
  }
  console.log(apply ? "Done:" : "Report only (add -- --apply to do it):", JSON.stringify(counts));
})()
  .catch((err) => {
    console.error("Placing learners by age failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
