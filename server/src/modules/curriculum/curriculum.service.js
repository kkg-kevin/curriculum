const CurriculumModel          = require("./curriculum.model");
const AcademicYearGroupModel   = require("./academic-year-groups.model");
const AcademicYearVersionModel = require("./academic-year-versions.model");

const CurriculumService = {
  async createCurriculum(data) {
    return CurriculumModel.create(data);
  },

  async getAllCurricula(filters) {
    const curricula = CurriculumModel.findAll(filters);

    const fs   = require("fs");
    const path = require("path");
    const readJ = (f) => { try { const r = fs.readFileSync(f, "utf-8").trim(); return r ? JSON.parse(r) : []; } catch { return []; } };

    const ayGroups    = readJ(path.join(__dirname, "../../../data/academic-year-groups.json"));
    const ayVersions  = readJ(path.join(__dirname, "../../../data/academic-year-versions.json"));
    const cvVersions  = readJ(path.join(__dirname, "../../../data/curriculum-versions.json"));

    // AY label lookup: curriculumId → published year label
    const groupById = Object.fromEntries(ayGroups.map((g) => [g.id, g]));
    const ayLabelByCurriculumId = {};
    for (const v of ayVersions) {
      if (v.status === "published" && v.curriculumId) {
        const group = groupById[v.yearGroupId];
        if (group) ayLabelByCurriculumId[v.curriculumId] = group.label;
      }
    }

    // Effective status lookup: prefer "published" > "active" over curriculum.status
    const effectiveStatusByCurriculumId = {};
    for (const v of cvVersions) {
      if (!v.curriculumId) continue;
      const current = effectiveStatusByCurriculumId[v.curriculumId];
      if (v.status === "published") {
        effectiveStatusByCurriculumId[v.curriculumId] = "published";
      } else if (v.status === "active" && current !== "published") {
        effectiveStatusByCurriculumId[v.curriculumId] = "active";
      }
    }

    return curricula.map((c) => ({
      ...c,
      publishedAcademicYear: ayLabelByCurriculumId[c.id] || null,
      effectiveStatus: effectiveStatusByCurriculumId[c.id] || c.status || "draft",
    }));
  },

  async getCurriculumById(id) {
    const curriculum = CurriculumModel.findById(id);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async updateCurriculum(id, data) {
    const curriculum = CurriculumModel.update(id, data);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return curriculum;
  },

  async deleteCurriculum(id) {
    const deleted = CurriculumModel.delete(id);
    if (!deleted) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Curriculum deleted successfully" };
  },
};

module.exports = CurriculumService;
