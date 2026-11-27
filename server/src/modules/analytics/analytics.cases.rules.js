// Follow-up cases (26 Nov 2026): the rules, with no database, so they can be tested
// (test/followup-cases.test.js). The service is analytics.cases.js.

const DUE_DAYS = 3; // the owner should act within this
const RECHECK_DAYS = 14; // then the figures are looked at again
const REOPEN_GAP_DAYS = 7; // a reason closed less than this ago doesn't open again yet

// Why a learner gets a case — each with the numbers that set it off.
const fmtDay = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const REASONS = {
  lowScore: { label: "Low scores", tone: "danger", summary: (d) => `Recent work averages ${d.score}% (${plural(d.pieces, "marked piece")}).` },
  lowAttendance: { label: "Low attendance", tone: "danger", summary: (d) => `Came to ${d.rate}% of ${plural(d.days, "session")} in the last 30 days.` },
  missedWork: { label: "Missed work", tone: "waiting", summary: (d) => `${plural(d.missed, "piece")} of work past the due date and not handed in.` },
  notSignedIn: { label: "Not signing in", tone: "waiting", summary: (d) => (d.lastSignIn ? `Nobody in the family has signed in since ${fmtDay(d.lastSignIn)}.` : "Nobody in the family has signed in yet.") },
  absenceStreak: { label: "Absent in a row", tone: "danger", summary: (d) => `Absent the last ${d.count} sessions${d.dates?.length ? ` (${d.dates.map(fmtDay).join(", ")})` : ""}.` },
  stuckCompetency: { label: "Stuck on a skill", tone: "waiting", summary: (d) => `${d.competencyName}: ${d.percent}% across ${plural(d.pieces, "marked piece")}.` },
  reportsUnread: { label: "Reports not opened", tone: "info", summary: (d) => `${plural(d.reports, "report")} waiting; the parent hasn't opened any.` },
  other: { label: "Other", tone: "neutral", summary: (d) => d.note || "Opened by the team." },
};
const REASON_KEYS = Object.keys(REASONS);

// Where a case stands. Escalated = handed to the workspace's admins.
const STATUSES = {
  open: { label: "Open", tone: "waiting" },
  contacted: { label: "Contacted", tone: "info" },
  plan: { label: "Plan agreed", tone: "good" },
  escalated: { label: "Escalated", tone: "danger" },
  resolved: { label: "Resolved", tone: "neutral" },
};
const OUTCOMES = {
  back_on_track: "Back on track",
  sorted: "Sorted",
  left: "Left the hub",
};

const openKeyOf = (learnerId, reasonKey) => `${learnerId}|${reasonKey}`.slice(0, 130);

const addDays = (day, n) => {
  const [y, m, d] = String(day).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// Which way a status may go. Resolved is final (a fresh case opens if the reason comes back).
function statusProblem(from, to) {
  if (!STATUSES[to]) return "Choose a status";
  if (from === "resolved") return "This follow-up is closed";
  if (from === to) return null;
  return null;
}

// Is it overdue? (an open-ish case past its due date)
const isOverdue = (c, today) => c.status !== "resolved" && !!c.dueOn && String(c.dueOn).slice(0, 10) < today;

// At the re-check: the reason has gone → closed "Back on track"; still there → checked again later.
function recheckOutcome({ stillFlagged, today }) {
  return stillFlagged
    ? { status: null, recheckOn: addDays(today, RECHECK_DAYS), outcome: null }
    : { status: "resolved", recheckOn: null, outcome: "back_on_track" };
}

// May the same reason open a new case now? Not while one is open, nor soon after one closed.
function mayOpen({ openExists, lastClosedAt, today }) {
  if (openExists) return false;
  if (!lastClosedAt) return true;
  return String(lastClosedAt).slice(0, 10) <= addDays(today, -REOPEN_GAP_DAYS);
}

// The suggested message to the parent, per reason — staff change it before sending. Plain words,
// no em dashes.
function suggestedMessage(reason, { first = "your child", parent = "", className = "", details = {} } = {}) {
  const hi = `Hello${parent ? ` ${String(parent).split(/\s+/)[0]}` : ""},`;
  const where = className ? ` in ${className}` : "";
  const end = "Please reply here or call us so we can help.";
  switch (reason) {
    case "absenceStreak":
      return `${hi} we've missed ${first} at the last ${details.count || "few"} sessions${where}. Is everything all right? We'd love to help ${first} catch up. ${end}`;
    case "lowAttendance":
      return `${hi} ${first} has come to ${details.rate ?? "only some"}% of sessions${where} this month. Regular attendance makes a big difference. Is there anything making it hard to come? ${end}`;
    case "lowScore":
      return `${hi} ${first}'s recent work is averaging ${details.score ?? "below"}%. Their educator is giving extra support in class. At home, asking ${first} to show you what they're making really helps. ${end}`;
    case "missedWork":
      return `${hi} ${first} has ${details.missed || "some"} pieces of work past their due date. They can still hand them in from their Digifunzi account. Could you help them find a time this week? ${end}`;
    case "notSignedIn":
      return `${hi} we haven't seen ${first} on Digifunzi for over two weeks. Their work and reports are waiting there. If signing in is a problem, we can help. ${end}`;
    case "stuckCompetency":
      return `${hi} ${first} is finding ${details.competencyName || "one skill"} hard at the moment. Their educator is giving extra practice. Encouraging ${first} to keep trying at home helps a lot. ${end}`;
    case "reportsUnread":
      return `${hi} ${first} has ${details.reports || "new"} progress report${details.reports === 1 ? "" : "s"} waiting for you on Digifunzi. Sign in to see how ${first} is doing and what to practise next.`;
    default:
      return `${hi} we'd like to talk to you about ${first}. ${end}`;
  }
}

// Each learner's run of absences, most recent first: how many sessions in a row they've missed
// right up to now (excused days skipped; present or late ends the run).
function absenceRun(rows) {
  const sorted = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const dates = [];
  for (const r of sorted) {
    if (r.status === "excused") continue;
    if (r.status !== "absent") break;
    dates.push(String(r.date).slice(0, 10));
  }
  return { count: dates.length, dates: dates.reverse() };
}

module.exports = {
  DUE_DAYS, RECHECK_DAYS, REOPEN_GAP_DAYS, REASONS, REASON_KEYS, STATUSES, OUTCOMES,
  openKeyOf, addDays, statusProblem, isOverdue, recheckOutcome, mayOpen, suggestedMessage, absenceRun, fmtDay,
};
