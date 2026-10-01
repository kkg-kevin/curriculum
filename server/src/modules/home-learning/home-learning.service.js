const db = require("../../config/db");
const HouseholdModel = require("./home-learning.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const CurriculumModel = require("../curriculum/curriculum.model");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const TeacherModel = require("../teachers/teacher.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const ClassModel = require("../classes/class.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearnerService = require("../learners/learner.service");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const BillingModel = require("../billing/billing.model");
const { createLearnerSchema } = require("../learners/learner.validation");
const { householdSchema, enrollmentSchema, newLearnerEnrollmentSchema, invoiceSchema, packageSchema } = require("./home-learning.validation");
const HomeLearningPackageModel = require("./home-learning-package.model");
const { priceForPackage, toPublicPackage, CURRENCY } = require("./home-learning.pricing");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");
const { slugify } = require("../../shared/utils/slugify");

// How Home Learning plugs into the rest of the system: every admin gets one "Home Learning" hub
// (learning_hubs.isHomeLearning), and every enrolled child gets their own Class in it for their
// curriculum + grade, with their educator linked to that class's courses. From then on the child
// is an ordinary learner in an ordinary class — assessments, grading, attendance, reports, the
// Progress Arc, portals and admin edit/suspend/delete all work through the existing class-based
// code, with no Home Learning special cases. home_learning_enrollments stays the record of the
// household/package side (which family, which place in the package, active/paused/removed).

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function parseOrFail(schema, input, fallback) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail(parsed.error.issues[0]?.message || fallback);
  return parsed.data;
}

// Resolves the household's package and what it costs for `requested` children. `currentPackageId`
// lets a household keep (and re-price on) a package that has since been archived; new sign-ups
// can only pick an active one.
async function resolvePackagePrice(ownerAdminId, packageId, requested, currentPackageId = null) {
  const pkg = await HomeLearningPackageModel.findById(packageId, ownerAdminId);
  if (!pkg || (pkg.status !== "active" && pkg.id !== currentPackageId)) fail("Package not found", 404);
  const price = priceForPackage(pkg, requested);
  if (!price) {
    fail(pkg.allowExtraChildren
      ? `${pkg.name} takes up to ${pkg.maxChildren} children`
      : `${pkg.name} covers ${pkg.childrenIncluded} ${pkg.childrenIncluded === 1 ? "child" : "children"} — choose a larger package for more`);
  }
  return { packageId: pkg.id, planCode: pkg.slug.slice(0, 30), ...price };
}

// Normalises a validated package form into a row: blank optionals become null, extra-child fields
// are only kept when extras are allowed, and maxChildren defaults to the included count.
function packageRow(data) {
  const extras = data.allowExtraChildren;
  return {
    name: data.name,
    summary: data.summary || null,
    description: data.description || null,
    childrenIncluded: data.childrenIncluded,
    monthlyAmount: data.monthlyAmount,
    allowExtraChildren: extras,
    extraChildAmount: extras ? data.extraChildAmount : null,
    maxChildren: extras ? (data.maxChildren ?? Math.max(data.childrenIncluded + 1, 20)) : data.childrenIncluded,
    features: data.features,
    badge: data.badge || null,
    isPublished: data.status === "archived" ? false : data.isPublished,
    status: data.status,
    sortOrder: data.sortOrder,
  };
}

async function uniqueSlug(ownerAdminId, wanted, excludeId) {
  const base = slugify(wanted) || "package";
  for (let n = 1; ; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const clash = await HomeLearningPackageModel.findBySlug(slug, ownerAdminId);
    if (!clash || clash.id === excludeId) return slug;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Enrollment status → what the child's class and hub link should look like. Only a child who is
// active in an active household is "in class"; everyone else keeps their hub link (so they stay in
// the admin's workspace and can be re-activated) but is marked inactive.
const LINK_STATUS = { active: "active", paused: "inactive", completed: "graduated", removed: "inactive" };

async function ensureHomeHub(ownerAdminId) {
  const existing = await HouseholdModel.findHomeHub(ownerAdminId);
  if (existing) return existing;
  // `school` type: a class/grade-based hub. It has no email (so no school-portal login) and school
  // hubs are never listed on the public website.
  await LearningHubModel.create({
    name: "Home Learning", hubType: "school", code: "HOME", status: "active", deliveryMode: "in_person",
    description: "Children learning at home with a visiting educator.", ownerAdminId, isHomeLearning: true,
  });
  return HouseholdModel.findHomeHub(ownerAdminId);
}

async function assertOwnCurriculum(ownerAdminId, curriculumId) {
  const curriculum = await CurriculumModel.findById(curriculumId);
  if (!curriculum || curriculum.ownerAdminId !== ownerAdminId) fail("Curriculum not found", 404);
  return curriculum;
}

function resolveGrade(curriculum, gradeId) {
  const grade = (Array.isArray(curriculum.classes) ? curriculum.classes : []).find((g) => g.id === gradeId);
  if (!grade) fail("Choose a grade / level from this curriculum");
  return { gradeId: grade.id, gradeName: grade.name };
}

// An educator is in this admin's workspace when linked to any of the admin's hubs — the Home
// Learning hub included, so a freelance home tutor only needs to be created against that hub.
async function assertOwnEducator(ownerAdminId, educatorId) {
  if (!educatorId) return null;
  const educator = await TeacherModel.findById(educatorId);
  if (!educator) fail("Educator not found", 404);
  const ownHubIds = new Set((await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true })).map((hub) => hub.id));
  const links = await TeacherHubLinkModel.findByTeacherId(educatorId);
  if (!links.some((link) => ownHubIds.has(link.hubId))) fail("This educator is not available in your workspace", 404);
  return educator;
}

async function learnerInWorkspace(ownerAdminId, learnerId) {
  const ownHubIds = new Set((await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true })).map((hub) => hub.id));
  const links = await LearnerHubLinkModel.findByLearnerId(learnerId);
  if (links.some((link) => ownHubIds.has(link.hubId))) return true;
  return (await HouseholdModel.findLearnerIds(ownerAdminId)).includes(learnerId);
}

// The child's own class in the Home Learning hub — created on first use, re-pointed when their
// curriculum/grade changes, and (re)activated/deactivated to match their status.
async function provisionClass(hub, enrollment, learner, { curriculumId, gradeId, gradeName }, active) {
  const status = active ? "active" : "inactive";
  const existing = enrollment?.classId ? await ClassModel.findById(enrollment.classId) : null;
  if (existing && existing.schoolId === hub.id) {
    await ClassModel.update(existing.id, { curriculumId, gradeId, gradeName, status });
    return ClassModel.findById(existing.id);
  }
  return ClassModel.create({
    schoolId: hub.id, curriculumId, gradeId, gradeName, academicYear: String(new Date().getFullYear()),
    capacity: 1, status, tag: null, streamName: `${learner.firstName} ${learner.lastName}`.trim().slice(0, 100),
  });
}

// Links the educator to every current course of the class's curriculum + grade (the per-course
// link is what grading/attendance/reports treat as "the educator of record"). Also re-run lazily
// when the educator opens their Home Learning page, so courses added to the curriculum later are
// picked up without anyone re-saving the enrollment.
async function syncEducatorLinks(hub, cls, educatorId, previousEducatorId) {
  if (previousEducatorId && previousEducatorId !== educatorId) {
    const stale = (await ClassCourseTeacherLinkModel.findByClassId(cls.id)).filter((l) => l.teacherId === previousEducatorId);
    for (const link of stale) await ClassCourseTeacherLinkModel.unlink(cls.id, link.courseId, previousEducatorId);
  }
  if (!educatorId) return;
  await TeacherHubLinkModel.link(educatorId, hub.id);
  const courses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
  for (const course of courses) await ClassCourseTeacherLinkModel.link(cls.id, course.id, educatorId);
}

async function placeLearnerInClass(hub, learnerId, cls, linkStatus) {
  const link = await LearnerHubLinkModel.findOne(learnerId, hub.id);
  if (!link) {
    // Always with an explicit classId — enrollInHub would otherwise auto-place the child in the
    // hub's first active class, i.e. another family's child's class.
    await LearnerService.enrollInHub(learnerId, { hubId: hub.id, classId: cls.id, status: linkStatus });
    return;
  }
  await LearnerService.updateEnrollment(learnerId, hub.id, { classId: cls.id, status: linkStatus });
}

// Brings the class, hub link and educator links in line with one enrollment row.
async function applyEnrollment(ownerAdminId, household, enrollment, learner, previousEducatorId) {
  const hub = await ensureHomeHub(ownerAdminId);
  const active = enrollment.status === "active" && household.status === "active";
  const cls = await provisionClass(hub, enrollment, learner, enrollment, active);
  if (enrollment.classId !== cls.id) await HouseholdModel.updateEnrollment(enrollment.id, { classId: cls.id });
  await placeLearnerInClass(hub, learner.id, cls, active ? "active" : (LINK_STATUS[enrollment.status] || "inactive"));
  await syncEducatorLinks(hub, cls, enrollment.educatorId || null, previousEducatorId);
  return cls;
}

// Household status changed → re-sync every child's class/link status (an enrollment only counts
// as active while its household is active too).
async function syncHouseholdChildren(ownerAdminId, household) {
  const hub = await HouseholdModel.findHomeHub(ownerAdminId);
  if (!hub) return;
  const enrollments = (await HouseholdModel.findEnrollmentsByHousehold(household.id, ownerAdminId)).filter((e) => e.status !== "removed" && e.classId);
  for (const enrollment of enrollments) {
    const active = enrollment.status === "active" && household.status === "active";
    await ClassModel.update(enrollment.classId, { status: active ? "active" : "inactive" });
    const link = await LearnerHubLinkModel.findOne(enrollment.learnerId, hub.id);
    if (link) await LearnerHubLinkModel.update(link.id, { status: active ? "active" : (LINK_STATUS[enrollment.status] || "inactive") });
  }
}

const GUARDIAN_FIELDS = ["guardianName", "guardianPhone", "guardianEmail"];
const sameText = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// The household's parent is the child's parent. Copies the household's parent details onto a
// learner's profile where the profile has none — or, after a household edit (`previous` = the
// household before it), where the profile still shows the old value — so the parent's portal
// login (keyed on guardianEmail, see scope.middleware.js) reaches both the child and the
// household's invoices. A profile that names a different parent's email is left alone.
async function syncLearnerGuardian(learner, household, previous = null) {
  const wasPrevious = (field) => previous && sameText(learner[field], previous[field]);
  if (learner.guardianEmail && household.guardianEmail && !sameText(learner.guardianEmail, household.guardianEmail) && !wasPrevious("guardianEmail")) return;
  const patch = {};
  for (const field of GUARDIAN_FIELDS) {
    const value = household[field];
    if (!value || sameText(learner[field], value)) continue;
    if (!learner[field] || wasPrevious(field)) patch[field] = value;
  }
  if (Object.keys(patch).length) await LearnerModel.update(learner.id, patch);
}

// Creates or resets the parent's portal login. Runs before anything is written, so an email
// that belongs to a staff account (409 from setOrCreatePassword) fails the whole save cleanly.
async function setParentPortalPassword(name, email, password) {
  if (!password) return;
  if (!email) fail("Add the parent's email before setting a portal password — it's what they sign in with");
  await AuthService.setOrCreatePassword({ name, email, password, role: "learner" });
}

// Whether each household's parent can sign in to see their invoices: "active" (a parent login
// exists for the email), "missing" (no login yet), "no_email", or "conflict" (the email belongs
// to a staff account, so it can't be a parent login).
async function portalStatuses(households) {
  const emails = [...new Set(households.map((h) => h.guardianEmail).filter(Boolean))];
  // users.email uses a case-insensitive collation, so whereIn matches regardless of case.
  const users = emails.length ? await db("users").whereIn("email", emails).select("email", "role", "username") : [];
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  return new Map(households.map((h) => {
    if (!h.guardianEmail) return [h.id, "no_email"];
    const user = byEmail.get(h.guardianEmail.toLowerCase());
    if (!user) return [h.id, "missing"];
    return [h.id, user.role === "learner" && !user.username ? "active" : "conflict"];
  }));
}

function monthRange(period) {
  const [year, month] = period.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { periodStart: `${year}-${pad(month)}-01`, periodEnd: `${year}-${pad(month)}-${pad(lastDay)}`, label: `${MONTHS[month - 1]} ${year}` };
}

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const OPEN_STATUSES = ["issued", "partially_paid", "overdue"];

// Per-household billing snapshot for the admin list: what's owed, whether any of it is overdue,
// and the most recent invoices (newest first).
async function billingSummaries(householdIds) {
  if (!householdIds.length) return new Map();
  const invoices = await db("billing_invoices")
    .whereIn("householdId", householdIds)
    .whereNotIn("status", ["draft", "cancelled", "void"])
    .orderBy("periodStart", "desc");
  const today = new Date().toISOString().slice(0, 10);
  const summaries = new Map();
  for (const id of householdIds) {
    const own = invoices.filter((inv) => inv.householdId === id);
    const open = own.filter((inv) => OPEN_STATUSES.includes(inv.status));
    summaries.set(id, {
      outstanding: money(open.reduce((sum, inv) => sum + Number(inv.total) - Number(inv.amountPaid), 0)),
      overdue: open.some((inv) => inv.status === "overdue" || (inv.dueAt && new Date(inv.dueAt).toISOString().slice(0, 10) < today)),
      invoices: own.slice(0, 6).map((inv) => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, periodLabel: inv.periodLabel,
        periodStart: inv.periodStart, total: money(inv.total), amountPaid: money(inv.amountPaid), dueAt: inv.dueAt,
      })),
    });
  }
  return summaries;
}

// Creates one household's monthly package invoice (issued) — shared by the admin's "Invoice month"
// and a website sign-up's first-month invoice. Callers check eligibility (status, duplicates).
async function raiseHouseholdInvoice(ownerAdminId, household, { periodStart, periodEnd, label, dueDate }, actorUserId) {
  const hub = await ensureHomeHub(ownerAdminId);
  const payer = household.guardianEmail ? await UserModel.findByEmail(household.guardianEmail) : null;
  const amount = money(household.monthlyAmount);
  const children = `${household.childCount} ${household.childCount === 1 ? "child" : "children"}`;
  const now = new Date();
  const invoice = await BillingModel.transaction(async (trx) => {
    const created = await BillingModel.createInvoice({
      invoiceNumber: await nextInvoiceNumber(trx),
      issuerType: "learning_hub", issuerHubId: hub.id,
      payerUserId: payer?.role === "learner" ? payer.id : null, payerHubId: null,
      learnerId: null, hubId: hub.id, householdId: household.id, invoiceType: "home_learning", status: "issued",
      currency: CURRENCY, subtotal: amount, discount: 0, total: amount, amountPaid: 0,
      periodStart, periodEnd, periodLabel: `Home Learning · ${label}`,
      issuedAt: now, dueAt: dueDate ? new Date(`${dueDate}T00:00:00`) : null, notes: null,
    }, trx);
    await BillingModel.createItem({
      invoiceId: created.id, learnerId: null, courseId: null,
      description: `Home Learning package (${children}) — ${label}`,
      quantity: 1, unitAmount: amount, totalAmount: amount,
      metadata: { householdId: household.id, planCode: household.planCode, childCount: household.childCount },
    }, trx);
    await BillingModel.createAuditEvent({
      invoiceId: created.id, actorUserId, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "home_learning" },
    }, trx);
    return created;
  });
  // Emailed to the household's guardian — lazy require, billing.service.js isn't needed at load time.
  require("../billing/billing.service").emailIssuedInvoice(invoice.id);
  return invoice;
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

const HomeLearningService = {
  /* ── Packages ───────────────────────────────────────────────────────────── */

  async listPackages(ownerAdminId) {
    const packages = await HomeLearningPackageModel.findAll(ownerAdminId);
    return Promise.all(packages.map(async (pkg) => ({ ...pkg, householdCount: await HomeLearningPackageModel.countHouseholds(pkg.id) })));
  },

  async createPackage(ownerAdminId, input) {
    const data = parseOrFail(packageSchema, input, "Invalid package details");
    const slug = await uniqueSlug(ownerAdminId, data.slug || data.name);
    return HomeLearningPackageModel.create({ ownerAdminId, slug, ...packageRow(data) });
  },

  // Price edits apply to new sign-ups (and to a household when it's next re-priced). Existing
  // households keep the monthly amount they signed up at, so an edit never silently changes what
  // a family is invoiced.
  async updatePackage(ownerAdminId, id, input) {
    const existing = await HomeLearningPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Package not found", 404);
    const data = parseOrFail(packageSchema, input, "Invalid package details");
    const slug = data.slug && data.slug !== existing.slug ? await uniqueSlug(ownerAdminId, data.slug, id) : existing.slug;
    return HomeLearningPackageModel.update(id, { slug, ...packageRow(data) });
  },

  async deletePackage(ownerAdminId, id) {
    const existing = await HomeLearningPackageModel.findById(id, ownerAdminId);
    if (!existing) fail("Package not found", 404);
    if (await HomeLearningPackageModel.countHouseholds(id)) fail("Households are on this package — archive it instead so it stops being offered", 409);
    await HomeLearningPackageModel.delete(id);
    return { deleted: true };
  },

  // The website's Home Schooling page: the designated public-content admin's published, active
  // packages, marketing fields only.
  async listPublicPackages() {
    const ownerAdminId = requirePublicContentAdminId();
    return (await HomeLearningPackageModel.findAll(ownerAdminId, { publishedOnly: true })).map(toPublicPackage);
  },

  async getPublicPackage(idOrSlug) {
    const ownerAdminId = requirePublicContentAdminId();
    const pkg = await HomeLearningPackageModel.findByIdOrSlug(idOrSlug, ownerAdminId);
    return pkg && pkg.isPublished && pkg.status === "active" ? toPublicPackage(pkg) : null;
  },

  /* ── Households ─────────────────────────────────────────────────────────── */

  async list(ownerAdminId) {
    const households = await HouseholdModel.findAll(ownerAdminId);
    const billing = await billingSummaries(households.map((h) => h.id));
    const portal = await portalStatuses(households);
    const packages = new Map((await HomeLearningPackageModel.findAll(ownerAdminId)).map((pkg) => [pkg.id, pkg]));
    return households.map((household) => {
      const pkg = packages.get(household.packageId);
      return { ...household, package: pkg ? { id: pkg.id, name: pkg.name, status: pkg.status } : null, billing: billing.get(household.id), parentPortal: portal.get(household.id) };
    });
  },

  getHousehold(ownerAdminId, id) {
    return HouseholdModel.findById(id, ownerAdminId);
  },

  async create(ownerAdminId, input) {
    const { portalPassword, ...data } = parseOrFail(householdSchema, input, "Invalid household details");
    const price = await resolvePackagePrice(ownerAdminId, data.packageId, data.childCount);
    await setParentPortalPassword(data.guardianName, data.guardianEmail, portalPassword);
    return HouseholdModel.createHousehold({
      ...data,
      ownerAdminId,
      ...price,
      status: data.status || "pending",
      guardianEmail: data.guardianEmail || null,
      mapUrl: data.mapUrl || null,
      locationPhotos: data.locationPhotos || [],
      startDate: data.startDate || null,
      notes: data.notes || null,
    });
  },

  async update(ownerAdminId, id, input) {
    const { portalPassword, ...updates } = parseOrFail(householdSchema.partial(), input, "Invalid household details");
    const existing = await HouseholdModel.findById(id, ownerAdminId);
    if (!existing) fail("Household not found", 404);
    // A website sign-up is activated by "Approve payment" (home-learning-signup.service.js), which
    // records the payment and unlocks the family's logins — not by flipping the status with nothing
    // paid, which would leave the logins locked and the invoice unpaid.
    if (existing.source === "website" && existing.status === "pending" && updates.status === "active" && existing.signupInvoiceId) {
      const signupInvoice = await db("billing_invoices").where({ id: existing.signupInvoiceId }).first();
      if (signupInvoice && Number(signupInvoice.amountPaid) === 0 && signupInvoice.status !== "cancelled") {
        fail("This family signed up on the website — use Approve payment to record their payment and activate them");
      }
    }
    if (updates.packageId !== undefined || updates.childCount !== undefined) {
      const packageId = updates.packageId ?? existing.packageId;
      if (!packageId) fail("Choose a package for this household");
      Object.assign(updates, await resolvePackagePrice(ownerAdminId, packageId, updates.childCount ?? existing.childCount, existing.packageId));
      if ((await HouseholdModel.countActive(id, ownerAdminId)) > updates.childCount) fail("Remove child enrollments before reducing the package size");
    }
    if (updates.guardianEmail === "") updates.guardianEmail = null;
    if (updates.mapUrl === "") updates.mapUrl = null;
    if (updates.startDate === "") updates.startDate = null;
    await setParentPortalPassword(updates.guardianName ?? existing.guardianName, updates.guardianEmail === undefined ? existing.guardianEmail : updates.guardianEmail, portalPassword);
    const household = await HouseholdModel.updateHousehold(id, ownerAdminId, updates);
    if (updates.status !== undefined && updates.status !== existing.status) await syncHouseholdChildren(ownerAdminId, household);
    // New parent details reach every child whose profile still showed the old ones.
    if (GUARDIAN_FIELDS.some((field) => updates[field] !== undefined && !sameText(updates[field], existing[field]))) {
      for (const enrollment of await HouseholdModel.findEnrollmentsByHousehold(id, ownerAdminId)) {
        const learner = await LearnerModel.findById(enrollment.learnerId);
        if (learner) await syncLearnerGuardian(learner, household, existing);
      }
    }
    return household;
  },

  // Assign an existing learner to a household (or update/re-activate their assignment).
  async setEnrollment(ownerAdminId, householdId, input) {
    const data = parseOrFail(enrollmentSchema, input, "Invalid learner enrollment");
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    const learner = await LearnerModel.findById(data.learnerId);
    if (!learner) fail("Learner not found", 404);
    if (!(await learnerInWorkspace(ownerAdminId, learner.id))) fail("This learner is not available in your workspace", 404);
    const curriculum = await assertOwnCurriculum(ownerAdminId, data.curriculumId);
    const grade = resolveGrade(curriculum, data.gradeId);
    await assertOwnEducator(ownerAdminId, data.educatorId);

    // A child has one Home Learning enrollment row overall (unique learnerId). A row left behind
    // by removal from another of this admin's households is moved here; anything else is a clash.
    const [prior] = await HouseholdModel.findEnrollmentsByLearner(learner.id);
    if (prior && prior.householdId !== householdId) {
      if (prior.ownerAdminId !== ownerAdminId || prior.status !== "removed") fail("This learner is already linked to a Home Learning household");
    }
    const existing = prior && prior.ownerAdminId === ownerAdminId ? prior : null;
    const alreadyActiveHere = existing?.householdId === householdId && existing.status === "active";
    if (data.status === "active" && !alreadyActiveHere && (await HouseholdModel.countActive(householdId, ownerAdminId)) >= household.childCount) {
      fail("This household package has no available child places");
    }

    const fields = { householdId, curriculumId: curriculum.id, ...grade, educatorId: data.educatorId || null, status: data.status };
    const enrollment = existing
      ? await HouseholdModel.updateEnrollment(existing.id, fields)
      : await HouseholdModel.createEnrollment({ ownerAdminId, learnerId: learner.id, ...fields });
    await applyEnrollment(ownerAdminId, household, enrollment, learner, existing?.educatorId || null);
    await syncLearnerGuardian(learner, household);
    return HouseholdModel.findEnrollment(householdId, learner.id, ownerAdminId);
  },

  // Register a brand-new child straight into a household. Everything is validated up front; if
  // anything fails after the learner record exists, that record (and the login minted for it) is
  // rolled back so a failed registration never leaves an orphaned child behind.
  async createLearner(ownerAdminId, householdId, input) {
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    const enrollmentData = parseOrFail(newLearnerEnrollmentSchema, {
      curriculumId: input.curriculumId, gradeId: input.gradeId, educatorId: input.educatorId, status: input.status || "active",
    }, "Invalid learner enrollment");
    if (enrollmentData.status === "active" && (await HouseholdModel.countActive(householdId, ownerAdminId)) >= household.childCount) {
      fail("This household package has no available child places");
    }
    const curriculum = await assertOwnCurriculum(ownerAdminId, enrollmentData.curriculumId);
    const grade = resolveGrade(curriculum, enrollmentData.gradeId);
    await assertOwnEducator(ownerAdminId, enrollmentData.educatorId);

    const parsed = createLearnerSchema.safeParse({
      ...input.learner,
      guardianName: household.guardianName,
      guardianPhone: household.guardianPhone,
      guardianEmail: household.guardianEmail || "",
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      fail(issue?.path?.[0] === "guardianEmail" && household.guardianEmail == null
        ? "Add a guardian email to the household before setting a guardian portal password"
        : issue?.message || "Invalid learner details");
    }
    const { password, learnerPassword, ...learnerData } = parsed.data;
    // Only a login this call mints is rolled back on failure — never one that already existed.
    const loginExisted = learnerPassword && learnerData.username ? !!(await UserModel.findByUsername(learnerData.username)) : true;
    // Guardian login first, same order as learner.controller.js's createLearner: if the email
    // belongs to a different-role account this throws before anything is written.
    if (password) await AuthService.setOrCreatePassword({ name: household.guardianName, email: learnerData.guardianEmail, password, role: "learner" });

    const learner = await LearnerService.createLearner(learnerData);
    let learnerLoginCreated = false;
    try {
      if (learnerPassword) {
        await AuthService.setOrCreatePasswordByUsername({
          name: `${learner.firstName} ${learner.lastName}`.trim(), username: learner.username, password: learnerPassword, role: "learner",
        });
        learnerLoginCreated = !loginExisted;
      }
      const enrollment = await HouseholdModel.createEnrollment({
        ownerAdminId, householdId, learnerId: learner.id, curriculumId: curriculum.id, ...grade,
        educatorId: enrollmentData.educatorId || null, status: enrollmentData.status,
      });
      await applyEnrollment(ownerAdminId, household, enrollment, learner, null);
    } catch (err) {
      await LearnerService.deleteLearner(learner.id).catch(() => {});
      if (learnerLoginCreated) {
        const login = await UserModel.findByUsername(learner.username).catch(() => null);
        if (login) await UserModel.delete(login.id).catch(() => {});
      }
      throw err;
    }
    return learner;
  },

  // Soft removal: the enrollment is kept as "removed" and the child keeps their Home Learning hub
  // link (inactive, no class), so they stay visible/editable in the admin's workspace and can be
  // re-added later — their class, attendance and grades are kept for when they come back.
  async removeEnrollment(ownerAdminId, householdId, learnerId) {
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    const enrollment = await HouseholdModel.findEnrollment(householdId, learnerId, ownerAdminId);
    if (!enrollment) fail("This learner is not in this household", 404);
    await HouseholdModel.updateEnrollment(enrollment.id, { status: "removed" });
    const hub = await HouseholdModel.findHomeHub(ownerAdminId);
    if (enrollment.classId) {
      await ClassModel.update(enrollment.classId, { status: "inactive" });
      if (enrollment.educatorId) {
        const links = (await ClassCourseTeacherLinkModel.findByClassId(enrollment.classId)).filter((l) => l.teacherId === enrollment.educatorId);
        for (const link of links) await ClassCourseTeacherLinkModel.unlink(enrollment.classId, link.courseId, enrollment.educatorId);
      }
    }
    if (hub) {
      const link = await LearnerHubLinkModel.findOne(learnerId, hub.id);
      if (link) await LearnerHubLinkModel.update(link.id, { classId: null, status: "inactive" });
    }
    return { removed: true };
  },

  getForLearner(learnerId) {
    return HouseholdModel.findForLearner(learnerId);
  },

  async getForEducator(educatorId) {
    const assignments = await HouseholdModel.findAssignmentsForEducator(educatorId);
    // Lazy sync: pick up courses added to the curriculum since the enrollment was saved.
    for (const assignment of assignments) {
      if (!assignment.classId) continue;
      const cls = await ClassModel.findById(assignment.classId);
      if (!cls) continue;
      const hub = await LearningHubModel.findById(cls.schoolId);
      if (hub) await syncEducatorLinks(hub, cls, educatorId, null);
    }
    return assignments;
  },

  // Called when a learner record is deleted outright (learner.service.js's deleteLearner): drops
  // their enrollment row and their personal Home Learning class.
  async onLearnerDeleted(learnerId) {
    const enrollments = await HouseholdModel.findEnrollmentsByLearner(learnerId);
    await HouseholdModel.deleteEnrollmentsByLearner(learnerId);
    const ClassService = require("../classes/class.service");
    for (const enrollment of enrollments) {
      if (enrollment.classId) await ClassService.deleteClass(enrollment.classId).catch(() => {});
    }
  },

  /* ── Billing ─────────────────────────────────────────────────────────────── */

  // One "home_learning" invoice per household per month, issued by the Home Learning hub to the
  // guardian. Idempotent: a month that's already invoiced (and not cancelled/void) is returned
  // as-is rather than billed twice. Payments are recorded on the invoice in Billing as usual.
  async generateInvoice(ownerAdminId, householdId, input, actorUserId) {
    const { period, dueDate } = parseOrFail(invoiceSchema, input, "Invalid invoice details");
    const household = await HouseholdModel.findById(householdId, ownerAdminId);
    if (!household) fail("Household not found", 404);
    if (household.status !== "active") fail("Only active households can be invoiced");
    const { periodStart, periodEnd, label } = monthRange(period);
    const existing = await db("billing_invoices")
      .where({ householdId, periodStart, invoiceType: "home_learning" })
      .whereNotIn("status", ["cancelled", "void"])
      .first();
    if (existing) return { invoice: existing, created: false };

    const invoice = await raiseHouseholdInvoice(ownerAdminId, household, { periodStart, periodEnd, label, dueDate }, actorUserId);
    return { invoice, created: true };
  },

  // "Invoice everyone for this month" — every active household, skipping ones already billed.
  async generateMonthlyInvoices(ownerAdminId, input, actorUserId) {
    const { period, dueDate } = parseOrFail(invoiceSchema, input, "Invalid invoice details");
    const households = (await db("home_learning_households").where({ ownerAdminId, status: "active" }));
    const result = { created: 0, skipped: 0 };
    for (const household of households) {
      const { created } = await HomeLearningService.generateInvoice(ownerAdminId, household.id, { period, dueDate }, actorUserId);
      result[created ? "created" : "skipped"] += 1;
    }
    return result;
  },
};

module.exports = HomeLearningService;
// For home-learning-signup.service.js: a website sign-up raises its first-month invoice the same way.
module.exports.raiseHouseholdInvoice = raiseHouseholdInvoice;
module.exports.monthRange = monthRange;
