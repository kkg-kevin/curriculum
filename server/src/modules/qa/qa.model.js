const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Thin Knex wrappers over the quality assurance tables (see the 20261029100000 migration). The
// rules — who may do what — live in qa.service.js and qa.access.js.

const TEMPLATES = "qa_templates";
const SCHEDULES = "qa_schedules";
const VISITS = "qa_visits";
const TEMPLATE_JSON = ["scale", "sections"];
const VISIT_JSON = ["template", "answers", "summary", "sectionScores"];

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const shapeTemplate = (row) => (row ? { ...row, scale: parseJson(row.scale, []), sections: parseJson(row.sections, []) } : row);
const shapeVisit = (row) => (row ? {
  ...row,
  template: parseJson(row.template, null),
  answers: parseJson(row.answers, {}),
  summary: parseJson(row.summary, {}),
  sectionScores: parseJson(row.sectionScores, []),
  score: row.score == null ? null : Number(row.score),
} : row);

const QaModel = {
  // ---- Templates ----
  async createTemplate(data, connection = db) { return shapeTemplate(await createRecord(connection, TEMPLATES, stringifyJsonFields(data, TEMPLATE_JSON))); },
  async updateTemplate(id, data, connection = db) { return shapeTemplate(await updateRecord(connection, TEMPLATES, id, stringifyJsonFields(data, TEMPLATE_JSON))); },
  async findTemplate(id, connection = db) { return shapeTemplate(await firstOrNull(connection(TEMPLATES).where({ id }))); },
  async listTemplates({ ownerAdminId, status }) {
    let q = db(TEMPLATES).where({ ownerAdminId });
    if (status) q = q.where({ status });
    return (await q.orderBy("name", "asc")).map(shapeTemplate);
  },
  deleteTemplate(id) { return db(TEMPLATES).where({ id }).del(); },

  // ---- Schedules ----
  createSchedule(data, connection = db) { return createRecord(connection, SCHEDULES, data); },
  updateSchedule(id, data, connection = db) { return updateRecord(connection, SCHEDULES, id, data); },
  findSchedule(id, connection = db) { return firstOrNull(connection(SCHEDULES).where({ id })); },
  activeSchedules(ownerAdminId = null) {
    let q = db(SCHEDULES).where({ status: "active" });
    if (ownerAdminId) q = q.where({ ownerAdminId });
    return q;
  },

  // ---- Visits ----
  // Adds the visits not on file yet; one already there for the same (schedule, date) is left as it
  // is (the UNIQUE key), so this is safe to run any number of times.
  async insertVisitsIgnoringExisting(rows, connection = db) {
    if (!rows.length) return;
    const now = new Date();
    await connection(VISITS).insert(rows.map((row) => ({ id: generateId(), createdAt: now, updatedAt: now, ...row }))).onConflict(["scheduleId", "occurrenceDate"]).ignore();
  },
  async createVisit(data, connection = db) { return shapeVisit(await createRecord(connection, VISITS, stringifyJsonFields(data, VISIT_JSON))); },
  async findVisit(id, connection = db, forUpdate = false) {
    let q = connection(VISITS).where({ id });
    if (forUpdate) q = q.forUpdate();
    return shapeVisit(await firstOrNull(q));
  },
  async updateVisit(id, data, connection = db) { return shapeVisit(await updateRecord(connection, VISITS, id, stringifyJsonFields(data, VISIT_JSON))); },
  visitsQuery() { return db(VISITS); },
  async findVisits(query) { return (await query).map(shapeVisit); },

  transaction(work) { return db.transaction(work); },
};

module.exports = QaModel;
module.exports._internal = { shapeVisit, shapeTemplate };
