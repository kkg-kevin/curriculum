const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const BillingModel = require("../billing/billing.model");
const NotificationService = require("../notifications/notification.service");
const R = require("./credit.rules");

// Family credits (27 Nov 2026). A parent buys credits (1 credit = KSh 1) for their children; any of
// their children can then book a mentor with them from their own login, without waiting for the
// parent — and the parent can book with them too.
//
//   buying     the parent picks an amount → one "credits" invoice billed to them (paid like any
//              other: M-Pesa, "I've paid"…); paid in full → the credits land in the wallet
//              (billing.paid-hooks.js → onInvoicePaid; once per invoice, uniqueKey purchase:<id>)
//   wallet     one per parent login per workspace (the mentor's workspace decides which one a
//              booking spends from). Every child of that parent (their guardian email) shares it.
//   spending   a booking's invoice is paid from the wallet through BillingService.applyPayment
//              (provider/method "credits"), so the booking confirms exactly as when money arrives
//   refunds    a cancelled booking's credits go straight back (uniqueKey refund:<bookingId>);
//              only money paid any other way is left as a refund due
//   rules      the parent may switch a child off or give them a monthly limit (childRules)
//   staff      see every wallet of the workspace, its ledger, and add or take off credits with a
//              reason (admins and staff with Mentor bookings → Edit)
// New tables (family_credit_*) — no SQL joins to older ones.

const W = "family_credit_wallets";
const E = "family_credit_entries";
const METHOD = "credits";
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const lower = (v) => String(v || "").trim().toLowerCase();
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const parseJson = (v) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
const fmt = (n) => R.round2(n).toLocaleString("en-KE");
const mentorBookings = () => require("../mentor-bookings/mentor-booking.service");

function shapeWallet(w) {
  if (!w) return w;
  return { ...w, balance: Number(w.balance), totalBought: Number(w.totalBought), totalSpent: Number(w.totalSpent), childRules: parseJson(w.childRules) || {} };
}
const shapeEntry = (e) => ({ ...e, amount: Number(e.amount), balanceAfter: Number(e.balanceAfter) });

async function settingsFor(ownerAdminId) {
  return mentorBookings().settingsFor(ownerAdminId);
}

async function findWallet(ownerAdminId, parentUserId, trx = db) {
  return shapeWallet(await trx(W).where({ ownerAdminId, parentUserId }).first());
}

async function ensureWallet(ownerAdminId, parentUserId) {
  const existing = await findWallet(ownerAdminId, parentUserId);
  if (existing) return existing;
  try {
    await db(W).insert({ id: generateId(), ownerAdminId, parentUserId, balance: 0, totalBought: 0, totalSpent: 0, childRules: JSON.stringify({}), createdAt: new Date(), updatedAt: new Date() });
  } catch (err) {
    if (err.code !== "ER_DUP_ENTRY") throw err;
  }
  return findWallet(ownerAdminId, parentUserId);
}

// Moves credits in or out of a wallet, locking it so two spends can't both read the old balance.
// `uniqueKey` makes a purchase / refund happen once. Returns the entry, or null when that key was
// already used. Refuses to go below 0 unless `allowNegative` (never used today).
async function move(walletId, { kind, amount, learnerId = null, invoiceId = null, bookingId = null, byUserId = null, byRole = "system", note = null, uniqueKey = null }) {
  const delta = R.round2(amount);
  if (!delta) fail("Nothing to move");
  let entry = null;
  try {
    await db.transaction(async (trx) => {
      const w = shapeWallet(await trx(W).where({ id: walletId }).forUpdate().first());
      if (!w) fail("Wallet not found", 404);
      const balanceAfter = R.round2(w.balance + delta);
      if (balanceAfter < 0) fail(`There ${w.balance === 1 ? "is" : "are"} only ${fmt(w.balance)} credits`, 409);
      entry = {
        id: generateId(), walletId, ownerAdminId: w.ownerAdminId, kind, amount: delta, balanceAfter, learnerId, invoiceId, bookingId,
        byUserId, byRole, note: note ? String(note).slice(0, 500) : null, uniqueKey, createdAt: new Date(),
      };
      await trx(E).insert(entry);
      const patch = { balance: balanceAfter, updatedAt: new Date() };
      if (kind === "purchase") patch.totalBought = R.round2(w.totalBought + delta);
      if (kind === "spend") patch.totalSpent = R.round2(w.totalSpent - delta);
      if (kind === "refund") patch.totalSpent = R.round2(Math.max(0, w.totalSpent - delta));
      await trx(W).where({ id: walletId }).update(patch);
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY" && uniqueKey) return null;
    throw err;
  }
  return shapeEntry(entry);
}

// The parent logins of a learner (their guardian email, never a child's username login).
async function parentUserIdsOf(learner) {
  const email = lower(learner?.guardianEmail);
  if (!email) return [];
  return db("users").whereRaw("LOWER(email) = ?", [email]).whereNull("username").pluck("id");
}

// What a child has spent (net of refunds) this Kenyan month from one wallet.
async function childSpentThisMonth(walletId, learnerId) {
  const row = await db(E).where({ walletId, learnerId }).whereIn("kind", ["spend", "refund"]).where("byRole", "child")
    .where("createdAt", ">=", R.kenyaMonthStart()).sum({ n: "amount" }).first();
  // Refunds of a child's own bookings are written byRole "child" too, so this nets them.
  return Math.max(0, R.round2(-(Number(row?.n) || 0)));
}

async function notify(userId, event, ownerAdminId) {
  if (!userId) return;
  await NotificationService.notifyPerson(userId, { ...event, ownerAdminId }).catch((err) => console.error("[family-credits] could not notify:", err.message));
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

// The workspaces a parent's children learn in, each with the children there and a name to show.
async function familyWorkspaces(learners) {
  const internal = mentorBookings()._internal;
  const byOwner = new Map();
  for (const l of learners) {
    for (const owner of await internal.learnerWorkspaces(l.id)) {
      (byOwner.get(owner) || byOwner.set(owner, []).get(owner)).push(l);
    }
  }
  const out = [];
  for (const [ownerAdminId, children] of byOwner) {
    const hubIds = await db("learner_hub_links").whereIn("learnerId", children.map((c) => c.id)).distinct("hubId").pluck("hubId");
    const hubs = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).where({ ownerAdminId }).pluck("name") : [];
    out.push({ ownerAdminId, children, name: hubs.slice(0, 2).join(", ") || "Your learning centre" });
  }
  return out;
}

const CreditService = {
  METHOD,
  findWallet,
  ensureWallet,

  /* ── Parents ──────────────────────────────────────────────────────────────────────────── */

  // The parent's credits page: a wallet per workspace their children learn in — balance, each
  // child with their rule and what they've spent this month, the latest entries, credits being
  // bought (unpaid invoices), and what can be bought.
  async mine(req) {
    const learners = req.ownLearners || [];
    const out = [];
    for (const ws of await familyWorkspaces(learners)) {
      const settings = await settingsFor(ws.ownerAdminId);
      const wallet = await findWallet(ws.ownerAdminId, req.user.id);
      const entries = wallet ? (await db(E).where({ walletId: wallet.id }).orderBy("createdAt", "desc").limit(60)).map(shapeEntry) : [];
      const names = new Map(learners.map((l) => [l.id, l.firstName]));
      const pending = await db("billing_invoices").where({ payerUserId: req.user.id, invoiceType: "credits" })
        .whereIn("status", ["issued", "partially_paid", "overdue"]).whereIn("hubId", db("learning_hubs").where({ ownerAdminId: ws.ownerAdminId }).select("id"))
        .orderBy("issuedAt", "desc").select("id", "invoiceNumber", "total", "amountPaid", "issuedAt");
      const children = [];
      for (const c of ws.children) {
        const rule = R.ruleFor(wallet?.childRules, c.id);
        children.push({ id: c.id, firstName: c.firstName, lastName: c.lastName, photo: c.photo || null, ...rule, spentThisMonth: wallet ? await childSpentThisMonth(wallet.id, c.id) : 0 });
      }
      out.push({
        ownerAdminId: ws.ownerAdminId, name: ws.name,
        enabled: settings.enabled && settings.creditsEnabled, childBooking: settings.childBooking,
        minimumPurchase: settings.minimumPurchase, presets: settings.creditPresets,
        balance: wallet?.balance || 0, totalBought: wallet?.totalBought || 0, totalSpent: wallet?.totalSpent || 0,
        children,
        pending: pending.map((p) => ({ id: p.id, invoiceNumber: p.invoiceNumber, amount: Number(p.total), paid: Number(p.amountPaid), issuedAt: p.issuedAt })),
        entries: entries.map((e) => ({ ...e, learnerName: names.get(e.learnerId) || null })),
      });
    }
    return out;
  },

  // Buying credits: one invoice for the amount, billed to the parent. Paid in full → credits.
  async buy(req, { amount, ownerAdminId }) {
    const learners = req.ownLearners || [];
    const workspaces = await familyWorkspaces(learners);
    const ws = workspaces.find((w) => w.ownerAdminId === ownerAdminId) || (workspaces.length === 1 ? workspaces[0] : null);
    if (!ws) fail("Choose which learning centre the credits are for", 400);
    const settings = await settingsFor(ws.ownerAdminId);
    if (!settings.enabled) fail("Mentor sessions aren't open at this learning centre yet", 409);
    const problem = R.purchaseProblem(amount, settings);
    if (problem) fail(problem);
    const internal = mentorBookings()._internal;
    let hubId = null;
    for (const c of ws.children) {
      hubId = await internal.invoiceHubFor(ws.ownerAdminId, c.id, null);
      if (hubId) break;
    }
    if (!hubId) fail("This learning centre has no active hub to bill through yet", 409);
    await ensureWallet(ws.ownerAdminId, req.user.id);
    const total = R.round2(amount);
    const now = new Date();
    let invoiceId;
    await BillingModel.transaction(async (trx) => {
      const invoice = await BillingModel.createInvoice({
        invoiceNumber: await nextInvoiceNumber(trx),
        issuerType: "platform", issuerHubId: null, payerUserId: req.user.id, payerHubId: null,
        learnerId: ws.children.length === 1 ? ws.children[0].id : null, hubId, invoiceType: "credits", status: "issued",
        currency: "KES", subtotal: total, discount: 0, total, amountPaid: 0,
        periodLabel: `${fmt(total)} mentor credits`, issuedAt: now, dueAt: null,
        notes: "1 credit = KSh 1. Once this is paid the credits are in your family's wallet — any of your children can use them to book a mentor.",
      }, trx);
      invoiceId = invoice.id;
      await BillingModel.createItem({
        invoiceId, learnerId: null, courseId: null, description: `Mentor credits — ${fmt(total)} credits (1 credit = KSh 1)`,
        quantity: 1, unitAmount: total, totalAmount: total, metadata: { credits: total },
      }, trx);
      await BillingModel.createAuditEvent({ invoiceId, actorUserId: req.user.id, eventType: "invoice_issued", newStatus: "issued", amount: total, metadata: { source: "family_credits" } }, trx);
    });
    require("../billing/billing.service").emailIssuedInvoice(invoiceId);
    return { invoiceId };
  },

  // The parent switches a child's booking on/off, or sets their monthly limit.
  async setChildRule(req, learnerId, { ownerAdminId, allowed, monthlyLimit }) {
    const child = (req.ownLearners || []).find((l) => l.id === learnerId);
    if (!child) fail("Choose one of your children", 404);
    const ws = (await familyWorkspaces([child])).find((w) => w.ownerAdminId === ownerAdminId);
    if (!ws) fail("Not found", 404);
    const wallet = await ensureWallet(ownerAdminId, req.user.id);
    const rules = { ...wallet.childRules, [learnerId]: { allowed: !!allowed, monthlyLimit: monthlyLimit == null || monthlyLimit === "" ? null : Math.max(0, Math.round(Number(monthlyLimit))) } };
    await db(W).where({ id: wallet.id }).update({ childRules: JSON.stringify(rules), updatedAt: new Date() });
    return R.ruleFor(rules, learnerId);
  },

  /* ── A child, booking for themselves ──────────────────────────────────────────────────── */

  // The wallet a child books from in a workspace: their parent's (the one with the most credits
  // when two logins share the email), with their rule and what's left this month.
  async childWallet(learner, ownerAdminId) {
    const parentIds = await parentUserIdsOf(learner);
    let best = null;
    for (const pid of parentIds) {
      const w = await findWallet(ownerAdminId, pid);
      if (w && (!best || w.balance > best.balance)) best = w;
    }
    const settings = await settingsFor(ownerAdminId);
    const rule = R.ruleFor(best?.childRules, learner.id);
    const spent = best ? await childSpentThisMonth(best.id, learner.id) : 0;
    return {
      wallet: best, parentUserId: best?.parentUserId || parentIds[0] || null, hasParentLogin: parentIds.length > 0,
      balance: best?.balance || 0, rule, spentThisMonth: spent, settings,
      left: rule.monthlyLimit == null ? null : Math.max(0, R.round2(rule.monthlyLimit - spent)),
    };
  },

  // What the child's own pages show: the credits they can use in each of their workspaces.
  async childSummary(req) {
    const learner = req.ownLearner;
    if (!learner) fail("Not allowed", 403);
    const full = await db("learners").where({ id: learner.id }).first("id", "firstName", "guardianEmail");
    const out = [];
    for (const owner of await mentorBookings()._internal.learnerWorkspaces(learner.id)) {
      const w = await CreditService.childWallet(full, owner);
      out.push({
        ownerAdminId: owner, balance: w.balance, allowed: w.rule.allowed, monthlyLimit: w.rule.monthlyLimit, left: w.left,
        hasParentLogin: w.hasParentLogin, enabled: w.settings.enabled && w.settings.creditsEnabled && w.settings.childBooking,
      });
    }
    return out;
  },

  /* ── Spending and refunds (mentor-booking.service.js) ─────────────────────────────────── */

  // Pays `amount` of an invoice from a wallet: takes the credits, then records the payment. If the
  // payment can't be recorded, the credits go back. Returns the amount paid.
  async spendOnInvoice({ wallet, amount, invoiceId, bookingId, learnerId, byUserId, byRole, note }) {
    const spend = R.round2(amount);
    if (!(spend > 0)) return 0;
    const entry = await move(wallet.id, { kind: "spend", amount: -spend, invoiceId, bookingId, learnerId, byUserId, byRole, note, uniqueKey: `spend:${bookingId || invoiceId}` });
    if (!entry) return 0;
    try {
      await require("../billing/billing.service").applyPayment(invoiceId, {
        amount: spend, provider: METHOD, paymentMethod: METHOD, providerReference: entry.id, payerUserId: wallet.parentUserId,
        recordedBy: byUserId, idempotencyKey: `credits:${entry.id}`, notes: `Paid with ${fmt(spend)} family credits`,
      });
    } catch (err) {
      await move(wallet.id, { kind: "refund", amount: spend, invoiceId, bookingId, learnerId, byUserId, byRole, note: "Payment couldn't be recorded — credits put back", uniqueKey: `undo:${entry.id}` });
      throw err;
    }
    return spend;
  },

  // A cancelled booking: its credits go back to the wallet they came from. Returns what went back.
  async refundBooking(booking, amount) {
    const back = R.round2(amount);
    if (!(back > 0)) return 0;
    const spent = await db(E).where({ bookingId: booking.id, kind: "spend" }).first();
    if (!spent) return 0;
    const entry = await move(spent.walletId, {
      kind: "refund", amount: back, bookingId: booking.id, invoiceId: spent.invoiceId, learnerId: booking.learnerId,
      byRole: spent.byRole === "child" ? "child" : "system", note: "Mentor session cancelled — credits back", uniqueKey: `refund:${booking.id}`,
    });
    if (entry) {
      const wallet = shapeWallet(await db(W).where({ id: spent.walletId }).first());
      await notify(wallet.parentUserId, {
        type: "credits_refunded", title: `${fmt(back)} credits back in your wallet`,
        message: `A mentor session on ${String(booking.date).slice(0, 10)} was cancelled, so its ${fmt(back)} credits are back. Balance: ${fmt(wallet.balance)} credits.`,
        payload: { route: "/parent/credits" }, dedupeKey: `credits_refunded:${booking.id}`,
      }, wallet.ownerAdminId);
    }
    return entry ? back : 0;
  },

  // The parent hears when a child spends credits.
  async tellParentChildBooked({ wallet, booking, childName, mentorName, spent }) {
    const fresh = shapeWallet(await db(W).where({ id: wallet.id }).first());
    await notify(fresh.parentUserId, {
      type: "credits_spent_by_child",
      title: `${childName} booked a mentor with ${fmt(spent)} credits`,
      message: `${childName} booked ${mentorName} for ${booking.minutes} minutes on ${String(booking.date).slice(0, 10)} at ${booking.startTime}. ${fmt(fresh.balance)} credits left.`,
      payload: { route: `/parent/bookings/${booking.id}` }, dedupeKey: `credits_spent_by_child:${booking.id}`,
    }, fresh.ownerAdminId);
  },

  /* ── Billing hook ─────────────────────────────────────────────────────────────────────── */

  // A "credits" invoice paid in full: its credits go into the parent's wallet (once).
  async onInvoicePaid(invoice) {
    if (invoice.invoiceType !== "credits" || !invoice.payerUserId) return;
    const hub = await db("learning_hubs").where({ id: invoice.hubId }).first("ownerAdminId");
    if (!hub?.ownerAdminId) return;
    const wallet = await ensureWallet(hub.ownerAdminId, invoice.payerUserId);
    const amount = R.round2(invoice.total);
    const entry = await move(wallet.id, { kind: "purchase", amount, invoiceId: invoice.id, byUserId: invoice.payerUserId, byRole: "parent", note: `Bought — ${invoice.invoiceNumber}`, uniqueKey: `purchase:${invoice.id}` });
    if (!entry) return;
    await notify(invoice.payerUserId, {
      type: "credits_added", title: `${fmt(amount)} credits added`,
      message: `Your payment for ${invoice.invoiceNumber} is in. Your family now has ${fmt(entry.balanceAfter)} credits — your children can use them to book a mentor themselves.`,
      payload: { route: "/parent/credits" }, dedupeKey: `credits_added:${invoice.id}`,
    }, hub.ownerAdminId);
  },

  /* ── Staff ─────────────────────────────────────────────────────────────────────────────── */

  async listWallets(ctx) {
    const wallets = (await db(W).where({ ownerAdminId: ctx.ownerAdminId }).orderBy("updatedAt", "desc")).map(shapeWallet);
    if (!wallets.length) return [];
    const users = new Map((await db("users").whereIn("id", wallets.map((w) => w.parentUserId)).select("id", "name", "email", "phone")).map((u) => [u.id, u]));
    const emails = [...new Set([...users.values()].map((u) => lower(u.email)).filter(Boolean))];
    const kids = emails.length ? await db("learners").whereRaw(`LOWER(guardianEmail) IN (${emails.map(() => "?").join(",")})`, emails).select("id", "firstName", "lastName", "guardianEmail") : [];
    const lastEntries = await db(E).whereIn("walletId", wallets.map((w) => w.id)).max({ at: "createdAt" }).select("walletId").groupBy("walletId");
    const lastAt = new Map(lastEntries.map((r) => [r.walletId, r.at]));
    return wallets.map((w) => {
      const u = users.get(w.parentUserId);
      return {
        id: w.id, parent: { id: w.parentUserId, name: u?.name || u?.email || "A parent", email: u?.email || null, phone: u?.phone || null },
        children: kids.filter((k) => lower(k.guardianEmail) === lower(u?.email)).map((k) => ({ id: k.id, name: fullName(k) })),
        balance: w.balance, totalBought: w.totalBought, totalSpent: w.totalSpent, lastActivityAt: lastAt.get(w.id) || w.updatedAt,
      };
    });
  },

  async walletDetail(ctx, id) {
    const w = shapeWallet(await db(W).where({ id, ownerAdminId: ctx.ownerAdminId }).first());
    if (!w) fail("Wallet not found", 404);
    const [summary] = (await CreditService.listWallets(ctx)).filter((x) => x.id === id);
    const entries = (await db(E).where({ walletId: id }).orderBy("createdAt", "desc").limit(500)).map(shapeEntry);
    const learners = new Map((await db("learners").whereIn("id", entries.map((e) => e.learnerId).filter(Boolean).concat("-")).select("id", "firstName", "lastName")).map((l) => [l.id, fullName(l)]));
    const by = new Map((await db("users").whereIn("id", entries.map((e) => e.byUserId).filter(Boolean).concat("-")).select("id", "name", "email", "username")).map((u) => [u.id, u.name || u.username || u.email]));
    const invoices = new Map((await db("billing_invoices").whereIn("id", entries.map((e) => e.invoiceId).filter(Boolean).concat("-")).select("id", "invoiceNumber")).map((i) => [i.id, i.invoiceNumber]));
    return { ...summary, childRules: w.childRules, entries: entries.map((e) => ({ ...e, learnerName: learners.get(e.learnerId) || null, byName: by.get(e.byUserId) || null, invoiceNumber: invoices.get(e.invoiceId) || null })) };
  },

  // Staff add (or take off) credits — a goodwill top-up, a correction — always with a reason.
  async adjust(ctx, id, { amount, note }) {
    if (!ctx.canManage) fail("Not allowed", 403);
    const w = shapeWallet(await db(W).where({ id, ownerAdminId: ctx.ownerAdminId }).first());
    if (!w) fail("Wallet not found", 404);
    const n = R.round2(amount);
    if (!n) fail("Enter how many credits to add (or a minus number to take off)");
    if (!String(note || "").trim()) fail("Say why, so the family understands");
    const entry = await move(id, { kind: "adjust", amount: n, byUserId: ctx.userId, byRole: "staff", note: String(note).trim() });
    await notify(w.parentUserId, {
      type: "credits_adjusted", title: n > 0 ? `${fmt(n)} credits added to your wallet` : `${fmt(-n)} credits taken off your wallet`,
      message: `${String(note).trim()} Balance: ${fmt(entry.balanceAfter)} credits.`, payload: { route: "/parent/credits" }, dedupeKey: `credits_adjusted:${entry.id}`,
    }, w.ownerAdminId);
    return CreditService.walletDetail(ctx, id);
  },
};

module.exports = CreditService;
