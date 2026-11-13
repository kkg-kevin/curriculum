const db = require("../../config/db");
const R = require("./removal.rules");
const { teamProblem, PROGRAMME_LABEL } = require("../affiliates/affiliate.rules");

// Removing an affiliate (modules/removals/removal.service.js says how the steps fit together).
//
// Deactivate = Suspend: their link and code stop bringing new families, nothing more is earned.
// Sorted out first, on the Affiliates page: a payout they asked for (mark it paid or reject it) and
// commissions not paid out yet — it's their money, so it's paid out (staff may pay out a suspended
// affiliate) or cancelled, never handed to someone else.
// Handed over to another active affiliate: the families they brought (referrals not cancelled) —
// that affiliate earns on them from now on, for the paid periods left (counted per family) — and a
// manager's team, to another manager or on their own.
// Kept under their name: commissions and payouts already paid. With any, the affiliate stays as a
// tombstone (status "removed"), out of every list but "Removed"; their sign-in goes.

const A = "affiliates";
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const ksh = (n) => `KSh ${Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

async function load(req, id) {
  const person = await db(A).where({ id }).first();
  if (!person || person.ownerAdminId !== req.ownerAdminId) fail("Affiliate not found", 404);
  return { req, id, person, ownerAdminId: req.ownerAdminId };
}

function describe({ person }) {
  return {
    id: person.id,
    name: person.name || "Affiliate",
    detail: [person.code, person.email].filter(Boolean).join(" · ") || null,
    status: person.status,
    deactivated: ["suspended", "removed"].includes(person.status),
    removed: person.status === "removed",
    removedAt: person.removedAt || null,
    deactivateNote: "Suspending them stops their link and code bringing new families, and nothing more is earned.",
  };
}

async function holdings(ctx) {
  const items = [];
  const referrals = await db("affiliate_referrals").where({ affiliateId: ctx.id }).whereNot({ status: "cancelled" }).orderBy("createdAt").select("id", "customerName", "programme", "status");
  for (const r of referrals) {
    items.push({
      key: R.itemKey("referral", r.id), type: "referral", group: "Families they brought", id: r.id,
      label: r.customerName || "A family", detail: `${PROGRAMME_LABEL[r.programme] || r.programme}${r.status === "paid" ? " · paying" : " · signed up"}`,
    });
  }
  const team = await db(A).where({ managerId: ctx.id }).whereNot({ status: "removed" }).orderBy("name").select("id", "name", "code");
  for (const m of team) {
    items.push({
      key: R.itemKey("teamMember", m.id), type: "teamMember", group: "Their team", id: m.id, allowNone: true,
      label: m.name || "An affiliate", detail: "Another manager, or on their own",
    });
  }
  return items;
}

async function candidates(ctx) {
  const rows = await db(A).where({ ownerAdminId: ctx.ownerAdminId, status: "active" }).whereNot({ id: ctx.id }).orderBy("name").select("id", "name", "code", "isManager", "managerId");
  return rows.map((a) => ({ id: a.id, name: a.name || a.code, detail: [a.code, a.isManager ? "Manager" : null].filter(Boolean).join(" · ") }));
}

const HANDLERS = {
  async referral(ctx, item, toId) {
    const to = await db(A).where({ id: toId, ownerAdminId: ctx.ownerAdminId }).first();
    if (!to || to.status !== "active") fail("Choose an active affiliate", 409);
    await db("affiliate_referrals").where({ id: item.id, affiliateId: ctx.id }).update({ affiliateId: toId, updatedAt: new Date() });
  },

  async teamMember(ctx, item, target) {
    const member = await db(A).where({ id: item.id }).first();
    if (!member || member.managerId !== ctx.id) return;
    if (target === R.NOBODY) {
      await db(A).where({ id: member.id }).update({ managerId: null, updatedAt: new Date() });
      return;
    }
    const manager = await db(A).where({ id: target, ownerAdminId: ctx.ownerAdminId }).first();
    const problem = teamProblem({ affiliate: member, isManager: Boolean(member.isManager), managerId: target, manager });
    if (problem) fail(problem, 409);
    await db(A).where({ id: member.id }).update({ managerId: target, updatedAt: new Date() });
  },
};

async function transferItem(ctx, item, target) {
  const handler = HANDLERS[item.type];
  if (!handler) fail("This can't be handed over here", 400);
  await handler(ctx, item, target);
}

async function toSettle(ctx) {
  const out = [];
  const payouts = await db("affiliate_payouts").where({ affiliateId: ctx.id, status: "requested" }).select("amount");
  if (payouts.length) {
    out.push({
      label: `${R.counted(payouts.length, "payout", "payouts")} asked for (${ksh(payouts.reduce((s, p) => s + Number(p.amount || 0), 0))})`,
      detail: "Mark it paid or reject it.", href: "/affiliates?tab=payouts",
    });
  }
  const unpaid = await db("affiliate_commissions").where({ affiliateId: ctx.id, status: "pending" }).whereNull("payoutId").select("amount");
  if (unpaid.length) {
    out.push({
      label: `${R.counted(unpaid.length, "commission", "commissions")} not paid out (${ksh(unpaid.reduce((s, c) => s + Number(c.amount || 0), 0))})`,
      detail: "It's their money: pay it out (Pay out on their row), or cancel what shouldn't be paid.", href: "/affiliates?tab=commissions",
    });
  }
  return out;
}

async function automatic(ctx) {
  return [
    `Their code ${ctx.person.code} stops working`,
    ctx.person.userId && "Their Affiliate sign-in stops (any other role on the same login stays)",
  ].filter(Boolean);
}

async function runAutomatic() {}

// What stays theirs once the rest is settled and handed over: commissions paid or cancelled,
// payouts, families that stopped (cancelled referrals). Any of it keeps them as a tombstone
// (affiliate.service.js's deleteAffiliate refuses a delete while any exists).
async function history(ctx) {
  const [paid, cancelled, payouts, stopped] = await Promise.all([
    db("affiliate_commissions").where({ affiliateId: ctx.id, status: "paid" }).select("amount"),
    db("affiliate_commissions").where({ affiliateId: ctx.id, status: "cancelled" }).count({ n: "*" }).first(),
    db("affiliate_payouts").where({ affiliateId: ctx.id }).whereIn("status", ["paid", "rejected"]).count({ n: "*" }).first(),
    db("affiliate_referrals").where({ affiliateId: ctx.id, status: "cancelled" }).count({ n: "*" }).first(),
  ]);
  const n = (row) => Number(row?.n || 0);
  return [
    paid.length && `${R.counted(paid.length, "commission", "commissions")} paid (${ksh(paid.reduce((s, c) => s + Number(c.amount || 0), 0))})`,
    n(cancelled) && R.counted(n(cancelled), "cancelled commission", "cancelled commissions"),
    n(payouts) && R.counted(n(payouts), "payout", "payouts"),
    n(stopped) && R.counted(n(stopped), "family that stopped", "families that stopped"),
  ].filter(Boolean);
}

async function deactivate(ctx) {
  await db(A).where({ id: ctx.id }).update({ status: "suspended", updatedAt: new Date() });
}

async function remove(ctx, { history: kept = [] } = {}) {
  const AffiliateService = require("../affiliates/affiliate.service");
  if (!kept.length) {
    await AffiliateService.deleteAffiliate(ctx.req, ctx.id);
    return "deleted";
  }
  await db(A).where({ id: ctx.id }).update({ status: "removed", isManager: false, managerId: null, userId: null, removedAt: new Date(), removedBy: ctx.req.user.id, updatedAt: new Date() });
  await AffiliateService._releaseLogin(ctx.person.userId, ctx.id);
  return "tombstone";
}

module.exports = { load, describe, holdings, candidates, transferItem, toSettle, automatic, runAutomatic, history, deactivate, remove };
