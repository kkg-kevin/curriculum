// Parent feedback (Reports & Analytics → Parent feedback): what parents (and TOT learners) said about
// the educators in scope in the period — modules/mentor-reviews/. Reviews at the scope's hubs (the
// chosen class's, when one is), averaged per educator. Admins also get the open conduct concerns. A
// hub sees averages only for educators with at least 3 reviews (no one parent can be picked out),
// never the concerns or comments, and only when its workspace lets hubs see averages.

const db = require("../../config/db");
const { fullName, inChunks } = require("./analytics.utils");
const { ANONYMOUS_MIN_REVIEWS, summarise } = require("../mentor-reviews/mentor-review.rules");
const { getSettings } = require("../mentor-reviews/mentor-review.service");

async function getParentFeedback(scope) {
  const settings = await getSettings(scope.ownerAdminId || scope.hubs[0]?.ownerAdminId || null);
  const aspects = settings.aspects;
  if (scope.isHubView && !settings.hubsSeeAverages) return { hidden: true, aspects, educators: [], concerns: [] };
  if (!scope.hubIds.length) return { aspects, summary: summarise([], aspects), educators: [], concerns: [], isHubView: scope.isHubView };

  const reviews = (await inChunks(scope.hubIds, (ids) => db("mentor_reviews").whereIn("hubId", ids)
    .whereBetween("createdAt", [scope.period.start, scope.period.end])))
    .filter((r) => !scope.filters.classId || r.classId === scope.filters.classId)
    .filter((r) => !scope.filters.courseId || r.courseId === scope.filters.courseId);

  const teacherIds = [...new Set(reviews.map((r) => r.teacherId))];
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", teacherIds).select("id", "firstName", "lastName") : [];
  const nameOf = new Map(teachers.map((t) => [t.id, fullName(t) || "Educator"]));

  const byTeacher = new Map();
  for (const r of reviews) (byTeacher.get(r.teacherId) || byTeacher.set(r.teacherId, []).get(r.teacherId)).push(r);
  let educators = [...byTeacher.entries()].map(([teacherId, rs]) => {
    const s = summarise(rs, aspects);
    return {
      teacherId,
      name: nameOf.get(teacherId) || "Educator",
      count: s.count,
      average: s.average,
      aspects: Object.fromEntries(s.aspects.map((a) => [a.key, a.average])),
      openConcerns: scope.isHubView ? undefined : rs.filter((r) => r.concern && !r.concernResolvedAt).length,
      lastReviewAt: rs.reduce((m, r) => (new Date(r.createdAt) > m ? new Date(r.createdAt) : m), new Date(0)),
    };
  });
  const tooFew = scope.isHubView ? educators.filter((e) => e.count < ANONYMOUS_MIN_REVIEWS).length : 0;
  if (scope.isHubView) educators = educators.filter((e) => e.count >= ANONYMOUS_MIN_REVIEWS);

  let concerns = [];
  if (!scope.isHubView) {
    const open = reviews.filter((r) => r.concern && !r.concernResolvedAt);
    const learnerIds = [...new Set(open.map((r) => r.learnerId))];
    const learners = learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("id", "firstName", "lastName") : [];
    const learnerName = new Map(learners.map((l) => [l.id, fullName(l)]));
    concerns = open.map((r) => ({
      reviewId: r.id, teacherId: r.teacherId, educator: nameOf.get(r.teacherId) || "Educator",
      learnerId: r.learnerId, learner: learnerName.get(r.learnerId) || "Learner",
      hubName: scope.hubById.get(r.hubId)?.name || null, text: r.concernText || "", createdAt: r.createdAt,
    }));
  }

  return {
    isHubView: scope.isHubView,
    aspects,
    summary: scope.isHubView && reviews.length < ANONYMOUS_MIN_REVIEWS ? { ...summarise([], aspects), count: reviews.length } : summarise(reviews, aspects),
    educators,
    tooFew,
    concerns,
    minReviews: ANONYMOUS_MIN_REVIEWS,
  };
}

module.exports = { getParentFeedback };
