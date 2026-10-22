// The rules for check-in sessions and actions — pure, no database, tested on their own
// (test/checkins.test.js).

const { OPEN_ACTION_STATUSES } = require("./checkin.constants");

// What a session's status should be today, from its date and its report. Completed and cancelled
// are final (only an authorized "reopen" or a reschedule moves them, elsewhere). A report that is
// submitted is the only way to complete — never the date passing.
function deriveSessionStatus(session, today) {
  if (session.status === "cancelled") return "cancelled";
  if (session.reportStatus === "submitted") return "completed";
  const past = session.scheduledDate < today;
  if (session.reportStatus === "draft") return past ? "pending_submission" : "in_progress";
  if (past) return "missed";
  // Upcoming or today, nothing written: a moved session keeps saying so.
  return session.status === "rescheduled" ? "rescheduled" : "scheduled";
}

// An action's next status from a requested change — or an error message. Resolving needs a note
// of what was done. Closing is for something resolved, or set aside by a manager. Reopening sends
// it back to assigned (or open, with nobody on it).
function nextActionStatus(action, requested, { resolutionNotes = "", isManager = false } = {}) {
  const from = action.status;
  if (requested === from) return { error: "The action already has that status" };
  if (requested === "resolved") {
    if (!String(resolutionNotes || action.resolutionNotes || "").trim()) return { error: "Say how it was resolved" };
    return { status: "resolved" };
  }
  if (requested === "closed") {
    if (from !== "resolved" && !isManager) return { error: "Only a resolved action can be closed" };
    return { status: "closed" };
  }
  if (requested === "in_progress") {
    if (!action.assigneeId) return { error: "Assign the action to someone first" };
    return { status: "in_progress" };
  }
  if (requested === "assigned") {
    if (!action.assigneeId) return { error: "Assign the action to someone first" };
    return { status: "assigned" };
  }
  if (requested === "open") return { status: action.assigneeId ? "assigned" : "open" };
  return { error: "Unknown status" };
}

const isActionOverdue = (action, today) => Boolean(action.dueDate) && action.dueDate < today && OPEN_ACTION_STATUSES.includes(action.status);

// What submitting a report needs. `actions` are the session's issues and actions.
function reportProblems(report, actions = []) {
  const problems = [];
  const r = report || {};
  if (!r.session?.actualDate) problems.push("Add the date the check-in actually took place");
  if (!r.operations?.generalStatus) problems.push("Choose the hub's general operational status");
  if (!r.summary?.overallStatus) problems.push("Choose the overall hub status (On track, Needs attention or Critical)");
  if (!String(r.summary?.observations || "").trim()) problems.push("Write the general observations in the summary");
  for (const a of actions) {
    if (a.kind === "action" && (!a.assigneeId || !a.dueDate)) problems.push(`Give the follow-up "${a.title}" a responsible person and a due date`);
  }
  return problems;
}

module.exports = { deriveSessionStatus, nextActionStatus, isActionOverdue, reportProblems };
