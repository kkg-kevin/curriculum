// The rules for check-ins — pure, no database, tested on their own (test/checkins.test.js).

// Where a check-in stands today: "reported" once its report is in; otherwise "due" from its day
// on (until the report is written — it stays due), "upcoming" before it.
function sessionState(session, today) {
  if (session.status === "reported") return "reported";
  return session.scheduledDate <= today ? "due" : "upcoming";
}

const REPORT_FIELDS = [
  ["highs", "Highs"],
  ["lows", "Lows"],
  ["resolutions", "Resolutions"],
];

// What a report still needs: each of the three parts written ("None" is fine).
function reportProblems(report) {
  return REPORT_FIELDS
    .filter(([key]) => !String(report?.[key] || "").trim())
    .map(([, label]) => `Write the ${label.toLowerCase()} (write "None" if there were none)`);
}

module.exports = { sessionState, reportProblems, REPORT_FIELDS };
