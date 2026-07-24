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
  // step) onto a hub as a real Class. Nothing is authored here — the curriculum already carries
  // its own grades/periods/competencies/course assignments from that flow.
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
    if (!(curriculum.classes || []).includes(data.gradeName)) {
      const err = new Error("That cohort/grade isn't defined on this curriculum's Structure step");
      err.statusCode = 400;
      throw err;
    }

    const cls = ClassModel.create({
      schoolId: hub.id,
      curriculumId: curriculum.id,
      gradeId: deriveGradeId(curriculum.id, data.gradeName),
      gradeName: data.gradeName,
      classTeacherId: data.classTeacherId || null,
      academicYear: String(new Date(data.startDate).getFullYear()),
      capacity: data.capacity ?? null,
      status: "active",
    });

    const program = ProgramModel.create({
      curriculumId: curriculum.id,
      hubId: hub.id,
      classId: cls.id,
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
    const cls = ClassModel.findById(program.classId);
    return {
      ...program,
      status: computeStatus(program.startDate, program.endDate),
      name: curriculum?.name || null,
      description: curriculum?.description || "",
      curriculumName: curriculum?.name || null,
      hubName: hub?.name || null,
      gradeName: cls?.gradeName || null,
      learnerCount: cls ? LearnerHubLinkModel.findByClassId(cls.id).length : 0,
      classTeacherId: cls?.classTeacherId || null,
    };
  },

  getAllPrograms() {
    return ProgramModel.findAll().map((p) => this.enrich(p));
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
