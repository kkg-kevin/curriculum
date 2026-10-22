// Hub check-ins — the fixed lists the rest of the module (and its validation) works from.

const FREQUENCIES = ["weekly", "monthly", "quarterly", "semi_annually", "annually", "once"];
const FORMATS = ["online", "in_person"];
const SCHEDULE_STATUSES = ["active", "ended"];

// A session's life:
//   scheduled           on the calendar, nothing written yet
//   rescheduled         moved to another date or time (counts as upcoming on its new date)
//   in_progress         its report has been started, on or before the day
//   pending_submission  the day has passed with a draft report not yet submitted
//   completed           its report is submitted — the only way a session completes
//   missed              the day passed and no report was started; stays until it is rescheduled,
//                       cancelled, or a report is written late
//   cancelled           called off (with a reason)
const SESSION_STATUSES = ["scheduled", "rescheduled", "in_progress", "pending_submission", "completed", "missed", "cancelled"];
const OPEN_SESSION_STATUSES = ["scheduled", "rescheduled", "in_progress", "pending_submission", "missed"];
const REPORT_STATUSES = ["none", "draft", "submitted"];
const OVERALL_STATUSES = ["on_track", "needs_attention", "critical"];

const ACTION_KINDS = ["issue", "action"];
const ACTION_STATUSES = ["open", "assigned", "in_progress", "resolved", "closed"];
const OPEN_ACTION_STATUSES = ["open", "assigned", "in_progress"];
const ACTION_CATEGORIES = ["equipment", "staffing", "facilities", "curriculum_delivery", "educator_support", "learner_engagement", "operations", "other"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const OPERATIONAL_STATUSES = ["running_well", "minor_issues", "significant_issues"];

// How far ahead a schedule's sessions are put on the calendar. Longer gaps (quarterly and up)
// always get at least their next session, whatever the horizon.
const GENERATE_AHEAD_DAYS = 90;

module.exports = {
  FREQUENCIES, FORMATS, SCHEDULE_STATUSES, SESSION_STATUSES, OPEN_SESSION_STATUSES, REPORT_STATUSES, OVERALL_STATUSES,
  ACTION_KINDS, ACTION_STATUSES, OPEN_ACTION_STATUSES, ACTION_CATEGORIES, PRIORITIES, OPERATIONAL_STATUSES, GENERATE_AHEAD_DAYS,
};
