const db = require("../../config/db");
const R = require("./ranking.rules");
const RankingService = require("./ranking.service");
const NotificationService = require("../notifications/notification.service");
const { kenyaDay } = require("../analytics/analytics.utils");

// The weekly round of class rankings (`npm run rankings:weekly`, Monday mornings from cron):
// every class with learners is ranked afresh — which writes this week's snapshot and awards any
// new badges — then each learner with a score this period hears, on the bell and by email to the
// parent (Settings → Emails can switch either off):
//   ranking_moved_up  their place went up since last week (only where their place is shown exactly)
//   ranking_weekly    the week's summary: score and level, their place or band, one next step
// Classes whose hub has rankings switched off (Settings → Rankings) are skipped. Safe to repeat:
// each notice has a key per learner, class and week.

function summaryOf(entry, data, standing, movement) {
  const name = entry.firstName || "Your child";
  const place = standing?.exact
    ? `, ${R.ordinal(standing.rank)} of ${standing.rankedCount}${movement > 0 ? ` (up ${movement})` : ""}`
    : standing ? ` — ${standing.band.toLowerCase()}` : "";
  const step = R.nextSteps(entry.parts, { open: entry.open, missed: entry.missed })[0];
  return `${name} in ${data.className}: Learning Score ${Math.round(entry.score)} out of 100 (${R.levelOf(entry.score).label})${place}. Next step: ${step.text}`;
}

async function runWeekly({ today = kenyaDay(new Date()) } = {}) {
  const week = R.weekStart(today);
  const allClassIds = (await db("learner_hub_links").where({ status: "active" }).whereNotNull("classId").distinct("classId").pluck("classId")).filter(Boolean);
  // A bootcamp run that has ended isn't ranked or announced any more (26 Nov 2026): its standing
  // stays as it was, and families stop getting weekly notices about a class that no longer meets.
  const { withRunInfo } = require("../classes/class-former-members");
  const ended = new Set((await withRunInfo(allClassIds.map((id) => ({ id })))).filter((c) => c.bootcampRun?.state === "ended").map((c) => c.id));
  const classIds = allClassIds.filter((id) => !ended.has(id));
  let classes = 0;
  let movedUp = 0;
  let summaries = 0;
  const weeklyByLearner = new Map();
  for (const classId of classIds) {
    try {
      const data = await RankingService.classStanding(classId, { fresh: true });
      if (!data.enabled) continue;
      classes += 1;
      const history = await RankingService.historyOf(classId, data.entries.map((e) => e.learnerId), data.period.key);
      for (const entry of data.entries) {
        if (entry.score == null) continue;
        const standing = data.ranked && entry.rank ? R.standingOf(entry.rank, data.rankedCount) : null;
        const before = (history.get(entry.learnerId) || []).filter((h) => h.week < week && h.rank != null);
        const last = before[before.length - 1];
        const movement = standing?.exact && last ? last.rank - entry.rank : null;
        const route = `/learner-portal/position?child=${entry.learnerId}`;
        const payload = { learnerId: entry.learnerId, classId, route };
        if (movement > 0) {
          await NotificationService.notifyLearner(entry.learnerId, {
            type: "ranking_moved_up",
            title: `Up ${movement} ${movement === 1 ? "place" : "places"} in ${data.className}`,
            message: `${entry.firstName || "Your child"} moved up to ${R.ordinal(entry.rank)} of ${data.rankedCount} this week. Well done!`,
            ownerAdminId: data.ownerAdminId,
            dedupeKey: `ranking_moved_up:${classId}:${entry.learnerId}:${week}`,
            payload,
          });
          movedUp += 1;
        }
        // One summary per learner, however many classes they're in — collected, sent below.
        const list = weeklyByLearner.get(entry.learnerId) || weeklyByLearner.set(entry.learnerId, { firstName: entry.firstName, ownerAdminId: data.ownerAdminId, lines: [] }).get(entry.learnerId);
        list.lines.push(summaryOf(entry, data, standing, movement));
      }
    } catch (err) {
      console.error(`[rankings-weekly] class ${classId}: ${err.message}`);
    }
  }
  for (const [learnerId, w] of weeklyByLearner) {
    try {
      await NotificationService.notifyLearner(learnerId, {
        type: "ranking_weekly",
        title: `${w.firstName || "Your child"}'s week in class`,
        message: w.lines.join("\n"),
        ownerAdminId: w.ownerAdminId,
        dedupeKey: `ranking_weekly:${learnerId}:${week}`,
        payload: { learnerId, route: `/learner-portal/position?child=${learnerId}` },
      });
      summaries += 1;
    } catch (err) {
      console.error(`[rankings-weekly] learner ${learnerId}: ${err.message}`);
    }
  }
  return { week, classes, movedUp, summaries };
}

module.exports = { runWeekly, summaryOf };
