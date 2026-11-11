const db = require("../../config/db");
const R = require("./mentor-standards.rules");
const NotificationService = require("../notifications/notification.service");

// Mentor standards (10 Nov 2026) — one bar for every mentor, set in Settings → Mentor standards and
// shown wherever a mentor's figures are: their profile (admins, staff, their supervisor, and the
// mentor themself — never a hub) and Reports & Analytics → Educators. Measures come from the
// mentor's profile figures (educator-profile.stats.js → stats.standards); the rules are
// mentor-standards.rules.js. Each month's standing is kept (mentor_standard_snapshots), and a mentor
// newly below a standard is flagged to their supervisor — or, without one, the workspace's admins —
// once per standard per month, suggesting a quality-review visit. Nothing else follows from it
// automatically; pay is never part of it.

const SETTINGS = "mentor_standard_settings";
const SNAPSHOTS = "mentor_standard_snapshots";
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const monthKe = (now = new Date()) => new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 7);

// The workspace a mentor belongs to: the one that added them, else one of their hubs'.
async function workspaceOf(teacher) {
  if (teacher.createdByAdminId) return teacher.createdByAdminId;
  const hubId = (await db("teacher_hub_links").where({ teacherId: teacher.id }).first("hubId"))?.hubId;
  return hubId ? (await db("learning_hubs").where({ id: hubId }).first("ownerAdminId"))?.ownerAdminId || null : null;
}

async function getSettings(ownerAdminId) {
  const row = ownerAdminId ? await db(SETTINGS).where({ ownerAdminId }).first() : null;
  return R.normaliseSettings(parseJson(row?.settings, {}));
}

// What the settings screen needs to draw each standard.
const definitions = () => R.STANDARDS.map((d) => ({
  key: d.key, label: d.label, unit: d.unit, higherIsBetter: d.higherIsBetter, step: d.step || (d.unit === "★" ? 0.1 : 1),
  max: d.unit === "★" ? 5 : 100, describe: d.describe, evidence: d.evidence, defaults: d.defaults,
}));

// A mentor's standing now, with their monthly history (oldest first, last 12).
async function standingFor(teacher, stats, ownerAdminId = null) {
  const owner = ownerAdminId || (await workspaceOf(teacher));
  const settings = await getSettings(owner);
  const now = R.standing(stats?.standards || {}, settings, { since: teacher.createdAt });
  const snaps = await db(SNAPSHOTS).where({ teacherId: teacher.id }).orderBy("month", "desc").limit(12);
  const history = snaps.reverse().map((s) => {
    const st = parseJson(s.standing, {});
    return { month: s.month, met: st.met ?? 0, counted: st.counted ?? 0, overall: st.overall || "not_enough" };
  });
  return { ...now, history, computedAt: stats?.computedAt || null };
}

const MentorStandardsService = {
  getSettings,
  definitions,
  standingFor,

  async settingsView(req) {
    return { settings: await getSettings(req.ownerAdminId), definitions: definitions() };
  },

  async saveSettings(req, raw) {
    if (!req.ownerAdminId) fail("No workspace", 400);
    const settings = R.normaliseSettings(raw);
    const row = { settings: JSON.stringify(settings), updatedBy: req.user.id, updatedAt: new Date() };
    if (await db(SETTINGS).where({ ownerAdminId: req.ownerAdminId }).first("ownerAdminId")) await db(SETTINGS).where({ ownerAdminId: req.ownerAdminId }).update(row);
    else await db(SETTINGS).insert({ ownerAdminId: req.ownerAdminId, ...row });
    return { settings, definitions: definitions() };
  },

  // Keeps this month's standing, and flags each standard the mentor has newly fallen below — to
  // their supervisor, else the workspace's admins — once per standard per month (dedupeKey).
  async snapshotAndNotify(teacher, stats) {
    const ownerAdminId = await workspaceOf(teacher);
    const settings = await getSettings(ownerAdminId);
    const now = R.standing(stats?.standards || {}, settings, { since: teacher.createdAt });
    const month = monthKe();
    const row = { ownerAdminId, standing: JSON.stringify({ met: now.met, counted: now.counted, overall: now.overall, below: now.below, close: now.close, items: now.items.map((i) => ({ key: i.key, value: i.value, status: i.status, target: i.target, minimum: i.minimum })) }), updatedAt: new Date() };
    if (await db(SNAPSHOTS).where({ teacherId: teacher.id, month }).first("teacherId")) await db(SNAPSHOTS).where({ teacherId: teacher.id, month }).update(row);
    else await db(SNAPSHOTS).insert({ teacherId: teacher.id, month, ...row });

    if (!settings.notifyBelow || now.inGrace || !now.below.length || !ownerAdminId) return now;
    const name = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") || "A mentor";
    for (const key of now.below) {
      const item = now.items.find((i) => i.key === key);
      const shown = item.unit === "★" ? `${item.value}★` : `${item.value}${item.unit}`;
      const target = item.unit === "★" ? `${item.target}★` : `${item.target}${item.unit}`;
      const event = (route) => ({
        type: "mentor_standard_below",
        title: `${name} is below a mentor standard`,
        message: `${item.label}: ${shown} (the standard is ${target}). Consider a quality-review visit to support them.`,
        payload: { route, teacherId: teacher.id, standard: key },
        dedupeKey: `mentor_standard_below:${teacher.id}:${key}:${month}`,
        ownerAdminId,
      });
      try {
        if (teacher.supervisorId) await NotificationService.notifyPerson(teacher.supervisorId, event(`/supervisor-portal/educators/${teacher.id}`));
        else await NotificationService._notify(ownerAdminId, event(`/teachers/${teacher.id}/view`));
      } catch (err) {
        console.error("[mentor-standards] could not notify:", err.message);
      }
    }
    return now;
  },

  // The nightly run (npm run educators:stats, after the figures are refreshed): every active mentor.
  async runAll() {
    const { getStats } = require("../educator-profiles/educator-profile.stats");
    // TOT learners only (in training) aren't mentors yet — never measured or reported below (tot/tot.people.js).
    const { withoutTotOnly } = require("../tot/tot.people");
    const teachers = await withoutTotOnly(await db("teachers").whereNot("status", "inactive").select("id", "firstName", "lastName", "createdAt", "createdByAdminId", "supervisorId"));
    let done = 0;
    for (const t of teachers) {
      try { await MentorStandardsService.snapshotAndNotify(t, await getStats(t.id)); done += 1; } catch (err) { console.error(`[mentor-standards] ${t.id}: ${err.message}`); }
    }
    return { mentors: teachers.length, snapshotted: done };
  },
};

module.exports = MentorStandardsService;
