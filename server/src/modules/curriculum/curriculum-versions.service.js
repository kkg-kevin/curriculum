const CurriculumVersionModel = require("./curriculum-versions.model");
const CurriculumModel = require("./curriculum.model");

/* ── Snapshot builder ────────────────────────────────────────────────── */

function buildSnapshot(curriculum) {
  return {
    name:               curriculum.name,
    code:               curriculum.code,
    academicYear:       curriculum.academicYear,
    description:        curriculum.description,
    framework:          curriculum.framework,
    academicCycleModel: curriculum.academicCycleModel,
    periods:            curriculum.periods    || [],
    structure:          curriculum.structure  || [],
    status:             curriculum.status,
    educationLevel:     curriculum.educationLevel,
    gradeFrom:          curriculum.gradeFrom,
    gradeTo:            curriculum.gradeTo,
  };
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function requireCurriculum(curriculumId) {
  const curriculum = CurriculumModel.findById(curriculumId);
  if (!curriculum) {
    const err = new Error("Curriculum not found");
    err.statusCode = 404;
    throw err;
  }
  return curriculum;
}

function requireVersion(curriculumId, versionId) {
  const version = CurriculumVersionModel.findById(versionId);
  if (!version || version.curriculumId !== curriculumId) {
    const err = new Error("Version not found");
    err.statusCode = 404;
    throw err;
  }
  return version;
}

/* ── Service ─────────────────────────────────────────────────────────── */

const CurriculumVersionService = {
  // Called by CurriculumService.createCurriculum right after the record is saved.
  async createInitialVersion(curriculum) {
    return CurriculumVersionModel.create({
      curriculumId:  curriculum.id,
      versionNumber: 1,
      versionLabel:  "Initial Version",
      status:        "active",
      changeNotes:   "Initial curriculum setup",
      snapshot:      buildSnapshot(curriculum),
    });
  },

  // Snapshot the current working copy into a new draft version.
  async createVersion(curriculumId, { versionLabel, changeNotes } = {}) {
    const curriculum = requireCurriculum(curriculumId);

    const existing = CurriculumVersionModel.findAllByCurriculumId(curriculumId);
    const nextNumber =
      existing.length > 0
        ? Math.max(...existing.map((v) => v.versionNumber)) + 1
        : 1;

    return CurriculumVersionModel.create({
      curriculumId,
      versionNumber: nextNumber,
      versionLabel:  versionLabel?.trim() || `Version ${nextNumber}`,
      status:        "draft",
      changeNotes:   changeNotes?.trim() || "",
      snapshot:      buildSnapshot(curriculum),
    });
  },

  // Promote a draft to active; archive the current active version.
  async publishVersion(curriculumId, versionId) {
    requireCurriculum(curriculumId);
    const version = requireVersion(curriculumId, versionId);

    if (version.status !== "draft") {
      const err = new Error(
        `Only draft versions can be published (current status: ${version.status})`
      );
      err.statusCode = 400;
      throw err;
    }

    // Archive everything that is currently active for this curriculum
    CurriculumVersionModel.updateWhere(
      curriculumId,
      (v) => v.status === "active",
      { status: "archived" }
    );

    return CurriculumVersionModel.update(versionId, { status: "active" });
  },

  // Copy a snapshot's fields back into the curriculum working copy.
  async revertVersion(curriculumId, versionId) {
    requireCurriculum(curriculumId);
    const version = requireVersion(curriculumId, versionId);
    const { snapshot } = version;

    const updated = CurriculumModel.update(curriculumId, {
      name:               snapshot.name,
      code:               snapshot.code,
      academicYear:       snapshot.academicYear,
      description:        snapshot.description,
      framework:          snapshot.framework,
      academicCycleModel: snapshot.academicCycleModel,
      periods:            snapshot.periods   || [],
      structure:          snapshot.structure || [],
      educationLevel:     snapshot.educationLevel,
      gradeFrom:          snapshot.gradeFrom,
      gradeTo:            snapshot.gradeTo,
    });

    return { curriculum: updated, version };
  },

  async getAllVersions(curriculumId) {
    requireCurriculum(curriculumId);
    return CurriculumVersionModel.findAllByCurriculumId(curriculumId);
  },

  async getVersionById(curriculumId, versionId) {
    requireCurriculum(curriculumId);
    return requireVersion(curriculumId, versionId);
  },
};

module.exports = CurriculumVersionService;
