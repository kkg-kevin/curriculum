const { z } = require("zod");
const {
  signupChildSchema, approveSignupSchema, invoiceSchema, packageSchema, phone, loginPassword, requiredText,
} = require("../home-learning/home-learning.validation");

// Tech Clubs reuse Home Learning's rules wherever the two mean the same thing: a package's
// pricing fields (packageSchema), a child on the sign-up form (signupChildSchema), the payment
// recorded on "Approve payment" (approveSignupSchema) and the month an invoice covers
// (invoiceSchema). Only what's club-specific is defined here.

// Which clubs a package is offered at — empty means every club. Parsed alongside packageSchema
// (which is refined, so it can't be extended).
const packageClubsSchema = z.object({
  hubIds: z.array(z.string().trim().min(1).max(36)).max(100).default([]),
});

// A family signing up on the website (POST /api/public/clubs/signups — see club-signup.service.js).
// The club is where the children learn, so unlike Home Learning there's no home address.
const signupSchema = z.object({
  hubId: requiredText(36, "Choose a club"),
  packageSlug: requiredText(160, "Choose a package"),
  parent: z.object({
    name: requiredText(150, "Enter your name"),
    email: z.string().trim().email("Enter a valid email address").max(255),
    phone,
    password: loginPassword,
  }),
  children: z.array(signupChildSchema).min(1, "Add at least one child").max(20, "Up to 20 children per sign-up"),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to us storing your family's details" }) }),
}).superRefine((data, ctx) => {
  const seen = new Set();
  data.children.forEach((child, index) => {
    const key = child.username.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["children", index, "username"], message: `Each child needs a different username ("${child.username}" is used twice)` });
    seen.add(key);
  });
});

// Admin edits to a membership. Package/child-count changes re-price it (club.service.js).
const membershipUpdateSchema = z.object({
  guardianName: z.string().trim().min(1, "Parent name is required").max(150).optional(),
  guardianPhone: phone.optional(),
  packageId: z.string().min(1).optional(),
  childCount: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["pending", "active", "paused", "cancelled"]).optional(),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

// Placing a child: the class at the membership's club they join (null = back to awaiting placement).
const placeChildSchema = z.object({
  classId: z.string().min(1).nullable(),
});

module.exports = {
  signupSchema, signupChildSchema, approveSignupSchema, invoiceSchema, packageSchema, packageClubsSchema,
  membershipUpdateSchema, placeChildSchema,
};
