const AcademicYearModel = require("./academic-years.model");

const AcademicYearService = {
  getAllForCurriculum(curriculumId) {
    const all = AcademicYearModel.findByCurriculumId(curriculumId);
    return all.sort((a, b) => b.versionNumber - a.versionNumber);
  },

  // Create first year, or start fresh (wipes current pointer)
  create(curriculumId, data, isFresh = false) {
    if (isFresh) AcademicYearModel.setAllNotCurrent(curriculumId);

    if (data.status === "active") AcademicYearModel.deactivateAllActive(curriculumId);

    const existing = AcademicYearModel.findByCurriculumId(curriculumId);
    const nextVersion = isFresh
      ? 1
      : existing.length
      ? Math.max(...existing.map((y) => y.versionNumber)) + 1
      : 1;

    return AcademicYearModel.create({
      curriculumId,
      label: data.label,
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      status: data.status || "draft",
      periods: data.periods || [],
      versionNumber: nextVersion,
      versionOf: isFresh ? null : (data.versionOf || null),
      isCurrent: true,
    });
  },

  // Edit creates a new version from an existing year
  edit(curriculumId, yearId, data) {
    const current = AcademicYearModel.findById(yearId);
    if (!current) throw Object.assign(new Error("Academic year not found"), { statusCode: 404 });

    // Archive the current version
    AcademicYearModel.update(yearId, { isCurrent: false });

    if (data.status === "active") AcademicYearModel.deactivateAllActive(curriculumId);

    const all = AcademicYearModel.findByCurriculumId(curriculumId);
    const nextVersion = Math.max(...all.map((y) => y.versionNumber)) + 1;

    return AcademicYearModel.create({
      curriculumId,
      label: data.label,
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      status: data.status || current.status,
      periods: data.periods || [],
      versionNumber: nextVersion,
      versionOf: yearId,
      isCurrent: true,
    });
  },

  changeStatus(curriculumId, yearId, status) {
    if (!["active", "draft", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "active") AcademicYearModel.deactivateAllActive(curriculumId);
    return AcademicYearModel.update(yearId, { status });
  },
};

module.exports = AcademicYearService;
