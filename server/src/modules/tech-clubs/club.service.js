const db = require("../../config/db");
const ClubMembershipModel = require("./club.model");
const ClubPackageModel = require("./club-package.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearnerService = require("../learners/learner.service");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const ClassModel = require("../classes/class.model");
const UserModel = require("../auth/user.model");
const BillingModel = require("../billing/billing.model");
const { packageSchema, packageClubsSchema, membershipUpdateSchema, placeChildSchema, invoiceSchema } = require("./club.validation");
const { priceForPackage, toPublicPackage, CURRENCY } = require("../home-learning/home-learning.pricing");
const { kenyaToday } = require("../../shared/utils/age");
const { scheduleChange, onActivation } = require("../../shared/utils/billing-periods");
const PackageBilling = require("../billing/package-billing");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");
const { slugify } = require("../../shared/utils/slugify");
const { classLabel } = require("./club.model");

// Estate Tech Clubs: a family's membership of one club (a non-school learning hub), sold on a
// package and billed every period (day, week, month, quarter or year — billing/package-billing.js) — the club counterpart of Home Learning's households. Each child in
// a membership is an ordinary learner; once an admin places them in one of the club's classes
// they get an ordinary learner_hub_links row there, so attendance, assessments, reports and the
// learner portal all work through the existing class-based code with no club special cases.
// club_membership_children stays the record of the membership side (which family, which
// placement, active/removed) and is what a child's hub link is kept in line with.
//
// Pricing reuses Home Learning's rules (home-learning.pricing.js): a package's amount per period
// covers childrenIncluded children, extra children (when allowed) cost extraChildAmount each.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function parseOrFail(schema, input, fallback) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail(parsed.error.issues[0]?.message || fallback);
  return parsed.data;
}

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const OPEN_STATUSES = ["issued", "partially_paid", "overdue"];
const childrenLabel = (n) => `${n} ${Number(n) === 1 ? "child" : "children"}`;

// The clubs an admin runs: every one of their non-school learning hubs (the website's Estate Tech
// Clubs page lists the same ones, active only).
async function ownClubs(ownerAdminId) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true });
  return hubs.filter((h) => h.hubType !== "school" && !h.isHomeLearning);
}

async function assertOwnClub(ownerAdminId, hubId) {
  const hub = await LearningHubModel.findById(hubId);
  if (!hub || hub.ownerAdminId !== ownerAdminId || hub.hubType === "school" || hub.isHomeLearning) fail("Club not found", 404);
  return hub;
}

async function cleanHubIds(ownerAdminId, hubIds) {
  if (!hubIds.length) return [];
  const own = new Set((await ownClubs(ownerAdminId)).map((h) => h.id));
  const kept = [...new Set(hubIds)].filter((id) => own.has(id));
  if (kept.length !== new Set(hubIds).size) fail("Choose clubs from your own learning hubs");
  return kept;
}

// Normalises a validated package form into a row (same rules as Home Learning's packageRow).
function packageRow(data, hubIds) {
  const extras = data.allowExtraChildren;
  return {
    name: data.name,
    summary: data.summary || null,
    description: data.description || null,
    childrenIncluded: data.childrenIncluded,
    amount: data.amount,
    billingPeriod: data.billingPeriod,
    allowExtraChildren: extras,
    extraChildAmount: extras ? data.extraChildAmount : null,
    maxChildren: extras ? (data.maxChildren ?? Math.max(data.childrenIncluded + 1, 20)) : data.childrenIncluded,
    features: data.features,
    badge: data.badge || null,
    hubIds,
    isPublished: data.status === "archived" ? false : data.isPublished,
    status: data.status,
    sortOrder: data.sortOrder,
  };
}

async function uniqueSlug(ownerAdminId, wanted, excludeId) {
  const base = slugify(wanted) || "package";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await ClubPackageModel.findBySlug(slug, ownerAdminId);
    if (!clash || clash.id === excludeId) return slug;
  }
}

// Resolves a membership's package and what it costs for `requested` children. `currentPackageId`
// lets a membership keep (and re-price on) a package that has since been archived.
async function resolvePackagePrice(ownerAdminId, packageId, requested, hubId, currentPackageId = null) {
  const pkg = await ClubPackageModel.findById(packageId, ownerAdminId);
  if (!pkg || (pkg.status !== "active" && pkg.id !== currentPackageId)) fail("Package not found", 404);
  if (pkg.id !== currentPackageId && !ClubPackageModel.offeredAt(pkg, hubId)) fail(`${pkg.name} isn't offered at this club`);
  const price = priceForPackage(pkg, requested);
  if (!price) {
    fail(pkg.allowExtraChildren
      ? `${pkg.name} takes up to ${pkg.maxChildren} children`
      : `${pkg.name} covers ${childrenLabel(pkg.childrenIncluded)} — choose a larger package for more`);
  }
  return { packageId: pkg.id, ...price };
}

// Brings a child's hub link at the club in line with their membership row: in their class and
// active only while the child is active, placed, and the membership itself is active. Otherwise
// the link (if any) is kept but taken out of the class and marked inactive — many places read
// class rosters without looking at link status, so an inactive member mustn't keep a classId.
// A link is never created for a child who isn't going into a class (enrollInHub without a class
// would drop them into the club's first class).
async function applyChildLink(membership, child) {
  const link = await LearnerHubLinkModel.findOne(child.learnerId, membership.hubId);
  const inClass = membership.status === "active" && child.status === "active" && !!child.classId;
  if (inClass) {
    if (!link) await LearnerService.enrollInHub(child.learnerId, { hubId: membership.hubId, classId: child.classId, status: "active" });
    else if (link.classId !== child.classId || link.status !== "active") await LearnerService.updateEnrollment(child.learnerId, membership.hubId, { classId: child.classId, status: "active" });
    return;
  }
  if (link && (link.classId || link.status === "active")) await LearnerHubLinkModel.update(link.id, { classId: null, status: "inactive" });
}

async function syncMembershipChildren(membership) {
  for (const child of await ClubMembershipModel.findChildren(membership.id, membership.ownerAdminId)) {
    await applyChildLink(membership, child);
  }
}

// Per-membership billing snapshot for the admin list: what's owed, whether any of it is overdue,
// and the most recent invoices (newest first).
async function billingSummaries(membershipIds) {
  if (!membershipIds.length) return new Map();
  const invoices = await db("billing_invoices")
    .whereIn("clubMembershipId", membershipIds)
    .whereNotIn("status", ["draft", "cancelled", "void"])
    .orderBy("periodStart", "desc");
  const today = new Date().toISOString().slice(0, 10);
  return new Map(membershipIds.map((id) => {
    const own = invoices.filter((inv) => inv.clubMembershipId === id);
    const open = own.filter((inv) => OPEN_STATUSES.includes(inv.status));
    return [id, {
      outstanding: money(open.reduce((sum, inv) => sum + Number(inv.total) - Number(inv.amountPaid), 0)),
      overdue: open.some((inv) => inv.status === "overdue" || (inv.dueAt && new Date(inv.dueAt).toISOString().slice(0, 10) < today)),
      invoices: own.slice(0, 6).map((inv) => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, periodLabel: inv.periodLabel,
        periodStart: inv.periodStart, total: money(inv.total), amountPaid: money(inv.amountPaid), dueAt: inv.dueAt,
      })),
    }];
  }));
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

// Creates one membership's invoice (issued) for one billing period, issued by the club to the
// parent — shared by the automatic invoicing (billing/package-billing.js), "Invoice next period"
// and a website sign-up's first invoice. A daily package's is `quantity` days at `unitAmount`
// each. Callers check eligibility (status, duplicates).
async function raiseMembershipInvoice(membership, { periodStart, periodEnd, label, dueDate, quantity = 1, unitAmount = membership.amount, unit = null }, actorUserId) {
  const hub = await LearningHubModel.findById(membership.hubId);
  const payer = membership.guardianEmail ? await UserModel.findByEmail(membership.guardianEmail) : null;
  const amount = money(Number(unitAmount) * quantity);
  const clubName = hub?.name || "Tech Club";
  const what = unit === "day" ? `${quantity} ${quantity === 1 ? "day" : "days"}, ${label}` : label;
  const invoice = await BillingModel.transaction(async (trx) => {
    const created = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: membership.hubId,
      payerUserId: payer?.role === "learner" ? payer.id : null, payerHubId: null,
      learnerId: null, hubId: membership.hubId, clubMembershipId: membership.id, invoiceType: "tech_club", status: "issued",
      currency: CURRENCY, subtotal: amount, discount: 0, total: amount, amountPaid: 0,
      periodStart, periodEnd, periodLabel: `Tech Club · ${label}`,
      issuedAt: new Date(), dueAt: dueDate ? new Date(`${dueDate}T00:00:00`) : null, notes: null,
    }, trx);
    await BillingModel.createItem({
      invoiceId: created.id, learnerId: null, courseId: null,
      description: `${clubName} membership (${childrenLabel(membership.childCount)}) — ${what}`,
      quantity, unitAmount: money(unitAmount), totalAmount: amount,
      metadata: { clubMembershipId: membership.id, packageId: membership.packageId, childCount: membership.childCount },
    }, trx);
    await BillingModel.createAuditEvent({
      invoiceId: created.id, actorUserId, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "tech_club" },
    }, trx);
    return created;
  });
  // Emailed to the parent — lazy require, billing.service.js isn't needed at load time.
  require("../billing/billing.service").emailIssuedInvoice(invoice.id);
  return invoice;
}

const ClubService = {
  /* ── Packages (Billing → Packages → Tech Clubs) ───────────────────────────── */

  async listPackages(ownerAdminId) {
    const packages = await ClubPackageModel.findAll(ownerAdminId);
    return Promise.all(packages.map(async (pkg) => ({ ...pkg, membershipCount: await ClubPackageModel.countMemberships(pkg.id) })));
  },

  async createPackage(ownerAdminId, input) {
    const data = parseOrFail(packageSchema, input, "Invalid package details");
    const { hubIds } = parseOrFail(packageClubsSchema, input, "Invalid clubs");
    const slug = await uniqueSlug(ownerAdminId, data.slug || data.name);
    return ClubPackageModel.create({ ownerAdminId, slug, ...packageRow(data, await cleanHubIds(ownerAdminId, hubIds)) });
  },

  // Price edits apply to new sign-ups (and to a membership when it's next re-priced). Existing
  // memberships keep the monthly amount they signed up at.
  async updatePackage(ownerAdminId, id, input) {
    const existing = await ClubPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Package not found", 404);
    const data = parseOrFail(packageSchema, input, "Invalid package details");
    const { hubIds } = parseOrFail(packageClubsSchema, input, "Invalid clubs");
    const slug = data.slug && data.slug !== existing.slug ? await uniqueSlug(ownerAdminId, data.slug, id) : existing.slug;
    return ClubPackageModel.update(id, { slug, ...packageRow(data, await cleanHubIds(ownerAdminId, hubIds)) });
  },

  async deletePackage(ownerAdminId, id) {
    const existing = await ClubPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Package not found", 404);
    if (await ClubPackageModel.countMemberships(id)) fail("Families are on this package — archive it instead so it stops being offered", 409);
    await ClubPackageModel.delete(id);
    return { deleted: true };
  },

  // The website's club pages: the designated public-content admin's published, active packages,
  // marketing fields only, each with the clubs it's offered at (empty = every club). Only
  // clubs the website lists (active, non-school) are named.
  async listPublicPackages() {
    const ownerAdminId = requirePublicContentAdminId();
    const publicClubIds = new Set((await ownClubs(ownerAdminId)).filter((h) => h.status === "active").map((h) => h.id));
    return (await ClubPackageModel.findAll(ownerAdminId, { publishedOnly: true }))
      .map((pkg) => ({ ...toPublicPackage(pkg), hubIds: pkg.hubIds.filter((id) => publicClubIds.has(id)), allClubs: !pkg.hubIds.length }))
      // A package limited to clubs that are no longer listed is offered nowhere.
      .filter((pkg) => pkg.allClubs || pkg.hubIds.length);
  },

  /* ── Clubs + memberships (admin Tech Clubs page) ──────────────────────────── */

  // The admin's clubs, each with its classes — the page's club filter and the "Place child" picker.
  async listClubs(ownerAdminId) {
    const clubs = await ownClubs(ownerAdminId);
    return Promise.all(clubs.map(async (hub) => {
      const classes = await ClassModel.findAll({ schoolId: hub.id });
      return {
        id: hub.id, name: hub.name, hubType: hub.hubType, status: hub.status,
        classes: classes.map((cls) => ({ id: cls.id, name: classLabel(cls), status: cls.status, academicYear: cls.academicYear })),
      };
    }));
  },

  async list(ownerAdminId, { hubId } = {}) {
    const memberships = await ClubMembershipModel.findAll(ownerAdminId, { hubId: hubId || undefined });
    const billing = await billingSummaries(memberships.map((m) => m.id));
    const packages = new Map((await ClubPackageModel.findAll(ownerAdminId)).map((pkg) => [pkg.id, pkg]));
    const hubs = new Map((await ownClubs(ownerAdminId)).map((h) => [h.id, h]));
    return memberships.map((membership) => {
      const pkg = packages.get(membership.packageId);
      const hub = hubs.get(membership.hubId);
      return {
        ...membership,
        club: hub ? { id: hub.id, name: hub.name } : null,
        package: pkg ? { id: pkg.id, name: pkg.name, status: pkg.status } : null,
        billing: { ...billing.get(membership.id), outlook: PackageBilling.billingOutlook(membership) },
      };
    });
  },

  async update(ownerAdminId, id, input) {
    const updates = parseOrFail(membershipUpdateSchema, input, "Invalid membership details");
    const existing = await ClubMembershipModel.findById(id, ownerAdminId);
    if (!existing) fail("Membership not found", 404);
    // A website sign-up is activated by "Approve payment" (club-signup.service.js), which records
    // the payment and unlocks the family's logins — not by flipping the status with nothing paid.
    if (existing.status === "pending" && updates.status === "active" && existing.signupInvoiceId) {
      const signupInvoice = await db("billing_invoices").where({ id: existing.signupInvoiceId }).first();
      if (signupInvoice && Number(signupInvoice.amountPaid) === 0 && signupInvoice.status !== "cancelled") {
        fail("This family signed up on the website — use Approve payment to record their payment and activate them");
      }
    }
    if (updates.packageId !== undefined || updates.childCount !== undefined) {
      const packageId = updates.packageId ?? existing.packageId;
      if (!packageId) fail("Choose a package for this membership");
      const { amount, billingPeriod, ...place } = await resolvePackagePrice(ownerAdminId, packageId, updates.childCount ?? existing.childCount, existing.hubId, existing.packageId);
      if ((await ClubMembershipModel.countActiveChildren(id, ownerAdminId)) > place.childCount) fail("Remove children before reducing the package size");
      // The places change now; the price and period from the next period not billed yet.
      Object.assign(updates, place, scheduleChange(existing, { amount, billingPeriod }));
    }
    if (updates.status === "active" && existing.status !== "active") {
      Object.assign(updates, onActivation(existing, { today: kenyaToday() }));
    }
    if (updates.notes === "") updates.notes = null;
    const membership = await ClubMembershipModel.update(id, ownerAdminId, updates);
    if (updates.status !== undefined && updates.status !== existing.status) await syncMembershipChildren(membership);
    return membership;
  },

  // Places a child in one of the club's classes (or moves them to another). While the membership
  // is still awaiting payment the placement is only recorded; it takes effect on approval.
  async placeChild(ownerAdminId, membershipId, learnerId, input) {
    const { classId } = parseOrFail(placeChildSchema, input, "Choose a class");
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    const child = await ClubMembershipModel.findChild(membershipId, learnerId, ownerAdminId);
    if (!child) fail("This child is not in this membership", 404);
    if (child.status !== "active") fail("Add this child back to the membership before placing them");
    let cls = null;
    if (classId) {
      cls = await ClassModel.findById(classId);
      if (!cls || cls.schoolId !== membership.hubId) fail("Choose a class at this club");
    }
    const updated = await ClubMembershipModel.updateChild(child.id, { classId: cls?.id || null });
    await applyChildLink(membership, updated);
    return updated;
  },

  // Soft removal: the child row is kept as "removed" and their hub link (if any) is taken out of
  // the class, so they stay in the workspace and can be added back.
  async removeChild(ownerAdminId, membershipId, learnerId) {
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    const child = await ClubMembershipModel.findChild(membershipId, learnerId, ownerAdminId);
    if (!child) fail("This child is not in this membership", 404);
    const updated = await ClubMembershipModel.updateChild(child.id, { status: "removed" });
    await applyChildLink(membership, updated);
    return { removed: true };
  },

  async restoreChild(ownerAdminId, membershipId, learnerId) {
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    const child = await ClubMembershipModel.findChild(membershipId, learnerId, ownerAdminId);
    if (!child) fail("This child is not in this membership", 404);
    if (child.status === "active") return child;
    if ((await ClubMembershipModel.countActiveChildren(membershipId, ownerAdminId)) >= membership.childCount) {
      fail("All the places in this package are filled — change the package or number of children first");
    }
    const updated = await ClubMembershipModel.updateChild(child.id, { status: "active" });
    await applyChildLink(membership, updated);
    return updated;
  },

  // Called when a learner record is deleted outright (learner.service.js's deleteLearner).
  async onLearnerDeleted(learnerId) {
    await ClubMembershipModel.deleteChildrenByLearner(learnerId);
  },

  /* ── Billing ─────────────────────────────────────────────────────────────── */

  // "Invoice next period": the membership's next invoice raised now, before its period starts
  // (otherwise the automatic invoicing raises it on the day). Idempotent: a period already
  // invoiced is returned as-is.
  async generateInvoice(ownerAdminId, membershipId, input, actorUserId) {
    const { dueDate } = parseOrFail(invoiceSchema, input || {}, "Invalid invoice details");
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    if (membership.status !== "active") fail("Only active memberships can be invoiced");
    return PackageBilling.invoiceNextPeriod("tech_club", membership, { dueDate: dueDate || null, actorUserId });
  },

  // "Invoice due now": every active membership's invoices (optionally at one club) brought up to
  // today, as the hourly run does.
  async generateDueInvoices(ownerAdminId, input, actorUserId) {
    const { families, invoices } = await PackageBilling.processPackageBilling({ ownerAdminId, kinds: ["tech_club"], hubId: input?.hubId || null, actorUserId });
    return { memberships: families, created: invoices };
  },
};

module.exports = ClubService;
// For club-signup.service.js.
module.exports.raiseMembershipInvoice = raiseMembershipInvoice;
module.exports.syncMembershipChildren = syncMembershipChildren;
module.exports.assertOwnClub = assertOwnClub;
