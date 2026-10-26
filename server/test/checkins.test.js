const test = require("node:test");
const assert = require("node:assert/strict");

// Hub check-ins: the recurrence, where a check-in stands, the report, and turning an old A–G
// report into highs / lows / resolutions — pure, no database (modules/checkins/checkin.dates.js,
// checkin.rules.js and the 20261026110000 migration).
const { occurrenceDates, addMonths, todayInKenya } = require("../src/modules/checkins/checkin.dates");
const { sessionState, reportProblems } = require("../src/modules/checkins/checkin.rules");
const { _convert: convertOldReport } = require("../src/db/migrations/20261026110000_simplify_hub_checkins");

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

test("a check-in is upcoming, then due from its day until its report is in", () => {
  const today = "2026-10-26";
  assert.equal(sessionState({ status: "open", scheduledDate: "2026-10-27" }, today), "upcoming");
  assert.equal(sessionState({ status: "open", scheduledDate: today }, today), "due");
  assert.equal(sessionState({ status: "open", scheduledDate: "2026-09-01" }, today), "due", "still due weeks later");
  assert.equal(sessionState({ status: "reported", scheduledDate: "2026-09-01" }, today), "reported");
});

test("a report needs its highs, lows and resolutions", () => {
  assert.deepEqual(reportProblems({ highs: "Attendance up", lows: "None", resolutions: "Keep going" }), []);
  assert.equal(reportProblems({}).length, 3);
  assert.deepEqual(reportProblems({ highs: "Good", lows: "  ", resolutions: "x" }), ['Write the lows (write "None" if there were none)']);
});

test("an old A–G report keeps everything written, under highs, lows and resolutions", () => {
  const report = convertOldReport({
    operations: { generalStatus: "minor_issues", staffing: "One educator short" },
    training: { challenges: "Kits arrive late" },
    achievements: { workingWell: "Robotics club full" },
    decisions: { nextSteps: "Order kits a month ahead" },
    summary: { overallStatus: "needs_attention", observations: "Busy term", recommendedFollowUp: "Visit in November" },
  }, [
    { kind: "issue", title: "Projector broken", description: "Room 2", status: "open" },
    { kind: "action", title: "Hire an educator", dueDate: "2026-11-01", status: "resolved", resolutionNotes: "Hired Jane" },
  ]);
  assert.deepEqual(report.highs.split("\n"), ["What's working well: Robotics club full", "General observations: Busy term"]);
  assert.deepEqual(report.lows.split("\n"), [
    "Overall: Needs attention", "Operations: Minor issues", "Staffing: One educator short", "Training challenges: Kits arrive late",
    "Issue: Projector broken — Room 2 (open)",
  ]);
  assert.deepEqual(report.resolutions.split("\n"), [
    "Next steps: Order kits a month ahead", "Recommended follow-up: Visit in November",
    "Follow-up: Hire an educator — due 2026-11-01 (resolved)", "Resolved (Hire an educator): Hired Jane",
  ]);
});
