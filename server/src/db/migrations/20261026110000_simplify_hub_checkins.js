// Hub check-ins, simplified (26 Oct 2026). A check-in is now: the admin sets up a schedule for a
// hub (Account Manager, Training Lead, how often, first date, online or in person); each check-in
// that comes round is due on its day; the pair write one report — Highs, Lows, Resolutions. How and
// where it's held, rescheduling, cancelling, the A–G report and the issues/actions tracker are gone.
//
//   checkin_sessions.report   becomes { highs, lows, resolutions }. A report written in the old form
//                             is carried over, every filled-in field under its old heading, so
//                             nothing written is lost: achievements (and general observations) →
//                             highs; operations, training and the issues raised → lows; next steps,
//                             escalations, recommended follow-up and the follow-ups agreed (with how
//                             each was resolved) → resolutions.
//   checkin_sessions.status   "open" or "reported" (a submitted report). A cancelled check-in with
//                             nothing written is deleted; any other unreported one is open again.
//   Dropped: the time / length / link / venue / agenda columns on both tables, the sessions' report
//   status, overall status, cancel reason and history, and the checkin_actions and
//   checkin_action_updates tables. checkin_schedules.endDate stays — ending a schedule sets it.
//
// Idempotent: a report already in the new shape is left as it is, and every drop is guarded.

const parse = (value) => {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
};
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const lines = (pairs) => pairs.filter(([, v]) => clean(v)).map(([label, v]) => `${label}: ${clean(v)}`);

const OPERATIONAL = { running_well: "Running well", minor_issues: "Minor issues", significant_issues: "Significant issues" };
const OVERALL = { on_track: "On track", needs_attention: "Needs attention", critical: "Critical" };

// An old A–G report (plus the session's issues and follow-ups) as highs / lows / resolutions.
function convert(old, actions) {
  const r = old || {};
  const op = r.operations || {};
  const tr = r.training || {};
  const ach = r.achievements || {};
  const dec = r.decisions || {};
  const sum = r.summary || {};
  const highs = lines([
    ["What's working well", ach.workingWell], ["Recent achievements", ach.recent], ["Improvements", ach.improvements], ["Good practices", ach.goodPractices],
    ["General observations", sum.observations],
  ]);
  if (sum.overallStatus === "on_track") highs.unshift("Overall: On track");
  const lows = lines([
    ["Day-to-day operations", op.dayToDay], ["Staffing", op.staffing], ["Facilities", op.facilities], ["Operations, other", op.other],
    ["Curriculum progress", tr.curriculumProgress], ["Educator preparedness", tr.educatorPreparedness], ["Learner engagement", tr.learnerEngagement],
    ["Training challenges", tr.challenges], ["Training, other", tr.other],
  ]);
  if (op.generalStatus && op.generalStatus !== "running_well") lows.unshift(`Operations: ${OPERATIONAL[op.generalStatus] || op.generalStatus}`);
  if (sum.overallStatus && sum.overallStatus !== "on_track") lows.unshift(`Overall: ${OVERALL[sum.overallStatus] || sum.overallStatus}`);
  const resolutions = lines([["Next steps", dec.nextSteps], ["Escalations", dec.escalations], ["Recommended follow-up", sum.recommendedFollowUp]]);
  for (const a of actions) {
    const extra = [clean(a.description), a.dueDate ? `due ${String(a.dueDate).slice(0, 10)}` : ""].filter(Boolean).join(", ");
    const line = `${a.title}${extra ? ` — ${extra}` : ""}${a.status ? ` (${a.status.replace("_", " ")})` : ""}`;
    if (a.kind === "issue") lows.push(`Issue: ${line}`);
    else resolutions.push(`Follow-up: ${line}`);
    if (clean(a.resolutionNotes)) resolutions.push(`Resolved (${a.title}): ${clean(a.resolutionNotes)}`);
  }
  return { highs: highs.join("\n"), lows: lows.join("\n"), resolutions: resolutions.join("\n") };
}

const isNewShape = (report) => report && ["highs", "lows", "resolutions"].some((k) => typeof report[k] === "string") && !report.summary && !report.operations;
const hasText = (report) => Boolean(report && ["highs", "lows", "resolutions"].some((k) => clean(report[k])));

async function dropColumns(knex, table, columns) {
  for (const column of columns) {
    if (await knex.schema.hasColumn(table, column)) await knex.schema.alterTable(table, (t) => t.dropColumn(column));
  }
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("checkin_sessions"))) return;
  const hasReportStatus = await knex.schema.hasColumn("checkin_sessions", "reportStatus");
  if (hasReportStatus) {
    const hasActions = await knex.schema.hasTable("checkin_actions");
    const sessions = await knex("checkin_sessions").select("id", "status", "reportStatus", "report");
    for (const s of sessions) {
      const old = parse(s.report);
      const actions = hasActions ? await knex("checkin_actions").where({ sessionId: s.id }).orderBy("createdAt", "asc") : [];
      const report = isNewShape(old) ? old : (old || actions.length ? convert(old, actions) : null);
      const reported = s.reportStatus === "submitted";
      if (s.status === "cancelled" && !reported && !hasText(report)) {
        await knex("checkin_sessions").where({ id: s.id }).del();
        continue;
      }
      await knex("checkin_sessions").where({ id: s.id }).update({
        report: hasText(report) ? JSON.stringify(report) : null,
        status: reported ? "reported" : "open",
      });
    }
  }

  await dropColumns(knex, "checkin_sessions", [
    "startTime", "durationMinutes", "meetingLink", "venue", "agenda", "reportStatus", "overallStatus", "cancelReason", "history",
  ]);
  await knex.schema.alterTable("checkin_sessions", (t) => t.string("status", 30).notNullable().defaultTo("open").alter());
  await dropColumns(knex, "checkin_schedules", ["startTime", "durationMinutes", "meetingLink", "venue", "agenda"]);
  await knex.schema.dropTableIfExists("checkin_action_updates");
  await knex.schema.dropTableIfExists("checkin_actions");
};

// The dropped columns come back empty (and the actions tables, empty); a report stays in the new
// shape — the old sections can't be split back out of it.
exports.down = async function down(knex) {
  const add = async (table, column, build) => {
    if (!(await knex.schema.hasColumn(table, column))) await knex.schema.alterTable(table, (t) => build(t));
  };
  for (const table of ["checkin_schedules", "checkin_sessions"]) {
    await add(table, "startTime", (t) => t.string("startTime", 5).notNullable().defaultTo("09:00"));
    await add(table, "durationMinutes", (t) => t.integer("durationMinutes").nullable());
    await add(table, "meetingLink", (t) => t.string("meetingLink", 500).nullable());
    await add(table, "venue", (t) => t.string("venue", 255).nullable());
    await add(table, "agenda", (t) => t.text("agenda").nullable());
  }
  await add("checkin_sessions", "reportStatus", (t) => t.string("reportStatus", 20).notNullable().defaultTo("none"));
  await add("checkin_sessions", "overallStatus", (t) => t.string("overallStatus", 30).nullable());
  await add("checkin_sessions", "cancelReason", (t) => t.string("cancelReason", 255).nullable());
  await add("checkin_sessions", "history", (t) => t.json("history").nullable());
  await knex("checkin_sessions").where({ status: "reported" }).update({ status: "completed", reportStatus: "submitted" });
  await knex("checkin_sessions").where({ status: "open" }).update({ status: "scheduled" });
  // The 20261022130000 migration's own up() recreates the actions tables when they're missing.
  await require("./20261022130000_create_hub_checkins").up(knex);
};

// For test/checkins.test.js.
exports._convert = convert;
