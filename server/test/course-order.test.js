// A course's sessions in the course pages' order (courses/session-numbering.js's courseOrder,
// 20 Nov 2026): modules in their order, each module's sessions in theirs, module-less last. Reports
// and certificates find a module's / the course's last session from it — sorting the whole course by
// each session's own `order` put another module's sessions first (Reports pointed at Game Creators
// for Code Foundations' certificates).
const test = require("node:test");
const assert = require("node:assert/strict");
const { courseOrder, numberSessions } = require("../src/modules/courses/session-numbering");

const modules = [
  { id: "cf", name: "Code Foundations", order: 1 },
  { id: "gc", name: "Game Creators", order: 2 },
];
const ids = (list) => list.map((s) => s.id);

test("session numbers that restart in each module: modules stay together, in module order", () => {
  const sessions = [
    { id: "gc1", moduleId: "gc", order: 1 }, { id: "cf1", moduleId: "cf", order: 1 },
    { id: "gc2", moduleId: "gc", order: 2 }, { id: "cf2", moduleId: "cf", order: 2 },
  ];
  assert.deepEqual(ids(courseOrder(sessions, modules)), ["cf1", "cf2", "gc1", "gc2"]);
});

test("a module moved to the top after its sessions were made comes first", () => {
  // Game Creators' sessions were made first (orders 1–2), Code Foundations' later (3–4), then
  // Code Foundations was moved to be module 1.
  const sessions = [
    { id: "gc1", moduleId: "gc", order: 1 }, { id: "gc2", moduleId: "gc", order: 2 },
    { id: "cf1", moduleId: "cf", order: 3 }, { id: "cf2", moduleId: "cf", order: 4 },
  ];
  const ordered = courseOrder(sessions, modules);
  assert.deepEqual(ids(ordered), ["cf1", "cf2", "gc1", "gc2"]);
  assert.equal(ordered[ordered.length - 1].id, "gc2", "the course's last session is the last module's last session");
  assert.equal(ordered.filter((s) => s.moduleId === "cf").pop().id, "cf2", "Code Foundations' last session is its own");
});

test("sessions with no module (or a deleted one) come last; nothing is lost", () => {
  const sessions = [
    { id: "x", moduleId: null, order: 0 }, { id: "gone", moduleId: "deleted", order: 1 },
    { id: "cf1", moduleId: "cf", order: 5 }, { id: "gc1", moduleId: "gc", order: 2 },
  ];
  assert.deepEqual(ids(courseOrder(sessions, modules)), ["cf1", "gc1", "x", "gone"]);
});

test("numbering still restarts in each module", () => {
  const sessions = [
    { id: "gc1", moduleId: "gc", order: 1 }, { id: "cf1", moduleId: "cf", order: 1 }, { id: "cf2", moduleId: "cf", order: 2 },
  ];
  const n = numberSessions(sessions, modules);
  assert.deepEqual([n.get("cf1").number, n.get("cf2").number, n.get("gc1").number], [1, 2, 1]);
  assert.equal(n.get("cf2").count, 2);
});
