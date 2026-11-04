const db = require("../../config/db");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const { generateId } = require("../../shared/utils/model.utils");
const { kenyaToday } = require("../../shared/utils/age");

// What a learner may open on a pathway, apart from their class (learner_pathway_access):
//   - source "subscription": a pathway plan (pathway-subscription.service.js) — open until
//     `accessUntil` (the paid periods' last day plus the workspace's grace days), then locked;
//   - source "purchase": a one-off price (Settings → Pathways → Price) — open with no end.
// A pathway is its rows of one curriculum sharing a name (one row per developmental stage), so
// access covers every stage's courses: the learner moves up the pathway without paying again.
// Locked access never touches the account (accountStatus) — the learner's class and other
// pathways stay open, and their work, reports and certificates are kept.
//
// Course access (course.controller.js's assertCourseAccess) allows a learner a course of their
// class's curriculum OR one of openCourseIds here.
const TABLE = "learner_pathway_access";
const sameName = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const isOpen = (row, today) => row.status === "active" && (!row.accessUntil || row.accessUntil >= today);

// The pathway's courses in its curriculum, every stage, in stage order then course order.
async function coursesOf(row) {
  const rows = (await PathwayModel.findByCurriculumId(row.curriculumId)).filter((p) => sameName(p.name, row.pathwayName));
  const ids = [];
  for (const p of rows) for (const id of Array.isArray(p.courses) ? p.courses : []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

const PathwayAccess = {
  isOpen,
  coursesOf,

  // Course ids the learner may open today through a pathway (not through a class).
  async openCourseIds(learnerId, today = kenyaToday()) {
    if (!learnerId) return new Set();
    const rows = (await db(TABLE).where({ learnerId, status: "active" })).filter((r) => isOpen(r, today));
    const ids = new Set();
    for (const row of rows) (await coursesOf(row)).forEach((id) => ids.add(id));
    return ids;
  },

  // Every pathway the learner has (or had) access to, for their courses page and staff: open or
  // locked, until when, and its courses.
  async listForLearner(learnerId, today = kenyaToday()) {
    const rows = await db(TABLE).where({ learnerId }).whereNot({ status: "revoked" }).orderBy("createdAt", "asc");
    const out = [];
    for (const row of rows) {
      out.push({
        id: row.id,
        pathwayName: row.pathwayName,
        curriculumId: row.curriculumId,
        pathwayTemplateId: row.pathwayTemplateId,
        source: row.source,
        subscriptionId: row.subscriptionId,
        accessUntil: row.accessUntil,
        open: isOpen(row, today),
        courseIds: await coursesOf(row),
      });
    }
    return out;
  },

  // Gives (or updates) a learner's access to a pathway. One row per learner, pathway and source
  // (and subscription), so granting again just moves its end date.
  async grant({ ownerAdminId, learnerId, curriculumId, pathwayTemplateId = null, pathwayName, source, subscriptionId = null, invoiceId = null, accessUntil = null }) {
    const now = new Date();
    const existing = (await db(TABLE).where({ learnerId, curriculumId, source }).modify((q) => { if (subscriptionId) q.where({ subscriptionId }); }))
      .find((r) => sameName(r.pathwayName, pathwayName));
    if (existing) {
      const patch = { status: "active", updatedAt: now, ...(invoiceId ? { invoiceId } : {}) };
      // A lifetime purchase stays lifetime; a subscription takes the later end date.
      if (source === "subscription") patch.accessUntil = [existing.accessUntil, accessUntil].filter(Boolean).sort().pop() || null;
      await db(TABLE).where({ id: existing.id }).update(patch);
      return { ...existing, ...patch };
    }
    const row = { id: generateId(), ownerAdminId, learnerId, curriculumId, pathwayTemplateId, pathwayName, source, subscriptionId, invoiceId, accessUntil: source === "purchase" ? null : accessUntil, status: "active", createdAt: now, updatedAt: now };
    await db(TABLE).insert(row);
    return row;
  },

  // A subscription's end date for every child on it (paying a period, a lapse, a cancellation).
  async setForSubscription(subscriptionId, { accessUntil, status = "active" }) {
    return db(TABLE).where({ subscriptionId, source: "subscription" }).update({ accessUntil, status, updatedAt: new Date() });
  },

  // A child taken off a subscription, or a learner deleted: their access row goes.
  async removeForLearner(learnerId, { subscriptionId = null } = {}) {
    return db(TABLE).where({ learnerId }).modify((q) => { if (subscriptionId) q.where({ subscriptionId }); }).del();
  },
};

module.exports = PathwayAccess;
