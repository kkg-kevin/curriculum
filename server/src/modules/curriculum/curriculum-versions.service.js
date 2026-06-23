const CurriculumVersionModel = require("./curriculum-versions.model");

function buildContentScaffold(curriculum) {
  const periods = curriculum.periods || [];
  const classes = curriculum.classes || [];
  return periods.map((p) => ({
    periodName: p.name,
    classes: classes.map((cls) => ({ className: cls, courses: [] })),
  }));
}

const CurriculumVersionService = {
  getAllForCurriculum(curriculumId) {
    const all     = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const current = all.find((v) => v.isCurrent) || null;
    const history = all.filter((v) => !v.isCurrent);
    return { current, history };
  },

  create(curriculumId, curriculum, data) {
    const existing    = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const nextVersion = existing.length ? Math.max(...existing.map((v) => v.versionNumber)) + 1 : 1;

    if (data.status === "active") CurriculumVersionModel.deactivateAllActive(curriculumId);
    CurriculumVersionModel.setAllNotCurrent(curriculumId);

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
      status:         data.status || "draft",
      isCurrent:      true,
      versionOf:      null,
      content,
    });
  },

  edit(curriculumId, versionId, data) {
    const current = CurriculumVersionModel.findById(versionId);
    if (!current || current.curriculumId !== curriculumId) {
      throw Object.assign(new Error("Version not found"), { statusCode: 404 });
    }

    if (data.status === "active") CurriculumVersionModel.deactivateAllActive(curriculumId);

    return CurriculumVersionModel.update(versionId, {
      status:  data.status  || current.status,
      content: data.content || current.content || [],
    });
  },

  changeStatus(curriculumId, versionId, status) {
    if (!["active", "draft", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "active") CurriculumVersionModel.deactivateAllActive(curriculumId);
    return CurriculumVersionModel.update(versionId, { status });
  },
};

module.exports = CurriculumVersionService;
