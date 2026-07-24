const ProgramModel = require("./program.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
}

// Same deterministic gradeId the admin Class-creation form generates client-side
// (CreateClassPage.jsx) — not a real foreign key, just a stable curriculum+grade-name key.
function deriveGradeId(curriculumId, gradeName) {
  return `${curriculumId.slice(0, 8)}-${slugify(gradeName)}`;
}

function computeStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "active";
}

const ProgramService = {
  // Deploys an already-authored program-curriculum (Basic Info -> Structure -> Competencies ->
  // Version Control, same flow as any curriculum, just flagged isProgram: true on the Structure
  // step) onto a hub as real Classes. Nothing is authored here — the curriculum already carries
  // its own cohorts/periods/competencies/course assignments from that flow, so this creates one
  // Class per cohort already defined in curriculum.classes automatically (same idea as "Set Up
  // Year" bulk-creating a class per grade for a regular curriculum) — no re-picking a grade here.
  async createProgram(data) {
    const curriculum = CurriculumModel.findById(data.curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    if (!curriculum.isProgram) {
      const err = new Error("This curriculum isn't flagged as a Program — set that on its Structure step first");
      err.statusCode = 400;
      throw err;
    }
    const hub = LearningHubModel.findById(data.hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    const gradeNames = curriculum.classes || [];
    if (gradeNames.length === 0) {
      const err = new Error("This program has no cohorts defined yet — add one on its Structure step first");
      err.statusCode = 400;
      throw err;
    }

    // Tech educator and capacity are per-class decisions, made afterward from the Classes
    // module — a deployment can create several classes at once (one per cohort), so there's no
    // single sensible value to apply to all of them here.
    const classes = gradeNames.map((gradeName) => ClassModel.create({
      schoolId: hub.id,
      curriculumId: curriculum.id,
      gradeId: deriveGradeId(curriculum.id, gradeName),
      gradeName,
      classTeacherId: null,
      academicYear: String(new Date(data.startDate).getFullYear()),
      capacity: null,
      status: "active",
    }));

    const program = ProgramModel.create({
      curriculumId: curriculum.id,
      hubId: hub.id,
      classIds: classes.map((c) => c.id),
      startDate: data.startDate,
      endDate: data.endDate,
    });

    return this.enrich(program);
  },

  // Merges in display-only data a program list/detail view needs — resolved fresh each read,
  // never stored, so it can't drift from the underlying curriculum/class records.
  enrich(program) {
    const curriculum = CurriculumModel.findById(program.curriculumId);
    const hub = LearningHubModel.findById(program.hubId);
    const classIds = program.classIds || [];
    const classes = classIds.map((id) => ClassModel.findById(id)).filter(Boolean);
    return {
      ...program,
      status: computeStatus(program.startDate, program.endDate),
      name: curriculum?.name || null,
      description: curriculum?.description || "",
      curriculumName: curriculum?.name || null,
      hubName: hub?.name || null,
      classes: classes.map((cls) => ({
        id: cls.id,
        gradeName: cls.gradeName,
        learnerCount: LearnerHubLinkModel.findByClassId(cls.id).length,
      })),
      learnerCount: classes.reduce((sum, cls) => sum + LearnerHubLinkModel.findByClassId(cls.id).length, 0),
      classTeacherId: classes[0]?.classTeacherId || null,
    };
  },

  getAllPrograms(filters) {
    return ProgramModel.findAll(filters).map((p) => this.enrich(p));
  },

  getProgramById(id) {
    const program = ProgramModel.findById(id);
    if (!program) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    return this.enrich(program);
  },

  updateProgram(id, data) {
    const updated = ProgramModel.update(id, data);
    if (!updated) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    return this.enrich(updated);
  },

  deleteProgram(id) {
    const deleted = ProgramModel.delete(id);
    if (!deleted) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Program deleted successfully" };
  },
};

module.exports = ProgramService;
