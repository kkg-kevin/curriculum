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

// Whether a part says anything. The parts are rich text (HTML) — the editor's empty state is
// still markup ("<p></p>") — so tags don't count, but a picture on its own does. Reports from
// before 27 Oct 2026 are plain text, which this reads the same way.
function hasContent(value) {
  const html = String(value || "");
  if (/<img[\s>]/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

// What a report still needs: each of the three parts written ("None" is fine).
function reportProblems(report) {
  return REPORT_FIELDS
    .filter(([key]) => !hasContent(report?.[key]))
    .map(([, label]) => `Write the ${label.toLowerCase()} (write "None" if there were none)`);
}

// Where a task from the resolutions stands today: "done", or open — "overdue" past its deadline,
// "due" on it, "open" before it.
function taskState(task, today) {
  if (task.status === "done") return "done";
  if (task.dueDate < today) return "overdue";
  return task.dueDate === today ? "due" : "open";
}

module.exports = { sessionState, reportProblems, hasContent, taskState, REPORT_FIELDS };
