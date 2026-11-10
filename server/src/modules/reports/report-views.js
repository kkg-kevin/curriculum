// A published report opened by the family (10 Nov 2026) — report_views, one row per report per
// login: who (the parent's login, or the child's own / a TOT learner's), first and last time, how
// many times. Read by Reports & Analytics → Parent engagement and "Needs your attention". Recording
// never fails the page.

const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const { isParent } = require("../parent/parent.access");

async function recordView(report, user) {
  try {
    if (!report?.id || report.status !== "published" || !user?.id || user.role !== "learner") return;
    const viewer = isParent(user) && !user.totLearner ? "parent" : "learner";
    const now = new Date();
    const updated = await db("report_views").where({ reportId: report.id, userId: user.id })
      .update({ views: db.raw("views + 1"), lastViewedAt: now });
    if (!updated) {
      await db("report_views").insert({ id: generateId(), reportId: report.id, learnerId: report.learnerId, userId: user.id, viewer, views: 1, firstViewedAt: now, lastViewedAt: now })
        .catch((err) => { if (err.code !== "ER_DUP_ENTRY") throw err; });
    }
  } catch (err) {
    console.error("[report-views] could not record:", err.message);
  }
}

module.exports = { recordView };
