// Hub check-ins — the fixed lists the rest of the module (and its validation) works from.

// What the admin chooses from. "quarterly" and "once" were offered before 26 Oct 2026; schedules
// set up then keep working (checkin.dates.js still knows them) but aren't offered any more.
const FREQUENCIES = ["weekly", "monthly", "semi_annually", "annually"];
const FORMATS = ["online", "in_person"];
const SCHEDULE_STATUSES = ["active", "ended"];

// A check-in is "open" until its report is in, then "reported". Whether an open one is upcoming
// or due is worked out from its date (checkin.rules.js).
const SESSION_STATUSES = ["open", "reported"];

// How far ahead a schedule's check-ins are put on the calendar. Longer gaps (every 6 months, a
// year) always get at least their next one, whatever the horizon.
const GENERATE_AHEAD_DAYS = 90;

module.exports = { FREQUENCIES, FORMATS, SCHEDULE_STATUSES, SESSION_STATUSES, GENERATE_AHEAD_DAYS };
