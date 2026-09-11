const EventModel = require("./event.model");
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

// createRecord/updateRecord return the record with `classIds` as whatever was just written — a
// JSON string on create/update (they return the stringified insert/update payload), a real
// array on a fresh read. Normalise to an array so callers never have to care which path fed them.
function classIdsArray(classIds) {
  if (Array.isArray(classIds)) return classIds;
  if (typeof classIds === "string") {
    try {
      const parsed = JSON.parse(classIds);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Blocks two deployments of the same curriculum to the same hub only when their date ranges
// actually overlap — re-running the same event at the same hub in a later, non-overlapping
// term (e.g. "Summer Camp" every year) is expected and stays allowed. Dates are plain YYYY-MM-DD
// strings throughout this module, which sort lexicographically the same as chronologically, so a
// direct string comparison is safe here.
async function findOverlappingDeployment(curriculumId, hubId, startDate, endDate, excludeId) {
  const events = await EventModel.findAll({ curriculumId });
  return events.find(
    (e) => e.id !== excludeId && e.hubId === hubId && startDate <= e.endDate && endDate >= e.startDate
  );
}

const EventService = {
  // Deploys an already-authored event-curriculum (Basic Info -> Structure -> Competencies ->
  // Version Control, same flow as any curriculum, just flagged isEvent: true on the Structure
  // step) onto a hub as real Classes. Nothing is authored here — the curriculum already carries
  // its own cohorts/periods/competencies/course assignments from that flow, so this creates one
  // Class per cohort already defined in curriculum.classes automatically (same idea as "Set Up
  // Year" bulk-creating a class per grade for a regular curriculum) — no re-picking a grade here.
  async createEvent(data) {
    const curriculum = await CurriculumModel.findById(data.curriculumId);
    if (!curriculum) {
      const err = new Error("Curriculum not found");
      err.statusCode = 404;
      throw err;
    }
    if (!curriculum.isEvent) {
      const err = new Error("This curriculum isn't flagged as an Event — set that on its Structure step first");
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
      const err = new Error("This event has no cohorts defined yet — add one on its Structure step first");
      err.statusCode = 400;
      throw err;
    }
    if (await findOverlappingDeployment(curriculum.id, hub.id, data.startDate, data.endDate)) {
      const err = new Error("This event is already deployed to this hub for an overlapping period");
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

    const event = await EventModel.create({
      curriculumId: curriculum.id,
      hubId: hub.id,
      classIds: classes.map((c) => c.id),
      startDate: data.startDate,
      endDate: data.endDate,
    });

    return this.enrich(event);
  },

  // Merges in display-only data an event list/detail view needs — resolved fresh each read,
  // never stored, so it can't drift from the underlying curriculum/class records.
  async enrich(event) {
    const curriculum = await CurriculumModel.findById(event.curriculumId);
    const hub = await LearningHubModel.findById(event.hubId);
    // EventModel.create/update return the record with classIds as whatever was just written —
    // a JSON string (createRecord/updateRecord return the stringified payload, not a re-read
    // row), while a fresh findAll/findById read gets it auto-parsed back into a real array by
    // mysql2. Normalise here so enrich() works the same regardless of which path called it —
    // same fix as CompetitionService's tracksArray() / BootcampService's highlightsArray().
    const classIds = classIdsArray(event.classIds);
    const resolvedClasses = await Promise.all(classIds.map((id) => ClassModel.findById(id)));
    const classes = resolvedClasses.filter(Boolean);
    const classesWithCounts = await Promise.all(classes.map(async (cls) => ({
      id: cls.id,
      gradeName: cls.gradeName,
      learnerCount: (await LearnerHubLinkModel.findByClassId(cls.id)).length,
    })));
    const learnerCount = classesWithCounts.reduce((sum, cls) => sum + cls.learnerCount, 0);
    return {
      ...event,
      status: computeStatus(event.startDate, event.endDate),
      name: curriculum?.name || null,
      description: curriculum?.description || "",
      curriculumName: curriculum?.name || null,
      hubName: hub?.name || null,
      classes: classesWithCounts,
      learnerCount,
    };
  },

  async getAllEvents(filters) {
    const events = await EventModel.findAll(filters);
    return Promise.all(events.map((e) => this.enrich(e)));
  },

  async getEventById(id) {
    const event = await EventModel.findById(id);
    if (!event) {
      const err = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }
    return this.enrich(event);
  },

  async updateEvent(id, data) {
    const existing = await EventModel.findById(id);
    if (!existing) {
      const err = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }
    const startDate = data.startDate || existing.startDate;
    const endDate = data.endDate || existing.endDate;
    if (await findOverlappingDeployment(existing.curriculumId, existing.hubId, startDate, endDate, id)) {
      const err = new Error("These dates overlap another deployment of this event at this hub");
      err.statusCode = 409;
      throw err;
    }
    const updated = await EventModel.update(id, data);
    return this.enrich(updated);
  },

  async deleteEvent(id) {
    const deleted = await EventModel.delete(id);
    if (!deleted) {
      const err = new Error("Event not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Event deleted successfully" };
  },
};

module.exports = EventService;
