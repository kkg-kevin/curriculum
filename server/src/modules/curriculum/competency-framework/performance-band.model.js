const fs     = require("fs");
const path   = require("path");
const { v4: uuidv4 } = require("uuid");

const FILE = path.join(__dirname, "../../../../data/performance-bands.json");

function read()      { return JSON.parse(fs.readFileSync(FILE, "utf-8")); }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }

const PerformanceBandModel = {
  findByCurriculum(curriculumId) {
    return read()
      .filter((b) => b.curriculumId === curriculumId)
      .sort((a, b) => a.order - b.order);
  },

  create(curriculumId, fields) {
    const all   = read();
    const count = all.filter((b) => b.curriculumId === curriculumId).length;
    const band  = {
      id:           uuidv4(),
      curriculumId,
      name:         fields.name,
      description:  fields.description || "",
      criteria:     fields.criteria    || [],
      minScore:     fields.minScore    ?? 0,
      maxScore:     fields.maxScore    ?? 100,
      order:        count + 1,
      createdAt:    new Date().toISOString(),
    };
    all.push(band);
    write(all);
    return band;
  },

  update(curriculumId, id, fields) {
    const all = read();
    const idx = all.findIndex((b) => b.id === id && b.curriculumId === curriculumId);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...fields };
    write(all);
    return all[idx];
  },

  delete(curriculumId, id) {
    const all      = read();
    const filtered = all.filter((b) => !(b.id === id && b.curriculumId === curriculumId));
    write(filtered);
  },

  reorder(curriculumId, orderedIds) {
    const all = read();
    orderedIds.forEach((id, i) => {
      const idx = all.findIndex((b) => b.id === id && b.curriculumId === curriculumId);
      if (idx !== -1) all[idx].order = i + 1;
    });
    write(all);
    return all.filter((b) => b.curriculumId === curriculumId).sort((a, b) => a.order - b.order);
  },
};

module.exports = PerformanceBandModel;
