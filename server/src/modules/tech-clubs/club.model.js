const db = require("../../config/db");
const { createRecord, updateRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

const MEMBERSHIPS = "club_memberships";
const CHILDREN = "club_membership_children";
const MEMBERSHIP_JSON_FIELDS = ["pendingBilling"];

// No SQL joins here: the club tables, learners and classes don't all share one collation, so
// related rows are looked up by id in separate queries instead.
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const idsOf = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))];
async function lookup(table, ids) {
  return byId(ids.length ? await db(table).whereIn("id", ids) : []);
}

// A class has no name of its own — it reads as its grade plus stream ("Grade 4 · Coders").
const classLabel = (cls) => [cls.gradeName, cls.streamName].filter(Boolean).join(" · ") || "Class";

const learnerSummary = (l) => (l ? {
  id: l.id, firstName: l.firstName, lastName: l.lastName, gender: l.gender, photo: l.photo, username: l.username || null,
  accountStatus: l.accountStatus, guardianEmail: l.guardianEmail,
} : null);

const ClubMembershipModel = {
  // The admin's memberships (optionally at one club), newest first, each with its children.
  async findAll(ownerAdminId, { hubId } = {}) {
    let query = db(MEMBERSHIPS).where({ ownerAdminId });
    if (hubId) query = query.where({ hubId });
    const memberships = await query.orderBy("createdAt", "desc");
    if (!memberships.length) return [];
    const children = await db(CHILDREN)
      .where({ ownerAdminId })
      .whereIn("membershipId", memberships.map((m) => m.id))
      .orderBy("createdAt", "asc");
    const [learners, classes] = await Promise.all([
      lookup("learners", idsOf(children, "learnerId")),
      lookup("classes", idsOf(children, "classId")),
    ]);
    return memberships.map((membership) => ({
      ...membership,
      children: children.filter((c) => c.membershipId === membership.id).map((child) => {
        const cls = classes.get(child.classId);
        return {
          ...child,
          learner: learnerSummary(learners.get(child.learnerId)),
          class: cls ? { id: cls.id, name: classLabel(cls), status: cls.status } : null,
        };
      }),
    }));
  },

  findById(id, ownerAdminId) {
    return firstOrNull(db(MEMBERSHIPS).where({ id, ownerAdminId }));
  },

  findByIdAnyOwner(id) {
    return firstOrNull(db(MEMBERSHIPS).where({ id }));
  },

  // Memberships a parent login reaches (matched on the parent's email), never cancelled ones.
  async findByGuardianEmail(email) {
    if (!email) return [];
    return db(MEMBERSHIPS).whereRaw("LOWER(guardianEmail) = ?", [email.toLowerCase()]).whereNot({ status: "cancelled" });
  },

  findChildren(membershipId, ownerAdminId) {
    return db(CHILDREN).where({ membershipId, ownerAdminId }).orderBy("createdAt", "asc");
  },

  findChild(membershipId, learnerId, ownerAdminId) {
    return firstOrNull(db(CHILDREN).where({ membershipId, learnerId, ownerAdminId }));
  },

  findChildrenByLearner(learnerId) {
    return db(CHILDREN).where({ learnerId });
  },

  async countActiveChildren(membershipId, ownerAdminId) {
    const row = await db(CHILDREN).where({ membershipId, ownerAdminId, status: "active" }).count({ count: "*" }).first();
    return Number(row?.count || 0);
  },

  create(data) {
    return createRecord(db, MEMBERSHIPS, stringifyJsonFields(data, MEMBERSHIP_JSON_FIELDS));
  },

  async update(id, ownerAdminId, data) {
    const existing = await firstOrNull(db(MEMBERSHIPS).where({ id, ownerAdminId }));
    if (!existing) return null;
    await updateRecord(db, MEMBERSHIPS, id, stringifyJsonFields(data, MEMBERSHIP_JSON_FIELDS));
    return firstOrNull(db(MEMBERSHIPS).where({ id, ownerAdminId }));
  },

  createChild(data) {
    return createRecord(db, CHILDREN, data);
  },

  async updateChild(id, data) {
    await updateRecord(db, CHILDREN, id, data);
    return firstOrNull(db(CHILDREN).where({ id }));
  },

  deleteChildrenByLearner(learnerId) {
    return db(CHILDREN).where({ learnerId }).del();
  },

  // Undo for a failed sign-up — the membership and its child rows.
  async deleteMembership(id) {
    await db(CHILDREN).where({ membershipId: id }).del();
    await db(MEMBERSHIPS).where({ id }).del();
  },
};

module.exports = ClubMembershipModel;
module.exports.classLabel = classLabel;
