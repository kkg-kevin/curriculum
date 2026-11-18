const db = require("../../config/db");
const R = require("./ranking.rules");
const { loadWork } = require("../analytics/analytics.work");
const { className } = require("../analytics/analytics.scope");
const { inChunks, json, kenyaDay, startOfKenyaDay, endOfKenyaDay } = require("../analytics/analytics.utils");
const CompetencyModel = require("../settings/competencies/competency.model");
const NotificationService = require("../notifications/notification.service");
const { generateId } = require("../../shared/utils/model.utils");

// Class rankings — a learner's Learning Score and place in each of their classes, worked out from
// the same records the reports and analytics use (analytics.work.js: the work issued, handed in,
// marked; attendance; competency marks). See ranking.rules.js for the score.
//
// A class's ranking is worked out when someone looks (or by the weekly job, ranking.weekly.js) and
// kept for a few minutes. Each time:
//   - this week's snapshot is written (learner_rank_snapshots) — last week's is what "moved up 2"
//     and the trend are read from;
//   - badges newly earned are kept (learner_badges) and announced once (bell + email to the
//     learner and their parent) — only while rankings are on for the class's hub.
// Settings → Rankings (ranking_settings, one row per workspace) can switch rankings off for the
// workspace or a hub (families then see nothing; staff still see the class ranking), change the
// weights and minimums, how other children are named, and the period ranked.

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();
const settingsCache = new Map();

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (l) => [l.firstName, l.lastName].filter(Boolean).join(" ").trim() || "Learner";
const badgeDef = (key) => R.BADGES.find((b) => b.key === key);

let indicatorCache = null;
async function indicatorToCompetency() {
  if (indicatorCache && indicatorCache.at > Date.now() - CACHE_MS) return indicatorCache.map;
  const map = new Map();
  for (const c of await CompetencyModel.findAll()) for (const ind of c.indicators || []) map.set(ind.id, c.id);
  indicatorCache = { at: Date.now(), map };
  return map;
}

// ---- Settings ---------------------------------------------------------------------------------
async function settingsFor(ownerAdminId) {
  if (!ownerAdminId) return R.settingsOf(null);
  const hit = settingsCache.get(ownerAdminId);
  if (hit && hit.at > Date.now() - 60 * 1000) return hit.settings;
  const row = await db("ranking_settings").where({ ownerAdminId }).first();
  const settings = R.settingsOf(row);
  settingsCache.set(ownerAdminId, { at: Date.now(), settings });
  return settings;
}

async function saveSettings(ownerAdminId, data) {
  const row = {
    enabled: data.enabled,
    disabledHubIds: JSON.stringify(data.disabledHubIds || []),
    weights: JSON.stringify(data.weights),
    minMarked: data.minMarked,
    minClass: data.minClass,
    nameStyle: data.nameStyle,
    period: data.period,
    terms: JSON.stringify(data.terms || []),
    updatedAt: new Date(),
  };
  const existing = await db("ranking_settings").where({ ownerAdminId }).first("id");
  if (existing) await db("ranking_settings").where({ id: existing.id }).update(row);
  else await db("ranking_settings").insert({ ...row, id: generateId(), ownerAdminId, createdAt: new Date() });
  settingsCache.delete(ownerAdminId);
  cache.clear();
  return settingsFor(ownerAdminId);
}

// ---- One class ----------------------------------------------------------------------------------
// Everything about one class in its current period, ranked:
// { cls, className, ownerAdminId, settings, enabled, period, ranked, rankedCount, entries, boards,
//   averages, mostImproved }
async function classStanding(classId, { fresh = false } = {}) {
  const today = kenyaDay(new Date());
  const cls = await db("classes").where({ id: classId }).first();
  if (!cls) fail("Class not found", 404);
  const hub = cls.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("id", "ownerAdminId") : null;
  const ownerAdminId = hub?.ownerAdminId || null;
  const settings = await settingsFor(ownerAdminId);
  const period = R.periodFor(today, settings);
  const key = `${classId}|${period.key}|${today}`;
  const hit = cache.get(key);
  if (!fresh && hit && hit.at > Date.now() - CACHE_MS) return hit.data;

  const links = await db("learner_hub_links").where({ classId, status: "active" });
  const learners = await inChunks(links.map((l) => l.learnerId), (ids) => db("learners").whereIn("id", ids).select("id", "firstName", "lastName", "photo", "accountStatus"));
  const learnerIds = new Set(learners.map((l) => l.id));
  const scope = { classIds: [cls.id], classById: new Map([[cls.id, cls]]), links: links.filter((l) => learnerIds.has(l.learnerId)), learnerIds, filters: { courseId: null } };

  const to = today < period.to ? today : period.to;
  const { tasks: allTasks, assessmentById, courseById } = await loadWork(scope, startOfKenyaDay(period.from), endOfKenyaDay(to));
  // This class's work (work issued to a learner alone, with no class, counts in each of their classes).
  const tasks = allTasks.filter((t) => !t.issue.classId || t.issue.classId === cls.id);

  const attendance = learnerIds.size ? await db("attendance").where({ classId: cls.id }).whereIn("learnerId", [...learnerIds]).whereBetween("date", [period.from, to]).select("learnerId", "status", "date") : [];

  // Competency marks from the marked work.
  const markedSubIds = tasks.filter((t) => t.marked && t.sub).map((t) => t.sub.id);
  const breakdowns = await inChunks(markedSubIds, (ids) => db("assessment_submissions").whereIn("id", ids).select("id", "learnerId", "indicatorBreakdown"));
  const indComp = await indicatorToCompetency();
  const compMarks = new Map(); // learnerId -> Map(competencyId -> {e,p})
  for (const s of breakdowns) {
    for (const r of json(s.indicatorBreakdown) || []) {
      const compId = indComp.get(r.indicatorId);
      const p = Number(r.marksPossible) || 0;
      if (!compId || p <= 0) continue;
      const m = compMarks.get(s.learnerId) || compMarks.set(s.learnerId, new Map()).get(s.learnerId);
      const cur = m.get(compId) || { e: 0, p: 0 };
      cur.e += Number(r.marksEarned) || 0;
      cur.p += p;
      m.set(compId, cur);
    }
  }

  const tasksBy = new Map();
  for (const t of tasks) (tasksBy.get(t.learnerId) || tasksBy.set(t.learnerId, []).get(t.learnerId)).push({ ...t, gradedAt: t.sub?.gradedAt || null });
  const attBy = new Map();
  for (const a of attendance) (attBy.get(a.learnerId) || attBy.set(a.learnerId, []).get(a.learnerId)).push({ ...a, date: String(a.date).slice(0, 10) });

  const nameOfIssue = (t) => assessmentById.get(t.issue.assessmentId)?.name || "Assessment";
  const courses = new Map();
  for (const t of tasks) if (t.issue.courseId && courseById.get(t.issue.courseId)) courses.set(t.issue.courseId, courseById.get(t.issue.courseId).name);

  const raw = learners.map((l) => {
    const mine = tasksBy.get(l.id) || [];
    const att = attBy.get(l.id) || [];
    const marks = compMarks.get(l.id) || new Map();
    const parts = R.partsFor({ tasks: mine, attendance: att, competencyMarks: marks });
    const courseMarks = new Map();
    for (const t of mine) if (t.marked && t.percent != null && t.issue.courseId) (courseMarks.get(t.issue.courseId) || courseMarks.set(t.issue.courseId, []).get(t.issue.courseId)).push(t.percent);
    return {
      learnerId: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      name: fullName(l),
      photo: l.photo || null,
      parts,
      score: R.scoreOf(parts, settings.weights),
      markedCount: parts.markedCount,
      courseMarks,
      tasks: mine,
      attendance: att,
      competencyMarks: marks,
      streaks: { onTime: R.onTimeStreak(mine), attendance: R.attendanceStreak(att) },
      open: mine.filter((t) => !t.handedIn && t.timing === "pending").sort((a, b) => (a.dueEnd || Infinity) - (b.dueEnd || Infinity))
        .map((t) => ({ name: nameOfIssue(t), dueDate: t.issue.dueDate ? String(t.issue.dueDate).slice(0, 10) : null })),
      missed: mine.filter((t) => t.timing === "missed").map((t) => ({ name: nameOfIssue(t) })),
    };
  });
  const { ranked, rankedCount, entries } = R.rankClass(raw, { minMarked: settings.minMarked, minClass: settings.minClass });
  const boards = R.boardsFor(entries, courses, { minClass: settings.minClass });
  const improved = boards.find((b) => b.key === "improved");
  const mostImproved = new Set(improved ? improved.rows.filter((r) => r.rank === 1 && r.value > 0).map((r) => r.learnerId) : []);

  const averages = {};
  for (const { key: part } of R.PARTS) {
    const vals = entries.map((e) => e.parts[part]).filter((v) => v != null);
    averages[part] = vals.length ? R.round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  }
  const scores = entries.filter((e) => e.eligible).map((e) => e.score);
  averages.score = scores.length ? R.round1(scores.reduce((s, v) => s + v, 0) / scores.length) : null;

  const enabled = settings.enabled && !(cls.schoolId && settings.disabledHubIds.includes(cls.schoolId));
  const data = { cls, className: className(cls), ownerAdminId, settings, enabled, period, ranked, rankedCount, entries, boards, averages, mostImproved, computedAt: new Date().toISOString() };

  await saveSnapshots(data, today).catch((err) => console.error("[rankings] snapshot not saved:", err.message));
  data.badges = await awardBadges(data).catch((err) => {
    console.error("[rankings] badges not saved:", err.message);
    return new Map();
  });
  cache.set(key, { at: Date.now(), data });
  return data;
}

// This week's snapshot for every learner of the class (replaced while the week lasts).
async function saveSnapshots(data, today) {
  const week = R.weekStart(today);
  const now = new Date();
  const rows = data.entries.map((e) => ({
    id: generateId(), classId: data.cls.id, learnerId: e.learnerId, termKey: data.period.key, weekStart: week,
    score: e.score, rank: e.rank, rankedCount: data.ranked ? data.rankedCount : 0, parts: JSON.stringify(e.parts), createdAt: now, updatedAt: now,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db("learner_rank_snapshots").insert(rows.slice(i, i + 200)).onConflict(["classId", "learnerId", "termKey", "weekStart"]).merge(["score", "rank", "rankedCount", "parts", "updatedAt"]);
  }
}

// Badges: what each learner holds now, plus what they earned earlier in the period (kept). New
// ones are saved and announced — one notice per learner listing them. Map learnerId → [{ key,
// detail, earnedAt }].
async function awardBadges(data) {
  const ids = data.entries.map((e) => e.learnerId);
  const stored = ids.length ? await db("learner_badges").where({ classId: data.cls.id, termKey: data.period.key }).whereIn("learnerId", ids) : [];
  const have = new Map();
  for (const b of stored) (have.get(b.learnerId) || have.set(b.learnerId, []).get(b.learnerId)).push({ key: b.badgeKey, detail: b.detail, earnedAt: b.earnedAt });
  const now = new Date();
  const fresh = [];
  for (const e of data.entries) {
    const held = new Set((have.get(e.learnerId) || []).map((b) => b.key));
    for (const b of R.badgesFor(e, { mostImproved: data.mostImproved.has(e.learnerId) })) {
      if (held.has(b.key)) continue;
      fresh.push({ id: generateId(), learnerId: e.learnerId, classId: data.cls.id, termKey: data.period.key, badgeKey: b.key, detail: b.detail, earnedAt: now });
      (have.get(e.learnerId) || have.set(e.learnerId, []).get(e.learnerId)).push({ key: b.key, detail: b.detail, earnedAt: now });
    }
  }
  if (!fresh.length) return have;
  await db("learner_badges").insert(fresh).onConflict(["learnerId", "classId", "termKey", "badgeKey"]).ignore();
  if (data.enabled) {
    const byLearner = new Map();
    for (const b of fresh) (byLearner.get(b.learnerId) || byLearner.set(b.learnerId, []).get(b.learnerId)).push(b);
    for (const [learnerId, list] of byLearner) {
      const entry = data.entries.find((e) => e.learnerId === learnerId);
      const names = list.map((b) => badgeDef(b.badgeKey)?.label || b.badgeKey);
      NotificationService.notifyLearner(learnerId, {
        type: "ranking_badge",
        title: list.length === 1 ? `New badge: ${names[0]}` : `${list.length} new badges`,
        message: `${entry?.firstName || "Your child"} earned ${names.map((n) => `"${n}"`).join(", ")} in ${data.className}.`,
        ownerAdminId: data.ownerAdminId,
        payload: { learnerId, classId: data.cls.id, route: `/learner-portal/position?child=${learnerId}` },
      }).catch((err) => console.error("[rankings] badge notice not sent:", err.message));
    }
  }
  return have;
}

// A learner's snapshots in a class this period, oldest first.
async function historyOf(classId, learnerIds, termKey) {
  if (!learnerIds.length) return new Map();
  const rows = await db("learner_rank_snapshots").where({ classId, termKey }).whereIn("learnerId", learnerIds).orderBy("weekStart");
  const by = new Map();
  for (const r of rows) (by.get(r.learnerId) || by.set(r.learnerId, []).get(r.learnerId)).push({ week: String(r.weekStart).slice(0, 10), score: r.score == null ? null : Number(r.score), rank: r.rank, rankedCount: r.rankedCount });
  return by;
}

// Places moved since the last week before this one: +2 = up two places.
function movementFrom(history, currentWeek, rank) {
  const before = (history || []).filter((h) => h.week < currentWeek && h.rank != null);
  const last = before[before.length - 1];
  return last && rank != null ? last.rank - rank : null;
}

const partsView = (parts, averages, weights) => R.PARTS.map(({ key, label }) => ({
  key,
  label,
  weight: weights[key],
  value: parts[key],
  level: R.levelOf(parts[key])?.label || null,
  classAverage: averages[key],
}));

// Badges for families: every badge of the set, earned or still to earn.
const badgesView = (held = []) => R.BADGES.map((b) => {
  const got = held.find((h) => h.key === b.key);
  return { key: b.key, label: b.label, description: b.description, icon: b.icon, earned: Boolean(got), detail: got?.detail || null, earnedAt: got?.earnedAt || null };
});

// A board as a family sees it: top three + their neighbours where their place shows exactly.
function boardView(board, learnerId, byId, nameStyle) {
  const rows = R.leaderboardFor(board.rows, learnerId).map((row) => {
    const r = board.rows.find((x) => x.learnerId === row.learnerId);
    const e = byId.get(row.learnerId);
    return { rank: row.rank, place: R.ordinal(row.rank), name: row.isMe ? "You" : R.displayName(e?.firstName, e?.lastName, nameStyle), isMe: row.isMe, gapBefore: row.gapBefore, value: R.round1(r.value) };
  });
  const mine = board.rows.find((r) => r.learnerId === learnerId);
  const standing = mine ? R.standingOf(mine.rank, board.rows.length) : null;
  return { key: board.key, label: board.label, unit: board.unit, rows, standing, count: board.rows.length };
}

const RankingService = {
  classStanding,
  settingsFor,
  saveSettings,
  historyOf,

  // The few key things, for every class of a learner — the profile's "This term" strip and the
  // parent home's line per child: place (families: exact in the top half, else a band), score,
  // level, movement, badges held and the on-time streak. Families never get a class whose hub has
  // rankings switched off; staff get every class and every exact place.
  async summaryFor(learner, { staff = false } = {}) {
    if (!learner) fail("No learner is linked to this account", 403);
    const links = await db("learner_hub_links").where({ learnerId: learner.id, status: "active" }).whereNotNull("classId");
    const classIds = [...new Set(links.map((l) => l.classId).filter(Boolean))];
    const week = R.weekStart(kenyaDay(new Date()));
    const classes = [];
    for (const classId of classIds) {
      let data;
      try {
        data = await classStanding(classId);
      } catch (err) {
        if (err.statusCode === 404) continue;
        throw err;
      }
      if (!staff && !data.enabled) continue;
      const me = data.entries.find((e) => e.learnerId === learner.id);
      if (!me) continue;
      const standing = data.ranked && me.rank ? R.standingOf(me.rank, data.rankedCount) : null;
      const showExact = staff || standing?.exact;
      const history = showExact ? (await historyOf(classId, [learner.id], data.period.key)).get(learner.id) : null;
      const held = data.badges.get(learner.id) || [];
      classes.push({
        classId,
        className: data.className,
        period: data.period.label,
        score: me.score,
        level: R.levelOf(me.score)?.label || null,
        eligible: me.eligible,
        markedCount: me.markedCount,
        minMarked: data.settings.minMarked,
        rank: showExact ? me.rank : null,
        rankedCount: data.ranked ? data.rankedCount : null,
        band: showExact ? null : standing?.band || null,
        movement: showExact && me.rank ? movementFrom(history, week, me.rank) : null,
        hiddenFromFamily: !data.enabled,
        onTimeStreak: me.streaks.onTime.current,
        badges: held.map((b) => {
          const def = badgeDef(b.key);
          return { key: b.key, label: def?.label || b.key, icon: def?.icon || "award", detail: b.detail, earnedAt: b.earnedAt };
        }),
      });
    }
    // Badges across all their classes, once each (the latest earned first).
    const byKey = new Map();
    for (const c of classes) for (const b of c.badges) {
      const prev = byKey.get(b.key);
      if (!prev || new Date(b.earnedAt) > new Date(prev.earnedAt)) byKey.set(b.key, { ...b, className: c.className });
    }
    return {
      learnerId: learner.id,
      firstName: learner.firstName,
      classes,
      badges: [...byKey.values()].sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)),
      badgeCount: R.BADGES.length,
    };
  },

  // The learner's own view (the learner portal, and a parent looking at their child): their place
  // and score in one of their classes, what makes it up, how to move up, badges, streaks, the
  // other boards, and the period so far.
  async forLearner(learner, classId) {
    if (!learner) fail("No learner is linked to this account", 403);
    const links = await db("learner_hub_links").where({ learnerId: learner.id, status: "active" }).whereNotNull("classId");
    const classRows = links.length ? await db("classes").whereIn("id", [...new Set(links.map((l) => l.classId))]) : [];
    const classes = classRows.map((c) => ({ id: c.id, name: className(c) }));
    if (!classes.length) return { classes: [], classId: null };
    const chosen = classes.find((c) => c.id === classId) || classes[0];

    const data = await classStanding(chosen.id);
    const base = { learnerId: learner.id, classes, classId: chosen.id, className: data.className, term: data.period };
    if (!data.enabled) return { ...base, disabled: true };
    const me = data.entries.find((e) => e.learnerId === learner.id);
    if (!me) return { ...base, notInClass: true };
    const eligible = data.entries.filter((e) => e.eligible);
    const standing = data.ranked && me.rank ? R.standingOf(me.rank, data.rankedCount) : null;
    const history = (await historyOf(chosen.id, [learner.id], data.period.key)).get(learner.id) || [];
    const week = R.weekStart(kenyaDay(new Date()));
    const next = data.ranked && me.rank ? R.pointsToNext(eligible, learner.id) : null;
    const byId = new Map(data.entries.map((e) => [e.learnerId, e]));
    const nameStyle = data.settings.nameStyle;

    return {
      ...base,
      ranked: data.ranked,
      rankedCount: data.rankedCount,
      classAverageScore: data.averages.score,
      minMarked: data.settings.minMarked,
      minClass: data.settings.minClass,
      me: {
        eligible: me.eligible,
        markedCount: me.markedCount,
        score: me.score,
        level: R.levelOf(me.score)?.label || null,
        standing,
        // The place moved is only told where the place itself is shown.
        movement: standing?.exact ? movementFrom(history, week, me.rank) : null,
        next: next ? { points: next.points, toPlace: standing?.exact ? R.ordinal(next.toRank) : null } : null,
        isTop: standing?.exact && me.rank === 1,
        parts: partsView(me.parts, data.averages, data.settings.weights),
        growthDelta: me.parts.growthDelta,
        missedCount: me.parts.missedCount,
        streaks: { onTime: me.streaks.onTime.current, onTimeBest: me.streaks.onTime.best, attendance: me.streaks.attendance.current, attendanceBest: me.streaks.attendance.best },
      },
      badges: badgesView(data.badges.get(learner.id)),
      leaderboard: data.ranked ? R.leaderboardFor(eligible, learner.id).map((row) => {
        const e = byId.get(row.learnerId);
        return { rank: row.rank, place: R.ordinal(row.rank), name: row.isMe ? "You" : R.displayName(e.firstName, e.lastName, nameStyle), isMe: row.isMe, gapBefore: row.gapBefore };
      }) : [],
      // More ways to shine — each board shows only when enough learners qualify for it.
      boards: data.boards.map((b) => boardView(b, learner.id, byId, nameStyle)),
      nextSteps: R.nextSteps(me.parts, { open: me.open, missed: me.missed }),
      // Places are only in the trend where the place is shown exactly.
      trend: history.map((h) => ({ week: h.week, score: h.score, rank: standing?.exact ? h.rank : null })),
      computedAt: data.computedAt,
    };
  },

  // The whole class for staff and its educators: every learner, their place, score, parts,
  // streaks and badges, and the other boards' leaders.
  async forClass(classId) {
    const data = await classStanding(classId);
    const history = await historyOf(classId, data.entries.map((e) => e.learnerId), data.period.key);
    const week = R.weekStart(kenyaDay(new Date()));
    const byId = new Map(data.entries.map((e) => [e.learnerId, e]));
    return {
      classId,
      className: data.className,
      term: data.period,
      enabled: data.enabled,
      ranked: data.ranked,
      rankedCount: data.rankedCount,
      minMarked: data.settings.minMarked,
      minClass: data.settings.minClass,
      weights: data.settings.weights,
      averages: data.averages,
      boards: data.boards.map((b) => ({ key: b.key, label: b.label, unit: b.unit, leaders: b.rows.filter((r) => r.rank <= 3).map((r) => ({ rank: r.rank, name: byId.get(r.learnerId)?.name, value: R.round1(r.value) })) })),
      learners: data.entries.map((e) => ({
        learnerId: e.learnerId,
        name: e.name,
        photo: e.photo,
        rank: e.rank,
        eligible: e.eligible,
        score: e.score,
        level: R.levelOf(e.score)?.label || null,
        movement: movementFrom(history.get(e.learnerId), week, e.rank),
        markedCount: e.markedCount,
        missedCount: e.parts.missedCount,
        parts: Object.fromEntries(R.PARTS.map(({ key }) => [key, e.parts[key]])),
        streaks: { onTime: e.streaks.onTime.current, attendance: e.streaks.attendance.current },
        badges: (data.badges.get(e.learnerId) || []).map((b) => badgeDef(b.key)?.label || b.key),
      })),
      computedAt: data.computedAt,
    };
  },
};

module.exports = RankingService;
