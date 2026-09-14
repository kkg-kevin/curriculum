const db = require("../../config/db");
const {
  createRecord,
  updateRecord,
  deleteRecord,
  firstOrNull,
  stringifyJsonFields,
} = require("../../shared/utils/model.utils");

const TABLE = "bootcamp_hubs";
const JSON_FIELDS = ["classIds"];

const BootcampHubModel = {
  create(data) {
    return createRecord(db, TABLE, stringifyJsonFields(data, JSON_FIELDS));
  },

  findAll({ ownerAdminId, bootcampId, hubId } = {}) {
    let query = db(TABLE);
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (bootcampId) query = query.where({ bootcampId });
    if (hubId) query = query.where({ hubId });
    return query.orderBy("createdAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  findByBootcampId(bootcampId) {
    return db(TABLE).where({ bootcampId }).orderBy("createdAt", "desc");
  },

  // Uniqueness guard — one bootcamp can run at a given hub only once (its dates are now
  // uniform across every hub it runs at, so a second run there would always overlap; see
  // bootcamp-hub.service.js's createOffering).
  findByBootcampAndHub(bootcampId, hubId) {
    return firstOrNull(db(TABLE).where({ bootcampId, hubId }));
  },

  // The offering that generated a given auto-created Class, if any — a Class has no back-
  // reference of its own (see bootcamp-hub.service.js's createOffering), so this scans the
  // other direction over each offering's classIds. Direct port of the old
  // EventModel.findByClassId; used by the timetable engine to find a bootcamp's running dates
  // for a class belonging to it.
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

  deleteByBootcampId(bootcampId) {
    return db(TABLE).where({ bootcampId }).del();
  },
};

module.exports = BootcampHubModel;
