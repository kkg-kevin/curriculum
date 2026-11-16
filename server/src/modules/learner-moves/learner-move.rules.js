// Moving a learner between programmes — the rules that need no database (learner-move.service.js
// does the reading and writing). Tested in test/learner-moves.test.js.
//
// A learner's record is never copied or rebuilt: their work, reports, certificates, attendance,
// diagnostics, pathway placement and invoices belong to the learner, not to the programme. A move
// only opens a place in the new programme (through that programme's own code) and ends the places
// they leave — ended, never deleted — and writes the move down.

const PROGRAMMES = ["hub", "bootcamp", "home_learning", "tech_club", "pathway"];

const PROGRAMME_LABELS = {
  hub: "Hub class",
  bootcamp: "Bootcamp",
  home_learning: "Home Learning",
  tech_club: "Tech Club",
  pathway: "Pathway plan",
};

// The staff module (access.registry.js) whose "create" a staff member needs to move someone INTO
// each programme. A hub class is only Learners → Edit (which every move needs anyway).
const DESTINATION_MODULE = {
  hub: null,
  bootcamp: "bootcamps",
  home_learning: "home-learning",
  tech_club: "tech-clubs",
  pathway: "pathway-subscriptions",
};

// Billing for a NEW household / membership / subscription starts on this day: today, or a day
// within the next year (to cover time the family already paid for elsewhere). Never in the past —
// that would bill periods the child wasn't in.
const MAX_START_DAYS = 366;

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function startDateProblem(startDate, today) {
  if (!startDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "Choose the day billing starts";
  if (startDate < today) return "Billing can't start in the past — choose today or later";
  if (startDate > addDays(today, MAX_START_DAYS)) return "Billing must start within the next year";
  return null;
}

// What's wrong with a move before anything is written: the destination's own problems come from
// its programme; these are the ones about the places they hold.
//   places      — every place they hold now ({ key, programme, recordId, hubId, status })
//   endKeys     — the places chosen to end
//   destination — { programme, recordId (an existing household / membership / subscription /
//                 bootcamp, if any), hubId, sameAs (the place key it would duplicate, if any) }
function moveProblems({ places = [], endKeys = [], destination }) {
  const problems = [];
  if (!destination || !PROGRAMMES.includes(destination.programme)) return ["Choose where they're moving to"];
  const byKey = new Map(places.map((p) => [p.key, p]));
  for (const key of endKeys) {
    if (!byKey.has(key)) problems.push("One of the places chosen to leave isn't theirs any more — reload and try again");
  }
  // Already in it: moving into a place they hold (and keep) changes nothing.
  if (destination.sameAs && byKey.has(destination.sameAs) && !endKeys.includes(destination.sameAs)) {
    problems.push(sameMessage(destination.programme));
  }
  // A hub has one place per learner (one hub link): a new place there means leaving the one they
  // hold. (A pathway plan sits beside a hub class, so it never clashes.)
  const clash = destination.hubClash && byKey.get(destination.hubClash);
  if (clash && destination.hubClash !== destination.sameAs && !endKeys.includes(clash.key)) {
    problems.push(`They already have a place there (${clash.label}) — tick it under "Where they are now" to leave it`);
  }
  // Home Learning is one place per child (one enrolment row); moving within it is the Home
  // Learning page's job, so a child already there (and staying) can't be moved in again.
  if (destination.programme === "home_learning" && places.some((p) => p.programme === "home_learning" && p.status !== "ended")) {
    const held = places.find((p) => p.programme === "home_learning");
    if (!endKeys.includes(held.key)) problems.push("They're already in Home Learning — change their place from the Home Learning page");
    else problems.push("They're already in Home Learning — change their household or class from the Home Learning page instead");
  }
  return [...new Set(problems)];
}

function sameMessage(programme) {
  return {
    hub: "They're already in that class",
    bootcamp: "They're already on that bootcamp run",
    tech_club: "They're already in that membership",
    pathway: "They're already on that subscription",
  }[programme] || "They already hold that place";
}

// A household, membership or subscription left with no child: offered to stop (cancel) so it isn't
// billed for nobody. `activeChildren` counts the child leaving.
function leavesEmpty(place) {
  return ["home_learning", "tech_club", "pathway"].includes(place?.programme) && Number(place.activeChildren || 0) <= 1;
}

// A child leaving a pathway subscription keeps the access already paid for: up to the end of the
// last paid period (the subscription's accessUntil), never longer than they had — and nothing when
// nothing was ever paid.
function accessAfterLeaving({ rowAccessUntil, paidUntil, today }) {
  if (!paidUntil) return addDays(today, -1);
  const end = [rowAccessUntil, paidUntil].filter(Boolean).sort()[0];
  return end || addDays(today, -1);
}

// The note on the move's record, read in the learner's Moves.
function moveNote(from, to) {
  if (!from) return `Joined ${to}`;
  return `${from} → ${to}`;
}

// Same curriculum before and after: the work they've done there still counts in the new place.
// A different one starts its courses fresh, with the old ones kept as history.
function continuity({ fromCurriculumIds = [], toCurriculumId }) {
  if (!toCurriculumId) return "unknown";
  return fromCurriculumIds.includes(toCurriculumId) ? "same" : "different";
}

module.exports = {
  PROGRAMMES, PROGRAMME_LABELS, DESTINATION_MODULE, MAX_START_DAYS,
  addDays, startDateProblem, moveProblems, leavesEmpty, accessAfterLeaving, moveNote, continuity,
};
