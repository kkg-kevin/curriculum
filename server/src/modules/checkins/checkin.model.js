const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Thin Knex wrappers over the four check-in tables (see the 20261022130000 migration for what
// each holds). The rules — who may do what, when a status changes — live in checkin.service.js.

const SCHEDULES = "checkin_schedules";
const SESSIONS = "checkin_sessions";
const ACTIONS = "checkin_actions";
const UPDATES = "checkin_action_updates";
const SESSION_JSON = ["report", "history"];

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const shapeSession = (row) => (row ? { ...row, report: parseJson(row.report, null), history: parseJson(row.history, []) } : row);

const CheckinModel = {
  db,

  // ---- Schedules ----
  createSchedule(data, connection = db) { return createRecord(connection, SCHEDULES, data); },
  updateSchedule(id, data, connection = db) { return updateRecord(connection, SCHEDULES, id, data); },
  findSchedule(id, connection = db) { return firstOrNull(connection(SCHEDULES).where({ id })); },
  listSchedules({ ownerAdminId, hubId, status, staffId } = {}) {
    let q = db(SCHEDULES).where({ ownerAdminId });
    if (hubId) q = q.where({ hubId });
    if (status) q = q.where({ status });
    if (staffId) q = q.where((w) => w.where({ accountManagerId: staffId }).orWhere({ trainingLeadId: staffId }));
    return q.orderBy("createdAt", "desc");
  },
  activeSchedules(ownerAdminId = null) {
    let q = db(SCHEDULES).where({ status: "active" });
    if (ownerAdminId) q = q.where({ ownerAdminId });
    return q;
  },

  // ---- Sessions ----
  // Adds the sessions not on file yet; one already there for the same (schedule, date) is left
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

  // ---- Actions ----
  createAction(data, connection = db) { return createRecord(connection, ACTIONS, data); },
  updateAction(id, data, connection = db) { return updateRecord(connection, ACTIONS, id, data); },
  async findAction(id, connection = db, forUpdate = false) {
    let q = connection(ACTIONS).where({ id });
    if (forUpdate) q = q.forUpdate();
    return firstOrNull(q);
  },
  deleteAction(id, connection = db) { return connection(ACTIONS).where({ id }).del(); },
  actionsQuery(ownerAdminId) { return db(ACTIONS).where({ ownerAdminId }); },
  findActionsForSession(sessionId) { return db(ACTIONS).where({ sessionId }).orderBy("createdAt", "asc"); },

  addUpdate(data, connection = db) { return createRecord(connection, UPDATES, data, { updatedAt: false }); },
  findUpdates(actionId) { return db(UPDATES).where({ actionId }).orderBy("createdAt", "asc"); },
  deleteUpdates(actionId, connection = db) { return connection(UPDATES).where({ actionId }).del(); },

  transaction(work) { return db.transaction(work); },
};

module.exports = CheckinModel;
module.exports._internal = { shapeSession };
