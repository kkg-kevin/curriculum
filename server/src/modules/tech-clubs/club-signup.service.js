const db = require("../../config/db");
const ClubMembershipModel = require("./club.model");
const ClubPackageModel = require("./club-package.model");
const { raiseMembershipInvoice, syncMembershipChildren } = require("./club.service");
const { signupSchema, signupChildSchema, approveSignupSchema } = require("./club.validation");
const { priceForPackage, CURRENCY } = require("../home-learning/home-learning.pricing");
const { monthRange } = require("../home-learning/home-learning.service");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const BillingModel = require("../billing/billing.model");
const BillingService = require("../billing/billing.service");
const LeadModel = require("../leads/lead.model");
const PaymentLinks = require("../payments/payment-links");
const NotificationService = require("../notifications/notification.service");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");

// Website Estate Tech Club sign-up — the same pattern as Home Learning's
// (home-learning-signup.service.js), for a club instead of a home:
//
//   signup()        creates the membership (status "pending", source "website") at the chosen
//                   club, the parent's portal login (email + password), each child as a learner
//                   (accountStatus "pending_payment") with their own login (username + password)
//                   "awaiting placement" (no class yet), and the first month's invoice. Until the
//                   admin approves, both logins land on the "payment pending" screen.
//   approveSignup() records the payment on that invoice and activates the membership + children
//                   (children already placed in a class go into it now).
//   declineSignup() cancels the invoice and removes the sign-up's accounts.
//
// The membership belongs to PUBLIC_CONTENT_ADMIN_ID — the admin whose clubs the website shows.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const fullName = (child) => `${child.firstName} ${child.lastName}`.trim();
const childrenLabel = (n) => `${n} ${Number(n) === 1 ? "child" : "children"}`;
const PAYABLE = ["issued", "partially_paid", "overdue"];

// A public form must never reset or take over an existing account. An email is "taken" if it has
// any login, is the parent email on any child's profile (a new login would reach those children),
// or belongs to a Home Learning household or club membership that's still live.
async function assertEmailFree(email) {
  const lower = email.toLowerCase();
  const taken = (await UserModel.findByEmail(email))
    || (await LearnerModel.findAll({ guardianEmail: email })).length
    || (await db("home_learning_households").whereRaw("LOWER(guardianEmail) = ?", [lower]).whereNot({ status: "cancelled" }).first())
    || (await db("club_memberships").whereRaw("LOWER(guardianEmail) = ?", [lower]).whereNot({ status: "cancelled" }).first());
  if (taken) fail("This email is already registered with us. Log in with it, or contact us to join this club.", 409);
}

async function assertUsernamesFree(children) {
  for (const child of children) {
    const taken = (await UserModel.findByUsername(child.username)) || (await LearnerModel.findByUsername(child.username));
    if (taken) fail(`The username "${child.username}" is already taken — choose another for ${child.firstName}.`, 409);
  }
}

// Undo everything a failed sign-up created, newest first. Best effort: each step is independent.
async function rollback({ learnerIds, usernames, parentUserId, membershipId }) {
  for (const id of learnerIds) await LearnerService.deleteLearner(id).catch(() => {});
  for (const username of usernames) {
    const login = await UserModel.findByUsername(username).catch(() => null);
    if (login) await UserModel.delete(login.id).catch(() => {});
  }
  if (parentUserId) await UserModel.delete(parentUserId).catch(() => {});
  if (membershipId) await ClubMembershipModel.deleteMembership(membershipId).catch(() => {});
}

// A paid sign-up: the membership goes active, every child's login unlocks, children the admin
// already placed go into their class, and the enquiry the sign-up made is stamped paid. Safe to
// run twice — a membership that is no longer pending is left alone.
async function activateMembership(membershipId, ownerAdminId, { amount, currency, paidByUserId = null }) {
  const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
  if (!membership || membership.status !== "pending") return;
  const active = await ClubMembershipModel.update(membership.id, ownerAdminId, { status: "active", startDate: new Date().toISOString().slice(0, 10) });
  for (const child of await ClubMembershipModel.findChildren(membership.id, ownerAdminId)) {
    const learner = await LearnerModel.findById(child.learnerId);
    if (learner?.accountStatus === "pending_payment") await LearnerModel.update(learner.id, { accountStatus: "active" });
    if (learner) {
      await NotificationService.notifyLearner(learner.id, {
        type: "account_activated",
        title: "Your account is active",
        message: "Your Tech Club payment has been confirmed. Welcome!",
        payload: { route: "/learner-portal" },
        // One per membership: a parent with several children gets it once (each child's own login
        // gets its own copy — a different recipient).
        dedupeKey: `tech_club_activated:${membership.id}`,
      }).catch(() => {});
    }
  }
  await syncMembershipChildren(active);
  const lead = await db("leads").where({ clubMembershipId: membership.id }).first();
  if (lead && !lead.paidAt) {
    await LeadModel.update(lead.id, { paidAmount: amount, paidCurrency: currency || CURRENCY, paidAt: new Date(), paidByUserId }).catch(() => {});
  }
}

// The parent's own login (email, no username) — a child's login can't see or add siblings.
function assertParentLogin(user) {
  if (user?.role !== "learner" || !user.email || user.username) {
    fail("Only the parent's account can manage the family's children", 403);
  }
}

// A website club is one of the designated admin's active, non-school hubs (the same ones
// /api/public/hubs lists).
async function resolvePublicClub(hubId, ownerAdminId) {
  const hub = await LearningHubModel.findById(hubId);
  if (!hub || hub.ownerAdminId !== ownerAdminId || hub.status !== "active" || hub.hubType === "school" || hub.isHomeLearning) {
    fail("That club isn't taking sign-ups right now — please choose another.", 404);
  }
  return hub;
}

// Creates one child as a learner with their own login and a membership row awaiting placement.
// Pushes what it made onto `created` so a failure can be rolled back.
async function createChild(child, { membership, guardian, accountStatus, ownerAdminId, notes }, created) {
  const learner = await LearnerService.createLearner({
    firstName: child.firstName,
    lastName: child.lastName,
    gender: child.gender,
    dateOfBirth: child.dateOfBirth || undefined,
    guardianName: guardian.name,
    guardianPhone: guardian.phone,
    guardianEmail: guardian.email,
    username: child.username,
    accountStatus,
    // No hub until the admin places the child — this is how the admin can still open them.
    createdByAdminId: ownerAdminId,
  });
  created.learnerIds.push(learner.id);
  await AuthService.setOrCreatePasswordByUsername({ name: fullName(child), username: child.username, password: child.password, role: "learner" });
  created.usernames.push(child.username);
  await ClubMembershipModel.createChild({
    ownerAdminId, membershipId: membership.id, learnerId: learner.id, classId: null, status: "active",
    placementNotes: notes ? notes.slice(0, 255) : null,
  });
  return learner;
}

const ClubSignupService = {
  async signup(input, visitSource = null) {
    // Honeypot (the website's hidden hp_field) — only a bot fills it.
    if (input?.hp_field) fail("Your sign-up couldn't be sent. Please try again.");
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Please check your details and try again");
    const data = parsed.data;
    const ownerAdminId = requirePublicContentAdminId();
    const hub = await resolvePublicClub(data.hubId, ownerAdminId);

    const pkg = await ClubPackageModel.findBySlug(data.packageSlug, ownerAdminId);
    if (!pkg || pkg.status !== "active" || !pkg.isPublished || !ClubPackageModel.offeredAt(pkg, hub.id)) {
      fail("That package is no longer available at this club — please choose another.", 404);
    }
    const price = priceForPackage(pkg, data.children.length);
    if (!price) {
      fail(pkg.allowExtraChildren
        ? `${pkg.name} takes up to ${pkg.maxChildren} children`
        : `${pkg.name} covers ${childrenLabel(pkg.childrenIncluded)} — choose a larger package for more`);
    }
    await assertEmailFree(data.parent.email);
    await assertUsernamesFree(data.children);

    const created = { learnerIds: [], usernames: [], parentUserId: null, membershipId: null };
    let membership;
    let invoice;
    try {
      const parentLogin = await AuthService.createUser({ name: data.parent.name, email: data.parent.email, password: data.parent.password, role: "learner" });
      created.parentUserId = parentLogin.id;

      membership = await ClubMembershipModel.create({
        ownerAdminId,
        hubId: hub.id,
        packageId: pkg.id,
        guardianName: data.parent.name,
        guardianEmail: data.parent.email,
        guardianPhone: data.parent.phone,
        childCount: price.childCount,
        monthlyAmount: price.monthlyAmount,
        status: "pending",
        source: "website",
        notes: `Signed up on the website on ${new Date().toISOString().slice(0, 10)}.`,
      });
      created.membershipId = membership.id;

      const guardian = { name: data.parent.name, phone: data.parent.phone, email: data.parent.email };
      for (const child of data.children) {
        await createChild(child, {
          membership, guardian, accountStatus: "pending_payment", ownerAdminId,
          notes: child.currentGrade ? `Parent says: ${child.currentGrade}` : null,
        }, created);
      }

      const { periodStart, periodEnd, label } = monthRange(new Date().toISOString().slice(0, 7));
      invoice = await raiseMembershipInvoice(membership, { periodStart, periodEnd, label, dueDate: "" }, null);
      membership = await ClubMembershipModel.update(membership.id, ownerAdminId, { signupInvoiceId: invoice.id });
    } catch (err) {
      await rollback(created);
      throw err;
    }

    // Visibility for staff — neither may fail the family's sign-up. No learnerId on the lead: that
    // would make it look like a bootcamp sign-up ("Mark paid") on the Enquiries page.
    const names = data.children.map(fullName).join(", ");
    await LeadModel.create({
      source: "enroll", name: data.parent.name, email: data.parent.email, phone: data.parent.phone,
      learnerName: names.slice(0, 150), interestedIn: "tech_club", hubId: hub.id, clubMembershipId: membership.id, visitSource,
      message: `Signed up on the website: ${hub.name}, ${pkg.name} for ${childrenLabel(data.children.length)}. Awaiting payment (${invoice.invoiceNumber}).`,
    }).catch(() => {});
    await NotificationService._notify(ownerAdminId, {
      type: "tech_club_signup",
      title: "New Tech Club sign-up",
      message: `${data.parent.name} signed up for ${hub.name} — ${pkg.name} (${names}). Approve their payment on the Tech Clubs page.`,
      payload: { route: `/tech-clubs?membership=${membership.id}` },
      dedupeKey: `tech_club_signup:${membership.id}`,
    }).catch(() => {});

    return {
      membershipId: membership.id,
      clubName: hub.name,
      packageName: pkg.name,
      childCount: data.children.length,
      monthlyAmount: price.monthlyAmount,
      currency: CURRENCY,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: Number(invoice.total),
      parentEmail: data.parent.email,
      children: data.children.map((child) => ({ name: fullName(child), username: child.username })),
      // Pay now by M-Pesa, without signing in (null when M-Pesa is off) — see payments/payment-links.js.
      pay: await PaymentLinks.forWebsite(invoice, "tech_club_signup"),
    };
  },

  // Admin: payment received for a website sign-up → record it and activate the family.
  async approveSignup(req, membershipId, input) {
    const ownerAdminId = req.ownerAdminId;
    const parsed = approveSignupSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Invalid payment details");
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    if (membership.status !== "pending") fail("Only a membership awaiting payment can be approved");
    if (!membership.signupInvoiceId) fail("This membership has no sign-up invoice — record its payment in Billing, then set it to Active");
    const invoice = await BillingModel.findInvoiceById(membership.signupInvoiceId);
    if (!invoice) fail("The sign-up invoice couldn't be found", 404);

    const { amount, paymentMethod, providerReference, notes } = parsed.data;
    if (PAYABLE.includes(invoice.status)) {
      await BillingService.recordPayment(invoice.id, {
        amount, paymentMethod, providerReference: providerReference || null, notes: notes || "Tech Club website sign-up",
        idempotencyKey: `club-signup-${membership.id}`, paymentDate: null,
      }, req);
    }

    // Paying the invoice in full has already switched the family on (see activateForPaidInvoice);
    // an admin approving a part payment does it here.
    await activateMembership(membership.id, ownerAdminId, { amount, currency: invoice.currency, paidByUserId: req.user.id });
    return ClubMembershipModel.findById(membership.id, ownerAdminId);
  },

  // A membership's sign-up invoice was paid in full (by M-Pesa, or recorded in Billing) — switch
  // the family on, as Approve does. Does nothing for any other invoice.
  async activateForPaidInvoice(invoice, { amount, paidByUserId }) {
    if (invoice.invoiceType !== "tech_club" || !invoice.clubMembershipId) return;
    const membership = await ClubMembershipModel.findByIdAnyOwner(invoice.clubMembershipId);
    if (!membership || membership.signupInvoiceId !== invoice.id || membership.status !== "pending") return;
    await activateMembership(membership.id, membership.ownerAdminId, { amount: amount ?? Number(invoice.total), currency: invoice.currency, paidByUserId });
    const hub = await LearningHubModel.findById(membership.hubId);
    // Staff who recorded the payment themselves don't need telling.
    if (paidByUserId) return;
    await NotificationService._notify(membership.ownerAdminId, {
      type: "tech_club_signup_paid",
      title: "Tech Club sign-up paid",
      message: `${membership.guardianName} paid invoice ${invoice.invoiceNumber} for ${hub?.name || "their Tech Club"}, so the family is now active. Place the children in a class on the Tech Clubs page.`,
      payload: { route: `/tech-clubs?membership=${membership.id}` },
      dedupeKey: `tech_club_signup_paid:${membership.id}`,
      ownerAdminId: membership.ownerAdminId,
    }).catch(() => {});
  },

  // Admin: a sign-up that won't go ahead (never paid, duplicate, fake) → cancel its invoice and
  // remove the accounts it created, so the family could sign up again later.
  async declineSignup(req, membershipId) {
    const ownerAdminId = req.ownerAdminId;
    const membership = await ClubMembershipModel.findById(membershipId, ownerAdminId);
    if (!membership) fail("Membership not found", 404);
    if (membership.source !== "website" || membership.status !== "pending") fail("Only a website sign-up awaiting payment can be declined");
    const invoice = membership.signupInvoiceId ? await BillingModel.findInvoiceById(membership.signupInvoiceId) : null;
    if (invoice && Number(invoice.amountPaid) > 0) fail("A payment has already been recorded for this sign-up — approve it instead, or sort the payment out in Billing first");
    if (invoice && invoice.status === "issued") await BillingService.cancelInvoice(invoice.id, req);

    for (const child of await ClubMembershipModel.findChildren(membership.id, ownerAdminId)) {
      const learner = await LearnerModel.findById(child.learnerId);
      if (learner?.accountStatus !== "pending_payment") continue; // an existing child — leave them
      if (learner.username) {
        const login = await UserModel.findByUsername(learner.username);
        if (login) await UserModel.delete(login.id);
      }
      await LearnerService.deleteLearner(learner.id);
    }
    // The parent's login goes too, unless it still reaches other children.
    if (membership.guardianEmail && !(await LearnerModel.findAll({ guardianEmail: membership.guardianEmail })).length) {
      const parentLogin = await UserModel.findByEmail(membership.guardianEmail);
      if (parentLogin && parentLogin.role === "learner" && !parentLogin.username) await UserModel.delete(parentLogin.id);
    }
    return ClubMembershipModel.update(membership.id, ownerAdminId, { status: "cancelled" });
  },

  // Parent portal → My Family: each club membership the parent has, its package, how many of its
  // paid places are filled, and the children in it (with each child's login username).
  async getFamily(user) {
    assertParentLogin(user);
    const memberships = await ClubMembershipModel.findByGuardianEmail(user.email);
    return Promise.all(memberships.map(async (membership) => {
      const [pkg, hub, children] = await Promise.all([
        membership.packageId ? ClubPackageModel.findById(membership.packageId, membership.ownerAdminId) : null,
        LearningHubModel.findById(membership.hubId),
        ClubMembershipModel.findChildren(membership.id, membership.ownerAdminId),
      ]);
      const active = children.filter((c) => c.status === "active");
      const learners = await Promise.all(active.map((c) => LearnerModel.findById(c.learnerId)));
      return {
        id: membership.id,
        status: membership.status,
        clubName: hub?.name || "Tech Club",
        packageName: pkg?.name || null,
        places: membership.childCount,
        filled: active.length,
        placesLeft: Math.max(0, membership.childCount - active.length),
        monthlyAmount: Number(membership.monthlyAmount),
        currency: CURRENCY,
        children: active.map((c, i) => ({
          learnerId: c.learnerId,
          name: learners[i] ? fullName(learners[i]) : "",
          username: learners[i]?.username || null,
          awaitingPlacement: !c.classId,
        })),
      };
    }));
  },

  // Parent portal → My Family → Add a child: fills one of the membership's already-paid places.
  // Never changes the package or the price: with no free place, the parent is asked to contact us.
  async addChildFromParent(user, membershipId, input) {
    assertParentLogin(user);
    const membership = (await ClubMembershipModel.findByGuardianEmail(user.email)).find((m) => m.id === membershipId);
    if (!membership) fail("Membership not found", 404);
    const ownerAdminId = membership.ownerAdminId;
    const filled = await ClubMembershipModel.countActiveChildren(membership.id, ownerAdminId);
    if (filled >= membership.childCount) {
      fail(`All ${membership.childCount} ${membership.childCount === 1 ? "place" : "places"} in your package are filled. Contact us to add more children.`, 409);
    }
    const parsed = signupChildSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Please check the child's details");
    const child = parsed.data;
    await assertUsernamesFree([child]);

    const created = { learnerIds: [], usernames: [], parentUserId: null, membershipId: null };
    let learner;
    try {
      learner = await createChild(child, {
        membership,
        guardian: { name: membership.guardianName, phone: membership.guardianPhone, email: membership.guardianEmail },
        // A membership still awaiting its first payment keeps new children on the same footing.
        accountStatus: membership.status === "pending" ? "pending_payment" : "active",
        ownerAdminId,
        notes: `Added by parent.${child.currentGrade ? ` Parent says: ${child.currentGrade}` : ""}`,
      }, created);
    } catch (err) {
      await rollback(created);
      throw err;
    }

    const hub = await LearningHubModel.findById(membership.hubId);
    await NotificationService._notify(ownerAdminId, {
      type: "tech_club_child_added",
      title: "Child added by a parent",
      message: `${membership.guardianName} added ${fullName(child)} to their ${hub?.name || "Tech Club"} membership. Place them in a class on the Tech Clubs page.`,
      payload: { route: `/tech-clubs?membership=${membership.id}` },
      dedupeKey: `tech_club_child_added:${learner.id}`,
    }).catch(() => {});

    return { learnerId: learner.id, name: fullName(child), username: child.username, placesLeft: membership.childCount - filled - 1 };
  },

  // For the "payment pending" screen: what a website club sign-up still owes, or null.
  async pendingPaymentForLearner(learnerId) {
    for (const child of await ClubMembershipModel.findChildrenByLearner(learnerId)) {
      const membership = await ClubMembershipModel.findByIdAnyOwner(child.membershipId);
      if (!membership || membership.status !== "pending" || !membership.signupInvoiceId) continue;
      const invoice = await BillingModel.findInvoiceById(membership.signupInvoiceId);
      if (!invoice || !PAYABLE.includes(invoice.status)) continue;
      const [pkg, hub] = await Promise.all([
        membership.packageId ? ClubPackageModel.findById(membership.packageId, membership.ownerAdminId) : null,
        LearningHubModel.findById(membership.hubId),
      ]);
      return {
        kind: "tech_club",
        itemName: `${hub?.name || "Tech Club"} — ${pkg?.name || "membership"}`,
        amount: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid || 0)),
        currency: invoice.currency || CURRENCY,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        hubName: hub?.name || null,
        mode: null,
      };
    }
    return null;
  },
};

module.exports = ClubSignupService;
