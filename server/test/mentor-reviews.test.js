const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_SETTINGS, normaliseSettings, isEditable, cleanSubmission, summarise, EDIT_DAYS } = require("../src/modules/mentor-reviews/mentor-review.rules");

test("settings fill in from the defaults and keep sensible bounds", () => {
  const s = normaliseSettings(null);
  assert.equal(s.aspects.length, DEFAULT_SETTINGS.aspects.length);
  assert.equal(s.minSessions, 3);
  const custom = normaliseSettings({ aspects: [{ label: "Kind and patient" }, { label: "Kind and patient" }, { label: "" }], minSessions: 8, midCourseAfterSessions: 2, hubsSeeAverages: false });
  assert.deepEqual(custom.aspects, [{ key: "kind-and-patient", label: "Kind and patient" }]);
  assert.equal(custom.midCourseAfterSessions, 8, "the mid-course prompt never comes before a review is allowed");
  assert.equal(custom.hubsSeeAverages, false);
});

test("a submission needs 1–5 stars overall; aspects are optional but 1–5; a concern needs words", () => {
  const s = normaliseSettings(null);
  assert.throws(() => cleanSubmission({ overall: 0 }, s), /1 to 5/);
  assert.throws(() => cleanSubmission({ overall: 4, ratings: { engagement: 9 } }, s), /needs 1 to 5/);
  assert.throws(() => cleanSubmission({ overall: 4, concern: true }, s), /what the concern is/);
  const ok = cleanSubmission({ overall: 4, ratings: { engagement: 5, unknown: 2 }, comment: "  Great  ", websiteConsent: true }, s);
  assert.deepEqual(ok.ratings, { engagement: 5 });
  assert.equal(ok.comment, "Great");
  assert.equal(ok.websiteConsent, true);
  assert.equal(cleanSubmission({ overall: 3, websiteConsent: true }, s).websiteConsent, false, "nothing to quote without a comment");
});

test("a review can be changed for 14 days", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  assert.equal(isEditable({ createdAt: new Date(now - (EDIT_DAYS - 1) * 86400000) }, now), true);
  assert.equal(isEditable({ createdAt: new Date(now - (EDIT_DAYS + 1) * 86400000) }, now), false);
});

test("summaries average overall and per aspect, and spread the stars", () => {
  const s = normaliseSettings(null);
  const reviews = [
    { overall: 5, ratings: { engagement: 5, communication: 4 }, createdAt: "2026-10-03" },
    { overall: 4, ratings: JSON.stringify({ engagement: 3 }), createdAt: "2026-11-01" },
    { overall: 3, ratings: null, createdAt: "2026-11-15" },
  ];
  const sum = summarise(reviews, s.aspects);
  assert.equal(sum.count, 3);
  assert.equal(sum.average, 4);
  assert.deepEqual(sum.aspects.find((a) => a.key === "engagement"), { key: "engagement", label: "Engages my child", average: 4, count: 2 });
  assert.equal(sum.aspects.find((a) => a.key === "preparation").average, null);
  assert.deepEqual(sum.distribution.map((d) => d.count), [1, 1, 1, 0, 0]);
  assert.deepEqual(sum.trend.map((t) => t.month), ["2026-10", "2026-11"]);
});
