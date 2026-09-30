const db = require("../../config/db");
const HouseholdModel = require("./home-learning.model");
const HomeLearningPackageModel = require("./home-learning-package.model");
const HomeLearningService = require("./home-learning.service");
const { raiseHouseholdInvoice, monthRange } = require("./home-learning.service");
const { signupSchema, signupChildSchema, approveSignupSchema } = require("./home-learning.validation");
const { priceForPackage, CURRENCY } = require("./home-learning.pricing");
const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const BillingModel = require("../billing/billing.model");
const BillingService = require("../billing/billing.service");
const LeadModel = require("../leads/lead.model");
const NotificationService = require("../notifications/notification.service");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");

// Website Home Learning sign-up — the same thing staff do on the Home Learning page, done by the
// family themselves, gated by payment (same pattern as bootcamp-enrollment.service.js):
//
//   signup()        creates the household (status "pending", source "website"), the parent's portal
//                   login (email + password), each child as a learner (accountStatus
//                   "pending_payment") with their own login (username + password) and an
//                   enrollment "awaiting placement" (no curriculum yet), and the first month's
//                   invoice. Until the admin approves, both logins land on the "payment pending"
//                   screen (auth.service.js's resolveSuspension / getPendingPayment).
//   approveSignup() records the payment on that invoice and activates the household + children.
//   declineSignup() cancels the invoice and removes the sign-up's accounts.
//
// The household belongs to PUBLIC_CONTENT_ADMIN_ID — the admin whose packages the website shows.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const fullName = (child) => `${child.firstName} ${child.lastName}`.trim();
const PAYABLE = ["issued", "partially_paid", "overdue"];

// A public form must never reset or take over an existing account. An email is "taken" if it has
// any login, is the parent email on any child's profile (a new login would reach those children),
// or belongs to a household that's still live.
async function assertEmailFree(email) {
  const taken = (await UserModel.findByEmail(email))
    || (await LearnerModel.findAll({ guardianEmail: email })).length
    || (await db("home_learning_households").whereRaw("LOWER(guardianEmail) = ?", [email.toLowerCase()]).whereNot({ status: "cancelled" }).first());
  if (taken) fail("This email is already registered with us. Log in with it, or contact us to add another child.", 409);
}

async function assertUsernamesFree(children) {
  for (const child of children) {
    const taken = (await UserModel.findByUsername(child.username)) || (await LearnerModel.findByUsername(child.username));
    if (taken) fail(`The username "${child.username}" is already taken — choose another for ${child.firstName}.`, 409);
  }
}

// Undo everything a failed sign-up created, newest first. Best effort: each step is independent.
async function rollback({ learnerIds, usernames, parentUserId, householdId }) {
  for (const id of learnerIds) await LearnerService.deleteLearner(id).catch(() => {});
  for (const username of usernames) {
    const login = await UserModel.findByUsername(username).catch(() => null);
    if (login) await UserModel.delete(login.id).catch(() => {});
  }
  if (parentUserId) await UserModel.delete(parentUserId).catch(() => {});
  if (householdId) {
    await db("home_learning_enrollments").where({ householdId }).del().catch(() => {});
    await db("home_learning_households").where({ id: householdId }).del().catch(() => {});
  }
}

// The parent's own login (email, no username) — a child's login can't see or add siblings.
function assertParentLogin(user) {
  if (user?.role !== "learner" || !user.email || user.username) {
    fail("Only the parent's account can manage the family's children", 403);
  }
}

// The parent's live households (never a cancelled one), matched on the parent's email.
async function parentHouseholds(email) {
  return (await HouseholdModel.findByGuardianEmail(email)).filter((h) => h.status !== "cancelled");
}

const HomeLearningSignupService = {
  async signup(input) {
    // Honeypot (the website's hidden hp_field) — only a bot fills it.
    if (input?.hp_field) fail("Your sign-up couldn't be sent. Please try again.");
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Please check your details and try again");
    const data = parsed.data;
    const ownerAdminId = requirePublicContentAdminId();

    const pkg = await HomeLearningPackageModel.findBySlug(data.packageSlug, ownerAdminId);
    if (!pkg || pkg.status !== "active" || !pkg.isPublished) fail("That package is no longer available — please choose another.", 404);
    const price = priceForPackage(pkg, data.children.length);
    if (!price) {
      fail(pkg.allowExtraChildren
        ? `${pkg.name} takes up to ${pkg.maxChildren} children`
        : `${pkg.name} covers ${pkg.childrenIncluded} ${pkg.childrenIncluded === 1 ? "child" : "children"} — choose a larger package for more`);
    }
    await assertEmailFree(data.parent.email);
    await assertUsernamesFree(data.children);

    const created = { learnerIds: [], usernames: [], parentUserId: null, householdId: null };
    let household;
    let invoice;
    try {
      const parentLogin = await AuthService.createUser({ name: data.parent.name, email: data.parent.email, password: data.parent.password, role: "learner" });
      created.parentUserId = parentLogin.id;

      household = await HouseholdModel.createHousehold({
        ownerAdminId,
        guardianName: data.parent.name,
        guardianEmail: data.parent.email,
        guardianPhone: data.parent.phone,
        county: data.home.county,
        subCounty: data.home.subCounty || null,
        town: data.home.town,
        addressLine: data.home.addressLine,
        landmark: data.home.landmark || null,
        mapUrl: data.home.mapUrl || null,
        locationPhotos: [],
        packageId: pkg.id,
        planCode: pkg.slug.slice(0, 30),
        childCount: price.childCount,
        monthlyAmount: price.monthlyAmount,
        status: "pending",
        source: "website",
        notes: `Signed up on the website on ${new Date().toISOString().slice(0, 10)}.`,
      });
      created.householdId = household.id;

      for (const child of data.children) {
        const learner = await LearnerService.createLearner({
          firstName: child.firstName,
          lastName: child.lastName,
          gender: child.gender,
          dateOfBirth: child.dateOfBirth || undefined,
          guardianName: data.parent.name,
          guardianPhone: data.parent.phone,
          guardianEmail: data.parent.email,
          username: child.username,
          accountStatus: "pending_payment",
          // No hub until the admin places the child — this is how the admin can still open them.
          createdByAdminId: ownerAdminId,
        });
        created.learnerIds.push(learner.id);
        await AuthService.setOrCreatePasswordByUsername({ name: fullName(child), username: child.username, password: child.password, role: "learner" });
        created.usernames.push(child.username);
        await HouseholdModel.createEnrollment({
          ownerAdminId, householdId: household.id, learnerId: learner.id, curriculumId: null, educatorId: null, status: "active",
          placementNotes: child.currentGrade ? `Parent says: ${child.currentGrade}`.slice(0, 255) : null,
        });
      }

      const { periodStart, periodEnd, label } = monthRange(new Date().toISOString().slice(0, 7));
      invoice = await raiseHouseholdInvoice(ownerAdminId, household, { periodStart, periodEnd, label, dueDate: "" }, null);
      await HouseholdModel.updateHousehold(household.id, ownerAdminId, { signupInvoiceId: invoice.id });
    } catch (err) {
      await rollback(created);
      throw err;
    }

    // Visibility for staff — neither may fail the family's sign-up.
    const names = data.children.map(fullName).join(", ");
    await LeadModel.create({
      source: "enroll", name: data.parent.name, email: data.parent.email, phone: data.parent.phone,
      learnerName: names.slice(0, 150), interestedIn: "home_schooling", referenceId: pkg.slug, homeLearningHouseholdId: household.id,
      message: `Signed up on the website: ${pkg.name} for ${data.children.length} ${data.children.length === 1 ? "child" : "children"}. Awaiting payment (${invoice.invoiceNumber}).`,
    }).catch(() => {});
    await NotificationService._notify(ownerAdminId, {
      type: "home_learning_signup",
      title: "New Home Learning sign-up",
      message: `${data.parent.name} signed up for ${pkg.name} (${names}). Approve their payment on the Home Learning page.`,
      payload: { route: `/home-learning?household=${household.id}` },
      dedupeKey: `home_learning_signup:${household.id}`,
    }).catch(() => {});

    return {
      householdId: household.id,
      packageName: pkg.name,
      childCount: data.children.length,
      monthlyAmount: price.monthlyAmount,
      currency: CURRENCY,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: Number(invoice.total),
      parentEmail: data.parent.email,
      children: data.children.map((child) => ({ name: fullName(child), username: child.username })),
    };
  },

  // Admin: payment received for a website sign-up → record it and activate the family.
  // Parent portal → My Family: each household the parent has, its package, how many of its paid
  // places are filled, and the children in it (with each child's login username).
  async getFamily(user) {
    assertParentLogin(user);
    const households = await parentHouseholds(user.email);
    return Promise.all(households.map(async (household) => {
      const [pkg, enrollments] = await Promise.all([
        household.packageId ? HomeLearningPackageModel.findById(household.packageId, household.ownerAdminId) : null,
        HouseholdModel.findEnrollmentsByHousehold(household.id, household.ownerAdminId),
      ]);
      const active = enrollments.filter((e) => e.status === "active");
      const learners = await Promise.all(active.map((e) => LearnerModel.findById(e.learnerId)));
      return {
        id: household.id,
        status: household.status,
        packageName: pkg?.name || null,
        places: household.childCount,
        filled: active.length,
        placesLeft: Math.max(0, household.childCount - active.length),
        monthlyAmount: Number(household.monthlyAmount),
        currency: CURRENCY,
        children: active.map((e, i) => ({
          learnerId: e.learnerId,
          name: learners[i] ? fullName(learners[i]) : "",
          username: learners[i]?.username || null,
          awaitingPlacement: !e.curriculumId,
        })),
      };
    }));
  },

  // Parent portal → My Family → Add a child: fills one of the household's already-paid places
  // (e.g. a three-child package with one child registered so far). The child is created exactly
  // like a website sign-up child — their own login (username + password) and an enrollment
  // "awaiting placement" — and the admin is notified to choose their curriculum, grade and
  // educator. Never changes the package or the price: with no free place, the parent is asked
  // to contact the school.
  async addChildFromParent(user, householdId, input) {
    assertParentLogin(user);
    const household = (await parentHouseholds(user.email)).find((h) => h.id === householdId);
    if (!household) fail("Household not found", 404);
    const ownerAdminId = household.ownerAdminId;
    const filled = await HouseholdModel.countActive(household.id, ownerAdminId);
    if (filled >= household.childCount) {
      fail(`All ${household.childCount} ${household.childCount === 1 ? "place" : "places"} in your package are filled. Contact us to add more children.`, 409);
    }
    const parsed = signupChildSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Please check the child's details");
    const child = parsed.data;
    await assertUsernamesFree([child]);

    const created = { learnerIds: [], usernames: [], parentUserId: null, householdId: null };
    let learner;
    try {
      learner = await LearnerService.createLearner({
        firstName: child.firstName,
        lastName: child.lastName,
        gender: child.gender,
        dateOfBirth: child.dateOfBirth || undefined,
        guardianName: household.guardianName,
        guardianPhone: household.guardianPhone,
        guardianEmail: household.guardianEmail,
        username: child.username,
        // A household still awaiting its first payment keeps new children on the same footing.
        accountStatus: household.status === "pending" ? "pending_payment" : "active",
        // No hub until the admin places the child — this is how the admin can still open them.
        createdByAdminId: ownerAdminId,
      });
      created.learnerIds.push(learner.id);
      await AuthService.setOrCreatePasswordByUsername({ name: fullName(child), username: child.username, password: child.password, role: "learner" });
      created.usernames.push(child.username);
      await HouseholdModel.createEnrollment({
        ownerAdminId, householdId: household.id, learnerId: learner.id, curriculumId: null, educatorId: null, status: "active",
        placementNotes: `Added by parent.${child.currentGrade ? ` Parent says: ${child.currentGrade}` : ""}`.slice(0, 255),
      });
    } catch (err) {
      await rollback(created);
      throw err;
    }

    await NotificationService._notify(ownerAdminId, {
      type: "home_learning_child_added",
      title: "Child added by a parent",
      message: `${household.guardianName} added ${fullName(child)} to their Home Learning household. Choose their curriculum, grade and educator on the Home Learning page.`,
      payload: { route: `/home-learning?household=${household.id}` },
      dedupeKey: `home_learning_child_added:${learner.id}`,
    }).catch(() => {});

    return {
      learnerId: learner.id,
      name: fullName(child),
      username: child.username,
      placesLeft: household.childCount - filled - 1,
    };
  },

  async approveSignup(req, householdId, input) {
    const ownerAdminId = req.ownerAdminId;
    const parsed = approveSignupSchema.safeParse(input);
    if (!parsed.success) fail(parsed.error.issues[0]?.message || "Invalid payment details");
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    if (household.status !== "pending") fail("Only a household awaiting payment can be approved");
    if (!household.signupInvoiceId) fail("This household has no sign-up invoice — record its payment in Billing, then set it to Active");
    const invoice = await BillingModel.findInvoiceById(household.signupInvoiceId);
    if (!invoice) fail("The sign-up invoice couldn't be found", 404);

    const { amount, paymentMethod, providerReference, notes } = parsed.data;
    if (PAYABLE.includes(invoice.status)) {
      await BillingService.recordPayment(invoice.id, {
        amount, paymentMethod, providerReference: providerReference || null, notes: notes || "Home Learning website sign-up",
        idempotencyKey: `hl-signup-${household.id}`, paymentDate: null,
      }, req);
    }

    await HomeLearningService.update(ownerAdminId, household.id, { status: "active", startDate: new Date().toISOString().slice(0, 10) });
    const enrollments = await HouseholdModel.findEnrollmentsByHousehold(household.id, ownerAdminId);
    for (const enrollment of enrollments) {
      const learner = await LearnerModel.findById(enrollment.learnerId);
      if (learner?.accountStatus === "pending_payment") await LearnerModel.update(learner.id, { accountStatus: "active" });
      if (learner) {
        await NotificationService.notifyLearner(learner.id, {
          type: "account_activated",
          title: "Your account is active",
          message: "Your Home Learning payment has been confirmed. Welcome!",
          payload: { route: "/learner-portal" },
          dedupeKey: `home_learning_activated:${learner.id}`,
        }).catch(() => {});
      }
    }
    const lead = await db("leads").where({ homeLearningHouseholdId: household.id }).first();
    if (lead && !lead.paidAt) {
      await LeadModel.update(lead.id, { paidAmount: amount, paidCurrency: invoice.currency || CURRENCY, paidAt: new Date(), paidByUserId: req.user.id }).catch(() => {});
    }
    return HouseholdModel.findById(household.id, ownerAdminId);
  },

  // Admin: a sign-up that won't go ahead (never paid, duplicate, fake) → cancel its invoice and
  // remove the accounts it created, so the family could sign up again later.
  async declineSignup(req, householdId) {
    const ownerAdminId = req.ownerAdminId;
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    if (household.source !== "website" || household.status !== "pending") fail("Only a website sign-up awaiting payment can be declined");
    const invoice = household.signupInvoiceId ? await BillingModel.findInvoiceById(household.signupInvoiceId) : null;
    if (invoice && Number(invoice.amountPaid) > 0) fail("A payment has already been recorded for this sign-up — approve it instead, or sort the payment out in Billing first");
    if (invoice && invoice.status === "issued") await BillingService.cancelInvoice(invoice.id, req);

    for (const enrollment of await HouseholdModel.findEnrollmentsByHousehold(household.id, ownerAdminId)) {
      const learner = await LearnerModel.findById(enrollment.learnerId);
      if (learner?.accountStatus !== "pending_payment") continue; // an existing child someone added — leave them
      if (learner.username) {
        const login = await UserModel.findByUsername(learner.username);
        if (login) await UserModel.delete(login.id);
      }
      await LearnerService.deleteLearner(learner.id);
    }
    // The parent's login goes too, unless it still reaches other children.
    if (household.guardianEmail && !(await LearnerModel.findAll({ guardianEmail: household.guardianEmail })).length) {
      const parentLogin = await UserModel.findByEmail(household.guardianEmail);
      if (parentLogin && parentLogin.role === "learner" && !parentLogin.username) await UserModel.delete(parentLogin.id);
    }
    await HouseholdModel.updateHousehold(household.id, ownerAdminId, { status: "cancelled" });
    return HouseholdModel.findById(household.id, ownerAdminId);
  },

  // For the "payment pending" screen: what a website sign-up still owes, or null.
  async pendingPaymentForLearner(learnerId) {
    const [enrollment] = await HouseholdModel.findEnrollmentsByLearner(learnerId);
    if (!enrollment) return null;
    const household = await db("home_learning_households").where({ id: enrollment.householdId }).first();
    if (!household || household.status !== "pending" || !household.signupInvoiceId) return null;
    const invoice = await BillingModel.findInvoiceById(household.signupInvoiceId);
    if (!invoice || !PAYABLE.includes(invoice.status)) return null;
    const pkg = household.packageId ? await HomeLearningPackageModel.findById(household.packageId, household.ownerAdminId) : null;
    return {
      kind: "home_learning",
      itemName: `Home Learning — ${pkg?.name || "family package"}`,
      amount: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid || 0)),
      currency: invoice.currency || CURRENCY,
      invoiceNumber: invoice.invoiceNumber,
      hubName: null,
      mode: null,
    };
  },
};

module.exports = HomeLearningSignupService;
