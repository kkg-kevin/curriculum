import { z } from "zod";

// Full world list, as nationalities (not country names) — matches the field's own label and the
// shape of data already on existing records (e.g. "Kenyan", not "Kenya").
export const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguan and Barbudan",
  "Argentine", "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini",
  "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese",
  "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British", "Bruneian", "Bulgarian",
  "Burkinabe", "Burmese", "Burundian", "Cabo Verdean", "Cambodian", "Cameroonian", "Canadian",
  "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran",
  "Congolese (DRC)", "Congolese (Republic)", "Costa Rican", "Croatian", "Cuban", "Cypriot",
  "Czech", "Danish", "Djiboutian", "Dominican", "Dutch", "East Timorese", "Ecuadorian",
  "Egyptian", "Emirati", "Equatorial Guinean", "Eritrean", "Estonian", "Eswatini (Swazi)",
  "Ethiopian", "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian",
  "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guinea-Bissauan",
  "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian",
  "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese",
  "Jordanian", "Kazakhstani", "Kenyan", "Kiribati", "Kosovar", "Kuwaiti", "Kyrgyz", "Laotian",
  "Latvian", "Lebanese", "Basotho (Lesotho)", "Liberian", "Libyan", "Liechtensteiner",
  "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian",
  "Maldivian", "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican",
  "Micronesian", "Moldovan", "Monacan", "Mongolian", "Montenegrin", "Moroccan", "Mozambican",
  "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerien", "Nigerian",
  "North Korean", "Norwegian", "Omani", "Pakistani", "Palauan", "Palestinian", "Panamanian",
  "Papua New Guinean", "Paraguayan", "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian",
  "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean",
  "Saudi Arabian", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean",
  "Slovak", "Slovenian", "Solomon Islander", "Somali", "South African", "South Korean",
  "South Sudanese", "Spanish", "Sri Lankan", "Sudanese", "Surinamese", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajikistani", "Tanzanian", "Thai", "Togolese", "Tongan",
  "Trinidadian and Tobagonian", "Tunisian", "Turkish", "Turkmen", "Tuvaluan", "Ugandan",
  "Ukrainian", "Uruguayan", "Uzbekistani", "Vanuatuan", "Venezuelan", "Vietnamese", "Yemeni",
  "Zambian", "Zimbabwean",
];

// Major world languages — not exhaustive (there's no practical "full list" for spoken
// languages), covers the ones a learner's guardian is overwhelmingly likely to pick.
export const LANGUAGES = [
  "English", "Mandarin Chinese", "Hindi", "Spanish", "French", "Arabic", "Bengali",
  "Portuguese", "Russian", "Urdu", "Indonesian", "German", "Japanese", "Swahili", "Punjabi",
  "Vietnamese", "Turkish", "Korean", "Italian", "Thai", "Persian (Farsi)", "Polish",
  "Ukrainian", "Dutch", "Greek", "Hebrew",
];

const baseLearnerSchema = z.object({
  firstName:     z.string().min(1, "First name is required"),
  lastName:      z.string().min(1, "Last name is required"),
  gender:        z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  dateOfBirth:   z.string().optional().or(z.literal("")),
  nationality:   z.string().optional().or(z.literal("")),
  languages:     z.string().optional().or(z.literal("")),
  // The learner's own login identifier — either logs into the guardian-owned account (if no
  // dedicated learnerPassword has been set yet) or their own separate account (once one has).
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed")
    .optional().or(z.literal("")),
  schoolId:      z.string().default(""),
  classId:       z.string().default(""),
  guardianName:  z.string().min(1, "Guardian name is required"),
  guardianPhone: z.string().min(1, "Guardian phone is required"),
  guardianEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  // Transient — never stored on the learner record. When present, creates or resets the
  // matching guardian's learner-portal login for guardianEmail.
  password:      z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  // Transient — never stored. When present, creates or resets the LEARNER's OWN separate
  // portal login (distinct from the guardian's `password` above), keyed by username.
  learnerPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  status:        z.enum(["active", "inactive", "transferred", "graduated"]).default("active"),
  photo: z.string().optional().nullable(),
});

export const createLearnerSchema = baseLearnerSchema.superRefine((data, ctx) => {
  if (data.password && !data.guardianEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianEmail"], message: "Guardian email is required to set a password" });
  }
  if (data.learnerPassword && !data.username) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["username"], message: "Username is required to set a learner-portal password" });
  }
});

export const updateLearnerSchema = baseLearnerSchema.partial();
