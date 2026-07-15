const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/learner-journeys.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// A learner's placement timeline, one record per (learner, Learning Area): where they
// currently stand plus an append-only history of every place they've been placed, so
// "the level they've reached" is always derivable from the latest history entry, not just
// a single overwritten field.
const LearnerJourneyModel = {
  findByLearner(learnerId) {
    return read().filter((j) => j.learnerId === learnerId);
  },

  findOne(learnerId, learningAreaId) {
    return read().find((j) => j.learnerId === learnerId && j.learningAreaId === learningAreaId) || null;
  },

  // Sets (or moves) a learner's current course in one Learning Area, appending to history
  // rather than overwriting it. Creates the record on first placement.
  place(learnerId, curriculumId, learningAreaId, courseId, reason, assessmentId = null) {
    const all = read();
    const idx = all.findIndex((j) => j.learnerId === learnerId && j.learningAreaId === learningAreaId);
    const now = new Date().toISOString();
    const entry = { courseId, reachedAt: now, reason, assessmentId };

    if (idx === -1) {
      const record = {
        id: genId(), learnerId, curriculumId, learningAreaId,
        currentCourseId: courseId,
        history: [entry],
        createdAt: now, updatedAt: now,
      };
      all.push(record);
      write(all);
      return record;
    }

    all[idx] = {
      ...all[idx],
      currentCourseId: courseId,
      history: [...(all[idx].history || []), entry],
      updatedAt: now,
    };
    write(all);
    return all[idx];
  },

  deleteByLearnerId(learnerId) {
    const all      = read();
    const filtered = all.filter((j) => j.learnerId !== learnerId);
    write(filtered);
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((j) => j.curriculumId !== curriculumId);
    write(filtered);
  },
};

module.exports = LearnerJourneyModel;
