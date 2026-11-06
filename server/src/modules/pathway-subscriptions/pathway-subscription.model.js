const db = require("../../config/db");
const { createRecord, updateRecord, deleteRecord, firstOrNull, stringifyJsonFields } = require("../../shared/utils/model.utils");

// Pathway plans (pathway_packages), subscriptions (pathway_subscriptions) and the children on each
// (pathway_subscription_children) — see the migration 20261104130000 and pathway-subscription.service.js.
const PACKAGES = "pathway_packages";
const SUBS = "pathway_subscriptions";
const CHILDREN = "pathway_subscription_children";

const list = (v) => (Array.isArray(v) ? v : []);
const normalisePackage = (pkg) => (pkg ? { ...pkg, features: list(pkg.features), isPublished: !!pkg.isPublished, allowExtraChildren: !!pkg.allowExtraChildren } : null);
const normaliseSub = (sub) => (sub ? { ...sub, pendingBilling: sub.pendingBilling && typeof sub.pendingBilling === "object" ? sub.pendingBilling : null } : null);
const orderedPackages = (query) => query.orderBy([{ column: "sortOrder", order: "asc" }, { column: "amount", order: "asc" }, { column: "name", order: "asc" }]);

const PathwayPackageModel = {
  async findAll(ownerAdminId, { pathwayTemplateId = null, publishedOnly = false } = {}) {
    let query = db(PACKAGES).where({ ownerAdminId });
    if (pathwayTemplateId) query = query.where({ pathwayTemplateId });
    if (publishedOnly) query = query.where({ isPublished: true, status: "active" });
    return (await orderedPackages(query)).map(normalisePackage);
  },
  async findById(id, ownerAdminId = null) {
    return normalisePackage(await firstOrNull(db(PACKAGES).where({ id, ...(ownerAdminId ? { ownerAdminId } : {}) })));
  },
  async findBySlug(slug, ownerAdminId) {
    return normalisePackage(await firstOrNull(db(PACKAGES).where({ slug, ownerAdminId })));
  },
  async countSubscriptions(packageId) {
    const row = await db(SUBS).where({ packageId }).count({ count: "*" }).first();
    return Number(row?.count || 0);
  },
  async create(data) {
    const row = await createRecord(db, PACKAGES, stringifyJsonFields(data, ["features", "periodPrices"]));
    return normalisePackage(await firstOrNull(db(PACKAGES).where({ id: row.id })));
  },
  async update(id, data) {
    return normalisePackage(await updateRecord(db, PACKAGES, id, stringifyJsonFields(data, ["features", "periodPrices"])));
  },
  delete(id) {
    return deleteRecord(db, PACKAGES, id);
  },
};

const PathwaySubscriptionModel = {
  async findAll(ownerAdminId, { status = null, pathwayTemplateId = null } = {}) {
    let query = db(SUBS).where({ ownerAdminId });
    if (status) query = query.where({ status });
    if (pathwayTemplateId) query = query.where({ pathwayTemplateId });
    return (await query.orderBy("createdAt", "desc")).map(normaliseSub);
  },
  async findById(id, ownerAdminId = null) {
    return normaliseSub(await firstOrNull(db(SUBS).where({ id, ...(ownerAdminId ? { ownerAdminId } : {}) })));
  },
  async findByGuardianEmail(email) {
    if (!email) return [];
    return (await db(SUBS).whereRaw("LOWER(guardianEmail) = ?", [String(email).toLowerCase()]).orderBy("createdAt", "desc")).map(normaliseSub);
  },
  async create(data) {
    const row = await createRecord(db, SUBS, stringifyJsonFields(data, ["pendingBilling"]));
    return normaliseSub(await firstOrNull(db(SUBS).where({ id: row.id })));
  },
  // The package billing engine calls this as update(rec, patch) through package-billing.js.
  async update(id, data) {
    return normaliseSub(await updateRecord(db, SUBS, id, stringifyJsonFields(data, ["pendingBilling"])));
  },
  delete(id) {
    return deleteRecord(db, SUBS, id);
  },

  children(subscriptionId) {
    return db(CHILDREN).where({ subscriptionId }).orderBy("createdAt", "asc");
  },
  childrenOf(subscriptionIds) {
    return subscriptionIds.length ? db(CHILDREN).whereIn("subscriptionId", subscriptionIds) : Promise.resolve([]);
  },
  activeLearnerIds(subscriptionId) {
    return db(CHILDREN).where({ subscriptionId, status: "active" }).pluck("learnerId");
  },
  addChild(data) {
    return createRecord(db, CHILDREN, data);
  },
  subscriptionsOfLearner(learnerId) {
    return db(`${CHILDREN} as c`).join(`${SUBS} as s`, "s.id", "c.subscriptionId").where("c.learnerId", learnerId).select("s.*", "c.status as childStatus");
  },
};

module.exports = { PathwayPackageModel, PathwaySubscriptionModel };
