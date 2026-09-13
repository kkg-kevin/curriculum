const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "competition_hubs";
const JSON_FIELDS = ["classIds"];

const CompetitionHubModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ ownerAdminId, competitionId, hubId } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (competitionId) query = query.where({ competitionId });
    if (hubId) query = query.where({ hubId });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByCompetitionId(competitionId) {
    return db(TABLE).where({ competitionId }).orderBy("createdAt", "desc");
  },

  // Uniqueness guard — one competition can run at a given hub only once (its dates are now
  // uniform across every hub it runs at).
  findByCompetitionAndHub(competitionId, hubId) {
    return firstOrNull(db(TABLE).where({ competitionId, hubId }));
  },

  // The offering that generated a given auto-created Class, if any — a Class has no back-
  // reference of its own, so this scans the other direction over each offering's classIds.
  // Direct port of the old EventModel.findByClassId; used by the timetable engine.
  async findByClassId(classId) {
    const offerings = await db(TABLE);
    return offerings.find((o) => (o.classIds || []).includes(classId)) || null;
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },

  deleteByCompetitionId(competitionId) {
    return db(TABLE).where({ competitionId }).del();
  },
};

module.exports = CompetitionHubModel;
