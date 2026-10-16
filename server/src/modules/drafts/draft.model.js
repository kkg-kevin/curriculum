const db = require("../../config/db");
const { createRecord, firstOrNull, toJson, withOwnerScope } = require("../../shared/utils/model.utils");

const TABLE = "drafts";

// What the "Unsaved drafts" lists show — everything but the form itself, which can be large.
const SUMMARY_COLUMNS = ["id", "kind", "recordId", "parentId", "type", "name", "revision", "lastEditedBy", "createdAt", "updatedAt"];

const DraftModel = {
  create(data) {
    return createRecord(db, TABLE, { ...data, content: toJson(data.content), revision: 1 });
  },

  // The workspace's drafts of the given kinds, newest first.
  findAll({ ownerAdminId, kinds, kind, recordId, parentId } = {}) {
    let query = withOwnerScope(db(TABLE), ownerAdminId).whereIn("kind", kinds).select(SUMMARY_COLUMNS);
    if (kind) query = query.where({ kind });
    if (recordId) query = query.where({ recordId });
    if (parentId) query = query.where({ parentId });
    return query.orderBy("updatedAt", "desc");
  },

  findById(id) {
    return firstOrNull(db(TABLE).where({ id }));
  },

  // Only writes when the draft is still at `revision` — someone else's write in between bumps it
  // and this returns null. One statement, so two writes at the same moment can't both pass.
  async updateAtRevision(id, revision, data) {
    const count = await db(TABLE)
      .where({ id, revision })
      .update({ ...data, content: toJson(data.content), revision: revision + 1, updatedAt: new Date() });
    if (count === 0) return null;
    return this.findById(id);
  },

  async delete(id) {
    return (await db(TABLE).where({ id }).del()) > 0;
  },

  deleteMany(ids) {
    return ids.length ? db(TABLE).whereIn("id", ids).del() : 0;
  },

  // Drafts of a record that no longer exists have nothing to be saved into.
  deleteByRecord(kind, recordId) {
    return db(TABLE).where({ kind, recordId }).del();
  },

  deleteByParent(parentId) {
    return db(TABLE).where({ parentId }).del();
  },
};

module.exports = DraftModel;
