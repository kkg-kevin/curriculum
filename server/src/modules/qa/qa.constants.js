// Quality assurance — the fixed lists the rest of the module (and its validation) works from.

// How often a schedule's visits come round. "quarterly" is once a term.
const FREQUENCIES = ["weekly", "monthly", "quarterly", "semi_annually", "annually"];

// An announced visit is shown to the educator (and the hub) beforehand; a surprise one only once
// its report is in.
const VISIT_TYPES = ["announced", "surprise"];

// How each criterion is answered.
const CRITERION_KINDS = ["yes_no", "rubric", "comment"];

// open → submitted, or cancelled. Whether an open one is upcoming or due comes from its date.
const VISIT_STATUSES = ["open", "submitted", "cancelled"];

// The rubric a new template starts with — editable per template.
const DEFAULT_SCALE = [
  { score: 1, label: "Needs support" },
  { score: 2, label: "Developing" },
  { score: 3, label: "Good" },
  { score: 4, label: "Excellent" },
];

// How far ahead a schedule's visits are put on the calendar (longer gaps always get their next one).
const GENERATE_AHEAD_DAYS = 90;
// An educator hears about an announced visit this many days before it (or as soon as it's planned,
// when that's sooner).
const NOTICE_DAYS = 7;

module.exports = { FREQUENCIES, VISIT_TYPES, CRITERION_KINDS, VISIT_STATUSES, DEFAULT_SCALE, GENERATE_AHEAD_DAYS, NOTICE_DAYS };
