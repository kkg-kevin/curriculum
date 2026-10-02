const db = require("../../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../../shared/utils/model.utils");

const TABLE = "event_games";
const JSON_FIELDS = ["skills"];

// The games library — see 20261005090000_add_event_games.js.
const GameModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll(ownerAdminId) {
    return db(TABLE).where({ ownerAdminId }).orderBy("name", "asc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Rows come back in no particular order — callers that care (a bootcamp's own game order)
  // re-order by their id list.
  findByIds(ids) {
    return ids.length ? db(TABLE).whereIn("id", ids) : Promise.resolve([]);
  },

  findByName(ownerAdminId, name) {
    return firstOrNull(db(TABLE).where({ ownerAdminId }).whereRaw("LOWER(name) = ?", [String(name).trim().toLowerCase()]));
  },

  update(id, data) {
    return updateRecord(db, TABLE, id, stringifyJsonFields(data, JSON_FIELDS));
  },

  delete(id) {
    return deleteRecord(db, TABLE, id);
  },
};

module.exports = GameModel;
