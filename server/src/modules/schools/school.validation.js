const { z } = require("zod");

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Muranga","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
  "Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana",
  "Uasin Gishu","Vihiga","Wajir","West Pokot",
];

const addressSchema = z.object({
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  county: z.string().refine((v) => KENYA_COUNTIES.includes(v), {
    message: "Please select a valid county",
  }),
});

const createSchoolSchema = z.object({
  name: z.string().min(1, "School name is required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(1, "School code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens"),
  email: z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  address: addressSchema,
  curriculumId: z.string().or(z.literal("")).nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateSchoolSchema = createSchoolSchema.partial().extend({
  address: addressSchema.partial().optional(),
});

module.exports = { createSchoolSchema, updateSchoolSchema, KENYA_COUNTIES };
