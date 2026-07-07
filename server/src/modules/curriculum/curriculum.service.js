const CurriculumModel          = require("./curriculum.model");
const AcademicYearGroupModel   = require("./academic-years/academic-year-groups.model");
const AcademicYearVersionModel = require("./academic-years/academic-year-versions.model");

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

    // Effective status: "published" only when BOTH curriculum-version AND academic-year-version are published
    const cvPublishedIds = new Set();
    const cvActiveIds    = new Set();
    // Courses count from the current (isCurrent) version's content
    const coursesCountById = {};
    for (const v of cvVersions) {
      if (!v.curriculumId) continue;
      if (v.status === "published") cvPublishedIds.add(v.curriculumId);
      if (v.status === "active")    cvActiveIds.add(v.curriculumId);
      if (v.isCurrent) {
        let count = 0;
        for (const period of (v.content || [])) {
          for (const cls of (period.classes || [])) {
            count += (cls.courses || []).length;
          }
        }
        coursesCountById[v.curriculumId] = count;
      }
    }

    const ayPublishedIds = new Set();
    for (const v of ayVersions) {
      if (v.curriculumId && v.status === "published") ayPublishedIds.add(v.curriculumId);
    }

    return curricula.map((c) => {
      let effectiveStatus;
      if (cvPublishedIds.has(c.id) && ayPublishedIds.has(c.id)) {
        effectiveStatus = "published";
      } else if (cvActiveIds.has(c.id)) {
        effectiveStatus = "active";
      } else {
        effectiveStatus = c.status || "draft";
      }
      return {
        ...c,
        publishedAcademicYear: ayLabelByCurriculumId[c.id] || null,
        effectiveStatus,
        coursesCount: coursesCountById[c.id] || 0,
      };
    });
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
