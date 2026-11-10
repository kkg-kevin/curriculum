// Mentor standards (10 Nov 2026) — one bar for every mentor in the workspace, set in Settings →
// Mentor standards. Pure rules, no database; tested on their own (test/mentor-standards.test.js).
//
// Each standard has a TARGET (meets it) and a MINIMUM (below it is a real problem; between the two
// is "close"), and the EVIDENCE it needs before it counts (a rating from 1 review says nothing —
// "not enough data yet", never a fail). A mentor in their first `graceDays` is shown their figures
// but never marked below. The measures themselves are worked out with the mentor's profile figures
// (educator-profile.stats.js → stats.standards); pay is never one of them.

const STANDARDS = [
  {
    key: "retention", label: "Learner retention", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 80, minimum: 65, minEvidence: 5 },
    evidence: ["learner", "learners"],
    describe: "Of the learners who finished a course with this mentor in the last 12 months, the share still enrolled 60 days later. Learners who graduated don't count.",
    tip: "Talk to families before a course ends about what comes next, and follow up learners who stop coming.",
  },
  {
    key: "rating", label: "Parent rating", unit: "★", higherIsBetter: true, step: 0.1, max: 5,
    defaults: { enabled: true, target: 4, minimum: 3.5, minEvidence: 5 },
    evidence: ["review", "reviews"],
    describe: "The average of parents' overall ratings in the last 12 months.",
    tip: "Read what parents say in your feedback, and keep families updated on their child's progress.",
  },
  {
    key: "qa", label: "Quality reviews", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 70, minimum: 60, minEvidence: 1 },
    evidence: ["visit", "visits"],
    describe: "The average score of every quality-assurance visit.",
    tip: "Go through your last QA report's areas to improve with your supervisor.",
  },
  {
    key: "reliability", label: "Sessions held", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 90, minimum: 80, minEvidence: 5 },
    evidence: ["timetabled session", "timetabled sessions"],
    describe: "Of the sessions on their timetable in the last 90 days, the share that were held (attendance taken).",
    tip: "Take attendance at every session you teach. That's how a session counts as held.",
  },
  {
    key: "markedOnTime", label: "Work marked within 72 hours", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 90, minimum: 75, minEvidence: 5 },
    evidence: ["piece marked", "pieces marked"],
    describe: "Of the hand-marked work in their classes in the last 12 months, the share marked within 72 hours of being handed in.",
    tip: "Check Needs Grading a couple of times a week, so learners get feedback while the work is fresh.",
  },
  {
    key: "attendanceOnDay", label: "Attendance marked on the day", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 95, minimum: 85, minEvidence: 5 },
    evidence: ["session", "sessions"],
    describe: "Of their sessions in the last 90 days, the share whose attendance was marked on the day itself.",
    tip: "Mark attendance during the session, not afterwards.",
  },
  {
    key: "learnerAttendance", label: "Learner attendance", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 80, minimum: 70, minEvidence: 20 },
    evidence: ["attendance mark", "attendance marks"],
    describe: "In their sessions of the last 90 days, the share of learners marked present or late.",
    tip: "Reach out to the families of learners who miss sessions, early.",
  },
  {
    key: "onTrack", label: "Learners on track", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 60, minimum: 45, minEvidence: 10 },
    evidence: ["piece of marked work", "pieces of marked work"],
    describe: "Of the marked work in their classes in the last 12 months, the share scoring 60% or more (On track or Strong start).",
    tip: "Look at which skills learners find hardest in the class's results, and revisit them.",
  },
  {
    key: "mentorCheckins", label: "Parent check-ins written up", unit: "%", higherIsBetter: true,
    defaults: { enabled: true, target: 90, minimum: 75, minEvidence: 3 },
    evidence: ["parent check-in", "parent check-ins"],
    describe: "Of their parent–mentor check-ins whose day has passed in the last 12 months, the share held and written up.",
    tip: "Write each parent check-in up on the day. The parent is waiting to read and approve it.",
  },
  {
    key: "openConcerns", label: "Open parent concerns", unit: "", higherIsBetter: false, step: 1,
    defaults: { enabled: true, target: 0, minimum: 1, minEvidence: 0 },
    evidence: ["concern", "concerns"],
    describe: "Conduct concerns raised by parents and not yet resolved by an admin or supervisor.",
    tip: "Talk to your supervisor about the concern raised, so it can be resolved.",
  },
];

const BY_KEY = new Map(STANDARDS.map((s) => [s.key, s]));
const DEFAULTS = { graceDays: 90, notifyBelow: true };

const num = (v, fallback, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

// The workspace's settings, filled in and kept in range. A minimum on the wrong side of its target
// is moved to the target (it can never be stricter than the bar itself).
function normaliseSettings(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const standards = {};
  for (const def of STANDARDS) {
    const given = src.standards?.[def.key] || {};
    const top = def.unit === "★" ? 5 : def.unit === "%" ? 100 : 100;
    const target = num(given.target, def.defaults.target, 0, top);
    let minimum = num(given.minimum, def.defaults.minimum, 0, top);
    if (def.higherIsBetter && minimum > target) minimum = target;
    if (!def.higherIsBetter && minimum < target) minimum = target;
    standards[def.key] = {
      enabled: given.enabled === undefined ? def.defaults.enabled : Boolean(given.enabled),
      target, minimum,
      minEvidence: Math.round(num(given.minEvidence, def.defaults.minEvidence, 0, 500)),
    };
  }
  return {
    graceDays: Math.round(num(src.graceDays, DEFAULTS.graceDays, 0, 365)),
    notifyBelow: src.notifyBelow === undefined ? DEFAULTS.notifyBelow : Boolean(src.notifyBelow),
    standards,
  };
}

// Where one measure stands against its standard:
//   off           the standard is switched off
//   not_enough    too little evidence yet (or nothing to measure)
//   meets         at or better than the target
//   close         between the target and the minimum
//   below         worse than the minimum
//   grace         a new mentor not meeting it yet — shown, never counted against them
function evaluate(def, setting, measure, { inGrace = false } = {}) {
  if (!setting?.enabled) return "off";
  const value = measure?.value;
  const evidence = Number(measure?.evidence || 0);
  if (value == null || evidence < setting.minEvidence) return "not_enough";
  const better = (a, b) => (def.higherIsBetter ? a >= b : a <= b);
  if (better(value, setting.target)) return "meets";
  const status = better(value, setting.minimum) ? "close" : "below";
  return inGrace ? "grace" : status;
}

const daysSince = (date, now = new Date()) => (date ? Math.floor((now - new Date(date)) / 86400000) : Infinity);

// A mentor's standing against every standard switched on: each one's value, target, status and (when
// not met) a tip; how many are met of those that count (enough evidence); and overall — "below" if
// any is below, else "close" if any is close, else "meets" (or "not_enough" when none count yet).
function standing(measures = {}, rawSettings = {}, { since = null, now = new Date() } = {}) {
  const settings = normaliseSettings(rawSettings);
  const inGrace = daysSince(since, now) < settings.graceDays;
  const items = [];
  for (const def of STANDARDS) {
    const setting = settings.standards[def.key];
    if (!setting.enabled) continue;
    const measure = measures[def.key] || { value: null, evidence: 0 };
    const status = evaluate(def, setting, measure, { inGrace });
    items.push({
      key: def.key, label: def.label, unit: def.unit, higherIsBetter: def.higherIsBetter,
      value: measure.value ?? null, evidence: Number(measure.evidence || 0),
      evidenceLabel: def.evidence[Number(measure.evidence || 0) === 1 ? 0 : 1],
      target: setting.target, minimum: setting.minimum, minEvidence: setting.minEvidence,
      status, describe: def.describe,
      tip: ["close", "below", "grace"].includes(status) ? def.tip : null,
    });
  }
  const counted = items.filter((i) => ["meets", "close", "below"].includes(i.status));
  const met = counted.filter((i) => i.status === "meets").length;
  const below = items.filter((i) => i.status === "below").map((i) => i.key);
  const close = items.filter((i) => i.status === "close").map((i) => i.key);
  // "Meets every standard" needs at least one standard backed by real evidence — "no open concerns"
  // (which needs none) alone doesn't make a mentor meet the bar.
  const evidenced = counted.filter((i) => i.minEvidence > 0);
  const overall = below.length ? "below" : close.length ? "close" : evidenced.length ? "meets" : "not_enough";
  return { items, met, counted: counted.length, total: items.length, below, close, overall, inGrace, graceDays: settings.graceDays };
}

module.exports = { STANDARDS, BY_KEY, DEFAULTS, normaliseSettings, evaluate, standing };
