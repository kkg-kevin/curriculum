// Class rankings — the rules that need no database (modules/rankings/ranking.rules.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/rankings/ranking.rules");

const task = (percent, timing = "on_time", day = 1) => ({ marked: percent != null, percent, timing, gradedAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z` });

test("terms follow Kenya's three-term year", () => {
  assert.deepEqual(R.termOf("2026-02-10"), { key: "2026-T1", label: "Term 1 2026", from: "2026-01-01", to: "2026-04-30" });
  assert.equal(R.termOf("2026-05-01").key, "2026-T2");
  assert.equal(R.termOf("2026-08-31").key, "2026-T2");
  assert.equal(R.termOf("2026-11-18").key, "2026-T3");
});

test("weeks start on Monday", () => {
  assert.equal(R.weekStart("2026-11-18"), "2026-11-16"); // a Wednesday
  assert.equal(R.weekStart("2026-11-16"), "2026-11-16");
  assert.equal(R.weekStart("2026-11-22"), "2026-11-16"); // Sunday
});

test("the parts come from marks, attendance, timing, growth and competencies", () => {
  const parts = R.partsFor({
    tasks: [task(40, "on_time", 1), task(50, "late", 2), task(80, "on_time", 3), task(90, "on_time", 4), { marked: false, percent: null, timing: "missed" }, { marked: false, percent: null, timing: "pending" }],
    attendance: [{ status: "present" }, { status: "late" }, { status: "absent" }, { status: "excused" }],
    competencyMarks: new Map([["c1", { e: 8, p: 10 }], ["c2", { e: 3, p: 6 }]]),
  });
  assert.equal(parts.achievement, 65); // (40+50+80+90)/4
  assert.equal(parts.attendance, 66.7); // 2 of 3 (excused left out)
  assert.equal(parts.onTime, 60); // 3 on time of 5 due (pending not counted)
  assert.equal(parts.growthDelta, 40); // (80+90)/2 - (40+50)/2
  assert.equal(parts.growth, 100); // capped
  assert.equal(parts.competencies, 65); // (80 + 50) / 2
  assert.equal(parts.markedCount, 4);
  assert.equal(parts.missedCount, 1);
});

test("a part with nothing to go on is left out, not counted as zero", () => {
  const parts = R.partsFor({ tasks: [task(70), task(90)] });
  assert.equal(parts.attendance, null);
  assert.equal(parts.growth, null, "growth needs 4 marked pieces");
  // Only achievement (80) and on-time (100): (80*50 + 100*15) / 65
  assert.equal(R.scoreOf(parts), 84.6);
  assert.equal(R.scoreOf({}), null);
});

test("ranking: enough work and a big enough class; ties share a place", () => {
  const e = (id, score, marked = 3) => ({ learnerId: id, score, markedCount: marked });
  const small = R.rankClass([e("a", 90), e("b", 80), e("c", 70)]);
  assert.equal(small.ranked, false, "fewer than 5 ranked learners");
  assert.ok(small.entries.every((x) => x.rank == null));

  const r = R.rankClass([e("a", 90), e("b", 80), e("c", 80), e("d", 70), e("e", 60), e("f", 99, 2), e("g", null, 0)]);
  assert.equal(r.ranked, true);
  assert.equal(r.rankedCount, 5);
  assert.deepEqual(r.entries.map((x) => [x.learnerId, x.rank]), [["a", 1], ["b", 2], ["c", 2], ["d", 4], ["e", 5], ["f", null], ["g", null]]);
  assert.equal(r.entries.find((x) => x.learnerId === "f").eligible, false, "2 marked pieces isn't enough");
});

test("families see an exact place in the top half, a band below it", () => {
  assert.deepEqual(R.standingOf(3, 10), { exact: true, rank: 3, rankedCount: 10, band: null });
  assert.equal(R.standingOf(5, 10).exact, true);
  assert.equal(R.standingOf(6, 10).band, "In the top three-quarters of the class");
  assert.equal(R.standingOf(9, 10).band, "Climbing the ladder");
  assert.equal(R.standingOf(9, 10).rank, null, "the place itself isn't given");
  assert.equal(R.standingOf(3, 5).exact, true);
  assert.equal(R.standingOf(4, 5).exact, false);
});

test("points to move up pass the learner above; none at the top", () => {
  const sorted = [{ learnerId: "a", score: 90, rank: 1 }, { learnerId: "b", score: 82.5, rank: 2 }, { learnerId: "c", score: 82.5, rank: 2 }, { learnerId: "d", score: 70, rank: 4 }];
  assert.equal(R.pointsToNext(sorted, "a"), null);
  assert.deepEqual(R.pointsToNext(sorted, "b"), { points: 7.6, toRank: 1 });
  assert.deepEqual(R.pointsToNext(sorted, "c"), { points: 7.6, toRank: 1 }, "a tie is passed by the one above both");
  assert.deepEqual(R.pointsToNext(sorted, "d"), { points: 12.6, toRank: 2 });
});

test("leaderboard: top three and the learner's neighbours, never the bottom", () => {
  const sorted = Array.from({ length: 10 }, (_, i) => ({ learnerId: `l${i + 1}`, rank: i + 1 }));
  const mid = R.leaderboardFor(sorted, "l5");
  assert.deepEqual(mid.map((r) => r.rank), [1, 2, 3, 4, 5]);
  assert.equal(mid.find((r) => r.isMe).rank, 5);
  const top = R.leaderboardFor(sorted, "l2");
  assert.deepEqual(top.map((r) => r.rank), [1, 2, 3]);
  // In the lower half: top three only — their neighbours would give their place away.
  const low = R.leaderboardFor(sorted, "l9");
  assert.deepEqual(low.map((r) => r.rank), [1, 2, 3]);
  assert.ok(!low.some((r) => r.isMe));
  // The gap is marked where places are skipped.
  const gap = R.leaderboardFor(Array.from({ length: 14 }, (_, i) => ({ learnerId: `l${i + 1}`, rank: i + 1 })), "l7");
  assert.deepEqual(gap.map((r) => [r.rank, r.gapBefore]), [[1, false], [2, false], [3, false], [6, true], [7, false]]);
});

test("names of other children: first name and initial", () => {
  assert.equal(R.shortName("Amani Grace", "Kamau"), "Amani K.");
  assert.equal(R.shortName("Zawadi", ""), "Zawadi");
  assert.equal(R.shortName("", null), "Learner");
});

test("next steps: open work first, then catching up, then the weakest part", () => {
  const steps = R.nextSteps({ achievement: 85, attendance: 50, onTime: 90 }, { open: [{ name: "Line follower", dueDate: "2026-11-20" }], missed: [{ name: "Quiz 2" }] });
  assert.deepEqual(steps.map((s) => s.kind), ["hand_in", "catch_up", "improve"]);
  assert.equal(steps[2].part, "attendance");
  assert.match(steps[0].text, /Line follower.*Fri 20 Nov/);
  assert.equal(R.nextSteps({ achievement: 95, attendance: 100, onTime: 100 }, {})[0].kind, "keep_going");
});

test("ordinals", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(R.ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
});

// ---- Phase 2: settings, periods, streaks, badges, boards ----

test("settings: defaults, cleaned weights and terms", () => {
  assert.deepEqual(R.settingsOf(null).weights, R.WEIGHTS);
  const s = R.settingsOf({ enabled: 0, weights: JSON.stringify({ achievement: 60, attendance: -5 }), minMarked: 0, nameStyle: "odd", period: "rolling30",
    terms: JSON.stringify([{ name: "T2", from: "2026-05-04", to: "2026-08-07" }, { name: "Bad", from: "2026-09-10", to: "2026-09-01" }, { name: "T1", from: "2026-01-05", to: "2026-04-03" }]) });
  assert.equal(s.enabled, false);
  assert.equal(s.weights.achievement, 60);
  assert.equal(s.weights.attendance, 15, "a negative weight falls back to the default");
  assert.equal(s.minMarked, 3);
  assert.equal(s.nameStyle, "initial");
  assert.equal(s.period, "rolling30");
  assert.deepEqual(s.terms.map((t) => t.name), ["T1", "T2"], "invalid terms dropped, sorted");
});

test("periods: own terms, the last term during a holiday, the Kenyan calendar, the last 30 days", () => {
  const terms = [{ name: "Term 1", from: "2026-01-05", to: "2026-04-03" }, { name: "Term 2", from: "2026-05-04", to: "2026-08-07" }];
  const s = { ...R.DEFAULT_SETTINGS, terms };
  assert.equal(R.periodFor("2026-06-01", s).label, "Term 2");
  assert.equal(R.periodFor("2026-04-20", s).label, "Term 1", "a holiday shows the term just ended");
  assert.equal(R.periodFor("2025-12-01", s).key, "2025-T3", "before any own term: the Kenyan calendar");
  const rolling = R.periodFor("2026-11-18", { ...R.DEFAULT_SETTINGS, period: "rolling30" });
  assert.equal(rolling.from, "2026-10-20");
  assert.equal(rolling.to, "2026-11-18");
});

test("streaks: on time and attendance, current and best", () => {
  const t = (timing, due) => ({ timing, dueEnd: new Date(`2026-10-${due}T20:00:00Z`) });
  assert.deepEqual(R.onTimeStreak([t("on_time", 10), t("late", 11), t("on_time", 12), t("on_time", 13), t("pending", 14)]), { current: 2, best: 2 });
  assert.deepEqual(R.onTimeStreak([t("on_time", 10), t("on_time", 11), t("on_time", 12), t("missed", 13)]), { current: 0, best: 3 });
  const a = (date, status) => ({ date, status });
  assert.deepEqual(R.attendanceStreak([a("2026-10-01", "present"), a("2026-10-02", "absent"), a("2026-10-03", "late"), a("2026-10-04", "excused"), a("2026-10-05", "present")]), { current: 2, best: 2 });
});

test("badges come from the period's record", () => {
  const marked = (p, day) => ({ marked: true, percent: p, timing: "on_time", gradedAt: `2026-10-${day}T10:00:00Z`, dueEnd: new Date(`2026-10-${day}T20:00:00Z`) });
  const entry = {
    rank: 2,
    parts: { growthDelta: 12 },
    tasks: [marked(60, 10), marked(70, 11), marked(100, 12), marked(75, 13), marked(80, 14)],
    attendance: [{ date: "2026-10-12", status: "present" }, { date: "2026-10-14", status: "late" }, { date: "2026-10-19", status: "absent" }],
    competencyMarks: new Map([["c1", { e: 9, p: 10 }]]),
  };
  const keys = R.badgesFor(entry, { mostImproved: true }).map((b) => b.key).sort();
  assert.deepEqual(keys, ["full_marks", "most_improved", "on_the_board", "on_time_5", "perfect_week", "strong_skill", "top_three"]);
  // Personal best: the latest piece beats every earlier one.
  const pb = R.badgesFor({ rank: null, parts: {}, tasks: [marked(50, 10), marked(60, 11), marked(90, 12)], attendance: [] }).map((b) => b.key);
  assert.ok(pb.includes("personal_best"));
  assert.ok(!pb.includes("on_the_board"), "not ranked, no board badge");
});

test("perfect weeks need 2+ sessions all attended", () => {
  assert.deepEqual(R.perfectWeeks([{ date: "2026-11-16", status: "present" }, { date: "2026-11-18", status: "present" }, { date: "2026-11-23", status: "present" }]), ["2026-11-16"]);
});

test("boards: most improved, attendance, on time and per course — only with enough learners", () => {
  const e = (id, growthDelta, att, sessions, courseMarks) => ({ learnerId: id, parts: { growthDelta, attendance: att, sessionsCounted: sessions, onTime: 80, dueCount: 1 }, courseMarks: new Map([["k1", courseMarks]]) });
  const entries = [e("a", 10, 100, 4, [80, 90]), e("b", 5, 90, 4, [70, 70]), e("c", null, 80, 2, [60]), e("d", -2, 70, 5, [50, 60]), e("f", 20, 100, 3, [90, 95])];
  const boards = R.boardsFor(entries, new Map([["k1", "Robotics"]]), { minClass: 4 });
  const byKey = Object.fromEntries(boards.map((b) => [b.key, b]));
  assert.deepEqual(byKey.improved.rows.map((r) => [r.learnerId, r.rank]), [["f", 1], ["a", 2], ["b", 3], ["d", 4]]);
  assert.deepEqual(byKey.attendance.rows.map((r) => [r.learnerId, r.rank]), [["a", 1], ["f", 1], ["b", 3], ["d", 4]], "ties share a place; 2 sessions isn't enough");
  assert.equal(byKey.onTime, undefined, "nobody has 3 pieces due");
  assert.equal(byKey["course:k1"].label, "Robotics");
  assert.equal(byKey["course:k1"].rows.length, 4, "1 marked piece in the course isn't enough");
});

test("names follow the setting", () => {
  assert.equal(R.displayName("Amani", "Kamau", "initial"), "Amani K.");
  assert.equal(R.displayName("Amani Grace", "Kamau", "first"), "Amani");
  assert.equal(R.displayName("Amani", "Kamau", "anonymous"), "A classmate");
});
