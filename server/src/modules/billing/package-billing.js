const db = require("../../config/db");
const HouseholdModel = require("../home-learning/home-learning.model");
const ClubMembershipModel = require("../tech-clubs/club.model");
const { kenyaToday } = require("../../shared/utils/age");
const { nextPeriod, periodAt, periodLabel, dueDateFor, dueChange, addDays } = require("../../shared/utils/billing-periods");

// Package invoices, raised automatically (npm run billing:process — hourly — and "Invoice due
// now" on the Home Learning / Tech Clubs pages). For every ACTIVE family (a Home Learning household
// or a Tech Club membership), each period that has started and isn't billed yet gets its invoice,
// emailed like any other (shared/utils/billing-periods.js has the period rules):
//   - weekly / monthly / quarterly / yearly: in advance, on the period's first day, due a week later
//     (by the period's end at the latest);
//   - daily: in arrears, once each calendar month is over — the family's price per day × the days
//     any of its children was marked present or late (no invoice for a month with none).
// A change of price or period waiting for the next period (pendingBilling) is applied as that
// period comes up. Paused, cancelled and pending (unpaid sign-up) families are skipped; coming back
// starts afresh (billing-periods.js's onActivation), so time away isn't billed.
// Safe to run any number of times: an invoice already raised for a period is never raised again,
// and billedThrough moves on only after a period is dealt with. A failure on one family is logged
// and the rest carry on.

const USED = ["present", "late"];
// At most this many periods per family per run — a weekly family left a year without a run is
// caught up over a few runs rather than in one go.
const MAX_PERIODS_PER_RUN = 60;

const KINDS = {
  home_learning: {
    table: "home_learning_households",
    invoiceKey: "householdId",
    invoiceType: "home_learning",
    childLearnerIds: (rec) => db("home_learning_enrollments").where({ householdId: rec.id }).pluck("learnerId"),
    update: (rec, patch) => HouseholdModel.updateHousehold(rec.id, rec.ownerAdminId, patch),
    // Required lazily: the services require this module (Invoice due now).
    raise: (rec, args, actorUserId) => require("../home-learning/home-learning.service").raiseHouseholdInvoice(rec.ownerAdminId, rec, args, actorUserId),
  },
  tech_club: {
    table: "club_memberships",
    invoiceKey: "clubMembershipId",
    invoiceType: "tech_club",
    childLearnerIds: (rec) => db("club_membership_children").where({ membershipId: rec.id }).pluck("learnerId"),
    update: (rec, patch) => ClubMembershipModel.update(rec.id, rec.ownerAdminId, patch),
    raise: (rec, args, actorUserId) => require("../tech-clubs/club.service").raiseMembershipInvoice(rec, args, actorUserId),
  },
};

function existingInvoice(kind, rec, periodStart) {
  const { invoiceKey, invoiceType } = KINDS[kind];
  return db("billing_invoices")
    .where({ [invoiceKey]: rec.id, invoiceType, periodStart })
    .whereNotIn("status", ["cancelled", "void"])
    .first();
}

// The days in [start, end] on which any of the family's children was marked present or late.
async function daysUsed(kind, rec, start, end) {
  const learnerIds = await KINDS[kind].childLearnerIds(rec);
  if (!learnerIds.length) return 0;
  const rows = await db("attendance")
    .whereIn("learnerId", learnerIds)
    .whereIn("status", USED)
    .whereBetween("date", [start, end])
    .distinct("date");
  return rows.length;
}

// A waiting change whose day has come, applied. Returns the family as it now stands.
async function applyDueChange(kind, rec) {
  const patch = dueChange(rec);
  return patch ? KINDS[kind].update(rec, patch) : rec;
}

// Bills one active family up to today. Returns how many invoices were raised.
async function billFamily(kind, rec, { today = kenyaToday(), actorUserId = null } = {}) {
  let raised = 0;
  if (!rec.billingAnchor) return raised; // not started yet (set when the family becomes active)
  for (let i = 0; i < MAX_PERIODS_PER_RUN; i += 1) {
    rec = await applyDueChange(kind, rec);
    const { start, end } = nextPeriod(rec);
    if (rec.billingPeriod === "daily") {
      if (end >= today) break; // the month isn't over yet
      const days = await daysUsed(kind, rec, start, end);
      if (days > 0 && !(await existingInvoice(kind, rec, start))) {
        await KINDS[kind].raise(rec, {
          periodStart: start, periodEnd: end, label: periodLabel(start, end),
          dueDate: dueDateFor("daily", today, end), quantity: days, unitAmount: Number(rec.amount), unit: "day",
        }, actorUserId);
        raised += 1;
      }
    } else {
      if (start > today) break; // not started yet
      if (!(await existingInvoice(kind, rec, start))) {
        await KINDS[kind].raise(rec, {
          periodStart: start, periodEnd: end, label: periodLabel(start, end),
          dueDate: dueDateFor(rec.billingPeriod, today, end), quantity: 1, unitAmount: Number(rec.amount),
        }, actorUserId);
        raised += 1;
      }
    }
    rec = await KINDS[kind].update(rec, { billedThrough: end });
  }
  return raised;
}

// Staff raising a family's next invoice now ("Invoice next period"), before it starts — not for
// a daily package, which can only be billed once its month is over. Returns { invoice, created }.
async function invoiceNextPeriod(kind, rec, { today = kenyaToday(), dueDate = null, actorUserId = null } = {}) {
  if (rec.billingPeriod === "daily") {
    throw Object.assign(new Error("A daily package is billed automatically at the end of each month, for the days used"), { statusCode: 400 });
  }
  rec = await applyDueChange(kind, rec);
  const { start, end } = nextPeriod(rec);
  let invoice = await existingInvoice(kind, rec, start);
  const created = !invoice;
  if (created) {
    invoice = await KINDS[kind].raise(rec, {
      periodStart: start, periodEnd: end, label: periodLabel(start, end),
      dueDate: dueDate || dueDateFor(rec.billingPeriod, today, end), quantity: 1, unitAmount: Number(rec.amount),
    }, actorUserId);
  }
  await KINDS[kind].update(rec, { billedThrough: end });
  return { invoice, created };
}

// Every active family's invoices brought up to today — for all workspaces, or one
// (`ownerAdminId`), Home Learning and/or Tech Clubs (`kinds`), optionally one club (`hubId`).
async function processPackageBilling({ ownerAdminId = null, kinds = Object.keys(KINDS), hubId = null, today = kenyaToday(), actorUserId = null } = {}) {
  const counts = { families: 0, invoices: 0, failed: 0 };
  for (const kind of kinds) {
    let query = db(KINDS[kind].table).where({ status: "active" });
    if (ownerAdminId) query = query.where({ ownerAdminId });
    if (hubId && kind === "tech_club") query = query.where({ hubId });
    for (const rec of await query) {
      counts.families += 1;
      try {
        counts.invoices += await billFamily(kind, rec, { today, actorUserId });
      } catch (err) {
        counts.failed += 1;
        console.error(`[package-billing] could not bill ${kind} ${rec.id}:`, err.message);
      }
    }
  }
  return counts;
}

// A website sign-up's first period: from today, on the package's period (never daily — a daily
// package isn't offered on the website). { start, end, label }.
function firstPeriod(billingPeriod, today = kenyaToday()) {
  const { start, end } = periodAt(billingPeriod, today, 0);
  return { start, end, label: periodLabel(start, end) };
}

// What a family's card shows: the next invoice (the period, and the day it's raised) and any change
// waiting for it. Null for a family that isn't billed now (pending, paused, cancelled).
function billingOutlook(record) {
  if (record.status !== "active" || !record.billingAnchor) return null;
  // A change that starts with the next period is what that invoice will be on.
  const change = dueChange(record);
  const rec = change ? { ...record, ...change } : record;
  const next = nextPeriod(rec);
  const pending = rec.pendingBilling?.from ? rec.pendingBilling : null;
  return {
    billingPeriod: rec.billingPeriod,
    amount: Number(rec.amount),
    next: {
      start: next.start, end: next.end, label: periodLabel(next.start, next.end),
      // Advance periods are raised on their first day; a daily month the day after it ends.
      raisedOn: rec.billingPeriod === "daily" ? addDays(next.end, 1) : next.start,
    },
    pending: pending ? { amount: Number(pending.amount), billingPeriod: pending.billingPeriod, from: pending.from } : null,
  };
}

module.exports = { processPackageBilling, billFamily, invoiceNextPeriod, billingOutlook, firstPeriod, daysUsed };
