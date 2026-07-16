const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/indicator-achievements.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

// A curriculum's current score (marks earned) per indicator — the persisted counterpart to
// the marksPossible CompetencyService.getPopulatedIndicators computes live from assessments.
// One row per (curriculumId, indicatorId); `marksPossible` is never stored here, only earned,
// so it can never drift from what assessments currently define.
const IndicatorAchievementModel = {
  findByCurriculumId(curriculumId) {
    return read().filter((a) => a.curriculumId === curriculumId);
  },

  findOne(curriculumId, indicatorId) {
    return read().find((a) => a.curriculumId === curriculumId && a.indicatorId === indicatorId) || null;
  },

  upsert(curriculumId, competencyId, indicatorId, marksEarned) {
    const all = read();
    const idx = all.findIndex((a) => a.curriculumId === curriculumId && a.indicatorId === indicatorId);
    const now = new Date().toISOString();
    if (idx === -1) {
      const item = { id: genId(), curriculumId, competencyId, indicatorId, marksEarned, createdAt: now, updatedAt: now };
      all.push(item);
      write(all);
      return item;
    }
    all[idx] = { ...all[idx], competencyId, marksEarned, updatedAt: now };
    write(all);
    return all[idx];
  },

  deleteByCurriculumId(curriculumId) {
    const all      = read();
    const filtered = all.filter((a) => a.curriculumId !== curriculumId);
    write(filtered);
  },

  deleteByCompetencyId(competencyId) {
    const all      = read();
    const filtered = all.filter((a) => a.competencyId !== competencyId);
    write(filtered);
  },

  deleteByLink(curriculumId, competencyId) {
    const all      = read();
    const filtered = all.filter((a) => !(a.curriculumId === curriculumId && a.competencyId === competencyId));
    write(filtered);
  },
};

module.exports = IndicatorAchievementModel;
