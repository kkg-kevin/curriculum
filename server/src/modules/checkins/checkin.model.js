const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Thin Knex wrappers over the two check-in tables (see the 20261022130000 and 20261026110000
// migrations). The rules — who may do what — live in checkin.service.js.

const SCHEDULES = "checkin_schedules";
const SESSIONS = "checkin_sessions";
const TEMPLATES = "checkin_templates";
const SESSION_JSON = ["report", "template", "answers", "sectionScores"];
const TEMPLATE_JSON = ["scale", "sections"];

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const shapeSession = (row) => (row ? {
  ...row,
  report: parseJson(row.report, null),
  template: parseJson(row.template, null),
  answers: parseJson(row.answers, {}),
  sectionScores: parseJson(row.sectionScores, []),
  score: row.score == null ? null : Number(row.score),
} : row);
const shapeTemplate = (row) => (row ? { ...row, scale: parseJson(row.scale, []), sections: parseJson(row.sections, []) } : row);

const CheckinModel = {
  db,

  // ---- Templates (the same shape as QA templates — qa.rules.js) ----
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
  listSchedules({ ownerAdminId, hubId, status } = {}) {
    let q = db(SCHEDULES).where({ ownerAdminId });
    if (hubId) q = q.where({ hubId });
    if (status) q = q.where({ status });
    return q.orderBy("createdAt", "desc");
  },
  activeSchedules(ownerAdminId = null) {
    let q = db(SCHEDULES).where({ status: "active" });
    if (ownerAdminId) q = q.where({ ownerAdminId });
    return q;
  },

  // ---- Check-ins ----
  // Adds the check-ins not on file yet; one already there for the same (schedule, date) is left
  // exactly as it is (the UNIQUE key), so this is safe to run any number of times.
  async insertSessionsIgnoringExisting(rows, connection = db) {
    if (!rows.length) return;
    const now = new Date();
    const prepared = rows.map((row) => stringifyJsonFields({ id: generateId(), createdAt: now, updatedAt: now, ...row }, SESSION_JSON));
    await connection(SESSIONS).insert(prepared).onConflict(["scheduleId", "occurrenceDate"]).ignore();
  },
  async findSession(id, connection = db, forUpdate = false) {
    let q = connection(SESSIONS).where({ id });
    if (forUpdate) q = q.forUpdate();
    return shapeSession(await firstOrNull(q));
  },
  async updateSession(id, data, connection = db) {
    return shapeSession(await updateRecord(connection, SESSIONS, id, stringifyJsonFields(data, SESSION_JSON)));
  },
  sessionsQuery(ownerAdminId) { return db(SESSIONS).where({ ownerAdminId }); },
  async findSessions(query) { return (await query).map(shapeSession); },

  // ---- Who takes part ----
  // Adds these people to these check-ins; anyone already on one stays as they are (UNIQUE).
  async addParticipants(sessions, participants, connection = db) {
    if (!sessions.length || !participants.length) return;
    const now = new Date();
    const rows = sessions.flatMap((s) => participants.map((p) => ({
      id: generateId(), ownerAdminId: s.ownerAdminId, sessionId: s.id, userId: p.userId, kind: p.kind, createdAt: now, updatedAt: now,
    })));
    for (let i = 0; i < rows.length; i += 500) {
      await connection("checkin_participants").insert(rows.slice(i, i + 500)).onConflict(["sessionId", "userId"]).ignore();
    }
  },
  // Takes everyone not in `participants` off these check-ins.
  removeOtherParticipants(sessionIds, participants, connection = db) {
    if (!sessionIds.length) return 0;
    const keep = participants.map((p) => p.userId);
    const q = connection("checkin_participants").whereIn("sessionId", sessionIds);
    return (keep.length ? q.whereNotIn("userId", keep) : q).del();
  },
  removeParticipantsOf(sessionIds, connection = db) {
    if (!sessionIds.length) return 0;
    return connection("checkin_participants").whereIn("sessionId", sessionIds).del();
  },
  participantsOf(sessionId) { return db("checkin_participants").where({ sessionId }); },

  transaction(work) { return db.transaction(work); },
};

module.exports = CheckinModel;
module.exports._internal = { shapeSession, shapeTemplate };
