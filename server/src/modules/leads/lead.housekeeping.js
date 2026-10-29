const db = require("../../config/db");
const env = require("../../config/env");
const { toJson } = require("../../shared/utils/model.utils");
const { adminIdsOf } = require("../../shared/utils/organisation");
const { todayInKenya } = require("../checkins/checkin.dates");

// Enquiry housekeeping (Settings → Enquiries; npm run enquiries:process — daily). Nothing here
// deletes an enquiry:
//   1. Reminder — once a day, the admins hear how many enquiries are still New after
//      `remindAfterDays` without anything happening, and how old the oldest is.
//   2. Auto-close — an enquiry still New or Contacted with nothing happening for `autoCloseDays`
//      is Closed, with a note saying so; it can be reopened. Only a plain enquiry: one that made a
//      sign-up, an invoice, a learner or a payment is left for staff.
//   3. Anonymise (off by default) — a Closed enquiry with nothing happening for
//      `anonymiseMonths` loses its personal details (name, email, phone, child's name, message,
//      and its replies and notes); what's left still counts in reports. Never one that made a
//      sign-up, a learner, an invoice or a payment, nor a bootcamp enrolment — those are kept.
// "Nothing happening" is measured from the enquiry's last change or its last reply / note,
// whichever is later. Safe to run any number of times.

const TABLE = "enquiry_settings";
const ROW_ID = "default";
const DEFAULTS = {
  remindersOn: true, remindAfterDays: 2,
  autoCloseOn: true, autoCloseDays: 60,
  anonymiseOn: false, anonymiseMonths: 12,
};
const REMOVED_NAME = "Details removed";
const DAY_MS = 24 * 60 * 60 * 1000;

function parse(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

async function getSettings() {
  const row = await db(TABLE).where({ id: ROW_ID }).first();
  return { ...DEFAULTS, ...parse(row?.settings), updatedAt: row?.updatedAt || null };
}

async function saveSettings(data, userId) {
  const settings = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, data[key] ?? DEFAULTS[key]]));
  const now = new Date();
  if (await db(TABLE).where({ id: ROW_ID }).first()) {
    await db(TABLE).where({ id: ROW_ID }).update({ settings: toJson(settings), updatedBy: userId || null, updatedAt: now });
  } else {
    await db(TABLE).insert({ id: ROW_ID, settings: toJson(settings), updatedBy: userId || null, createdAt: now, updatedAt: now });
  }
  return getSettings();
}

// A sign-up, an invoice, a learner or a payment came of it — staff look after those.
const isPlain = (lead) => !(lead.learnerId || lead.invoiceId || lead.homeLearningHouseholdId || lead.clubMembershipId || lead.paidAt);

const lastActivity = (lead, lastMessageAt) => new Date(Math.max(
  new Date(lead.updatedAt || lead.createdAt).getTime(),
  new Date(lead.createdAt).getTime(),
  lastMessageAt ? new Date(lastMessageAt).getTime() : 0,
));

// Who hears about waiting enquiries: the website's workspace's admins (PUBLIC_CONTENT_ADMIN_ID),
// or every admin on an installation without one.
async function reminderRecipients() {
  if (env.PUBLIC_CONTENT_ADMIN_ID) return adminIdsOf(env.PUBLIC_CONTENT_ADMIN_ID);
  return db("users").where({ role: "admin" }).whereNull("deactivatedAt").pluck("id");
}

const formatDay = (date) => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });

async function processEnquiries({ now = new Date(), settings = null } = {}) {
  const NotificationService = require("../notifications/notification.service");
  const rules = settings || (await getSettings());
  const counts = { waiting: 0, reminded: 0, autoClosed: 0, anonymised: 0 };
  const leads = await db("leads").whereNull("anonymisedAt").select("*");
  const lastMessages = new Map((await db("lead_messages").select("leadId").max({ last: "createdAt" }).groupBy("leadId")).map((r) => [r.leadId, r.last]));
  const idleDays = (lead) => (now.getTime() - lastActivity(lead, lastMessages.get(lead.id)).getTime()) / DAY_MS;

  // 2. Auto-close (before the reminder, so a lead closed now isn't counted as waiting).
  if (rules.autoCloseOn) {
    for (const lead of leads) {
      if (!["new", "contacted"].includes(lead.status) || !isPlain(lead) || idleDays(lead) < rules.autoCloseDays) continue;
      await db("leads").where({ id: lead.id }).update({ status: "closed", autoClosedAt: now, updatedAt: now });
      await db("lead_messages").insert({
        id: require("crypto").randomUUID(), leadId: lead.id, direction: "note", subject: null, sentByUserId: null, createdAt: now,
        body: `Closed automatically after ${rules.autoCloseDays} days with no activity. Reopen it by changing its status.`,
      });
      lead.status = "closed";
      lead.updatedAt = now;
      counts.autoClosed += 1;
    }
  }

  // 1. Reminder.
  if (rules.remindersOn) {
    const waiting = leads.filter((l) => l.status === "new" && idleDays(l) >= rules.remindAfterDays);
    counts.waiting = waiting.length;
    if (waiting.length) {
      const oldest = waiting.reduce((a, b) => (new Date(a.createdAt) < new Date(b.createdAt) ? a : b));
      const day = todayInKenya(now);
      const recipients = [...new Set(await reminderRecipients())];
      for (const recipientId of recipients) {
        await NotificationService.notifyPerson(recipientId, {
          type: "enquiries_waiting",
          title: `${waiting.length} ${waiting.length === 1 ? "enquiry is" : "enquiries are"} still New`,
          message: `${waiting.length === 1 ? "One enquiry has" : `${waiting.length} enquiries have`} waited more than ${rules.remindAfterDays} day${rules.remindAfterDays === 1 ? "" : "s"} for a reply — the oldest from ${formatDay(oldest.createdAt)} (${oldest.name}).`,
          payload: { route: "/enquiries", status: "new" },
          dedupeKey: `enquiries_waiting:${day}`,
          ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID || null,
        }).catch((err) => console.error("[enquiries] could not send the reminder:", err.message));
        counts.reminded += 1;
      }
    }
  }

  // 3. Anonymise.
  if (rules.anonymiseOn) {
    for (const lead of leads) {
      // Sign-ups and bootcamp enrolments keep their details — they're the families to reach out to
      // when a bootcamp runs again (the bootcamp's Learners & parents list).
      if (lead.status !== "closed" || !isPlain(lead) || lead.bootcampId || idleDays(lead) < rules.anonymiseMonths * 30.44) continue;
      await db("lead_messages").where({ leadId: lead.id }).del();
      await db("leads").where({ id: lead.id }).update({ name: REMOVED_NAME, email: null, phone: null, learnerName: null, learnerDateOfBirth: null, message: null, anonymisedAt: now, updatedAt: now });
      counts.anonymised += 1;
    }
  }
  return counts;
}

module.exports = { DEFAULTS, getSettings, saveSettings, processEnquiries, isPlain };
