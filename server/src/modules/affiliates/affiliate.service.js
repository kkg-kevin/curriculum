const crypto = require("crypto");
const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");
const env = require("../../config/env");
const NotificationService = require("../notifications/notification.service");
const Emails = require("./affiliate.emails");
const { isParent } = require("../parent/parent.access");
const {
  PROGRAMMES, PROGRAMME_LABEL, RECURRING, PAYOUT_METHODS, normaliseSettings, normaliseCode, suggestCode,
  emailKey, pickAttribution, isSelfReferral, commissionFor, availableFrom, commissionState, totals, firstNameOf, money,
} = require("./affiliate.rules");

// Affiliate marketing (6 Nov 2026) — see CLAUDE.md "Affiliates". How it fits together:
//   1. Attribution: a website link carries ?ref=CODE (kept with the visit — the website's
//      utils/visitSource.js) or the family types the code at sign-up. Each website sign-up calls
//      recordReferral (never failing the sign-up), which credits one active affiliate of the
//      sign-up's workspace — never the family themself.
//   2. Commission: only money earns. billing.paid-hooks.js calls onInvoicePaid when an invoice is
//      paid in full; a referred sign-up's invoice (its first, and each later period's for a
//      subscription, up to the workspace's periods) earns the programme's rate of what was paid.
//   3. Payout: commissions wait holdDays, then the affiliate (from the minimum) or an admin asks
//      for a payout of everything available; an admin pays it (M-Pesa / bank / cash, a reference
//      typed in) or applies it as credit on one of the affiliate's own invoices
//      (BillingService.applyPayment, method "affiliate_credit" — never earning commission itself).
// New tables, newer collation: no SQL joins to older tables — look things up separately.

const A = "affiliates";
const R = "affiliate_referrals";
const C = "affiliate_commissions";
const P = "affiliate_payouts";
const S = "affiliate_settings";
const CREDIT_METHOD = "affiliate_credit";

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const ksh = (n) => `KSh ${money(n).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const now = () => new Date();

// The website's address for an affiliate's link: the first https site of PUBLIC_SITE_URL, else
// the first one listed (local).
function websiteUrl() {
  const sites = String(env.PUBLIC_SITE_URL || "").split(",").map((o) => o.trim()).filter(Boolean);
  return (sites.find((o) => /^https:\/\//i.test(o)) || sites[0] || "").replace(/\/+$/, "");
}
const linkFor = (code) => (websiteUrl() ? `${websiteUrl()}/?ref=${encodeURIComponent(code)}` : null);
// Where an affiliate's own notifications open.
const portalRoute = (affiliate) => (affiliate.kind === "educator" ? "/teacher-portal/refer" : "/parent/refer");

// ---- Affiliates who aren't users (no login) ---------------------------------------------------
// Their private dashboard on the website (/affiliate?token=...), no sign-in: the token is an HMAC
// of their id and dashboardVersion — read-only, for that one page; "Make a new link" raises the
// version, so every older link stops working. Never a portal session.
const isOutsider = (affiliate) => !affiliate.userId;
const dashboardKey = () => crypto.createHash("sha256").update(`affiliate-dashboard:${env.JWT_SECRET}`).digest();
const signDashboard = (affiliate) => crypto.createHmac("sha256", dashboardKey()).update(`${affiliate.id}:${affiliate.dashboardVersion || 1}`).digest("base64url");
const dashboardToken = (affiliate) => `${affiliate.id}.${signDashboard(affiliate)}`;
const dashboardUrl = (affiliate) => (websiteUrl() && isOutsider(affiliate) ? `${websiteUrl()}/affiliate?token=${dashboardToken(affiliate)}` : null);

async function affiliateForToken(token) {
  const [id, signature] = String(token || "").split(".");
  if (!id || !signature) return null;
  const affiliate = await db(A).where({ id }).first();
  if (!affiliate || !isOutsider(affiliate)) return null;
  const expected = Buffer.from(signDashboard(affiliate));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return affiliate;
}

// An email to an affiliate without a login (they have no bell), when the workspace sends them.
async function emailOutsider(affiliate, kind, payload = {}) {
  try {
    if (!affiliate?.email || !isOutsider(affiliate)) return;
    const settings = await getSettings(affiliate.ownerAdminId);
    if (!settings.emailOutsiders) return;
    await Emails[kind](affiliate, { ...payload, dashboardUrl: dashboardUrl(affiliate), link: linkFor(affiliate.code), offer: offerLine(settings) });
  } catch (err) {
    console.error("[affiliates] could not email an affiliate:", err.message);
  }
}

// "07•• ••• 111" — enough for the affiliate to recognise their number on a page anyone with the
// link could open.
const maskPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 6 ? `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}` : null;
};

// ---- Settings ---------------------------------------------------------------------------------
async function getSettings(ownerAdminId) {
  const row = ownerAdminId ? await db(S).where({ ownerAdminId }).first() : null;
  const raw = typeof row?.settings === "string" ? JSON.parse(row.settings || "{}") : row?.settings;
  return normaliseSettings(raw);
}

async function saveSettings(ownerAdminId, raw) {
  const settings = normaliseSettings(raw);
  const exists = await db(S).where({ ownerAdminId }).first();
  if (exists) await db(S).where({ ownerAdminId }).update({ settings: toJson(settings), updatedAt: now() });
  else await db(S).insert({ ownerAdminId, settings: toJson(settings), updatedAt: now() });
  return settings;
}

// "10% of each of a family's first 3 payments" — the offer in words, for the Refer & earn page.
function offerLine(settings) {
  const on = PROGRAMMES.filter((p) => settings.programmes[p]);
  if (!settings.enabled || on.length === 0) return null;
  const rates = [...new Set(on.map((p) => settings.rates[p]))];
  const rate = rates.length === 1 ? `${rates[0]}%` : `${Math.min(...rates)}–${Math.max(...rates)}%`;
  const recurring = on.some((p) => RECURRING.has(p));
  return recurring && settings.periods > 1
    ? `${rate} of what each family you refer pays — on each of their first ${settings.periods} payments`
    : `${rate} of what each family you refer pays`;
}

// ---- Loading ----------------------------------------------------------------------------------
async function affiliateInWorkspace(req, id) {
  const affiliate = await db(A).where({ id }).first();
  if (!affiliate || affiliate.ownerAdminId !== req.ownerAdminId) fail("Affiliate not found", 404);
  return affiliate;
}

// Commissions with their state (payouts looked up separately — no joins).
async function withStates(commissions) {
  const payoutIds = [...new Set(commissions.map((c) => c.payoutId).filter(Boolean))];
  const payouts = payoutIds.length ? await db(P).whereIn("id", payoutIds) : [];
  const byId = new Map(payouts.map((p) => [p.id, p]));
  const at = now();
  return commissions.map((c) => ({ ...c, amount: money(c.amount), baseAmount: money(c.baseAmount), ratePercent: Number(c.ratePercent), state: commissionState(c, byId.get(c.payoutId), at) }));
}

const shapeAffiliate = (a) => ({ ...a, link: linkFor(a.code), outsider: isOutsider(a), dashboardUrl: dashboardUrl(a) });

async function uniqueCode(wanted, name) {
  if (wanted) {
    const code = normaliseCode(wanted);
    if (!code) fail("A code is 4–20 letters and numbers, e.g. AMINA24");
    return code;
  }
  for (let i = 0; i < 20; i += 1) {
    const code = suggestCode(name);
    if (!(await db(A).where({ code }).first())) return code;
  }
  return `${suggestCode(name)}${Math.floor(Math.random() * 900 + 100)}`;
}

async function assertCodeFree(code, exceptId = null) {
  const taken = await db(A).where({ code }).first();
  if (taken && taken.id !== exceptId) fail(`The code ${code} is already taken — choose another.`, 409);
}

function cleanAffiliateInput(input, { partial = false } = {}) {
  const out = {};
  const text = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);
  if (!partial || input.name !== undefined) {
    out.name = text(input.name, 150);
    if (!out.name) fail("Enter the affiliate's name");
  }
  if (input.email !== undefined) {
    out.email = text(input.email, 255);
    if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) fail("Enter a valid email address");
  }
  if (input.phone !== undefined) out.phone = text(input.phone, 40);
  if (input.kind !== undefined) {
    if (!["parent", "educator", "other"].includes(input.kind)) fail("Choose who the affiliate is");
    out.kind = input.kind;
  }
  if (input.status !== undefined) {
    if (!["pending", "active", "suspended"].includes(input.status)) fail("Unknown status");
    out.status = input.status;
  }
  if (input.payoutMethod !== undefined) {
    if (!["credit", "mpesa", "bank"].includes(input.payoutMethod)) fail("Choose how they're paid");
    out.payoutMethod = input.payoutMethod;
  }
  if (input.payoutPhone !== undefined) out.payoutPhone = text(input.payoutPhone, 40);
  if (input.payoutDetails !== undefined) out.payoutDetails = text(input.payoutDetails, 500);
  if (input.notes !== undefined) out.notes = input.notes == null ? null : String(input.notes).slice(0, 4000);
  return out;
}

// The login an email belongs to (a parent's or educator's), linked so they see Refer & earn.
async function loginFor(email) {
  if (!email) return null;
  return db("users").whereRaw("LOWER(email) = ?", [email.toLowerCase()]).first("id", "role", "username");
}

const AffiliateService = {
  getSettings,
  saveSettings,

  // ---- 1. Attribution (website sign-ups) ------------------------------------------------------
  // Credits a website sign-up to the affiliate whose code was typed or whose link the family came
  // by. `programme` one of PROGRAMMES; `recordId` the household / membership / subscription /
  // order (bootcamp: the invoice); `parent` { userId, name, email, phone }. Never throws — a
  // family's sign-up must never fail over a referral. Returns the referral, or null.
  async recordReferral({ ownerAdminId, programme, recordId, invoiceId = null, parent = {}, code = null, visitSource = null, detail = null }) {
    try {
      if (!ownerAdminId || !recordId || !PROGRAMMES.includes(programme)) return null;
      const settings = await getSettings(ownerAdminId);
      if (!settings.enabled || !settings.programmes[programme]) return null;
      const pick = pickAttribution({ typedCode: code, visitSource, attributionDays: settings.attributionDays });
      if (!pick) return null;
      const affiliate = await db(A).where({ code: pick.code }).first();
      if (!affiliate || affiliate.status !== "active" || affiliate.ownerAdminId !== ownerAdminId) return null;
      if (isSelfReferral(affiliate, parent)) return null;
      if (await db(R).where({ programme, recordId }).first()) return null;
      const referral = {
        id: generateId(), ownerAdminId, affiliateId: affiliate.id, via: pick.via, programme, recordId,
        invoiceId: invoiceId || null, parentUserId: parent.userId || null,
        parentEmail: parent.email ? String(parent.email).slice(0, 255) : null,
        parentPhone: parent.phone ? String(parent.phone).slice(0, 40) : null,
        customerName: parent.name ? String(parent.name).slice(0, 150) : null,
        detail: detail ? String(detail).slice(0, 255) : null,
        landingPage: visitSource?.landingPage ? String(visitSource.landingPage).slice(0, 300) : null,
        status: "signed_up", createdAt: now(), updatedAt: now(),
      };
      await db(R).insert(referral);
      if (affiliate.userId) {
        await NotificationService.notifyPerson(affiliate.userId, {
          type: "affiliate_referral",
          title: "A family signed up through you",
          message: `${firstNameOf(referral.customerName)} signed up for ${PROGRAMME_LABEL[programme]}. You earn once they pay.`,
          payload: { route: portalRoute(affiliate) },
          dedupeKey: `affiliate_referral:${referral.id}`,
        }).catch(() => {});
      }
      await emailOutsider(affiliate, "referral", { referral, programme: PROGRAMME_LABEL[programme] });
      return referral;
    } catch (err) {
      console.error("[affiliates] could not record a referral:", err.message);
      return null;
    }
  },

  // The website's check of a typed code: only whether it's an active code (no names).
  async checkCode(code) {
    const clean = normaliseCode(code);
    if (!clean) return { valid: false };
    const affiliate = await db(A).where({ code: clean }).first("status", "ownerAdminId");
    const settings = affiliate ? await getSettings(affiliate.ownerAdminId) : null;
    return { valid: Boolean(affiliate && affiliate.status === "active" && settings?.enabled), code: clean };
  },

  // ---- 2. Commission (billing.paid-hooks.js, an invoice paid in full) -------------------------
  async onInvoicePaid(invoice) {
    if (!invoice?.id) return null;
    if (await db(C).where({ invoiceId: invoice.id }).first()) return null;
    // Which referred sign-up this invoice belongs to: a subscription's every period, else the
    // one-off sign-up whose invoice it is.
    let referral = null;
    if (invoice.householdId) referral = await db(R).where({ programme: "home_learning", recordId: invoice.householdId }).first();
    else if (invoice.clubMembershipId) referral = await db(R).where({ programme: "tech_club", recordId: invoice.clubMembershipId }).first();
    else if (invoice.pathwaySubscriptionId) referral = await db(R).where({ programme: "pathway", recordId: invoice.pathwaySubscriptionId }).first();
    if (!referral) referral = await db(R).where({ invoiceId: invoice.id }).first();
    if (!referral || referral.status === "cancelled") return null;
    const affiliate = await db(A).where({ id: referral.affiliateId }).first();
    if (!affiliate || affiliate.status === "suspended") return null;

    const settings = await getSettings(referral.ownerAdminId);
    const payments = await db("billing_payments").where({ invoiceId: invoice.id, status: "successful" });
    const paidAmount = money(payments.filter((p) => p.paymentMethod !== CREDIT_METHOD).reduce((sum, p) => sum + Number(p.amount || 0), 0));
    const earnedSoFar = Number((await db(C).where({ referralId: referral.id }).whereNot({ status: "cancelled" }).count("* as n"))[0].n) || 0;
    const commission = commissionFor({ settings, programme: referral.programme, paidAmount, earnedSoFar });
    if (!commission) return null;

    // Never later than now (MySQL rounds a stored time to the nearest second, sometimes up).
    const paidAt = invoice.paidAt ? new Date(Math.min(new Date(invoice.paidAt).getTime(), Date.now())) : now();
    const row = {
      id: generateId(), ownerAdminId: referral.ownerAdminId, affiliateId: affiliate.id, referralId: referral.id,
      invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || null, ...commission,
      currency: invoice.currency || "KES", status: "pending", availableAt: availableFrom(paidAt, settings.holdDays),
      createdAt: now(), updatedAt: now(),
    };
    try {
      await db(C).insert(row);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") return null; // the same payment's hook ran twice
      throw err;
    }
    if (referral.status !== "paid") await db(R).where({ id: referral.id }).update({ status: "paid", firstPaidAt: referral.firstPaidAt || paidAt, updatedAt: now() });
    if (affiliate.userId) {
      await NotificationService.notifyPerson(affiliate.userId, {
        type: "affiliate_commission",
        title: `You earned ${ksh(row.amount)}`,
        message: `${firstNameOf(referral.customerName)}'s family paid for ${PROGRAMME_LABEL[referral.programme]}. It can be paid out from ${row.availableAt.toISOString().slice(0, 10)}.`,
        payload: { route: portalRoute(affiliate) },
        dedupeKey: `affiliate_commission:${row.id}`,
      }).catch(() => {});
    }
    await emailOutsider(affiliate, "commission", { commission: row, referral, programme: PROGRAMME_LABEL[referral.programme] });
    return row;
  },

  // ---- Admin: affiliates ----------------------------------------------------------------------
  async listAffiliates(req) {
    const affiliates = await db(A).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc");
    const commissions = await withStates(await db(C).where({ ownerAdminId: req.ownerAdminId }));
    const referrals = await db(R).where({ ownerAdminId: req.ownerAdminId }).select("affiliateId", "status");
    return affiliates.map((a) => {
      const own = referrals.filter((r) => r.affiliateId === a.id);
      return {
        ...shapeAffiliate(a),
        referrals: own.length,
        paidReferrals: own.filter((r) => r.status === "paid").length,
        totals: totals(commissions.filter((c) => c.affiliateId === a.id)),
      };
    });
  },

  async createAffiliate(req, input) {
    const data = cleanAffiliateInput(input);
    const code = await uniqueCode(input.code, data.name);
    await assertCodeFree(code);
    const login = await loginFor(data.email);
    if (login?.id && (await db(A).where({ ownerAdminId: req.ownerAdminId, userId: login.id }).first())) {
      fail("That person is already an affiliate.", 409);
    }
    const kind = data.kind || (login?.role === "teacher" ? "educator" : login?.role === "learner" && !login.username ? "parent" : "other");
    const row = {
      id: generateId(), ownerAdminId: req.ownerAdminId, userId: login?.id || null,
      name: data.name, email: data.email || null, phone: data.phone || null, kind, code,
      status: data.status || "active",
      payoutMethod: data.payoutMethod || (kind === "parent" ? "credit" : "mpesa"),
      payoutPhone: data.payoutPhone || data.phone || null, payoutDetails: data.payoutDetails || null,
      notes: data.notes || null, createdBy: req.user.id, createdAt: now(), updatedAt: now(),
    };
    await db(A).insert(row);
    if (row.status === "active") await emailOutsider(row, "welcome");
    return shapeAffiliate(row);
  },

  async updateAffiliate(req, id, input) {
    const affiliate = await affiliateInWorkspace(req, id);
    const data = cleanAffiliateInput(input, { partial: true });
    if (input.code !== undefined) {
      data.code = normaliseCode(input.code);
      if (!data.code) fail("A code is 4–20 letters and numbers, e.g. AMINA24");
      await assertCodeFree(data.code, id);
    }
    if (data.email !== undefined && emailKey(data.email) !== emailKey(affiliate.email)) {
      const login = await loginFor(data.email);
      data.userId = login?.id || null;
    }
    await db(A).where({ id }).update({ ...data, updatedAt: now() });
    const updated = await db(A).where({ id }).first();
    // Approved after asking to join: tell them.
    if (affiliate.status === "pending" && updated.status === "active" && updated.userId) {
      await NotificationService.notifyPerson(updated.userId, {
        type: "affiliate_approved",
        title: "You're in the referral programme",
        message: `Share your link or code ${updated.code} — you earn when the families you refer pay.`,
        payload: { route: portalRoute(updated) },
        dedupeKey: `affiliate_approved:${updated.id}`,
      }).catch(() => {});
    }
    if (affiliate.status !== "active" && updated.status === "active") await emailOutsider(updated, "welcome");
    return shapeAffiliate(updated);
  },

  // Only an affiliate with no referrals can be deleted; otherwise suspend them (their history stays).
  async deleteAffiliate(req, id) {
    await affiliateInWorkspace(req, id);
    if (await db(R).where({ affiliateId: id }).first()) {
      fail("This affiliate has referrals, so their history is kept — suspend them instead.", 409);
    }
    await db(A).where({ id }).del();
  },

  // ---- Admin: referrals, commissions --------------------------------------------------------
  async listReferrals(req, { affiliateId = null } = {}) {
    const q = db(R).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc").limit(1000);
    if (affiliateId) q.where({ affiliateId });
    const referrals = await q;
    const affiliates = await db(A).where({ ownerAdminId: req.ownerAdminId }).select("id", "name", "code");
    const byId = new Map(affiliates.map((a) => [a.id, a]));
    const commissions = referrals.length ? await db(C).whereIn("referralId", referrals.map((r) => r.id)).whereNot({ status: "cancelled" }) : [];
    return referrals.map((r) => ({
      ...r,
      programmeLabel: PROGRAMME_LABEL[r.programme],
      affiliate: byId.get(r.affiliateId) || null,
      earned: money(commissions.filter((c) => c.referralId === r.id).reduce((s, c) => s + Number(c.amount), 0)),
      payments: commissions.filter((c) => c.referralId === r.id).length,
    }));
  },

  // A referral credited to the wrong person, or not a real one: it stops earning (commissions not
  // yet paid out are cancelled).
  async cancelReferral(req, id, note = null) {
    const referral = await db(R).where({ id }).first();
    if (!referral || referral.ownerAdminId !== req.ownerAdminId) fail("Referral not found", 404);
    const inPayout = await db(C).where({ referralId: id, status: "pending" }).whereNotNull("payoutId").first();
    if (inPayout) fail("One of its commissions is in a payout request — reject that payout first.");
    await db(R).where({ id }).update({ status: "cancelled", updatedAt: now() });
    await db(C).where({ referralId: id, status: "pending" }).update({ status: "cancelled", note: note ? String(note).slice(0, 500) : "Referral cancelled", updatedAt: now() });
  },

  async listCommissions(req, { affiliateId = null, state = null } = {}) {
    const q = db(C).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc").limit(2000);
    if (affiliateId) q.where({ affiliateId });
    let rows = await withStates(await q);
    if (state) rows = rows.filter((c) => c.state === state);
    const affiliates = await db(A).where({ ownerAdminId: req.ownerAdminId }).select("id", "name", "code");
    const byId = new Map(affiliates.map((a) => [a.id, a]));
    const referralIds = [...new Set(rows.map((c) => c.referralId))];
    const referrals = referralIds.length ? await db(R).whereIn("id", referralIds).select("id", "programme", "customerName") : [];
    const refById = new Map(referrals.map((r) => [r.id, r]));
    return rows.map((c) => {
      const r = refById.get(c.referralId);
      return { ...c, affiliate: byId.get(c.affiliateId) || null, programme: r?.programme, programmeLabel: PROGRAMME_LABEL[r?.programme], customerName: r?.customerName || null };
    });
  },

  async cancelCommission(req, id, note = null) {
    const commission = await db(C).where({ id }).first();
    if (!commission || commission.ownerAdminId !== req.ownerAdminId) fail("Commission not found", 404);
    if (commission.status !== "pending") fail(commission.status === "paid" ? "It's already been paid out." : "It's already cancelled.");
    if (commission.payoutId) fail("It's in a payout request — reject that payout first.");
    await db(C).where({ id }).update({ status: "cancelled", note: note ? String(note).slice(0, 500) : null, updatedAt: now() });
  },

  // ---- Payouts --------------------------------------------------------------------------------
  // Everything the affiliate has available goes into one payout request.
  async _requestPayout(affiliate, { requestedBy, enforceMinimum }) {
    if (affiliate.status !== "active") fail("Only an active affiliate can be paid out.");
    const settings = await getSettings(affiliate.ownerAdminId);
    const available = (await withStates(await db(C).where({ affiliateId: affiliate.id, status: "pending" }).whereNull("payoutId")))
      .filter((c) => c.state === "available");
    const amount = money(available.reduce((s, c) => s + c.amount, 0));
    if (amount <= 0) fail("There's nothing available to pay out yet.");
    if (enforceMinimum && amount < settings.minimumPayout) fail(`Payouts start from ${ksh(settings.minimumPayout)} — you have ${ksh(amount)} available.`);
    if (await db(P).where({ affiliateId: affiliate.id, status: "requested" }).first()) fail("A payout is already waiting to be paid.");
    const payout = {
      id: generateId(), ownerAdminId: affiliate.ownerAdminId, affiliateId: affiliate.id, amount,
      currency: available[0]?.currency || "KES", method: affiliate.payoutMethod || "mpesa", status: "requested",
      requestedBy, createdAt: now(), updatedAt: now(),
    };
    await db.transaction(async (trx) => {
      await trx(P).insert(payout);
      await trx(C).whereIn("id", available.map((c) => c.id)).whereNull("payoutId").update({ payoutId: payout.id, updatedAt: now() });
    });
    await NotificationService._notify(affiliate.ownerAdminId, {
      type: "affiliate_payout_requested",
      title: "Affiliate payout requested",
      message: `${affiliate.name} (${affiliate.code}) — ${ksh(amount)} by ${affiliate.payoutMethod === "credit" ? "invoice credit" : affiliate.payoutMethod === "bank" ? "bank" : "M-Pesa"}.`,
      payload: { route: "/affiliates?tab=payouts" },
      dedupeKey: `affiliate_payout_requested:${payout.id}`,
      ownerAdminId: affiliate.ownerAdminId,
    }).catch(() => {});
    return payout;
  },

  async createPayout(req, affiliateId) {
    const affiliate = await affiliateInWorkspace(req, affiliateId);
    return AffiliateService._requestPayout(affiliate, { requestedBy: req.user.id, enforceMinimum: false });
  },

  async listPayouts(req, { status = null, affiliateId = null } = {}) {
    const q = db(P).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc").limit(1000);
    if (status) q.where({ status });
    if (affiliateId) q.where({ affiliateId });
    const payouts = await q;
    const affiliates = await db(A).where({ ownerAdminId: req.ownerAdminId });
    const byId = new Map(affiliates.map((a) => [a.id, a]));
    const invoiceIds = payouts.map((p) => p.creditInvoiceId).filter(Boolean);
    const invoices = invoiceIds.length ? await db("billing_invoices").whereIn("id", invoiceIds).select("id", "invoiceNumber") : [];
    const invById = new Map(invoices.map((i) => [i.id, i]));
    return payouts.map((p) => {
      const a = byId.get(p.affiliateId);
      return {
        ...p, amount: money(p.amount),
        affiliate: a ? { id: a.id, name: a.name, code: a.code, kind: a.kind, payoutMethod: a.payoutMethod, payoutPhone: a.payoutPhone, payoutDetails: a.payoutDetails, userId: a.userId } : null,
        creditInvoiceNumber: invById.get(p.creditInvoiceId)?.invoiceNumber || null,
      };
    });
  },

  // The affiliate's own unpaid invoices — where a credit payout can go.
  async openInvoicesFor(req, affiliateId) {
    const affiliate = await affiliateInWorkspace(req, affiliateId);
    if (!affiliate.userId) return [];
    const invoices = await db("billing_invoices").where({ payerUserId: affiliate.userId }).whereIn("status", ["issued", "partially_paid", "overdue"]).orderBy("createdAt", "desc");
    return invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, total: money(i.total), amountDue: money(Number(i.total) - Number(i.amountPaid || 0)), status: i.status, periodLabel: i.periodLabel, currency: i.currency }));
  },

  async markPayoutPaid(req, id, input = {}) {
    const payout = await db(P).where({ id }).first();
    if (!payout || payout.ownerAdminId !== req.ownerAdminId) fail("Payout not found", 404);
    if (payout.status !== "requested") fail("This payout has already been decided.");
    const affiliate = await db(A).where({ id: payout.affiliateId }).first();
    const method = input.method || payout.method;
    if (!PAYOUT_METHODS.includes(method)) fail("Choose how it was paid");
    let reference = input.reference ? String(input.reference).trim().slice(0, 120) : null;
    let creditInvoiceId = null;
    if (method === "credit") {
      const invoice = input.creditInvoiceId ? await db("billing_invoices").where({ id: input.creditInvoiceId }).first() : null;
      if (!invoice || !affiliate.userId || invoice.payerUserId !== affiliate.userId) fail("Choose one of the affiliate's own unpaid invoices for the credit.");
      const due = money(Number(invoice.total) - Number(invoice.amountPaid || 0));
      if (Number(payout.amount) > due) fail(`The credit (${ksh(payout.amount)}) is more than ${invoice.invoiceNumber} still owes (${ksh(due)}) — choose another invoice, or pay it by M-Pesa.`);
      await require("../billing/billing.service").applyPayment(invoice.id, {
        amount: Number(payout.amount), provider: "affiliate", paymentMethod: CREDIT_METHOD, providerReference: payout.id,
        recordedBy: req.user.id, idempotencyKey: `affiliate_payout:${payout.id}`, notes: `Referral credit for ${affiliate.name} (${affiliate.code})`,
      });
      creditInvoiceId = invoice.id;
      reference = invoice.invoiceNumber;
    } else if (method !== "cash" && !reference) {
      fail(method === "mpesa" ? "Enter the M-Pesa code" : "Enter the bank reference");
    }
    await db.transaction(async (trx) => {
      await trx(P).where({ id }).update({ status: "paid", method, reference, creditInvoiceId, note: input.note ? String(input.note).slice(0, 500) : null, decidedBy: req.user.id, decidedAt: now(), updatedAt: now() });
      await trx(C).where({ payoutId: id, status: "pending" }).update({ status: "paid", updatedAt: now() });
    });
    if (affiliate.userId) {
      await NotificationService.notifyPerson(affiliate.userId, {
        type: "affiliate_payout_paid",
        title: `Your payout of ${ksh(payout.amount)} is paid`,
        message: method === "credit" ? `It was taken off invoice ${reference}.` : `${method === "mpesa" ? "M-Pesa" : method === "bank" ? "Bank" : "Cash"}${reference ? ` · ${reference}` : ""}.`,
        payload: { route: portalRoute(affiliate) },
        dedupeKey: `affiliate_payout_paid:${id}`,
      }).catch(() => {});
    }
    const how = method === "credit" ? `Taken off invoice ${reference}` : `${method === "mpesa" ? "M-Pesa" : method === "bank" ? "Bank transfer" : "Cash"}${reference ? ` · ${reference}` : ""}`;
    await emailOutsider(affiliate, "payoutPaid", { payout, how });
    return db(P).where({ id }).first();
  },

  async rejectPayout(req, id, note = null) {
    const payout = await db(P).where({ id }).first();
    if (!payout || payout.ownerAdminId !== req.ownerAdminId) fail("Payout not found", 404);
    if (payout.status !== "requested") fail("This payout has already been decided.");
    await db.transaction(async (trx) => {
      await trx(P).where({ id }).update({ status: "rejected", note: note ? String(note).slice(0, 500) : null, decidedBy: req.user.id, decidedAt: now(), updatedAt: now() });
      // Its commissions are available again.
      await trx(C).where({ payoutId: id, status: "pending" }).update({ payoutId: null, updatedAt: now() });
    });
    const affiliate = await db(A).where({ id: payout.affiliateId }).first();
    if (affiliate?.userId) {
      await NotificationService.notifyPerson(affiliate.userId, {
        type: "affiliate_payout_rejected",
        title: "About your payout request",
        message: `${ksh(payout.amount)} couldn't be paid yet${note ? ` — ${String(note).slice(0, 200)}` : ""}. It's available again.`,
        payload: { route: portalRoute(affiliate) },
        dedupeKey: `affiliate_payout_rejected:${id}`,
      }).catch(() => {});
    }
    await emailOutsider(affiliate, "payoutRejected", { payout, note });
  },

  // An outside affiliate's dashboard link: the current one (staff can copy it), emailed to them
  // with `send`, or a new one with `reset` (every older link stops working).
  async dashboardLink(req, id, { reset = false, send = false } = {}) {
    let affiliate = await affiliateInWorkspace(req, id);
    if (!isOutsider(affiliate)) fail("They have a login — they see their referrals in their portal (Refer & earn).");
    if (reset) {
      await db(A).where({ id }).update({ dashboardVersion: (affiliate.dashboardVersion || 1) + 1, updatedAt: now() });
      affiliate = await db(A).where({ id }).first();
    }
    if (send) {
      if (!affiliate.email) fail("Add their email first.");
      await Emails.dashboardLink(affiliate, { dashboardUrl: dashboardUrl(affiliate) });
    }
    return { url: dashboardUrl(affiliate), sent: Boolean(send) };
  },

  // ---- The affiliate's own view ("Refer & earn" in the parent and educator portals) -----------
  eligible(req) {
    if (req.user.role === "teacher") return "educator";
    if (isParent(req.user) && !req.user.totLearner) return "parent";
    return null;
  },

  async mine(req) {
    const kind = AffiliateService.eligible(req);
    if (!kind) fail("Refer & earn is for parents and educators.", 403);
    const affiliate = await db(A).where({ userId: req.user.id }).orderByRaw("FIELD(status, 'active', 'pending', 'suspended')").first();
    return AffiliateService._view(affiliate, kind);
  },

  // What an affiliate sees of their own: the programme, their link and code, totals, families
  // (first names only — never contact details), commissions and payouts.
  async _view(affiliate, kind) {
    const settings = await getSettings(affiliate?.ownerAdminId || env.PUBLIC_CONTENT_ADMIN_ID);
    const programme = {
      enabled: settings.enabled, selfJoin: settings.selfJoin, requireApproval: settings.requireApproval,
      offer: offerLine(settings), holdDays: settings.holdDays, minimumPayout: settings.minimumPayout,
      attributionDays: settings.attributionDays, programmes: PROGRAMMES.filter((p) => settings.programmes[p]).map((p) => PROGRAMME_LABEL[p]),
    };
    if (!affiliate) return { kind, programme, affiliate: null };
    const referrals = await db(R).where({ affiliateId: affiliate.id }).orderBy("createdAt", "desc").limit(500);
    const commissions = await withStates(await db(C).where({ affiliateId: affiliate.id }).orderBy("createdAt", "desc"));
    const payouts = await db(P).where({ affiliateId: affiliate.id }).orderBy("createdAt", "desc").limit(100);
    const refById = new Map(referrals.map((r) => [r.id, r]));
    const outsider = isOutsider(affiliate);
    return {
      kind,
      programme,
      affiliate: {
        id: affiliate.id, name: affiliate.name, code: affiliate.code, status: affiliate.status, link: linkFor(affiliate.code), payoutMethod: affiliate.payoutMethod,
        // On the no-sign-in dashboard only a hint of the number (anyone with the link could open it).
        payoutPhone: outsider ? maskPhone(affiliate.payoutPhone) : affiliate.payoutPhone,
        payoutDetails: outsider ? (affiliate.payoutDetails ? "On file" : null) : affiliate.payoutDetails,
        outsider,
      },
      totals: totals(commissions),
      referrals: referrals.map((r) => ({
        id: r.id, firstName: firstNameOf(r.customerName), programme: PROGRAMME_LABEL[r.programme], via: r.via, status: r.status, createdAt: r.createdAt,
        earned: money(commissions.filter((c) => c.referralId === r.id && c.state !== "cancelled").reduce((sum, c) => sum + c.amount, 0)),
      })),
      commissions: commissions.map((c) => ({
        id: c.id, amount: c.amount, state: c.state, availableAt: c.availableAt, createdAt: c.createdAt, periodNumber: c.periodNumber,
        firstName: firstNameOf(refById.get(c.referralId)?.customerName), programme: PROGRAMME_LABEL[refById.get(c.referralId)?.programme] || "",
      })),
      payouts: payouts.map((p) => ({ id: p.id, amount: money(p.amount), method: p.method, status: p.status, reference: p.status === "paid" ? p.reference : null, createdAt: p.createdAt, decidedAt: p.decidedAt, note: p.status === "rejected" ? p.note : null })),
    };
  },

  // ---- The website: an outside affiliate's dashboard, and applying ---------------------------
  async dashboard(token) {
    const affiliate = await affiliateForToken(token);
    if (!affiliate) fail("This link doesn't work any more — ask us for a new one.", 404);
    return AffiliateService._view(affiliate, affiliate.kind);
  },

  async requestDashboardPayout(token) {
    const affiliate = await affiliateForToken(token);
    if (!affiliate) fail("This link doesn't work any more — ask us for a new one.", 404);
    if (affiliate.payoutMethod === "mpesa" && !affiliate.payoutPhone) fail("We don't have an M-Pesa number for you yet — reply to any of our emails with it.");
    if (affiliate.payoutMethod === "bank" && !affiliate.payoutDetails) fail("We don't have your bank details yet — reply to any of our emails with them.");
    await AffiliateService._requestPayout(affiliate, { requestedBy: null, enforceMinimum: true });
    return AffiliateService._view(affiliate, affiliate.kind);
  },

  // The "Become an affiliate" page: the offer, and whether it's taking applications.
  async publicProgramme() {
    const ownerAdminId = env.PUBLIC_CONTENT_ADMIN_ID;
    const settings = await getSettings(ownerAdminId);
    return {
      open: Boolean(ownerAdminId && settings.enabled && settings.publicApplications),
      offer: offerLine(settings), holdDays: settings.holdDays, minimumPayout: settings.minimumPayout,
      attributionDays: settings.attributionDays, requireApproval: settings.requireApproval,
      programmes: PROGRAMMES.filter((p) => settings.programmes[p]).map((p) => PROGRAMME_LABEL[p]),
    };
  },

  // An application from the website. Always answers the same way, whether or not the email was
  // already an affiliate (no telling who is), and makes at most one affiliate per email.
  async apply(data) {
    const ownerAdminId = env.PUBLIC_CONTENT_ADMIN_ID;
    if (!ownerAdminId) fail("Applications aren't open yet.", 503);
    const settings = await getSettings(ownerAdminId);
    if (!settings.enabled || !settings.publicApplications) fail("We're not taking affiliate applications right now.", 403);
    const email = data.email.trim();
    const existing = await db(A).where({ ownerAdminId }).whereRaw("LOWER(email) = ?", [email.toLowerCase()]).first();
    if (existing) return { status: "received" };
    const login = await loginFor(email);
    const kind = login?.role === "teacher" ? "educator" : login?.role === "learner" && !login.username ? "parent" : "other";
    const row = {
      id: generateId(), ownerAdminId, userId: login?.id || null, name: data.name.trim().slice(0, 150), email, phone: data.phone.trim().slice(0, 40),
      kind, code: await uniqueCode(null, data.name), status: settings.requireApproval ? "pending" : "active",
      payoutMethod: data.payoutMethod, payoutPhone: data.payoutMethod === "mpesa" ? (data.payoutPhone || data.phone).trim().slice(0, 40) : null,
      payoutDetails: data.payoutMethod === "bank" ? String(data.payoutDetails || "").trim().slice(0, 500) || null : null,
      promotion: data.promotion ? String(data.promotion).slice(0, 2000) : null, source: "website", termsAcceptedAt: now(),
      dashboardVersion: 1, createdBy: null, createdAt: now(), updatedAt: now(),
    };
    await db(A).insert(row);
    if (row.status === "pending") {
      await NotificationService._notify(ownerAdminId, {
        type: "affiliate_joined",
        title: "New affiliate application",
        message: `${row.name} applied on the website to become an affiliate.`,
        payload: { route: "/affiliates?tab=affiliates" },
        dedupeKey: `affiliate_joined:${row.id}`,
        ownerAdminId,
      }).catch(() => {});
      await emailOutsider(row, "applicationReceived");
    } else {
      await emailOutsider(row, "welcome");
    }
    return { status: "received" };
  },

  async join(req, input = {}) {
    const kind = AffiliateService.eligible(req);
    if (!kind) fail("Refer & earn is for parents and educators.", 403);
    if (await db(A).where({ userId: req.user.id }).first()) fail("You've already joined.", 409);
    const ownerAdminId = env.PUBLIC_CONTENT_ADMIN_ID;
    if (!ownerAdminId) fail("The referral programme isn't set up yet.", 503);
    const settings = await getSettings(ownerAdminId);
    if (!settings.enabled || !settings.selfJoin) fail("Ask our team to add you to the referral programme.", 403);
    const user = await db("users").where({ id: req.user.id }).first("id", "name", "email", "phone");
    const name = user?.name || req.user.name || "Affiliate";
    const payoutPhone = input.payoutPhone ? String(input.payoutPhone).trim().slice(0, 40) : user?.phone || null;
    const row = {
      id: generateId(), ownerAdminId, userId: req.user.id, name, email: user?.email || null, phone: user?.phone || payoutPhone,
      kind, code: await uniqueCode(null, name), status: settings.requireApproval ? "pending" : "active",
      payoutMethod: kind === "parent" ? "credit" : "mpesa", payoutPhone, source: "portal", createdBy: req.user.id, createdAt: now(), updatedAt: now(),
    };
    await db(A).insert(row);
    if (row.status === "pending") {
      await NotificationService._notify(ownerAdminId, {
        type: "affiliate_joined",
        title: "New affiliate to approve",
        message: `${name} (${kind}) asked to join the referral programme.`,
        payload: { route: "/affiliates?tab=affiliates" },
        dedupeKey: `affiliate_joined:${row.id}`,
        ownerAdminId,
      }).catch(() => {});
    }
    return AffiliateService.mine(req);
  },

  async updateMine(req, input = {}) {
    const affiliate = await db(A).where({ userId: req.user.id }).first();
    if (!affiliate) fail("Join the referral programme first.", 404);
    const patch = {};
    if (input.payoutMethod !== undefined) {
      if (!["credit", "mpesa"].includes(input.payoutMethod) || (input.payoutMethod === "credit" && affiliate.kind !== "parent")) fail("Choose how you'd like to be paid");
      patch.payoutMethod = input.payoutMethod;
    }
    if (input.payoutPhone !== undefined) patch.payoutPhone = String(input.payoutPhone || "").trim().slice(0, 40) || null;
    if ((patch.payoutMethod || affiliate.payoutMethod) === "mpesa" && !(patch.payoutPhone ?? affiliate.payoutPhone)) fail("Enter the M-Pesa number to pay");
    if (Object.keys(patch).length) await db(A).where({ id: affiliate.id }).update({ ...patch, updatedAt: now() });
    return AffiliateService.mine(req);
  },

  async requestMyPayout(req) {
    const affiliate = await db(A).where({ userId: req.user.id }).first();
    if (!affiliate) fail("Join the referral programme first.", 404);
    if (affiliate.payoutMethod === "mpesa" && !affiliate.payoutPhone) fail("Add the M-Pesa number to pay first.");
    await AffiliateService._requestPayout(affiliate, { requestedBy: req.user.id, enforceMinimum: true });
    return AffiliateService.mine(req);
  },
};

module.exports = AffiliateService;
