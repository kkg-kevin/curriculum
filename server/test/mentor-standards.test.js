const test = require("node:test");
const assert = require("node:assert/strict");

// Mentor standards: settings kept in range, a measure against its target / minimum / evidence, the
// new mentors' grace period, and a mentor's overall standing — pure (mentor-standards.rules.js).
const R = require("../src/modules/mentor-standards/mentor-standards.rules");

const def = (key) => R.BY_KEY.get(key);

test("defaults fill in, and a minimum never sits on the wrong side of its target", () => {
  const s = R.normaliseSettings({ graceDays: 30, standards: { retention: { target: 80, minimum: 95 }, openConcerns: { target: 1, minimum: 0 }, rating: { target: 9 } } });
  assert.equal(s.graceDays, 30);
  assert.equal(s.standards.retention.minimum, 80);
  assert.equal(s.standards.openConcerns.minimum, 1);
  assert.equal(s.standards.rating.target, 5);
  assert.equal(s.standards.qa.target, 70);
  assert.equal(s.notifyBelow, true);
});

test("meets, close and below a higher-is-better standard", () => {
  const setting = { enabled: true, target: 80, minimum: 65, minEvidence: 5 };
  assert.equal(R.evaluate(def("retention"), setting, { value: 85, evidence: 10 }), "meets");
  assert.equal(R.evaluate(def("retention"), setting, { value: 80, evidence: 10 }), "meets");
  assert.equal(R.evaluate(def("retention"), setting, { value: 70, evidence: 10 }), "close");
  assert.equal(R.evaluate(def("retention"), setting, { value: 50, evidence: 10 }), "below");
});

test("too little evidence is never a fail", () => {
  const setting = { enabled: true, target: 4, minimum: 3.5, minEvidence: 5 };
  assert.equal(R.evaluate(def("rating"), setting, { value: 2, evidence: 1 }), "not_enough");
  assert.equal(R.evaluate(def("rating"), setting, { value: null, evidence: 0 }), "not_enough");
});

test("a lower-is-better standard (open concerns)", () => {
  const setting = { enabled: true, target: 0, minimum: 1, minEvidence: 0 };
  assert.equal(R.evaluate(def("openConcerns"), setting, { value: 0, evidence: 1 }), "meets");
  assert.equal(R.evaluate(def("openConcerns"), setting, { value: 1, evidence: 1 }), "close");
  assert.equal(R.evaluate(def("openConcerns"), setting, { value: 3, evidence: 1 }), "below");
});

test("a switched-off standard is left out", () => {
  const out = R.standing({ retention: { value: 10, evidence: 50 } }, { standards: { retention: { enabled: false } } }, { since: "2020-01-01" });
  assert.ok(!out.items.some((i) => i.key === "retention"));
});

test("a new mentor in their grace period is shown, never marked below", () => {
  const now = new Date("2026-11-10T09:00:00Z");
  const fresh = R.standing({ retention: { value: 10, evidence: 50 } }, {}, { since: "2026-10-01", now });
  const item = fresh.items.find((i) => i.key === "retention");
  assert.equal(item.status, "grace");
  assert.equal(fresh.inGrace, true);
  assert.deepEqual(fresh.below, []);
  const settled = R.standing({ retention: { value: 10, evidence: 50 } }, {}, { since: "2025-01-01", now });
  assert.equal(settled.items.find((i) => i.key === "retention").status, "below");
});

test("no open concerns on its own isn't meeting the bar", () => {
  const out = R.standing({ openConcerns: { value: 0, evidence: 1 } }, {}, { since: "2024-01-01" });
  assert.equal(out.met, 1);
  assert.equal(out.overall, "not_enough");
});

test("overall standing and how many are met", () => {
  const measures = {
    retention: { value: 90, evidence: 20 }, rating: { value: 4.5, evidence: 8 }, qa: { value: 65, evidence: 2 },
    reliability: { value: 95, evidence: 30 }, openConcerns: { value: 0, evidence: 1 },
  };
  const out = R.standing(measures, {}, { since: "2024-01-01" });
  assert.equal(out.overall, "close");
  assert.equal(out.counted, 5);
  assert.equal(out.met, 4);
  assert.deepEqual(out.close, ["qa"]);
  assert.ok(out.items.find((i) => i.key === "qa").tip);
  assert.equal(out.items.find((i) => i.key === "markedOnTime").status, "not_enough");
});
