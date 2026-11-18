// Class rankings — the rules that need no database (tested in test/rankings.test.js). The service
// (ranking.service.js) loads a class's period of work and hands it here.
//
// Every learner gets a Learning Score (0–100) per class per period, from everything they do there
// (weights are Settings → Rankings; these are the defaults):
//   achievement   50%  their marked work — each piece's percentage, averaged
//   attendance    15%  sessions attended (present or late) out of those marked, excused left out
//   on-time work  15%  work handed in by its due date, out of the work that has come due
//   growth        10%  their later marked work against their earlier work this period
//   competencies  10%  the competency framework: their marks per competency, averaged
// A part with nothing to go on yet (no attendance taken, too little work to show growth) is left
// out and the others are weighed up to 100 — nobody is marked down for what hasn't happened.
//
// Fairness: only work issued in the period counts, and a piece only counts against on-time once
// its due date has passed. A learner needs `minMarked` marked pieces to be ranked, and a class
// needs `minClass` ranked learners before positions are shown. Equal scores share a place.
//
// What families see (the user's choice, 18 Nov 2026): the exact place for the top half of the
// class, a band below it, never the bottom of the list; others by first name and initial (or as
// Settings → Rankings says).

const WEIGHTS = { achievement: 50, attendance: 15, onTime: 15, growth: 10, competencies: 10 };
const PARTS = [
  { key: "achievement", label: "Marked work" },
  { key: "attendance", label: "Attendance" },
  { key: "onTime", label: "Work on time" },
  { key: "growth", label: "Growth" },
  { key: "competencies", label: "Competencies" },
];
const MIN_MARKED = 3;
const MIN_CLASS = 5;
const GROWTH_MIN_PIECES = 4;
const NAME_STYLES = ["initial", "first", "anonymous"];
const PERIODS = ["term", "rolling30"];

const DEFAULT_SETTINGS = {
  enabled: true, disabledHubIds: [], weights: { ...WEIGHTS }, minMarked: MIN_MARKED, minClass: MIN_CLASS, nameStyle: "initial", period: "term", terms: [],
};

// The four level words of learners' reports (analytics.utils.js LEVELS, client reportView.js).
const LEVELS = [
  { key: "early", label: "Early days", min: 0 },
  { key: "starting", label: "Getting started", min: 40 },
  { key: "track", label: "On track", min: 60 },
  { key: "strong", label: "Strong start", min: 80 },
];
const levelOf = (percent) => (percent == null ? null : [...LEVELS].reverse().find((l) => percent >= l.min) || LEVELS[0]);

const round1 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const parseJson = (v) => {
  if (v == null || typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};

// ---- Settings ---------------------------------------------------------------------------------
function settingsOf(row) {
  if (!row) return { ...DEFAULT_SETTINGS, weights: { ...WEIGHTS }, disabledHubIds: [], terms: [] };
  const w = parseJson(row.weights) || {};
  const weights = Object.fromEntries(PARTS.map(({ key }) => [key, Number.isFinite(Number(w[key])) && Number(w[key]) >= 0 ? Number(w[key]) : WEIGHTS[key]]));
  if (!Object.values(weights).some((v) => v > 0)) Object.assign(weights, WEIGHTS);
  const terms = (parseJson(row.terms) || []).filter((t) => t && isDay(t.from) && isDay(t.to) && t.from <= t.to)
    .map((t) => ({ name: String(t.name || "Term").slice(0, 60), from: t.from, to: t.to }))
    .sort((a, b) => a.from.localeCompare(b.from));
  return {
    enabled: row.enabled !== false && row.enabled !== 0,
    disabledHubIds: (parseJson(row.disabledHubIds) || []).map(String),
    weights,
    minMarked: Math.max(1, Number(row.minMarked) || MIN_MARKED),
    minClass: Math.max(2, Number(row.minClass) || MIN_CLASS),
    nameStyle: NAME_STYLES.includes(row.nameStyle) ? row.nameStyle : "initial",
    period: PERIODS.includes(row.period) ? row.period : "term",
    terms,
  };
}

// ---- Periods ----------------------------------------------------------------------------------
// Kenya's three-term year: Jan–Apr, May–Aug, Sep–Dec — when the workspace hasn't set its own.
function termOf(day) {
  const [y, m] = String(day).slice(0, 7).split("-").map(Number);
  const n = m <= 4 ? 1 : m <= 8 ? 2 : 3;
  const from = `${y}-${["01-01", "05-01", "09-01"][n - 1]}`;
  const to = `${y}-${["04-30", "08-31", "12-31"][n - 1]}`;
  return { key: `${y}-T${n}`, label: `Term ${n} ${y}`, from, to };
}

const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// The period ranked on `day`: the workspace's own term holding it (else the one just ended, so
// a school holiday still shows last term), the Kenyan term, or the last 30 days.
function periodFor(day, settings = DEFAULT_SETTINGS) {
  if (settings.period === "rolling30") {
    // Keyed by the week, so snapshots and badges still group sensibly.
    return { key: `R30-${weekStart(day)}`, label: "The last 30 days", from: addDays(day, -29), to: day, rolling: true };
  }
  const terms = settings.terms || [];
  if (terms.length) {
    const current = terms.find((t) => t.from <= day && day <= t.to) || [...terms].reverse().find((t) => t.to < day);
    if (current) return { key: `C-${current.from}`, label: current.name, from: current.from, to: current.to };
  }
  return termOf(day);
}

// The Monday of a day's week ("YYYY-MM-DD") — snapshots are kept one per week.
function weekStart(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400000).toISOString().slice(0, 10);
}

// ---- One learner's parts ----------------------------------------------------------------------
/**
 * tasks       their tasks in the class in the period (analytics.work.js): { timing, marked,
 *             percent, gradedAt }
 * attendance  their attendance rows: { status, date }
 * competencyMarks  Map competencyId → { e, p } from their marked work
 */
function partsFor({ tasks = [], attendance = [], competencyMarks = new Map() }) {
  const marked = tasks.filter((t) => t.marked && t.percent != null)
    .sort((a, b) => new Date(a.gradedAt || 0) - new Date(b.gradedAt || 0));
  const achievement = marked.length ? mean(marked.map((t) => t.percent)) : null;

  const counted = attendance.filter((a) => a.status !== "excused");
  const attended = counted.filter((a) => a.status === "present" || a.status === "late").length;
  const attendancePct = counted.length ? (attended / counted.length) * 100 : null;

  // Due (or handed in without a due date): on time or no due date counts as on time.
  const due = tasks.filter((t) => ["on_time", "late", "missed", "no_due"].includes(t.timing));
  const onTime = due.length ? (due.filter((t) => t.timing === "on_time" || t.timing === "no_due").length / due.length) * 100 : null;

  // Growth: the later half of their marked work against the earlier half. +20 points of
  // improvement is full marks, no change is the middle, a drop of 20 is the bottom.
  let growth = null;
  let growthDelta = null;
  if (marked.length >= GROWTH_MIN_PIECES) {
    const half = Math.floor(marked.length / 2);
    growthDelta = mean(marked.slice(marked.length - half).map((t) => t.percent)) - mean(marked.slice(0, half).map((t) => t.percent));
    growth = clamp(50 + growthDelta * 2.5);
  }

  const compPercents = [...competencyMarks.values()].filter((c) => c.p > 0).map((c) => Math.min(100, (c.e / c.p) * 100));
  const competencies = compPercents.length ? mean(compPercents) : null;

  return {
    achievement: round1(achievement),
    attendance: round1(attendancePct),
    onTime: round1(onTime),
    growth: round1(growth),
    competencies: round1(competencies),
    growthDelta: round1(growthDelta),
    markedCount: marked.length,
    dueCount: due.length,
    missedCount: tasks.filter((t) => t.timing === "missed").length,
    sessionsCounted: counted.length,
  };
}

// The Learning Score: the parts there are, weighed up to 100.
function scoreOf(parts, weights = WEIGHTS) {
  let sum = 0;
  let weight = 0;
  for (const { key } of PARTS) {
    if (parts[key] == null || !(weights[key] > 0)) continue;
    sum += parts[key] * weights[key];
    weight += weights[key];
  }
  return weight ? round1(sum / weight) : null;
}

// ---- Streaks ----------------------------------------------------------------------------------
// On-time: the run of pieces handed in on time (by due date order), counted back from the latest
// piece that has come due; a late or missed piece ends it. Also the best run in the period.
function onTimeStreak(tasks) {
  const due = tasks.filter((t) => ["on_time", "late", "missed", "no_due"].includes(t.timing))
    .sort((a, b) => (a.dueEnd || 0) - (b.dueEnd || 0));
  let run = 0;
  let best = 0;
  for (const t of due) {
    run = t.timing === "on_time" || t.timing === "no_due" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

// Attendance: sessions in a row they came to, counted back from the latest (excused skipped).
function attendanceStreak(rows) {
  const sorted = rows.filter((a) => a.status !== "excused").sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let run = 0;
  let best = 0;
  for (const a of sorted) {
    run = a.status === "present" || a.status === "late" ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

// ---- Badges -----------------------------------------------------------------------------------
const BADGES = [
  { key: "on_the_board", label: "On the board", description: "Ranked in the class for the first time this term", icon: "flag" },
  { key: "top_of_class", label: "Top of the class", description: "1st place in the class", icon: "award" },
  { key: "top_three", label: "Top three", description: "A place in the top three", icon: "star" },
  { key: "most_improved", label: "Most improved", description: "The biggest improvement in the class", icon: "trending" },
  { key: "perfect_week", label: "Perfect week", description: "Came to every session in a week", icon: "calendar" },
  { key: "on_time_5", label: "On-time streak", description: "5 pieces of work in a row handed in on time", icon: "clock" },
  { key: "full_marks", label: "Full marks", description: "100% on a piece of work", icon: "check" },
  { key: "personal_best", label: "Personal best", description: "Their best mark of the term on their latest piece", icon: "zap" },
  { key: "strong_skill", label: "Strong skill", description: "A competency at Strong start", icon: "target" },
];

// Weeks (Monday) in which the learner came to every session, with at least 2 sessions.
function perfectWeeks(attendance) {
  const byWeek = new Map();
  for (const a of attendance) {
    if (a.status === "excused" || !a.date) continue;
    const w = weekStart(String(a.date).slice(0, 10));
    const x = byWeek.get(w) || { n: 0, ok: 0 };
    x.n += 1;
    if (a.status === "present" || a.status === "late") x.ok += 1;
    byWeek.set(w, x);
  }
  return [...byWeek].filter(([, x]) => x.n >= 2 && x.ok === x.n).map(([w]) => w);
}

/**
 * The badges a learner holds now, from their period in the class.
 * entry: { parts, rank, tasks, attendance, competencyMarks }; mostImproved: they lead the class's
 * Most improved board.
 * Returns [{ key, detail }].
 */
function badgesFor(entry, { mostImproved = false } = {}) {
  const out = [];
  const marked = (entry.tasks || []).filter((t) => t.marked && t.percent != null).sort((a, b) => new Date(a.gradedAt || 0) - new Date(b.gradedAt || 0));
  if (entry.rank) out.push({ key: "on_the_board", detail: null });
  if (entry.rank === 1) out.push({ key: "top_of_class", detail: null });
  if (entry.rank && entry.rank <= 3) out.push({ key: "top_three", detail: null });
  if (mostImproved) out.push({ key: "most_improved", detail: entry.parts.growthDelta != null ? `+${Math.round(entry.parts.growthDelta)} points` : null });
  const weeks = perfectWeeks(entry.attendance || []);
  if (weeks.length) out.push({ key: "perfect_week", detail: `Week of ${weeks[weeks.length - 1]}` });
  if (onTimeStreak(entry.tasks || []).best >= 5) out.push({ key: "on_time_5", detail: null });
  if (marked.some((t) => t.percent >= 100)) out.push({ key: "full_marks", detail: null });
  if (marked.length >= 3) {
    const last = marked[marked.length - 1].percent;
    if (marked.slice(0, -1).every((t) => last > t.percent)) out.push({ key: "personal_best", detail: `${Math.round(last)}%` });
  }
  const strong = [...(entry.competencyMarks || new Map()).values()].some((c) => c.p > 0 && (c.e / c.p) * 100 >= 80);
  if (strong) out.push({ key: "strong_skill", detail: null });
  return out;
}

// ---- Ranking a class --------------------------------------------------------------------------
// Places for a list already sorted best first, by `valueOf` — equal values share a place.
function placeSorted(sorted, valueOf) {
  sorted.forEach((e, i) => {
    e.rank = i > 0 && valueOf(sorted[i - 1]) === valueOf(e) ? sorted[i - 1].rank : i + 1;
  });
  return sorted;
}

/**
 * entries: [{ learnerId, score, markedCount, ... }] → the same, each with `eligible`, and — when
 * the class has enough ranked learners — `rank` (equal scores share a place, the next place skips:
 * 1, 2, 2, 4). Sorted best first; learners not yet ranked last.
 */
function rankClass(entries, { minMarked = MIN_MARKED, minClass = MIN_CLASS } = {}) {
  const withFlags = entries.map((e) => ({ ...e, eligible: e.score != null && e.markedCount >= minMarked, rank: null }));
  const eligible = withFlags.filter((e) => e.eligible).sort((a, b) => b.score - a.score);
  const ranked = eligible.length >= minClass;
  if (ranked) placeSorted(eligible, (e) => e.score);
  const rest = withFlags.filter((e) => !e.eligible).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return { ranked, rankedCount: eligible.length, entries: [...eligible, ...rest] };
}

/**
 * More ways to shine: boards besides the overall one. Each board ranks the learners who qualify
 * for it and is only shown when at least `minClass` do.
 *   improved     growth over the period (4+ marked pieces) — the change in points
 *   attendance   attendance (3+ sessions marked)
 *   onTime       work on time (3+ pieces come due)
 *   course:<id>  their average mark in one course (2+ marked pieces in it)
 * entries carry `parts` and `courseMarks` (Map courseId → [percent]).
 * Returns [{ key, label, unit, rows: [{ learnerId, rank, value }] }] (rows best first).
 */
function boardsFor(entries, courses = new Map(), { minClass = MIN_CLASS } = {}) {
  const make = (key, label, unit, valueOf) => {
    const rows = entries.map((e) => ({ learnerId: e.learnerId, value: valueOf(e) })).filter((r) => r.value != null).sort((a, b) => b.value - a.value);
    if (rows.length < minClass) return null;
    return { key, label, unit, rows: placeSorted(rows, (r) => r.value) };
  };
  const boards = [
    make("improved", "Most improved", "points", (e) => (e.parts.growthDelta != null ? e.parts.growthDelta : null)),
    make("attendance", "Attendance", "%", (e) => (e.parts.sessionsCounted >= 3 ? e.parts.attendance : null)),
    make("onTime", "On time", "%", (e) => (e.parts.dueCount >= 3 ? e.parts.onTime : null)),
  ];
  for (const [courseId, name] of courses) {
    boards.push(make(`course:${courseId}`, name, "%", (e) => {
      const list = e.courseMarks?.get(courseId) || [];
      return list.length >= 2 ? round1(mean(list)) : null;
    }));
  }
  return boards.filter(Boolean);
}

// What a family is shown of a place: the exact place in the top half, else a band.
function standingOf(rank, rankedCount) {
  if (!rank || !rankedCount) return null;
  const exact = rank <= Math.ceil(rankedCount / 2);
  if (exact) return { exact: true, rank, rankedCount, band: null };
  const share = rank / rankedCount;
  return { exact: false, rank: null, rankedCount, band: share <= 0.75 ? "In the top three-quarters of the class" : "Climbing the ladder" };
}

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// How many points to the next place up (just passing the learner above), or null at the top.
function pointsToNext(sortedEligible, learnerId) {
  const i = sortedEligible.findIndex((e) => e.learnerId === learnerId);
  if (i <= 0) return null;
  const me = sortedEligible[i];
  const above = sortedEligible.slice(0, i).reverse().find((e) => e.score > me.score);
  if (!above) return null;
  return { points: round1(above.score - me.score + 0.1), toRank: above.rank };
}

// "Amani K." — first name and initial only, for other children.
function shortName(first, last) {
  const f = String(first || "").trim().split(/\s+/)[0] || "Learner";
  const l = String(last || "").trim();
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

// Another child's name as Settings → Rankings says: "Amani K.", "Amani", or "A classmate".
function displayName(first, last, style = "initial") {
  if (style === "anonymous") return "A classmate";
  if (style === "first") return String(first || "").trim().split(/\s+/)[0] || "Learner";
  return shortName(first, last);
}

/**
 * What a learner's leaderboard shows: the top three, and — when their own place is shown exactly —
 * the learners just above and below them. Never the bottom of the class.
 * Returns [{ rank, learnerId, isMe, gapBefore }].
 */
function leaderboardFor(sortedEligible, learnerId) {
  const meIndex = sortedEligible.findIndex((e) => e.learnerId === learnerId);
  const me = meIndex >= 0 ? sortedEligible[meIndex] : null;
  const exact = me && standingOf(me.rank, sortedEligible.length)?.exact;
  const pick = new Set([0, 1, 2].filter((i) => i < sortedEligible.length));
  if (exact) [meIndex - 1, meIndex, meIndex + 1].forEach((i) => {
    if (i >= 0 && i < sortedEligible.length && standingOf(sortedEligible[i].rank, sortedEligible.length).exact) pick.add(i);
  });
  const out = [];
  let last = -1;
  for (const i of [...pick].sort((a, b) => a - b)) {
    out.push({ rank: sortedEligible[i].rank, learnerId: sortedEligible[i].learnerId, isMe: sortedEligible[i].learnerId === learnerId, gapBefore: last >= 0 && i > last + 1 });
    last = i;
  }
  return out;
}

/**
 * What to do next — at most three steps, most useful first.
 * open: their work still open (not handed in, due date not passed): [{ name, dueDate }]
 * missed: their missed work: [{ name }]
 */
// "Fri 21 Nov" — the way people say a date.
function friendlyDay(day) {
  const d = new Date(`${String(day).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function nextSteps(parts, { open = [], missed = [] } = {}) {
  const steps = [];
  for (const t of open.slice(0, 2)) steps.push({ kind: "hand_in", text: `Hand in "${t.name}"${t.dueDate ? ` by ${friendlyDay(t.dueDate)}` : ""} — on-time work and marks both count.` });
  if (missed.length) steps.push({ kind: "catch_up", text: `Ask your educator about ${missed.length === 1 ? `"${missed[0].name}"` : `${missed.length} missed pieces of work`} — catching up lifts your score.` });
  const weakest = PARTS.filter((p) => parts[p.key] != null && p.key !== "growth").sort((a, b) => parts[a.key] - parts[b.key])[0];
  if (weakest && parts[weakest.key] < 80) {
    const tips = {
      achievement: "Read the feedback on your marked work and practise the parts you found hard.",
      attendance: "Come to every session — attendance is part of your score.",
      onTime: "Hand work in before its due date — it counts every time.",
      competencies: "Practise the skills where your level is lowest — they show on your profile.",
    };
    steps.push({ kind: "improve", part: weakest.key, text: tips[weakest.key] });
  }
  if (!steps.length) steps.push({ kind: "keep_going", text: "Keep doing what you're doing — come to every session and hand work in on time." });
  return steps.slice(0, 3);
}

module.exports = {
  WEIGHTS, PARTS, MIN_MARKED, MIN_CLASS, LEVELS, BADGES, NAME_STYLES, PERIODS, DEFAULT_SETTINGS,
  levelOf, round1, settingsOf, termOf, periodFor, weekStart, partsFor, scoreOf, onTimeStreak, attendanceStreak, perfectWeeks, badgesFor,
  rankClass, boardsFor, standingOf, ordinal, pointsToNext, shortName, displayName, leaderboardFor, nextSteps,
};
