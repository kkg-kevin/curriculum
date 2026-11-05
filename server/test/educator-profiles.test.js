const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/educator-profiles/educator-profile.rules");

const slots = [
  { classId: "c1", courseId: "k1", dayOfWeek: "tuesday", startTime: "11:00", endTime: "12:30" },
  { classId: "c1", courseId: "k2", dayOfWeek: "thursday", startTime: "09:00", endTime: "10:00" },
];

test("teaching time: each held day on a slot's weekday counts once, for that course", () => {
  // 2026-11-03 Tue, 2026-11-05 Thu, 2026-11-06 Fri (no slot), 2026-11-10 Tue
  const held = new Map([["c1", new Set(["2026-11-03", "2026-11-05", "2026-11-06", "2026-11-10"])]]);
  const rows = R.creditSessions({ slots, held });
  const k1 = rows.find((r) => r.courseId === "k1");
  const k2 = rows.find((r) => r.courseId === "k2");
  assert.deepEqual(k1.sessions, ["2026-11-03", "2026-11-10"]);
  assert.equal(k1.minutes, 180);
  assert.deepEqual(k2.sessions, ["2026-11-05"]);
  assert.equal(k2.minutes, 60);
});

test("a session shifted to another day counts on its new day, not the old one", () => {
  const held = new Map([["c1", new Set(["2026-11-03", "2026-11-06"])]]);
  const shifts = [{ classId: "c1", courseId: "k1", date: "2026-11-03", newDate: "2026-11-06" }];
  const k1 = R.creditSessions({ slots, held, shifts }).find((r) => r.courseId === "k1");
  assert.deepEqual(k1.sessions, ["2026-11-06"]);
  assert.equal(k1.minutes, 90);
});

test("reliability counts planned sessions from the course start, held ones by attendance", () => {
  const held = new Map([["c1", new Set(["2026-11-03"])]]);
  const rel = R.reliability({ slots: [slots[0]], held, startOf: () => "2026-11-01", from: "2026-10-01", to: "2026-11-11" });
  assert.deepEqual(rel, { planned: 2, given: 1, rate: 50 });
});

test("ratings are smoothed so a few 5★ don't outrank many 4.7★", () => {
  assert.ok(R.smoothedRating([5, 5]) < R.smoothedRating(Array(40).fill(4.7)));
  assert.equal(R.smoothedRating([]), null);
});

test("QA bands, badges and the About an educator writes", () => {
  assert.equal(R.qaBand(90), "Excellent");
  assert.equal(R.qaBand(72), "Strong");
  assert.equal(R.qaBand(50), "Developing");
  const badges = R.badgesFor({ rating: { count: 12, average: 4.6 }, qa: { count: 2, lastTwoAverage: 88 }, reliability: { rate: 96, planned: 10 }, feedback: { medianHours: 20, count: 6 }, hours: { total: 520 }, tot: { certificates: 1, level: 3 } });
  assert.ok(badges.every((b) => b.earned), JSON.stringify(badges.filter((b) => !b.earned)));
  assert.equal(badges.find((b) => b.key === "hours").label, "500+ hours");
  const about = R.cleanAbout({ headline: "  Robotics mentor ", specialties: "Scratch, Robotics, Scratch", languages: ["English", "Kiswahili"] });
  assert.deepEqual(about.specialties, ["Scratch", "Robotics"]);
  assert.equal(about.headline, "Robotics mentor");
  assert.equal(R.slugify("Phyllis  Kennedy"), "phyllis-kennedy");
});

test("quality reviews compound: every visit counts, running average after each, sections across visits", () => {
  assert.equal(R.aggregateQa([]).count, 0);
  assert.equal(R.aggregateQa([]).average, null);
  const q = R.aggregateQa([
    { date: "2026-09-10", score: 80, visitType: "surprise", sectionScores: [{ title: "Planning", score: 50, scored: 2 }, { title: "Delivery", score: 100, scored: 3 }], summary: { strengths: "<p>Clear</p>" } },
    { date: "2026-07-01", score: 60, visitType: "announced", sectionScores: [{ title: "Planning", score: 40, scored: 1 }, { title: "Delivery", score: 80, scored: 3 }] },
    { date: "2026-10-20", score: 91, visitType: "announced", sectionScores: [{ title: " planning ", score: 75, scored: 4 }], summary: { strengths: "<b>Warm</b>", improvements: "Pace" } },
    { date: "2026-10-25", score: null },
  ]);
  assert.equal(q.count, 3);
  assert.equal(q.average, 77); // (60 + 80 + 91) / 3
  assert.equal(q.band, "Strong");
  assert.deepEqual(q.history.map((h) => [h.date, h.score, h.runningAverage]), [["2026-07-01", 60, 60], ["2026-09-10", 80, 70], ["2026-10-20", 91, 77]]);
  assert.equal(q.firstScore, 60);
  assert.equal(q.latestScore, 91);
  assert.equal(q.change, 31);
  assert.equal(q.sinceLast, 11);
  assert.equal(q.best, 91);
  assert.equal(q.lowest, 60);
  assert.equal(q.lastTwoAverage, 86);
  assert.equal(q.lastThreeAverage, 77);
  const planning = q.sections.find((x) => x.title === "Planning");
  assert.equal(planning.visits, 3);
  assert.equal(planning.score, 63); // (40*1 + 50*2 + 75*4) / 7, weighted by items
  assert.equal(planning.latest, 75);
  assert.equal(planning.change, 35);
  assert.equal(q.sections.find((x) => x.title === "Delivery").score, 90);
  assert.equal(q.itemsChecked, 13);
  assert.equal(q.surprise, 1);
  assert.equal(q.announced, 2);
  assert.equal(q.strengths, "Warm");
  assert.equal(q.improvements, "Pace");
  // A fourth visit moves every total.
  const more = R.aggregateQa([{ date: "2026-07-01", score: 60 }, { date: "2026-09-10", score: 80 }, { date: "2026-10-20", score: 91 }, { date: "2026-11-01", score: 97 }]);
  assert.equal(more.count, 4);
  assert.equal(more.average, 82);
  assert.equal(more.history.at(-1).runningAverage, 82);
});

test("the weakest QA section across visits becomes a growth tip", () => {
  const s = { qa: { sections: [{ title: "Planning", score: 55, visits: 3 }, { title: "Delivery", score: 90, visits: 3 }, { title: "Once", score: 20, visits: 1 }] } };
  const tips = R.growthTips(s, []);
  assert.ok(tips.some((t) => t.includes("\"Planning\" averages 55%")));
  assert.ok(!tips.some((t) => t.includes("Once")));
});
