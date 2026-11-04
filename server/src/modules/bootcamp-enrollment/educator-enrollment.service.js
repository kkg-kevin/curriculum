const db = require("../../config/db");
const LeadModel = require("../leads/lead.model");
const LeadService = require("../leads/lead.service");
const LearnerService = require("../learners/learner.service");
const AuthService = require("../auth/auth.service");
const UserModel = require("../auth/user.model");
const TeacherModel = require("../teachers/teacher.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const PaymentLinks = require("../payments/payment-links");
const TotService = require("../tot/tot.service");
const { parentLoginFor } = require("../auth/parent-login");
const { resolveEffectiveBootcampPrice } = require("../../shared/utils/bootcamp-pricing");
const { slugify } = require("../../shared/utils/slugify");
const { ageFrom } = require("../../shared/utils/age");
const BootcampEnrollmentService = require("./bootcamp-enrollment.service");

const { money, raiseEnrollmentInvoice, cohortClassFor } = BootcampEnrollmentService.enrolmentHelpers;
const { placeOnBootcampPathway } = BootcampEnrollmentService;

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

// The website's sign-up for a TOT (training of trainers) bootcamp — bootcamps.audience
// "educators". The educator enrols themself, the way a family enrols a child
// (bootcamp-enrollment.service.js), and it ends on the same Payment step:
//   - their educator record: the one already under their email, or a new one in the bootcamp's
//     workspace, linked to the hub they chose;
//   - their login (email + password; an existing login proves its own password — parent-login.js)
//     with the educator role;
//   - their place in the bootcamp's TOT class at that hub — their own learner record
//     (TotService.enrol), waiting on payment ("pending_payment") when the bootcamp has a price;
//   - the website diagnostic they took before the form (attemptId), on their record, placing them on
//     the bootcamp's pathway at the course their score earns — as a child's does
//     (placeOnBootcampPathway). Skipped, they take the system's diagnostic in My learning;
//   - an enquiry (so they show among the bootcamp's participants) and one invoice, billed to them.
// Paying the invoice switches their training on (activateForPaidInvoice, invoiceType "bootcamp").
// Until then My learning is view-only (scope.middleware.js). Anything that fails part-way is undone.
const EducatorEnrollmentService = {
  async submitEducatorEnrollment(data, visitSource = null) {
    const { bootcamp, offering } = await BootcampEnrollmentService.resolveBootcampOffering(data.bootcampIdOrSlug, data.hubId, { audience: "educators" });
    // Their cohort: the one for their stage when the curriculum's cohorts are tied to stages.
    const classId = await cohortClassFor(offering, bootcamp.curriculumId, { attemptId: data.attemptId || null, age: data.dateOfBirth ? ageFrom(data.dateOfBirth) : null }) || offering.classIds[0];
    const hub = await LearningHubModel.findById(offering.hubId);
    const ownerAdminId = hub?.ownerAdminId || bootcamp.ownerAdminId;
    const email = data.email.trim().toLowerCase();
    const name = `${data.firstName} ${data.lastName}`.trim();

    // Checked before anything is written: an existing login must give its own password, and an
    // admin's login is never turned into an educator's from a public form.
    const existingLogin = await parentLoginFor(email, data.password);
    if (existingLogin && ["admin", "curriculumAdmin"].includes(existingLogin.role)) {
      fail("This email belongs to an administrator account — enrol with another email.", 409);
    }

    const price = resolveEffectiveBootcampPrice(bootcamp);
    const amount = Number(price.amount) > 0 ? money(price.amount) : null;

    const created = { teacherId: null, loginId: null, learnerId: null, hubLinked: false };
    let teacher = (await TeacherModel.findAll({ email }))[0] || null;
    // Already training (their own learner record): one class place per hub, so a place they hold
    // at this hub is never moved from a public form — signing up again for the same class says so,
    // another class at the same hub goes through the hub.
    const existingTrainee = teacher ? await db("learners").where({ teacherId: teacher.id }).first("id") : null;
    const placeHere = existingTrainee ? await db("learner_hub_links").where({ learnerId: existingTrainee.id, hubId: offering.hubId }).first() : null;
    if (placeHere && placeHere.status === "active") {
      fail(placeHere.classId === classId
        ? "You're already enrolled in this training — sign in and open My learning."
        : "You're already training at this hub — contact the hub to change your class.", 409);
    }
    let learner;
    try {
      if (!teacher) {
        teacher = await TeacherModel.create({
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phone: data.phone,
          // Not teaching yet: signs in and learns, but isn't given classes until an admin makes
          // them Active (teacher.validation.js's canTeach). An existing educator keeps theirs.
          status: "in_training",
          employmentType: "part_time",
          payRateTypes: ["session"],
          qualifiedCourseIds: [],
          createdByAdminId: ownerAdminId,
        });
        created.teacherId = teacher.id;
      }
      if (!(await db("teacher_hub_links").where({ teacherId: teacher.id, hubId: offering.hubId }).first())) {
        await TeacherHubLinkModel.link(teacher.id, offering.hubId);
        created.hubLinked = true;
      }
      const login = await AuthService.setOrCreatePassword({ name, email, password: data.password, role: "teacher" });
      if (!existingLogin) created.loginId = login?.id || (await UserModel.findByEmail(email))?.id || null;

      const hadTraining = await db("learners").where({ teacherId: teacher.id }).first("id");
      const training = await TotService.enrol(teacher, { hubId: offering.hubId, classId }, { ownerAdminId, pendingPayment: amount != null && !hadTraining, dateOfBirth: data.dateOfBirth || null });
      if (!hadTraining) created.learnerId = training.learnerId;
      learner = await db("learners").where({ id: training.learnerId }).first();
      // Already training elsewhere (their account stays active for that): only this new class
      // place waits on the payment — paying opens it (activateLead), the release job frees it.
      if (hadTraining && amount != null) {
        await db("learner_hub_links").where({ learnerId: learner.id, hubId: offering.hubId }).update({ status: "inactive", updatedAt: new Date() });
      }
    } catch (err) {
      if (created.learnerId) await LearnerService.deleteLearner(created.learnerId).catch(() => {});
      if (created.hubLinked) await TeacherHubLinkModel.unlink(teacher.id, offering.hubId).catch(() => {});
      if (created.teacherId) await TeacherModel.delete(created.teacherId).catch(() => {});
      if (created.loginId) await UserModel.delete(created.loginId).catch(() => {});
      throw err;
    }

    const lead = await LeadModel.create({
      source: "enroll",
      name,
      email,
      phone: data.phone,
      learnerName: name,
      interestedIn: "bootcamp",
      referenceId: slugify(bootcamp.name) || "bootcamp",
      message: [`Educator (training of trainers)`, data.organisation ? `teaches at ${data.organisation}` : null, data.attemptId ? `Diagnostic attempt: ${data.attemptId}` : null].filter(Boolean).join(" — "),
      learnerDateOfBirth: data.dateOfBirth || null,
      learnerAge: data.dateOfBirth ? ageFrom(data.dateOfBirth) : null,
      bootcampId: bootcamp.id,
      hubId: offering.hubId,
      learnerId: learner.id,
      visitSource,
    });
    await LeadService._notifyAdmins(lead).catch(() => {});

    // The website diagnostic they took joins their record and places them — never fails the sign-up.
    if (data.attemptId) {
      await require("../assessments/submissions/website-diagnostic.service").record(learner.id, data.attemptId)
        .catch((err) => console.error("[educator-enrollment] could not add the website diagnostic:", err.message));
    }
    await placeOnBootcampPathway(learner.id, bootcamp, offering.hubId, { attemptId: data.attemptId || null, age: data.dateOfBirth ? ageFrom(data.dateOfBirth) : null })
      .catch((err) => console.error("[educator-enrollment] could not place them on a pathway:", err.message));

    let invoice = null;
    if (amount != null) {
      invoice = await raiseEnrollmentInvoice({
        enrolled: [{ child: { learnerName: name }, lead, learner }],
        hubId: offering.hubId, bootcamp, amount, currency: price.currency || "KES",
      }).catch((err) => { console.error("[educator-enrollment] could not raise the invoice:", err.message); return null; });
      if (invoice) {
        await LeadModel.update(lead.id, { invoiceId: invoice.id });
        require("../billing/billing.service").emailIssuedInvoice(invoice.id);
      }
    }

    return {
      account: { email, existing: Boolean(existingLogin), name, phone: data.phone },
      payment: {
        amount: amount ?? price.amount,
        currency: price.currency,
        mode: price.mode,
        hubName: hub?.name || null,
        invoiceNumber: invoice?.invoiceNumber || null,
        pay: invoice ? await PaymentLinks.forWebsite(invoice, "bootcamp_enrollment") : null,
      },
    };
  },
};

module.exports = EducatorEnrollmentService;
