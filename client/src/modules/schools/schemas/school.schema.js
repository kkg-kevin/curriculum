import { z } from "zod";

export const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Muranga","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
  "Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana",
  "Uasin Gishu","Vihiga","Wajir","West Pokot",
];

export const schoolSchema = z.object({
  name: z.string().min(1, "School name is required").max(150, "Max 150 characters"),
  code: z
    .string()
    .min(1, "School code is required")
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, and hyphens"),
  email: z
    .string()
    .email("Invalid email address")
    .or(z.literal(""))
    .default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  address: z.object({
    street: z.string().max(200).default(""),
    city: z.string().max(100).default(""),
    county: z.string().min(1, "County is required").refine(
      (v) => KENYA_COUNTIES.includes(v),
      { message: "Select a valid Kenyan county" }
    ),
  }),
  curriculumId: z.string().or(z.literal("")).nullable().default(""),
  status: z.enum(["active", "inactive"]).default("active"),
});
