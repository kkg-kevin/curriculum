// The educator performance profile — the rules, with no database (tested in
// test/educator-profiles.test.js). Every figure is worked out from what the system records; nothing is
// typed in by the educator except their "About", which an admin approves before it's ever public.

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const dayKey = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));
const weekdayOf = (date) => DAYS[new Date(`${dayKey(date)}T12:00:00Z`).getUTCDay()];
const minutesBetween = (start, end) => {
  const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return h * 60 + (m || 0); };
  const d = toMin(end) - toMin(start);
  return Number.isFinite(d) && d > 0 ? d : 0;
};
const round1 = (n) => Math.round(n * 10) / 10;

// Teaching time actually given, per course: each day a class's attendance was taken counts as that
// class's session on that day, credited to the educator whose timetable slot is on that weekday (a
// session moved to another day — a "shift" — counts on its new day). Returns, per course,
// { sessions: [dates], minutes }.
//   slots:   [{ classId, courseId, dayOfWeek, startTime, endTime }]   (this educator's)
//   held:    Map classId -> Set of "YYYY-MM-DD" (days attendance was taken)
//   shifts:  [{ classId, courseId, date, newDate, startTime, endTime }]
function creditSessions({ slots, held, shifts = [] }) {
  const byCourse = new Map();
  const add = (classId, courseId, date, minutes) => {
    const key = `${classId}|${courseId}`;
    const row = byCourse.get(key) || byCourse.set(key, { classId, courseId, sessions: new Set(), minutes: 0 }).get(key);
    if (row.sessions.has(date)) return;
    row.sessions.add(date);
    row.minutes += minutes;
  };
  const shiftedAway = new Set(shifts.map((s) => `${s.classId}|${s.courseId}|${dayKey(s.date)}`));
  for (const [classId, days] of held) {
    const classSlots = slots.filter((s) => s.classId === classId);
    for (const date of days) {
      const wd = weekdayOf(date);
      for (const s of classSlots) {
        if (s.dayOfWeek !== wd || shiftedAway.has(`${classId}|${s.courseId}|${date}`)) continue;
        add(classId, s.courseId, date, minutesBetween(s.startTime, s.endTime));
      }
      for (const sh of shifts.filter((x) => x.classId === classId && dayKey(x.newDate) === date)) {
        const slot = classSlots.find((s) => s.courseId === sh.courseId);
        if (!slot) continue;
        add(classId, sh.courseId, date, minutesBetween(sh.startTime || slot.startTime, sh.endTime || slot.endTime));
      }
    }
  }
  return [...byCourse.values()].map((r) => ({ ...r, sessions: [...r.sessions].sort() }));
}

// How many of the sessions this educator's timetable planned in [from, to] were held: each weekday
// slot from the course's start, less merged days; a shifted one is due on its new day.
function reliability({ slots, held, shifts = [], startOf, from, to }) {
  let planned = 0;
  let given = 0;
  const end = new Date(`${to}T12:00:00Z`);
  for (const s of slots) {
    const start = [from, startOf(s.classId, s.courseId)].filter(Boolean).sort().pop();
    if (!start) continue;
    for (let d = new Date(`${start}T12:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      if (DAYS[d.getUTCDay()] !== s.dayOfWeek) continue;
      const moved = shifts.find((x) => x.classId === s.classId && x.courseId === s.courseId && dayKey(x.date) === date);
      if (moved && !moved.newDate) continue; // merged away — not due
      const due = moved ? dayKey(moved.newDate) : date;
      if (due > to) continue;
      planned += 1;
      if (held.get(s.classId)?.has(due)) given += 1;
    }
  }
  return { planned, given, rate: planned ? Math.round((given / planned) * 100) : null };
}

// Parent ratings, smoothed towards 4.0 by 5 reviews' worth — so 2 reviews at 5★ never outrank 40 at 4.7★.
const PRIOR_MEAN = 4.0;
const PRIOR_WEIGHT = 5;
const PUBLIC_MIN_REVIEWS = 5;
function smoothedRating(ratings) {
  const n = ratings.length;
  if (!n) return null;
  const sum = ratings.reduce((a, b) => a + Number(b), 0);
  return round1((PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + n));
}

const qaBand = (score) => (score == null ? null : score >= 85 ? "Excellent" : score >= 70 ? "Strong" : "Developing");

// Quality reviews, compounded: every submitted visit counts, and each new one moves the totals.
//   visits: [{ date, score, visitType, sectionScores: [{ title, score, scored }], summary: { strengths, improvements } }]
// Returns the all-time average (each visit counts equally) and its band, the history with the
// running average after each visit, every section averaged across all visits (weighted by the items
// scored in it), how far the latest moved from the first and from the one before, best / lowest, the
// last 2 / 3 averaged (badges), items checked in all, visit kinds and the latest strengths / to improve.
const avgInt = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const sectionKey = (title) => String(title || "").trim().toLowerCase();
function aggregateQa(visits = []) {
  const list = visits
    .filter((v) => v && v.score != null && Number.isFinite(Number(v.score)))
    .map((v) => ({ ...v, date: dayKey(v.date), score: Number(v.score) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const n = list.length;
  const base = { count: n, average: null, band: null, history: [], sections: [], trend: [], latestScore: null, latestAt: null, firstScore: null,
    change: null, sinceLast: null, best: null, lowest: null, lastThreeAverage: null, lastTwoAverage: null, itemsChecked: 0,
    announced: 0, surprise: 0, strengths: null, improvements: null };
  if (!n) return base;

  let sum = 0;
  const history = list.map((v, i) => { sum += v.score; return { date: v.date, score: Math.round(v.score), runningAverage: Math.round(sum / (i + 1)), visitType: v.visitType || null }; });
  const scores = list.map((v) => v.score);
  const recent = [...scores].reverse();

  const byTitle = new Map();
  list.forEach((v, i) => {
    for (const s of v.sectionScores || []) {
      if (s?.score == null || !Number.isFinite(Number(s.score))) continue;
      const key = sectionKey(s.title);
      if (!key) continue;
      const weight = Number(s.scored) > 0 ? Number(s.scored) : 1;
      const row = byTitle.get(key) || { title: String(s.title).trim(), weighted: 0, weight: 0, items: 0, visits: 0, first: null, latest: null, order: byTitle.size };
      row.weighted += Number(s.score) * weight;
      row.weight += weight;
      row.items += Number(s.scored) > 0 ? Number(s.scored) : 0;
      row.visits += 1;
      if (row.first == null) row.first = Number(s.score);
      row.latest = Number(s.score);
      row.latestVisit = i;
      byTitle.set(key, row);
    }
  });
  const sections = [...byTitle.values()].sort((a, b) => a.order - b.order).map((r) => ({
    title: r.title,
    score: Math.round(r.weighted / r.weight),
    visits: r.visits,
    items: r.items,
    latest: Math.round(r.latest),
    change: r.visits > 1 ? Math.round(r.latest - r.first) : null,
  }));

  const latest = list[n - 1];
  const average = avgInt(scores);
  const summary = latest.summary || {};
  return {
    ...base,
    average,
    band: qaBand(average),
    history,
    trend: history.map(({ date, score }) => ({ date, score })),
    sections,
    latestScore: Math.round(latest.score),
    latestAt: latest.date,
    firstScore: Math.round(list[0].score),
    change: n > 1 ? Math.round(latest.score - list[0].score) : null,
    sinceLast: n > 1 ? Math.round(latest.score - list[n - 2].score) : null,
    best: Math.round(Math.max(...scores)),
    lowest: Math.round(Math.min(...scores)),
    lastThreeAverage: avgInt(recent.slice(0, 3)),
    lastTwoAverage: avgInt(recent.slice(0, 2)),
    itemsChecked: sections.reduce((t, s) => t + s.items, 0),
    announced: list.filter((v) => v.visitType !== "surprise").length,
    surprise: list.filter((v) => v.visitType === "surprise").length,
    strengths: stripHtml(summary.strengths).slice(0, 400) || null,
    improvements: stripHtml(summary.improvements).slice(0, 400) || null,
  };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Badges — each with its rule in words and how close the educator is.
function badgesFor(s) {
  const r = s.rating || {};
  const q = s.qa || {};
  const rel = s.reliability || {};
  const fb = s.feedback || {};
  const hours = s.hours?.total || 0;
  const milestone = [1000, 500, 100].find((h) => hours >= h);
  const nextMilestone = [100, 500, 1000].find((h) => hours < h);
  return [
    { key: "top_rated", label: "Top rated", rule: "4.5★ or more from 10+ parent reviews in the last 12 months",
      earned: (r.count || 0) >= 10 && (r.average || 0) >= 4.5,
      progress: `${r.count || 0}/10 reviews${r.average != null ? ` · ${r.average.toFixed(1)}★` : ""}` },
    { key: "qa_excellent", label: "QA excellent", rule: "85% or more over the last 2 quality reviews",
      earned: (q.lastTwoAverage ?? 0) >= 85 && (q.count || 0) >= 2,
      progress: q.lastTwoAverage != null ? `${q.lastTwoAverage}% over the last ${Math.min(2, q.count)}` : "No quality review yet" },
    { key: "reliable", label: "Reliable", rule: "95% or more of timetabled sessions held (last 90 days, 8+ planned)",
      earned: (rel.rate ?? 0) >= 95 && (rel.planned || 0) >= 8,
      progress: rel.rate != null ? `${rel.rate}% of ${rel.planned} held` : "Not enough timetabled sessions yet" },
    { key: "fast_feedback", label: "Fast feedback", rule: "Marks work within 48 hours (typical, 5+ pieces in 12 months)",
      earned: fb.medianHours != null && fb.medianHours <= 48 && (fb.count || 0) >= 5,
      progress: fb.medianHours != null ? `Typically ${Math.round(fb.medianHours)} h (${fb.count} marked)` : "Nothing marked yet" },
    { key: "hours", label: milestone ? `${milestone}+ hours` : "100+ hours", rule: "Verified teaching hours: 100, 500, 1,000",
      earned: !!milestone, progress: `${Math.round(hours)} h${nextMilestone ? ` of ${nextMilestone}` : ""}` },
    { key: "tot_certified", label: s.tot?.level ? `TOT certified · Level ${s.tot.level}` : "TOT certified", rule: "Holds a certificate from training of trainers",
      earned: (s.tot?.certificates || 0) > 0, progress: `${s.tot?.certificates || 0} TOT certificate${s.tot?.certificates === 1 ? "" : "s"}` },
  ];
}

// What to work on next — from the lowest parent aspect, the last QA "to improve" and the weakest QA
// section across visits, reliability and
// marking speed, then the nearest badge.
function growthTips(s, badges) {
  const tips = [];
  const low = (s.rating?.aspects || []).filter((a) => a.average != null && a.count >= 3).sort((a, b) => a.average - b.average)[0];
  if (low && low.average < 4.2) tips.push(`Parents rate "${low.label}" lowest (${low.average.toFixed(1)}★) — a good place to focus.`);
  if (s.qa?.improvements) tips.push(`From the last quality review: ${s.qa.improvements}`);
  const weakest = (s.qa?.sections || []).filter((x) => x.visits >= 2 && x.score < 70).sort((a, b) => a.score - b.score)[0];
  if (weakest) tips.push(`Across ${weakest.visits} quality reviews, "${weakest.title}" averages ${weakest.score}% — the area with most room to grow.`);
  if (s.reliability?.rate != null && s.reliability.rate < 90) tips.push(`${s.reliability.rate}% of timetabled sessions were held in the last 90 days — attendance has to be taken at every session taught for it to count.`);
  if (s.feedback?.medianHours != null && s.feedback.medianHours > 72) tips.push(`Work typically waits ${Math.round(s.feedback.medianHours)} hours to be marked — learners do better with feedback within two days.`);
  const next = badges.find((b) => !b.earned && b.key !== "tot_certified");
  if (next) tips.push(`Next badge — ${next.label}: ${next.rule}. Now: ${next.progress}.`);
  return tips.slice(0, 5);
}

// What an educator may write about themself — trimmed and bounded.
function cleanAbout(raw = {}) {
  const list = (v, max, len) => [...new Set((Array.isArray(v) ? v : String(v || "").split(","))
    .map((x) => String(x).trim()).filter(Boolean).map((x) => x.slice(0, len)))].slice(0, max);
  return {
    headline: String(raw.headline || "").trim().slice(0, 120),
    bio: String(raw.bio || "").trim().slice(0, 1500),
    specialties: list(raw.specialties, 8, 40),
    languages: list(raw.languages, 6, 30),
    ageRange: String(raw.ageRange || "").trim().slice(0, 30),
  };
}
const sameAbout = (a, b) => JSON.stringify(cleanAbout(a || {})) === JSON.stringify(cleanAbout(b || {}));

const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "educator";
const stripHtml = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

module.exports = {
  DAYS, dayKey, weekdayOf, minutesBetween, creditSessions, reliability, smoothedRating, PUBLIC_MIN_REVIEWS,
  qaBand, aggregateQa, median, badgesFor, growthTips, cleanAbout, sameAbout, slugify, stripHtml, round1,
};
