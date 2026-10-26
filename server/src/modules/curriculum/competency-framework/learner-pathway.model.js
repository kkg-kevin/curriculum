const db = require("../../../config/db");
const { generateId, firstOrNull, toJson } = require("../../../shared/utils/model.utils");

const TABLE = "learner_pathways";

// A learner's placement timeline, one record per (learner, Pathway): where they
// currently stand plus an append-only history of every place they've been placed, so
// "the level they've reached" is always derivable from the latest history entry, not just
// a single overwritten field. `source` is how the learner came to be on the pathway: "auto"
// (their stage's pathway, placed by its diagnostic) or "manual" (assigned by staff).
const LearnerPathwayModel = {
  findByLearner(learnerId) {
    return db(TABLE).where({ learnerId });
  },

  findOne(learnerId, pathwayId) {
    return firstOrNull(db(TABLE).where({ learnerId, pathwayId }));
  },

  // Sets (or moves) a learner's current course in one Pathway, appending to history
  // rather than overwriting it. Creates the record on first placement, with `source`; a later
  // placement never changes it (a diagnostic on a hand-assigned pathway leaves it manual).
  async place(learnerId, curriculumId, pathwayId, courseId, reason, assessmentId = null, source = "auto") {
    const existing = await firstOrNull(db(TABLE).where({ learnerId, pathwayId }));
    const now = new Date();
    const entry = { courseId, reachedAt: now.toISOString(), reason, assessmentId };

    if (!existing) {
      const record = {
        id: generateId(),
        learnerId,
        curriculumId,
        pathwayId,
        currentCourseId: courseId,
        source,
        history: [entry],
        createdAt: now,
        updatedAt: now,
      };
      await db(TABLE).insert({ ...record, history: toJson(record.history) });
      return record;
    }

    const history = [...(existing.history || []), entry];
    await db(TABLE).where({ id: existing.id }).update({
      currentCourseId: courseId,
      history: toJson(history),
      updatedAt: now,
    });
    return { ...existing, currentCourseId: courseId, history, updatedAt: now };
  },

  deleteOne(learnerId, pathwayId) {
    return db(TABLE).where({ learnerId, pathwayId }).del();
  },

  deleteByLearnerId(learnerId) {
    return db(TABLE).where({ learnerId }).del();
  },

  deleteByCurriculumId(curriculumId) {
    return db(TABLE).where({ curriculumId }).del();
  },

  // Every learner's placement in one Pathway — called when the Pathway itself is deleted
  // (see CompetencyService.deletePathway), so no learner's placement history sits orphaned
  // pointing at a pathway that no longer exists.
  deleteByPathwayId(pathwayId) {
    return db(TABLE).where({ pathwayId }).del();
  },
};

module.exports = LearnerPathwayModel;
