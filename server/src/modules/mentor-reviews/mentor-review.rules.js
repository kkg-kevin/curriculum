// Parent feedback on mentors — the rules, with no database (tested in test/mentor-reviews.test.js).

// A workspace's settings (Settings → Parent feedback), filled in from these defaults.
const DEFAULT_ASPECTS = [
  { key: "engagement", label: "Engages my child" },
  { key: "communication", label: "Communicates with me" },
  { key: "preparation", label: "On time and prepared" },
  { key: "progress", label: "My child is progressing" },
  { key: "feedback", label: "Feedback is useful" },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  aspects: DEFAULT_ASPECTS,
  // Sessions the child must have attended (present or late) in the class before its educators can
  // be reviewed — nobody rates a mentor they haven't seen.
  minSessions: 3,
  // A mid-course check-in prompt once the child has attended this many sessions (the end-of-course
  // prompt comes with the final report either way).
  midCourse: true,
  midCourseAfterSessions: 6,
  // Hubs see their own educators' averages (never comments or names).
  hubsSeeAverages: true,
};

// An educator sees their feedback only as a summary, and only from this many reviews — so no
// parent can be picked out (and no child affected).
const ANONYMOUS_MIN_REVIEWS = 3;
// A parent can change their review for this many days.
const EDIT_DAYS = 14;

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function normaliseSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const seen = new Set();
  const aspects = (Array.isArray(s.aspects) ? s.aspects : DEFAULT_ASPECTS)
    .map((a) => ({ key: slug(a?.key || a?.label), label: String(a?.label || "").trim().slice(0, 80) }))
    .filter((a) => a.key && a.label && !seen.has(a.key) && seen.add(a.key))
    .slice(0, 8);
  const minSessions = clampInt(s.minSessions, 0, 50, DEFAULT_SETTINGS.minSessions);
  return {
    enabled: s.enabled !== false,
    aspects,
    minSessions,
    midCourse: s.midCourse !== false,
    midCourseAfterSessions: Math.max(minSessions, clampInt(s.midCourseAfterSessions, 1, 100, DEFAULT_SETTINGS.midCourseAfterSessions)),
    hubsSeeAverages: s.hubsSeeAverages !== false,
  };
}

const isEditable = (review, now = new Date()) =>
  !!review && (now.getTime() - new Date(review.createdAt).getTime()) < EDIT_DAYS * 86400000;

// A submitted review, checked and trimmed to the workspace's aspects. Throws a 400 on bad input.
function cleanSubmission(body, settings) {
  const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  const overall = Number(body.overall);
  if (!Number.isInteger(overall) || overall < 1 || overall > 5) fail("Choose a rating from 1 to 5 stars");
  const ratings = {};
  for (const a of settings.aspects) {
    const v = body.ratings?.[a.key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) fail(`"${a.label}" needs 1 to 5 stars`);
    ratings[a.key] = n;
  }
  const comment = String(body.comment || "").trim().slice(0, 2000);
  const concern = body.concern === true;
  const concernText = String(body.concernText || "").trim().slice(0, 2000);
  if (concern && !concernText) fail("Tell us what the concern is, so the team can act on it");
  return { overall, ratings, comment: comment || null, concern, concernText: concern ? concernText : null, websiteConsent: body.websiteConsent === true && !!comment };
}

const round1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const monthOf = (d) => new Date(d).toISOString().slice(0, 7);

// Averages over reviews: overall, each aspect, how the stars spread, and month by month (last 12).
function summarise(reviews, aspects) {
  const overall = reviews.map((r) => Number(r.overall)).filter(Boolean);
  const ratingsOf = (r) => (typeof r.ratings === "string" ? JSON.parse(r.ratings || "{}") : r.ratings || {});
  const byAspect = aspects.map((a) => {
    const xs = reviews.map((r) => ratingsOf(r)[a.key]).filter((v) => Number.isFinite(Number(v)) && v != null).map(Number);
    return { key: a.key, label: a.label, average: avg(xs), count: xs.length };
  });
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: overall.filter((v) => v === stars).length }));
  const months = new Map();
  for (const r of reviews) {
    const m = monthOf(r.createdAt);
    (months.get(m) || months.set(m, []).get(m)).push(Number(r.overall));
  }
  const trend = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, xs]) => ({ month, average: avg(xs), count: xs.length }));
  return { count: reviews.length, average: avg(overall), aspects: byAspect, distribution, trend };
}

module.exports = { DEFAULT_ASPECTS, DEFAULT_SETTINGS, ANONYMOUS_MIN_REVIEWS, EDIT_DAYS, normaliseSettings, isEditable, cleanSubmission, summarise };
