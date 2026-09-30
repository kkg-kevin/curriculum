const { z } = require("zod");

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(""));

// Same phone rule the public enquiry form uses (lead.validation.js), so a household created from an
// enquiry and one typed in by staff are held to the same standard.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Use a valid date (YYYY-MM-DD)");

// A Google Maps link to the home: a share link (maps.app.goo.gl / goo.gl/maps) or a full
// google.<tld>/maps or maps.google.<tld> URL. Anything else is refused, since educators open it.
function isGoogleMapsUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  return /^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps");
}

const mapUrl = z.string().trim().max(2048).refine(isGoogleMapsUrl, "Paste a Google Maps link (e.g. https://maps.app.goo.gl/…)");

// Uploaded image URLs (from /api/uploads/image) that help the educator recognise the home.
const locationPhotos = z
  .array(z.string().trim().min(1).max(2048).regex(/^(https?:\/\/|\/)/, "Invalid photo"))
  .max(2, "Add at most two location photos");

const householdSchema = z.object({
  guardianName: z.string().trim().min(1, "Guardian name is required").max(150),
  guardianEmail: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  guardianPhone: phone,
  county: optionalText(100),
  subCounty: optionalText(100),
  town: optionalText(100),
  addressLine: optionalText(255),
  landmark: optionalText(255),
  mapUrl: mapUrl.optional().or(z.literal("")),
  locationPhotos: locationPhotos.optional(),
  packageId: z.string().min(1, "Choose a package"),
  // How many children the family is enrolling. Optional — defaults to the package's included
  // children; more than that is only accepted by a package that allows extra children.
  childCount: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["pending", "active", "paused", "cancelled"]).optional(),
  startDate: isoDate.optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  // Transient - never stored on the household. Creates or resets the parent's portal login for
  // guardianEmail (the same login learner.controller.js's `password` sets), through which the
  // parent sees their children and the household's invoices.
  portalPassword: z.string().min(8, "Parent portal password must be at least 8 characters").max(100).optional().or(z.literal("")),
});

const enrollmentSchema = z.object({
  learnerId: z.string().min(1, "Choose a learner"),
  curriculumId: z.string().min(1, "Choose a curriculum"),
  gradeId: z.string().min(1, "Choose a grade / level"),
  educatorId: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

// Registering a brand-new child — the enrollment half (learner is created from `learner`).
const newLearnerEnrollmentSchema = enrollmentSchema.omit({ learnerId: true });

const money = z.coerce.number().int("Use whole shillings").min(0).max(10_000_000);

// A Home Learning package as the admin edits it (Home Learning → Packages).
const packageSchema = z.object({
  name: z.string().trim().min(1, "Package name is required").max(150),
  slug: z.string().trim().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").optional().or(z.literal("")),
  summary: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  childrenIncluded: z.coerce.number().int().min(1, "A package includes at least 1 child").max(50),
  monthlyAmount: money,
  allowExtraChildren: z.boolean().default(false),
  extraChildAmount: money.nullable().optional(),
  maxChildren: z.coerce.number().int().min(1).max(50).optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  badge: z.string().trim().max(40).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  status: z.enum(["active", "archived"]).default("active"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).superRefine((data, ctx) => {
  if (data.allowExtraChildren) {
    if (data.extraChildAmount == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["extraChildAmount"], message: "Set the price per extra child" });
    if (data.maxChildren != null && data.maxChildren <= data.childrenIncluded) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxChildren"], message: "Maximum children must be more than the children included" });
  }
});

// "YYYY-MM" — the month an invoice covers.
const invoiceSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month (YYYY-MM)"),
  dueDate: isoDate.optional().or(z.literal("")),
});

// A family signing up on the website (POST /api/public/home-learning/signups — see
// home-learning-signup.service.js). The parent's email + password become their portal login; each
// child gets their own username + password. The admin places each child (curriculum, grade,
// educator) after sign-up, so the form only asks for what helps with that (current school/grade).
const username = z.string().trim()
  .min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Usernames can only use letters, numbers, dots, underscores and hyphens");
const loginPassword = z.string().min(8, "Passwords must be at least 8 characters").max(72, "Passwords must be at most 72 characters");
const requiredText = (max, message) => z.string().trim().min(1, message).max(max);

const signupChildSchema = z.object({
  firstName: requiredText(80, "Enter each child's first name"),
  lastName: requiredText(80, "Enter each child's last name"),
  gender: z.enum(["female", "male", "other"], { errorMap: () => ({ message: "Choose each child's gender" }) }),
  dateOfBirth: isoDate.optional().or(z.literal("")),
  currentGrade: optionalText(150),
  username,
  password: loginPassword,
});

const signupSchema = z.object({
  packageSlug: requiredText(160, "Choose a package"),
  parent: z.object({
    name: requiredText(150, "Enter your name"),
    email: z.string().trim().email("Enter a valid email address").max(255),
    phone,
    password: loginPassword,
  }),
  children: z.array(signupChildSchema).min(1, "Add at least one child").max(20, "Up to 20 children per sign-up"),
  home: z.object({
    county: requiredText(100, "Enter your county"),
    subCounty: optionalText(100),
    town: requiredText(100, "Enter your town or area"),
    addressLine: requiredText(255, "Enter your home address"),
    landmark: optionalText(255),
    mapUrl: mapUrl.optional().or(z.literal("")),
  }),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to us storing your family's details" }) }),
}).superRefine((data, ctx) => {
  const seen = new Set();
  data.children.forEach((child, index) => {
    const key = child.username.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["children", index, "username"], message: `Each child needs a different username ("${child.username}" is used twice)` });
    seen.add(key);
  });
});

// Admin → "Approve payment" on a website sign-up: the cash (or other) payment received.
const approveSignupSchema = z.object({
  amount: z.coerce.number().positive("Enter the amount received"),
  paymentMethod: z.enum(["cash", "bank_transfer", "mpesa_manual", "cheque", "card_manual", "other"]).default("cash"),
  providerReference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(255).optional().or(z.literal("")),
});

// signupChildSchema is also what a parent fills in to add a child from their own account.
module.exports = { signupSchema, signupChildSchema, approveSignupSchema, householdSchema, enrollmentSchema, newLearnerEnrollmentSchema, invoiceSchema, packageSchema };
