const crypto = require("crypto");
const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");
const env = require("../../config/env");
const NotificationService = require("../notifications/notification.service");
const Emails = require("./affiliate.emails");
const { isParent } = require("../parent/parent.access");
const UserModel = require("../auth/user.model");
const passwords = require("../../shared/utils/password");
const { appUrl } = require("../../shared/mail/mail.layout");
const { AFFILIATE_ROLE, OWN_ONLY_ROLES, rolesOf, extraRolesOf } = require("../auth/account-roles");
const { isLeftoverLogin } = require("../auth/leftover-login");
const { adminIdsOf } = require("../../shared/utils/organisation");
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

// ---- Their login (9 Nov 2026) -----------------------------------------------------------------
// Every active affiliate signs in with a real login. A parent or an educator uses the login they
// already have, and Refer & earn in their own portal (`kind` parent / educator). Anyone else
// (`kind` other) signs in as Affiliate (account-roles.js's AFFILIATE_ROLE) to the affiliate portal
// (/affiliate-portal): a login made for them — they set its password from the welcome email — or,
// when their email already has a login (a hub's, a staff member's…), the Affiliate role added to it.
// `kind` follows the login (kindOfLogin), never typed by staff. There's no other way in: the
// private dashboard links of 6 Nov 2026 are gone.
const portalRoute = (affiliate) => (affiliate.kind === "educator" ? "/teacher-portal/refer" : affiliate.kind === "parent" ? "/parent/refer" : "/affiliate-portal");
const signsInAsAffiliate = (affiliate) => affiliate.kind === "other";
const signInUrl = () => appUrl("/login");
const accountUrl = () => appUrl("/affiliate-portal");

async function liveRole(user, role) {
  return rolesOf(user).includes(role) && !(await isLeftoverLogin({ ...user, role }));
}

// What a login makes its affiliate: an educator's or a parent's (Refer & earn in that portal), else
// an affiliate signing in as one.
async function kindOfLogin(user) {
  if (!user) return "other";
  if (await liveRole(user, "teacher")) return "educator";
  if (user.email && !user.username && (await liveRole(user, "learner"))) return "parent";
  return "other";
}

// Links the affiliate to their login — the one already linked, else the one their email has, else
// a new one (role Affiliate, an unguessable password until they set theirs from the email) — and
// gives it the Affiliate role when they aren't a parent or educator. Called when they become active
// (and by staff's "Email sign-in details"). `created` is true for a brand-new login.
async function ensureLogin(affiliate) {
  let user = affiliate.userId ? await UserModel.findById(affiliate.userId) : null;
  if (!user && affiliate.email) user = await UserModel.findByEmail(affiliate.email);
  if (user && OWN_ONLY_ROLES.includes(user.role)) fail("That email is an admin's login — an admin can't also be an affiliate. Use another email.", 409);
  let created = false;
  if (!user) {
    if (!affiliate.email) fail("Add their email first — it's what they sign in with.");
    const passwordHash = await passwords.hash(crypto.randomBytes(24).toString("hex"), 10);
    user = await UserModel.create({ name: affiliate.name, email: affiliate.email, phone: affiliate.phone || null, passwordHash, role: AFFILIATE_ROLE });
    created = true;
  }
  const kind = await kindOfLogin(user);
  if (kind === "other" && !rolesOf(user).includes(AFFILIATE_ROLE)) {
    user = await UserModel.update(user.id, { extraRoles: [...extraRolesOf(user), AFFILIATE_ROLE] });
  }
  if (affiliate.userId !== user.id || affiliate.kind !== kind) {
    await db(A).where({ id: affiliate.id }).update({ userId: user.id, kind, updatedAt: now() });
  }
  return { affiliate: { ...affiliate, userId: user.id, kind }, user, created };
}

// The login no longer used by this affiliate: it loses the Affiliate role — and goes, when that was
// all it was — unless another affiliate record still uses it.
async function releaseLogin(userId, exceptAffiliateId = null) {
  if (!userId) return;
  const q = db(A).where({ userId });
  if (exceptAffiliateId) q.whereNot({ id: exceptAffiliateId });
  if (await q.first("id")) return;
  const user = await UserModel.findById(userId);
  if (!user || !rolesOf(user).includes(AFFILIATE_ROLE)) return;
  await require("../auth/auth.service").dropRole(user, AFFILIATE_ROLE);
}

// What signing in looks like for them, for the welcome and "sign-in details" emails: a new login
// gets a one-time "set your password" link (7 days, only ever emailed to them).
async function signInFor(user, { created }) {
  const setPassword = created ? await require("../auth/auth.service").passwordSetLink(user) : null;
  return { email: user.email, signInUrl: signInUrl(), setPasswordUrl: setPassword?.url || null, setPasswordExpiresAt: setPassword?.expiresAt || null };
}

// An affiliate became active (added active, approved, applied with no approval needed): their login,
// then a welcome — an email with how to sign in for someone signing in as Affiliate, the bell for a
// parent or educator (Refer & earn is already in their portal). Sent once per affiliate.
async function welcome(affiliate) {
  const { affiliate: a, user, created } = await ensureLogin(affiliate);
  if (signsInAsAffiliate(a)) {
    const settings = await getSettings(a.ownerAdminId);
    await Emails.welcome({ ...a, email: user.email }, { link: linkFor(a.code), offer: offerLine(settings), account: await signInFor(user, { created }) });
  }
  await NotificationService.notifyPerson(user.id, {
    type: "affiliate_approved",
    title: "You're in the referral programme",
    message: `Share your link or code ${a.code} — you earn when the families you refer pay.`,
    payload: { route: portalRoute(a) },
    dedupeKey: `affiliate_approved:${a.id}`,
  }).catch(() => {});
  return a;
}

// News for an affiliate who signs in as Affiliate (a family signed up, they earned, a payout), by
// email as well as the bell, when the workspace sends them (Settings). Parents and educators get the
// bell only.
async function emailAffiliate(affiliate, kind, payload = {}) {
  try {
    if (!affiliate?.email || !signsInAsAffiliate(affiliate)) return;
    const settings = await getSettings(affiliate.ownerAdminId);
    if (!settings.emailOutsiders) return;
    await Emails[kind](affiliate, { ...payload, accountUrl: accountUrl(), link: linkFor(affiliate.code), offer: offerLine(settings) });
  } catch (err) {
    console.error("[affiliates] could not email an affiliate:", err.message);
  }
}

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

// `account`: how they sign in — the login's email, whether they sign in as Affiliate (else in their
// parent / educator portal), and when they last signed in (null: never yet).
const shapeAffiliate = (a, login = null) => ({
  ...a,
  link: linkFor(a.code),
  account: a.userId
    ? { email: login?.email || a.email, asAffiliate: signsInAsAffiliate(a), lastSignInAt: login?.lastSignInAt || null }
    : null,
});

// Logins (looked up separately — newer collation, no joins) with their last sign-in from the
// Activity log, by user id.
async function loginsById(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await db("users").whereIn("id", ids).select("id", "email");
  const last = await db("audit_log").whereIn("actorUserId", ids).where({ action: "login" })
    .groupBy("actorUserId").select("actorUserId").max({ at: "createdAt" });
  const lastBy = new Map(last.map((r) => [r.actorUserId, r.at]));
  return new Map(users.map((u) => [u.id, { email: u.email, lastSignInAt: lastBy.get(u.id) || null }]));
}

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
  // `kind` isn't typed in — it follows their login (kindOfLogin).
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

// The login an email already belongs to, linked while an affiliate waits for approval (so a parent
// or educator sees "waiting" in their Refer & earn). Never an admin's.
async function loginFor(email) {
  if (!email) return null;
  const user = await UserModel.findByEmail(email);
  return user && !OWN_ONLY_ROLES.includes(user.role) ? user : null;
}

// ---- People already on Digifunzi (10 Nov 2026) -----------------------------------------------------
// Staff add an affiliate by picking someone who already has a login instead of typing them in: they
// keep signing in with their own email and password. Only people tied to this workspace are found —
// parents of its learners (by guardian email, never a child's username login), its educators, its
// hubs' own logins and its staff — never an admin, never another workspace's people.
const lowerKey = (v) => String(v || "").trim().toLowerCase();

// What each of these logins is to the workspace: Map userId → { kind, detail }. Logins not tied to it
// are left out.
async function workspaceTiesOf(ownerAdminId, users) {
  const ties = new Map();
  if (!users.length) return ties;
  const owners = [...new Set([ownerAdminId, ...(await adminIdsOf(ownerAdminId))])];
  const hubs = await db("learning_hubs").where({ ownerAdminId }).select("id", "name", "email");
  const hubIds = hubs.map((h) => h.id);
  const emails = [...new Set(users.map((u) => lowerKey(u.email)).filter(Boolean))];
  if (!emails.length) return ties;

  const [teachers, children] = await Promise.all([
    db("teachers").whereIn(db.raw("LOWER(email)"), emails)
      .where((w) => {
        w.whereIn("createdByAdminId", owners);
        if (hubIds.length) w.orWhereIn("id", db("teacher_hub_links").whereIn("hubId", hubIds).select("teacherId"));
      })
      .select("email"),
    hubIds.length
      ? db("learners").whereIn(db.raw("LOWER(guardianEmail)"), emails).whereNull("teacherId")
        .whereIn("id", db("learner_hub_links").whereIn("hubId", hubIds).select("learnerId"))
        .select("guardianEmail", "firstName")
      : [],
  ]);
  const educatorEmails = new Set(teachers.map((t) => lowerKey(t.email)));
  const childrenOf = new Map();
  for (const c of children) {
    const key = lowerKey(c.guardianEmail);
    childrenOf.set(key, [...(childrenOf.get(key) || []), c.firstName].filter(Boolean));
  }
  const hubOfEmail = new Map(hubs.filter((h) => h.email).map((h) => [lowerKey(h.email), h.name]));

  for (const u of users) {
    if (u.username || OWN_ONLY_ROLES.includes(u.role)) continue;
    const key = lowerKey(u.email);
    const roles = rolesOf(u);
    const details = [];
    if (roles.includes("teacher") && educatorEmails.has(key)) details.push("Educator");
    if (roles.includes("learner") && childrenOf.has(key)) details.push(`Parent of ${[...new Set(childrenOf.get(key))].slice(0, 3).join(", ") || "a learner"}`);
    if (roles.includes("school") && hubOfEmail.has(key)) details.push(`${hubOfEmail.get(key)} (hub login)`);
    if (roles.includes("collaborator") && owners.includes(u.invitedByAdminId)) details.push("Staff");
    if (roles.includes(AFFILIATE_ROLE) && !details.length) {
      // Someone signing in only as Affiliate — tied to us when they're (or were) our affiliate.
      if (await db(A).where({ ownerAdminId, userId: u.id }).first("id")) details.push("Affiliate");
    }
    if (details.length) ties.set(u.id, { kind: await kindOfLogin(u), detail: details.join(" · ") });
  }
  return ties;
}

const AffiliateService = {
  getSettings,

  // Staff's search for someone already on Digifunzi to make an affiliate: by name, email or phone,
  // only this workspace's people (workspaceTiesOf), each saying whether they're already one.
  async searchPeople(req, q) {
    const term = String(q || "").trim();
    if (term.length < 2) return [];
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const users = await db("users")
      .whereNull("deactivatedAt").whereNull("username").whereNotNull("email")
      .whereNotIn("role", OWN_ONLY_ROLES)
      .where((w) => w.where("name", "like", like).orWhere("email", "like", like).orWhere("phone", "like", like))
      .orderBy("name", "asc").limit(60)
      .select("id", "name", "email", "phone", "role", "extraRoles", "username", "invitedByAdminId");
    const ties = await workspaceTiesOf(req.ownerAdminId, users);
    const found = users.filter((u) => ties.has(u.id)).slice(0, 15);
    const taken = found.length
      ? new Set((await db(A).where({ ownerAdminId: req.ownerAdminId }).whereIn("userId", found.map((u) => u.id)).pluck("userId")))
      : new Set();
    return found.map((u) => ({
      userId: u.id, name: u.name || u.email, email: u.email, phone: u.phone || null,
      kind: ties.get(u.id).kind, detail: ties.get(u.id).detail, alreadyAffiliate: taken.has(u.id),
    }));
  },
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
      await emailAffiliate(affiliate, "referral", { referral, programme: PROGRAMME_LABEL[programme] });
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
    await emailAffiliate(affiliate, "commission", { commission: row, referral, programme: PROGRAMME_LABEL[referral.programme] });
    return row;
  },

  // ---- Admin: affiliates ----------------------------------------------------------------------
  async listAffiliates(req) {
    const affiliates = await db(A).where({ ownerAdminId: req.ownerAdminId }).orderBy("createdAt", "desc");
    const commissions = await withStates(await db(C).where({ ownerAdminId: req.ownerAdminId }));
    const referrals = await db(R).where({ ownerAdminId: req.ownerAdminId }).select("affiliateId", "status");
    const logins = await loginsById(affiliates.map((a) => a.userId));
    return affiliates.map((a) => {
      const own = referrals.filter((r) => r.affiliateId === a.id);
      return {
        ...shapeAffiliate(a, logins.get(a.userId)),
        referrals: own.length,
        paidReferrals: own.filter((r) => r.status === "paid").length,
        totals: totals(commissions.filter((c) => c.affiliateId === a.id)),
      };
    });
  },

  // Added by staff. Their email is required — it's their sign-in. Active (the default): their login
  // is linked or made and they're welcomed (welcome()); waiting for approval: an existing login is
  // only linked.
  async createAffiliate(req, input) {
    // Someone already on Digifunzi, picked from the search: their own name, email and phone.
    if (input.userId) {
      const picked = await UserModel.findById(input.userId);
      if (!picked || !(await workspaceTiesOf(req.ownerAdminId, [picked])).has(picked.id)) fail("That person isn't one of this workspace's people — search again.", 404);
      input = { ...input, name: picked.name || picked.email, email: picked.email, phone: input.phone || picked.phone || null };
    }
    const data = cleanAffiliateInput(input);
    if (!data.email) fail("Enter their email — it's what they sign in with.");
    const code = await uniqueCode(input.code, data.name);
    await assertCodeFree(code);
    const existing = await UserModel.findByEmail(data.email);
    if (existing && OWN_ONLY_ROLES.includes(existing.role)) fail("That email is an admin's login — an admin can't also be an affiliate. Use another email.", 409);
    const duplicate = await db(A).where({ ownerAdminId: req.ownerAdminId })
      .andWhere((q) => { q.whereRaw("LOWER(email) = ?", [data.email.toLowerCase()]); if (existing) q.orWhere({ userId: existing.id }); })
      .first("id");
    if (duplicate) fail("That person is already an affiliate.", 409);
    const kind = await kindOfLogin(existing);
    const row = {
      id: generateId(), ownerAdminId: req.ownerAdminId, userId: existing?.id || null,
      name: data.name, email: data.email, phone: data.phone || null, kind, code,
      status: data.status || "active",
      payoutMethod: data.payoutMethod || (kind === "parent" ? "credit" : "mpesa"),
      payoutPhone: data.payoutPhone || data.phone || null, payoutDetails: data.payoutDetails || null,
      notes: data.notes || null, source: "admin", createdBy: req.user.id, createdAt: now(), updatedAt: now(),
    };
    await db(A).insert(row);
    let saved = row;
    if (row.status === "active") {
      try {
        saved = await welcome(row);
      } catch (err) {
        // No login could be set up: nothing is kept, so adding them again works.
        await db(A).where({ id: row.id }).del();
        throw err;
      }
    }
    return shapeAffiliate(saved, (await loginsById([saved.userId])).get(saved.userId));
  },

  // A changed email: an affiliate's own Affiliate login (nothing else) changes its email with it;
  // a login that's also someone's parent / educator / hub login stays theirs, and the affiliate
  // moves to the new email's login (or a new one). Becoming active — approved, reactivated, or an
  // affiliate still without a login — links / makes the login and welcomes them (once per login).
  async updateAffiliate(req, id, input) {
    const affiliate = await affiliateInWorkspace(req, id);
    const data = cleanAffiliateInput(input, { partial: true });
    if (input.code !== undefined) {
      data.code = normaliseCode(input.code);
      if (!data.code) fail("A code is 4–20 letters and numbers, e.g. AMINA24");
      await assertCodeFree(data.code, id);
    }
    if (data.email !== undefined && !data.email) fail("Enter their email — it's what they sign in with.");
    const emailChanged = data.email !== undefined && emailKey(data.email) !== emailKey(affiliate.email);
    const login = affiliate.userId ? await UserModel.findById(affiliate.userId) : null;
    const ownLogin = Boolean(login && login.role === AFFILIATE_ROLE && rolesOf(login).length === 1);
    let releaseOld = null;
    if (emailChanged) {
      const taken = await UserModel.findByEmail(data.email);
      if (taken && OWN_ONLY_ROLES.includes(taken.role)) fail("That email is an admin's login — an admin can't also be an affiliate. Use another email.", 409);
      if (ownLogin) {
        if (taken && taken.id !== login.id) fail("That email already has a Digifunzi login of its own — use another, or delete this affiliate and add them again with it.", 409);
        await UserModel.update(login.id, { email: data.email });
      } else if (login) {
        data.userId = (await loginFor(data.email))?.id || null;
        releaseOld = login.id;
      } else {
        data.userId = (await loginFor(data.email))?.id || null;
      }
    }
    // Their own login carries their name and phone too.
    if (ownLogin && (data.name !== undefined || data.phone !== undefined)) {
      await UserModel.update(login.id, { ...(data.name ? { name: data.name } : {}), ...(data.phone !== undefined ? { phone: data.phone } : {}) });
    }
    await db(A).where({ id }).update({ ...data, updatedAt: now() });
    if (releaseOld) await releaseLogin(releaseOld, id);
    let updated = await db(A).where({ id }).first();
    if (updated.status === "active" && (affiliate.status !== "active" || !updated.userId || emailChanged)) updated = await welcome(updated);
    return shapeAffiliate(updated, (await loginsById([updated.userId])).get(updated.userId));
  },

  // Only an affiliate with no referrals can be deleted; otherwise suspend them (their history stays).
  // Their Affiliate sign-in goes with them (the login too, when that's all it was).
  async deleteAffiliate(req, id) {
    const affiliate = await affiliateInWorkspace(req, id);
    if (await db(R).where({ affiliateId: id }).first()) {
      fail("This affiliate has referrals, so their history is kept — suspend them instead.", 409);
    }
    await db(A).where({ id }).del();
    await releaseLogin(affiliate.userId);
  },

  // Staff's "Email sign-in details": emails an affiliate who signs in as Affiliate how to sign in,
  // with a one-time link to set (or reset) their password — only ever to the login's own address,
  // never shown to staff. Makes their login first if they have none. A parent or educator signs in
  // with their own login; for them it explains rather than emails.
  async sendSignInDetails(req, id) {
    const found = await affiliateInWorkspace(req, id);
    if (found.status === "pending") fail("Approve them first — their account is made when they're approved.");
    const { affiliate, user } = await ensureLogin(found);
    if (!signsInAsAffiliate(affiliate)) {
      fail(`They sign in with their own ${affiliate.kind} login (${user.email}) — Refer & earn is in their portal. If they've forgotten the password, "Forgot password?" on the sign-in page emails them a link.`);
    }
    await Emails.signInDetails({ ...affiliate, email: user.email }, { account: await signInFor(user, { created: true }) });
    return { sent: true, email: user.email };
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
    await emailAffiliate(affiliate, "payoutPaid", { payout, how });
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
    await emailAffiliate(affiliate, "payoutRejected", { payout, note });
  },

  // ---- The affiliate's own view: "Refer & earn" in the parent and educator portals, and the ------
  // affiliate portal for everyone else (signed in as Affiliate).
  eligible(req) {
    if (req.user.role === "teacher") return "educator";
    if (isParent(req.user) && !req.user.totLearner) return "parent";
    if (req.user.role === AFFILIATE_ROLE) return "other";
    return null;
  },

  async mine(req) {
    const kind = AffiliateService.eligible(req);
    if (!kind) fail("Refer & earn is for parents, educators and affiliates.", 403);
    const affiliate = await db(A).where({ userId: req.user.id }).orderByRaw("FIELD(status, 'active', 'pending', 'suspended')").first();
    return AffiliateService._view(affiliate, kind);
  },

  // What an affiliate sees of their own: the programme, their link and code, totals, families
  // (first names only — never contact details), commissions and payouts, and their own details.
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
    return {
      kind,
      programme,
      affiliate: {
        id: affiliate.id, name: affiliate.name, email: affiliate.email, phone: affiliate.phone, code: affiliate.code, status: affiliate.status,
        link: linkFor(affiliate.code), payoutMethod: affiliate.payoutMethod, payoutPhone: affiliate.payoutPhone, payoutDetails: affiliate.payoutDetails,
        termsAcceptedAt: affiliate.termsAcceptedAt || null, createdAt: affiliate.createdAt,
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

  // ---- The website: applying ---------------------------------------------------------------------
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
    const row = {
      id: generateId(), ownerAdminId, userId: login?.id || null, name: data.name.trim().slice(0, 150), email, phone: data.phone.trim().slice(0, 40),
      kind: await kindOfLogin(login), code: await uniqueCode(null, data.name), status: settings.requireApproval ? "pending" : "active",
      payoutMethod: data.payoutMethod, payoutPhone: data.payoutMethod === "mpesa" ? (data.payoutPhone || data.phone).trim().slice(0, 40) : null,
      payoutDetails: data.payoutMethod === "bank" ? String(data.payoutDetails || "").trim().slice(0, 500) || null : null,
      promotion: data.promotion ? String(data.promotion).slice(0, 2000) : null, source: "website", termsAcceptedAt: now(),
      createdBy: null, createdAt: now(), updatedAt: now(),
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
      await Emails.applicationReceived(row);
    } else {
      // No approval needed: their account straight away (an admin's email can't be one — staff
      // see them without a login and can change the email).
      await welcome(row).catch((err) => console.error("[affiliates] could not set up an applicant's login:", err.message));
    }
    return { status: "received" };
  },

  // A parent or educator joining from their own portal. (Signed in as Affiliate, they already are one.)
  async join(req, input = {}) {
    const kind = AffiliateService.eligible(req);
    if (!kind || kind === "other") fail("Refer & earn is for parents and educators.", 403);
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

  // Their own details: how they're paid (parents may take it off their invoices; anyone by M-Pesa or
  // bank), and — signed in as Affiliate, where the affiliate record is all there is — their name and
  // phone, kept on their login too.
  async updateMine(req, input = {}) {
    const affiliate = await db(A).where({ userId: req.user.id }).orderByRaw("FIELD(status, 'active', 'pending', 'suspended')").first();
    if (!affiliate) fail("Join the referral programme first.", 404);
    const text = (v, max) => String(v || "").trim().slice(0, max) || null;
    const patch = {};
    if (input.payoutMethod !== undefined) {
      if (!["credit", "mpesa", "bank"].includes(input.payoutMethod) || (input.payoutMethod === "credit" && affiliate.kind !== "parent")) fail("Choose how you'd like to be paid");
      patch.payoutMethod = input.payoutMethod;
    }
    if (input.payoutPhone !== undefined) patch.payoutPhone = text(input.payoutPhone, 40);
    if (input.payoutDetails !== undefined) patch.payoutDetails = text(input.payoutDetails, 500);
    const method = patch.payoutMethod || affiliate.payoutMethod;
    if (method === "mpesa" && !(patch.payoutPhone !== undefined ? patch.payoutPhone : affiliate.payoutPhone)) fail("Enter the M-Pesa number to pay");
    if (method === "bank" && !(patch.payoutDetails !== undefined ? patch.payoutDetails : affiliate.payoutDetails)) fail("Enter your bank, account name and number");
    const asAffiliate = req.user.role === AFFILIATE_ROLE;
    if (asAffiliate && input.name !== undefined) {
      patch.name = text(input.name, 150);
      if (!patch.name || patch.name.length < 2) fail("Enter your name");
    }
    if (asAffiliate && input.phone !== undefined) patch.phone = text(input.phone, 40);
    if (Object.keys(patch).length) await db(A).where({ id: affiliate.id }).update({ ...patch, updatedAt: now() });
    if (asAffiliate && (patch.name || patch.phone !== undefined)) {
      await UserModel.update(req.user.id, { ...(patch.name ? { name: patch.name } : {}), ...(patch.phone !== undefined ? { phone: patch.phone } : {}) });
    }
    return AffiliateService.mine(req);
  },

  async requestMyPayout(req) {
    const affiliate = await db(A).where({ userId: req.user.id }).orderByRaw("FIELD(status, 'active', 'pending', 'suspended')").first();
    if (!affiliate) fail("Join the referral programme first.", 404);
    if (affiliate.payoutMethod === "mpesa" && !affiliate.payoutPhone) fail("Add the M-Pesa number to pay first.");
    if (affiliate.payoutMethod === "bank" && !affiliate.payoutDetails) fail("Add your bank details first.");
    await AffiliateService._requestPayout(affiliate, { requestedBy: req.user.id, enforceMinimum: true });
    return AffiliateService.mine(req);
  },
};

module.exports = AffiliateService;
