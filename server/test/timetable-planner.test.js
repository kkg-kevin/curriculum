const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/modules/timetable/timetable.rules");
const Profile = require("../src/modules/educator-profiles/educator-profile.rules");

// The timetable's rules (src/modules/timetable/timetable.rules.js). 2026-11-30 is a Monday.

const lesson = (courseId, extra = {}) => ({ courseId, teacherId: null, ...extra });

test("a lesson's version applies only between its dates", () => {
  assert.equal(R.validOn({}, "2026-11-30"), true);
  assert.equal(R.validOn({ validFrom: "2026-12-07" }, "2026-11-30"), false);
  assert.equal(R.validOn({ validFrom: "2026-12-07" }, "2026-12-07"), true);
  assert.equal(R.validOn({ validTo: "2026-12-06" }, "2026-12-06"), true);
  assert.equal(R.validOn({ validTo: "2026-12-06" }, "2026-12-07"), false);
});

test("the version in force on a date is the one used, so past sessions don't move", () => {
  const old = { startTime: "09:00", validTo: "2026-12-06" };
  const now = { startTime: "14:00", validFrom: "2026-12-07" };
  assert.equal(R.slotForDate([now, old], "2026-11-30"), old);
  assert.equal(R.slotForDate([now, old], "2026-12-07"), now);
  assert.equal(R.slotForDate([{ startTime: "14:00", validFrom: "2027-01-01" }], "2026-12-07"), null);
});

test("a class's status says the next thing it needs", () => {
  assert.equal(R.classStatus({ lessons: [] }), "not_set");
  const lessons = [lesson("a")];
  assert.equal(R.classStatus({ lessons, educatorsByCourse: new Map(), datedCourseIds: new Set(["a"]) }), "needs_educator");
  const educators = new Map([["a", [{ id: "t" }]]]);
  assert.equal(R.classStatus({ lessons, educatorsByCourse: educators, datedCourseIds: new Set() }), "needs_dates");
  assert.equal(R.classStatus({ lessons, educatorsByCourse: educators, datedCourseIds: new Set(["a"]) }), "ready");
  assert.equal(R.classStatus({ lessons: [lesson("b", { teacherId: "t" })], datedCourseIds: new Set(["b"]) }), "ready", "named on the lesson counts");
});

test("travel: under 30 minutes between two physical hubs is flagged", () => {
  const here = { hubId: "h1", startTime: "10:00", endTime: "11:00" };
  const near = { hubId: "h2", startTime: "11:15", endTime: "12:00" };
  assert.equal(R.travelProblems(here, [near]).length, 1);
  assert.equal(R.travelProblems(here, [{ ...near, startTime: "11:30" }]).length, 0, "exactly 30 minutes is enough");
  assert.equal(R.travelProblems(here, [{ ...near, hubId: "h1" }]).length, 0, "same hub");
  assert.equal(R.travelProblems(here, [{ ...near, virtual: true }]).length, 0, "online needs no travel");
  assert.equal(R.travelProblems({ ...here, virtual: true }, [near]).length, 0);
  assert.equal(R.travelProblems(here, [{ ...near, startTime: "10:30" }]).length, 0, "an overlap is a clash, not travel");
  assert.equal(R.travelProblems(here, [{ hubId: "h2", startTime: "08:00", endTime: "09:50" }]).length, 1, "the lesson before counts too");
  assert.equal(R.gapBetween(here, near), 15);
});

test("sessions land on the chosen days, skipping days out of session", () => {
  assert.deepEqual(R.walkSessions({ startDate: "2026-11-30", days: ["monday", "wednesday"], sessionCount: 3 }), { first: "2026-11-30", last: "2026-12-07", placed: 3 });
  const noBreakWeek = (d) => d !== "2026-12-07";
  assert.equal(R.walkSessions({ startDate: "2026-11-30", days: ["monday"], sessionCount: 2, isSchedulable: noBreakWeek }).last, "2026-12-14");
  assert.deepEqual(R.walkSessions({ startDate: "2026-12-05", days: ["saturday"], sessionCount: 1 }), { first: "2026-12-05", last: "2026-12-05", placed: 1 });
  assert.equal(R.walkSessions({ startDate: "2026-11-30", days: ["monday"], sessionCount: 5, isSchedulable: (d) => d <= "2026-12-07" }).placed, 2);
  assert.equal(R.walkSessions({ startDate: null, days: ["monday"], sessionCount: 5 }).placed, 0);
});

test("a class is copied only when every lesson is ready", () => {
  assert.equal(R.copyStatus([{ status: "ready" }, { status: "already" }]), "ready");
  assert.equal(R.copyStatus([{ status: "already" }]), "already_set");
  assert.equal(R.copyStatus([{ status: "ready" }, { status: "missing_educator" }]), "missing_educator");
  assert.equal(R.copyStatus([{ status: "missing_course" }, { status: "clash" }]), "clash");
});

test("weekdays include the weekend", () => {
  assert.equal(R.weekdayOf("2026-12-05"), "saturday");
  assert.equal(R.weekdayOf("2026-12-06"), "sunday");
  assert.equal(R.DAYS.length, 7);
});

test("educator hours for sessions held stay with the lesson as it was that day", () => {
  const slots = [
    { classId: "c", courseId: "x", dayOfWeek: "monday", startTime: "09:00", endTime: "10:00", validTo: "2026-12-06" },
    { classId: "c", courseId: "x", dayOfWeek: "monday", startTime: "09:00", endTime: "11:00", validFrom: "2026-12-07" },
  ];
  const [row] = Profile.creditSessions({ slots, held: new Map([["c", new Set(["2026-11-30", "2026-12-07"])]]) });
  assert.deepEqual(row.sessions, ["2026-11-30", "2026-12-07"]);
  assert.equal(row.minutes, 60 + 120, "one hour before the change, two after");
});
