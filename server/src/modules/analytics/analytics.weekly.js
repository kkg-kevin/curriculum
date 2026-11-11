// The weekly summary of Reports & Analytics (10 Nov 2026) — `npm run analytics:weekly`, Monday
// mornings from cron. To each workspace's admins (every hub of theirs) and each hub's own login (its
// hub only): last week's key figures against the week before, and "Needs your attention" with a
// link to each. Switchable like any email — Settings → Emails (analytics_weekly) and each person's
// own email settings. Sent once per person per week (the outbox's dedupe key), so a re-run is safe.

const db = require("../../config/db");
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { MAIL_BRAND_NAME } = require("../../config/env");
const { wantsEmail } = require("../notifications/notification.emails");
const { workspaceAllows, preferencesToken } = require("../notifications/email-workspace");
const { rolesOf } = require("../auth/account-roles");
const { resolveScope } = require("./analytics.scope");
const { kenyaDay, addDays } = require("./analytics.utils");
const { getAttention } = require("./analytics.attention");
const { getAttendance } = require("./analytics.attendance");
const { loadWork } = require("./analytics.work");

const TYPE = "analytics_weekly";

// Last week, Monday to Sunday, on the Kenyan calendar.
function lastWeek(now = new Date()) {
  const today = kenyaDay(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sunday
  const thisMonday = addDays(today, -((dow + 6) % 7));
  return { from: addDays(thisMonday, -7), to: addDays(thisMonday, -1), key: thisMonday };
}

const signed = (n, suffix = "") => (n == null ? "" : n === 0 ? " (no change)" : ` (${n > 0 ? "+" : ""}${n}${suffix} on the week before)`);

async function figuresFor(scope) {
  const att = await getAttendance(scope);
  const { tasks } = await loadWork(scope, scope.period.start, scope.period.end);
  const handedIn = tasks.filter((t) => t.handedIn).length;
  const timed = tasks.filter((t) => ["on_time", "late", "missed"].includes(t.timing));
  const onTime = timed.length ? Math.round((timed.filter((t) => t.timing === "on_time").length / timed.length) * 100) : null;
  const marked = tasks.filter((t) => t.marked);
  const e = marked.reduce((n, t) => n + (Number(t.sub?.totalScore) || 0), 0);
  const p = marked.reduce((n, t) => n + (Number(t.sub?.maxScore) || 0), 0);
  return {
    learners: scope.learners.length,
    attendance: att.rate, attendanceBefore: att.previousRate,
    handedIn, onTime, marked: marked.length,
    score: p > 0 ? Math.round((e / p) * 100) : null,
  };
}

function emailFor({ user, title, figures, attention, reportsPath, week }) {
  const rows = [
    ["Learners", String(figures.learners)],
    ["Attendance", figures.attendance == null ? "No registers" : `${figures.attendance}%${signed(figures.attendance != null && figures.attendanceBefore != null ? figures.attendance - figures.attendanceBefore : null, " pts")}`],
    ["Work handed in", String(figures.handedIn)],
    ["Handed in on time", figures.onTime == null ? "No due dates" : `${figures.onTime}%`],
    ["Work marked", String(figures.marked)],
    ["Average score", figures.score == null ? "Nothing marked" : `${figures.score}%`],
  ];
  const todo = attention.items.slice(0, 8).map((i) => `• ${i.count} ${i.label}`);
  const { html, text } = renderEmail({
    tone: attention.items.some((i) => i.tone === "danger") ? "warning" : "info",
    icon: "document",
    eyebrow: "Weekly summary",
    preview: attention.items.length ? `${attention.items.length} thing${attention.items.length === 1 ? "" : "s"} need your attention this week` : "Nothing needs your attention this week",
    heading: title,
    greeting: `Hi ${String(user.name || "").trim().split(/\s+/)[0] || "there"},`,
    paragraphs: [`Here's how ${week.from} to ${week.to} went.`],
    rows,
    afterParagraphs: attention.items.length
      ? ["Needs your attention:", ...todo]
      : ["Nothing needs your attention right now."],
    button: { label: "Open Reports & Analytics", url: appUrl(reportsPath) },
    footerNote: `You're receiving this weekly summary from your ${MAIL_BRAND_NAME} account.`,
    footerLink: { label: "Stop the weekly summary, or choose your emails", url: appUrl(`/email-preferences?token=${preferencesToken(user.id)}&type=${TYPE}`) },
  });
  return { html, text };
}

async function send(user, ownerAdminId, content, week, subject) {
  if (!wantsEmail(user, TYPE)) return false;
  if (!(await workspaceAllows(ownerAdminId, TYPE))) return false;
  await queueMail({ to: user.email, subject, html: content.html, text: content.text, template: `analytics:${TYPE}`, userId: user.id, dedupeKey: `${TYPE}:${user.id}:${week.key}` });
  return true;
}

async function runWeekly({ now = new Date() } = {}) {
  const week = lastWeek(now);
  const query = { from: week.from, to: week.to };
  let sent = 0;

  // Workspaces: every admin login, grouped by their organisation.
  const admins = await db("users").where({ role: "admin" }).whereNull("deactivatedAt").whereNotNull("email").select("id", "name", "email", "role", "emailPreferences", "organisationId");
  const byWorkspace = new Map();
  for (const a of admins) {
    const owner = a.organisationId || a.id;
    if (!byWorkspace.has(owner)) byWorkspace.set(owner, []);
    byWorkspace.get(owner).push(a);
  }
  for (const [ownerAdminId, people] of byWorkspace) {
    try {
      const scope = await resolveScope({ user: { role: "admin" }, ownerAdminId, query });
      if (!scope.learners.length) continue;
      const figures = await figuresFor(scope);
      const attention = await getAttention(scope);
      for (const user of people) {
        const prefs = typeof user.emailPreferences === "string" ? JSON.parse(user.emailPreferences || "{}") : user.emailPreferences;
        const content = emailFor({ user, title: "Your week at a glance", figures, attention, reportsPath: "/reports", week });
        if (await send({ ...user, emailPreferences: prefs }, ownerAdminId, content, week, `Your week: ${attention.items.length ? `${attention.items.length} thing${attention.items.length === 1 ? "" : "s"} need you` : "all clear"}`)) sent += 1;
      }
    } catch (err) {
      console.error(`[analytics-weekly] workspace ${ownerAdminId}: ${err.message}`);
    }
  }

  // Hubs: each active hub with a login of its own (the hub's email).
  const hubs = await db("learning_hubs").whereNotNull("email").where((q) => q.where({ status: "active" }).orWhereNull("status")).select("id", "name", "email", "ownerAdminId", "status", "parentHubId");
  for (const hub of hubs) {
    try {
      const logins = (await db("users").whereRaw("LOWER(email) = ?", [String(hub.email).toLowerCase()]).whereNull("deactivatedAt").select("id", "name", "email", "role", "extraRoles", "emailPreferences"))
        .filter((u) => rolesOf(u).includes("school"));
      if (!logins.length) continue;
      const scope = await resolveScope({ user: { role: "school" }, ownSchool: hub, ownerAdminId: hub.ownerAdminId, query });
      if (!scope.learners.length) continue;
      const figures = await figuresFor(scope);
      const attention = await getAttention(scope);
      for (const user of logins) {
        const prefs = typeof user.emailPreferences === "string" ? JSON.parse(user.emailPreferences || "{}") : user.emailPreferences;
        const content = emailFor({ user: { ...user, name: user.name || hub.name }, title: `${hub.name}: your week at a glance`, figures, attention, reportsPath: "/school-portal/reports", week });
        if (await send({ ...user, role: "school", emailPreferences: prefs }, hub.ownerAdminId, content, week, `${hub.name}, your week: ${attention.items.length ? `${attention.items.length} thing${attention.items.length === 1 ? "" : "s"} need you` : "all clear"}`)) sent += 1;
      }
    } catch (err) {
      console.error(`[analytics-weekly] hub ${hub.id}: ${err.message}`);
    }
  }
  return { week, sent };
}

module.exports = { runWeekly, lastWeek };
