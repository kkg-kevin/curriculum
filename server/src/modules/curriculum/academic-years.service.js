const AcademicYearModel = require("./academic-years.model");

const AcademicYearService = {
  getAllForCurriculum(curriculumId) {
    const all = AcademicYearModel.findByCurriculumId(curriculumId);
    return all.sort((a, b) => b.versionNumber - a.versionNumber);
  },

  // Create first year, or start fresh (wipes current pointer)
  create(curriculumId, data, isFresh = false) {
    AcademicYearModel.setAllNotCurrent(curriculumId);

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
      status: "draft",
      periods: data.periods || [],
      versionNumber: nextVersion,
      versionOf: isFresh ? null : (data.versionOf || null),
      isCurrent: true,
    });
  },

  // Edit creates a new draft version and makes it current (the previous stays in history)
  edit(curriculumId, yearId, data) {
    const existing = AcademicYearModel.findById(yearId);
    if (!existing) throw Object.assign(new Error("Academic year not found"), { statusCode: 404 });

    // Demote all to history
    AcademicYearModel.setAllNotCurrent(curriculumId);

    const all = AcademicYearModel.findByCurriculumId(curriculumId);
    const nextVersion = Math.max(...all.map((y) => y.versionNumber)) + 1;

    return AcademicYearModel.create({
      curriculumId,
      label: data.label,
      startDate: data.startDate || "",
      endDate: data.endDate || "",
      status: "draft",
      periods: data.periods || [],
      versionNumber: nextVersion,
      versionOf: yearId,
      isCurrent: true,
    });
  },

  changeStatus(curriculumId, yearId, status) {
    if (!["draft", "published", "inactive"].includes(status)) {
      throw Object.assign(new Error("Invalid status"), { statusCode: 400 });
    }
    if (status === "published") {
      // Retire previously published years; also make the target year "current" in the view
      const all = AcademicYearModel.findByCurriculumId(curriculumId);
      all.forEach((y) => {
        if (y.id !== yearId) {
          const updates = { isCurrent: false };
          if (y.status === "published") updates.status = "inactive";
          AcademicYearModel.update(y.id, updates);
        }
      });
      return AcademicYearModel.update(yearId, { status: "published", isCurrent: true });
    }
    // For draft/inactive: update status only, keep isCurrent as-is
    return AcademicYearModel.update(yearId, { status });
  },
};

module.exports = AcademicYearService;
