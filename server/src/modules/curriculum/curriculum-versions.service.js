const CurriculumVersionModel = require("./curriculum-versions.model");

function buildContentScaffold(curriculum) {
  const periods = curriculum.periods || [];

  // Collect unique grade names from curriculum.structure
  const gradesMap = new Map();
  (curriculum.structure || []).forEach((term) => {
    (term.grades || []).forEach((g) => {
      const key = g.id || g.name;
      if (key && !gradesMap.has(key)) gradesMap.set(key, g.name || g);
    });
  });
  let gradeNames = [...gradesMap.values()];
  // Fall back to legacy curriculum.classes if structure has no grades
  if (gradeNames.length === 0) gradeNames = curriculum.classes || [];

  return periods.map((p) => ({
    periodName: p.name,
    classes: gradeNames.map((name) => ({ className: name, courses: [] })),
  }));
}

const CurriculumVersionService = {
  getAllForCurriculum(curriculumId) {
    const all     = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    // published (isCurrent) version is the "current"; everything else is history
    const current = all.find((v) => v.isCurrent) || null;
    const history = all.filter((v) => !v.isCurrent);
    return { current, history };
  },

  create(curriculumId, curriculum, data) {
    const existing    = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const nextVersion = existing.length ? Math.max(...existing.map((v) => v.versionNumber)) + 1 : 1;

    // New versions are always created as drafts — user explicitly publishes
    const scaffold = buildContentScaffold(curriculum);
    const content  = (data.content && data.content.length)
      ? scaffold.map((sp) => {
          const provided = data.content.find((p) => p.periodName === sp.periodName);
          return provided
            ? { ...sp, classes: sp.classes.map((sc) => { const pc = provided.classes?.find((c) => c.className === sc.className); return pc || sc; }) }
            : sp;
        })
      : scaffold;

    return CurriculumVersionModel.create({
      curriculumId,
      academicYearId: data.academicYearId || null,
      versionNumber:  nextVersion,
      status:         "draft",
      isCurrent:      false,
      versionOf:      null,
      content,
    });
  },

  edit(curriculumId, versionId, data) {
    const version = CurriculumVersionModel.findById(versionId);
    if (!version || version.curriculumId !== curriculumId) {
      throw Object.assign(new Error("Version not found"), { statusCode: 404 });
    }
    return CurriculumVersionModel.update(versionId, {
      status:  data.status  || version.status,
      content: data.content || version.content || [],
    });
  },

  changeStatus(curriculumId, versionId, status) {
    if (!["draft", "published", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "published") {
      // Retire any currently published version
      const all = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
      all.forEach((v) => {
        if (v.id !== versionId && v.isCurrent) {
          CurriculumVersionModel.update(v.id, { status: "inactive", isCurrent: false });
        }
      });
      return CurriculumVersionModel.update(versionId, { status: "published", isCurrent: true });
    }
    // draft / inactive — remove the isCurrent flag if it was on this version
    return CurriculumVersionModel.update(versionId, { status, isCurrent: false });
  },
};

module.exports = CurriculumVersionService;
