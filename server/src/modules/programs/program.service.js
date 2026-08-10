const ProgramModel = require("./program.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const ClassModel = require("../classes/class.model");
const ClassService = require("../classes/class.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");

function computeStatus(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return "upcoming";
  if (today > endDate) return "completed";
  return "active";
}

// Blocks two deployments of the same curriculum to the same hub only when their date ranges
// actually overlap — re-running the same program at the same hub in a later, non-overlapping
// term (e.g. "Summer Camp" every year) is expected and stays allowed. Dates are plain YYYY-MM-DD
// strings throughout this module, which sort lexicographically the same as chronologically, so a
// direct string comparison is safe here.
async function findOverlappingDeployment(curriculumId, hubId, startDate, endDate, excludeId) {
  const programs = await ProgramModel.findAll({ curriculumId });
  return programs.find(
    (p) => p.id !== excludeId && p.hubId === hubId && startDate <= p.endDate && endDate >= p.startDate
  );
}

const ProgramService = {
  // Deploys an already-authored program-curriculum (Basic Info -> Structure -> Competencies ->
  // Version Control, same flow as any curriculum, just flagged isProgram: true on the Structure
  // step) onto a hub as real Classes. Nothing is authored here — the curriculum already carries
  // its own cohorts/periods/competencies/course assignments from that flow, so this creates one
  // Class per cohort already defined in curriculum.classes automatically (same idea as "Set Up
  // Year" bulk-creating a class per grade for a regular curriculum) — no re-picking a grade here.
  async createProgram(data) {
    const curriculum = await CurriculumModel.findById(data.curriculumId);
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
    const hub = await LearningHubModel.findById(data.hubId);
    if (!hub) {
      const err = new Error("Learning hub not found");
      err.statusCode = 404;
      throw err;
    }
    const curriculumClasses = curriculum.classes || [];
    if (curriculumClasses.length === 0) {
      const err = new Error("This program has no cohorts defined yet — add one on its Structure step first");
      err.statusCode = 400;
      throw err;
    }
    if (await findOverlappingDeployment(curriculum.id, hub.id, data.startDate, data.endDate)) {
      const err = new Error("This program is already deployed to this hub for an overlapping period");
      err.statusCode = 409;
      throw err;
    }

    // Course-educator assignment and capacity are per-class decisions, made afterward from the
    // Classes module — a deployment can create several classes at once (one per cohort), so
    // there's no single sensible value to apply to all of them here.
    // Routed through ClassService (same path as "Set Up Year") so the tag/stream uniqueness
    // checks run here too — creating straight off ClassModel skipped them, letting deployment
    // create classes the Classes screen itself would have rejected as duplicates.
    const classes = await ClassService.bulkCreateClasses(curriculumClasses.map((cls) => ({
      schoolId: hub.id,
      curriculumId: curriculum.id,
      gradeId: cls.id,
      gradeName: cls.name,
      academicYear: String(new Date(data.startDate).getFullYear()),
      capacity: null,
      status: "active",
    })));

    const program = await ProgramModel.create({
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
  async enrich(program) {
    const curriculum = await CurriculumModel.findById(program.curriculumId);
    const hub = await LearningHubModel.findById(program.hubId);
    const classIds = program.classIds || [];
    const resolvedClasses = await Promise.all(classIds.map((id) => ClassModel.findById(id)));
    const classes = resolvedClasses.filter(Boolean);
    const classesWithCounts = await Promise.all(classes.map(async (cls) => ({
      id: cls.id,
      gradeName: cls.gradeName,
      learnerCount: (await LearnerHubLinkModel.findByClassId(cls.id)).length,
    })));
    const learnerCount = classesWithCounts.reduce((sum, cls) => sum + cls.learnerCount, 0);
    return {
      ...program,
      status: computeStatus(program.startDate, program.endDate),
      name: curriculum?.name || null,
      description: curriculum?.description || "",
      curriculumName: curriculum?.name || null,
      hubName: hub?.name || null,
      classes: classesWithCounts,
      learnerCount,
    };
  },

  async getAllPrograms(filters) {
    const programs = await ProgramModel.findAll(filters);
    return Promise.all(programs.map((p) => this.enrich(p)));
  },

  async getProgramById(id) {
    const program = await ProgramModel.findById(id);
    if (!program) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    return this.enrich(program);
  },

  async updateProgram(id, data) {
    const existing = await ProgramModel.findById(id);
    if (!existing) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;
    if (await findOverlappingDeployment(existing.curriculumId, existing.hubId, startDate, endDate, id)) {
      const err = new Error("These dates overlap another deployment of this program at this hub");
      err.statusCode = 409;
      throw err;
    }
    const updated = await ProgramModel.update(id, data);
    return this.enrich(updated);
  },

  async deleteProgram(id) {
    const deleted = await ProgramModel.delete(id);
    if (!deleted) {
      const err = new Error("Program not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Program deleted successfully" };
  },
};

module.exports = ProgramService;
