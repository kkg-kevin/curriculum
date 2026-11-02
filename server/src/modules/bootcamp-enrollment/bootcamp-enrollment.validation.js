const { z } = require("zod");
const { learnerDateOfBirth } = require("../../shared/utils/age");

// Mirrors lead.validation.js's phone pattern — same reasoning: the website already validates
// client-side, this is the server-side copy so a request bypassing the browser can't skip it.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

// One child on a bootcamp enrolment. username/password are the learner's OWN chosen login (see
// auth.service.js's setOrCreatePasswordByUsername) — the visitor picks both on the form instead of
// the system minting a firstname.lastname@digifunzi.com address and an 8-digit temporary password.
// Same username shape as learner.validation.js's own field so the two stay consistent; password
// only needs to be memorable (a bootcamp learner's own account, not staff), so just a length floor.
// The website sends the date of birth (the age is then worked out from it — the service); an older
// website sends only an age. attemptId ties the child to the website diagnostic they took.
const enrollmentChildSchema = z.object({
  learnerName: z.string().trim().min(2, "Please enter the learner's name").max(120),
  learnerAge: z.coerce.number().int().min(3).max(19).optional().nullable(),
  learnerDateOfBirth,
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  attemptId: z.string().trim().max(100).optional().nullable(),
}).refine((c) => c.learnerDateOfBirth || c.learnerAge != null, { message: "Enter the learner's date of birth", path: ["learnerDateOfBirth"] });

// An older website sends one child as flat fields (learnerName, username, …) — the same as
// children: [that child].
function withChildren(body) {
  if (!body || typeof body !== "object" || Array.isArray(body.children) || !body.learnerName) return body;
  const { learnerName, learnerAge, learnerDateOfBirth, username, password, attemptId, ...rest } = body;
  return { ...rest, attemptId, children: [{ learnerName, learnerAge, learnerDateOfBirth, username, password, attemptId }] };
}

// POST /api/public/bootcamp-enrollments body. Unlike the generic lead schema (parentPhone
// optional), phone is REQUIRED here — this parent becomes the account's real contact, not an
// optional follow-up channel. bootcampIdOrSlug is never shown to the visitor; it comes from
// whichever bootcamp page/diagnostic report the form is rendered on.
//
// One enrolment can sign up several children (siblings) at once: each gets their own learner
// record and login, all under the one parent login, on one invoice.
//
// The parent's login: their password (a new login's, or the existing login's under that email),
// OR a parent token (auth/parent-signup.js) — they proved the password earlier in this visit, by
// "Sign in" or a sign-up just made ("Enrol another child").
const submitBootcampEnrollmentSchema = z.preprocess(withChildren, z.object({
  bootcampIdOrSlug: z.string().trim().min(1, "Bootcamp is required"),
  parentName: z.string().trim().min(2, "Please enter your name").max(120),
  parentEmail: z.string().trim().email("Enter a valid email address").max(160),
  parentPhone: phone,
  parentPassword: z.string().min(6, "Your password must be at least 6 characters").max(72).optional(),
  parentToken: z.string().trim().max(2000).optional(),
  children: z.array(enrollmentChildSchema).min(1, "Add at least one learner").max(6, "Up to 6 learners in one enrolment"),
  // Which of the bootcamp's hubs (bootcamp_hubs) the visitor wants to attend — required only
  // when the bootcamp actually runs at more than one; the service falls back to auto-picking
  // when this is omitted (single-hub bootcamps never show the picker at all).
  hubId: z.string().trim().max(64).optional().nullable(),
  // The diagnostic attempt that led here (an older website sends it here, not on the child) —
  // never validated against a real attempt row, never required.
  attemptId: z.string().trim().max(100).optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.parentPassword && !data.parentToken) {
    ctx.addIssue({ code: "custom", path: ["parentPassword"], message: "Enter your password" });
  }
  const seen = new Set();
  data.children.forEach((child, i) => {
    const key = child.username.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["children", i, "username"], message: "Each learner needs their own username" });
    seen.add(key);
  });
}));

// POST /api/leads/:id/mark-paid body — a manually-recorded cash payment. amount is entered by
// the admin (there's no automated price lookup at payment time — see
// bootcamp-enrollment.service.js's markLeadPaid), defaulting client-side to the bootcamp's own
// priceAmount but always editable/confirmable since this is what was ACTUALLY received.
const markLeadPaidSchema = z.object({
  amount: z.coerce.number().positive("Enter the amount received"),
  currency: z.string().trim().max(8).optional().default("KES"),
  description: z.string().trim().max(255).optional().nullable(),
});

module.exports = { submitBootcampEnrollmentSchema, markLeadPaidSchema, enrollmentChildSchema, withChildren, phone };
