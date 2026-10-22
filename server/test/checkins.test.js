const test = require("node:test");
const assert = require("node:assert/strict");

// Hub check-ins: the recurrence and the status rules — pure, no database
// (modules/checkins/checkin.dates.js and checkin.rules.js).
const { occurrenceDates, addMonths, todayInKenya } = require("../src/modules/checkins/checkin.dates");
const { deriveSessionStatus, nextActionStatus, isActionOverdue, reportProblems } = require("../src/modules/checkins/checkin.rules");

test("each frequency produces its own dates", () => {
  const until = "2026-12-31";
  assert.deepEqual(occurrenceDates({ startDate: "2026-11-02", frequency: "weekly" }, until, { includeNext: false }).slice(0, 3), ["2026-11-02", "2026-11-09", "2026-11-16"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-01-15", frequency: "monthly" }, "2026-04-30", { includeNext: false }), ["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-01-15", frequency: "quarterly" }, "2026-12-31", { includeNext: false }), ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-01-15", frequency: "semi_annually" }, "2027-12-31", { includeNext: false }), ["2026-01-15", "2026-07-15", "2027-01-15", "2027-07-15"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-03-01", frequency: "annually" }, "2028-12-31", { includeNext: false }), ["2026-03-01", "2027-03-01", "2028-03-01"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-05-05", frequency: "once" }, until), ["2026-05-05"]);
});

test("a month-end start stays on the month's last day without drifting", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29", "leap year");
});

test("the next occurrence past the horizon is included, so long gaps always have one ahead", () => {
  assert.deepEqual(occurrenceDates({ startDate: "2026-01-10", frequency: "annually" }, "2026-06-30", { from: "2026-06-01" }), ["2027-01-10"]);
  const weekly = occurrenceDates({ startDate: "2026-11-02", frequency: "weekly" }, "2026-11-20");
  assert.equal(weekly.at(-1), "2026-11-23");
});

test("nothing is generated before `from` (no back-filled missed check-ins), and the end date is respected", () => {
  const dates = occurrenceDates({ startDate: "2026-01-05", frequency: "weekly" }, "2026-11-30", { from: "2026-11-10", includeNext: false });
  assert.deepEqual(dates, ["2026-11-16", "2026-11-23", "2026-11-30"]);
  assert.deepEqual(occurrenceDates({ startDate: "2026-11-02", endDate: "2026-11-20", frequency: "weekly" }, "2027-01-31"), ["2026-11-02", "2026-11-09", "2026-11-16"]);
  // A one-off is created even for a past date (writing up one that already happened).
  assert.deepEqual(occurrenceDates({ startDate: "2026-01-05", frequency: "once" }, "2026-11-30", { from: "2026-11-10" }), ["2026-01-05"]);
});

test("today is a Kenyan date whatever the server's time zone", () => {
  assert.equal(todayInKenya(new Date("2026-10-22T22:30:00Z")), "2026-10-23", "01:30 in Nairobi");
  assert.equal(todayInKenya(new Date("2026-10-22T20:59:00Z")), "2026-10-22");
});

test("a session's status follows its date and its report", () => {
  const today = "2026-10-22";
  const s = (over) => ({ status: "scheduled", reportStatus: "none", scheduledDate: today, ...over });
  assert.equal(deriveSessionStatus(s({}), today), "scheduled");
  assert.equal(deriveSessionStatus(s({ scheduledDate: "2026-10-21" }), today), "missed", "the day passed with nothing written");
  assert.equal(deriveSessionStatus(s({ reportStatus: "draft" }), today), "in_progress");
  assert.equal(deriveSessionStatus(s({ reportStatus: "draft", scheduledDate: "2026-10-21" }), today), "pending_submission");
  assert.equal(deriveSessionStatus(s({ status: "missed", reportStatus: "draft", scheduledDate: "2026-10-01" }), today), "pending_submission", "a late report takes a missed one out of Missed");
  assert.equal(deriveSessionStatus(s({ status: "rescheduled", scheduledDate: "2026-10-30" }), today), "rescheduled");
  assert.equal(deriveSessionStatus(s({ status: "cancelled", scheduledDate: "2026-10-01" }), today), "cancelled");
  assert.equal(deriveSessionStatus(s({ reportStatus: "submitted", scheduledDate: "2026-10-01" }), today), "completed");
});

test("a report can't be submitted without its essentials, nor with follow-ups nobody owns", () => {
  const complete = {
    session: { actualDate: "2026-10-22" },
    operations: { generalStatus: "running_well" },
    summary: { overallStatus: "on_track", observations: "All good" },
  };
  assert.deepEqual(reportProblems(complete, []), []);
  assert.equal(reportProblems({}, []).length, 4);
  const problems = reportProblems(complete, [{ kind: "action", title: "Fix projector", assigneeId: null, dueDate: null }, { kind: "issue", title: "Leaky roof" }]);
  assert.deepEqual(problems, ['Give the follow-up "Fix projector" a responsible person and a due date']);
});

test("action statuses move only in sensible ways", () => {
  const a = (over) => ({ status: "open", assigneeId: null, resolutionNotes: null, ...over });
  assert.match(nextActionStatus(a({}), "in_progress").error, /Assign/);
  assert.deepEqual(nextActionStatus(a({ assigneeId: "u1", status: "assigned" }), "in_progress"), { status: "in_progress" });
  assert.match(nextActionStatus(a({ assigneeId: "u1", status: "in_progress" }), "resolved").error, /how it was resolved/);
  assert.deepEqual(nextActionStatus(a({ assigneeId: "u1", status: "in_progress" }), "resolved", { resolutionNotes: "Replaced the bulb" }), { status: "resolved" });
  assert.match(nextActionStatus(a({ status: "in_progress", assigneeId: "u1" }), "closed").error, /resolved action/);
  assert.deepEqual(nextActionStatus(a({ status: "in_progress", assigneeId: "u1" }), "closed", { isManager: true }), { status: "closed" });
  assert.deepEqual(nextActionStatus(a({ status: "resolved", assigneeId: "u1" }), "closed"), { status: "closed" });
  assert.deepEqual(nextActionStatus(a({ status: "closed", assigneeId: "u1" }), "open"), { status: "assigned" }, "reopening goes back to its owner");
});

test("an action is overdue only while it's still outstanding", () => {
  assert.equal(isActionOverdue({ dueDate: "2026-10-01", status: "assigned" }, "2026-10-22"), true);
  assert.equal(isActionOverdue({ dueDate: "2026-10-01", status: "resolved" }, "2026-10-22"), false);
  assert.equal(isActionOverdue({ dueDate: "2026-10-22", status: "open" }, "2026-10-22"), false, "due today isn't overdue yet");
  assert.equal(isActionOverdue({ dueDate: null, status: "open" }, "2026-10-22"), false);
});
