import { NATIONALITIES, LANGUAGES } from "../schemas/learner.schema";

// Tidying a bulk-import row for the preview — mirrors the server's
// modules/learners/learner.import.js (the source of truth, which runs the same rules again), plus
// matching nationality and languages to the learner form's own lists.

export const TEMPLATE_HEADERS = ["First Name", "Last Name", "Gender", "Guardian Name", "Guardian Phone", "Guardian Email", "Username", "Date of Birth", "Nationality", "Languages"];
export const TEMPLATE_EXAMPLE = ["Amina", "Otieno", "female", "Grace Otieno", "+254712345678", "grace.otieno@example.com", "amina.otieno", "2015-03-12", "Kenyan", "English, Swahili"];
export const TEMPLATE_FIELDS = ["firstName", "lastName", "gender", "guardianName", "guardianPhone", "guardianEmail", "username", "dateOfBirth", "nationality", "languages"];

const GENDERS = { m: "male", male: "male", boy: "male", f: "female", female: "female", girl: "female" };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

export function normalizeGender(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return GENDERS[key] || key;
}

export function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: "" };
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(raw)) {
    return { error: `Guardian phone "${raw}" was turned into a number by Excel — format the column as Text and type the number again` };
  }
  if (/[^\d\s+()\-./]/.test(raw)) return { error: `Guardian phone "${raw}" isn't a phone number` };
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return { value: `+${digits}` };
  if (!plus && digits.startsWith("0") && digits.length === 10) return { value: `+254${digits.slice(1)}` };
  if (!plus && digits.length === 9 && /^[17]/.test(digits)) return { value: `+254${digits}` };
  if (digits.length >= 7 && digits.length <= 15) return { value: plus ? `+${digits}` : digits };
  return { error: `Guardian phone "${raw}" doesn't look like a phone number` };
}

function isoDate(year, month, day) {
  let y = year;
  if (y < 100) y += y <= new Date().getFullYear() % 100 ? 2000 : 1900;
  const date = new Date(Date.UTC(y, month - 1, day));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}
const monthOf = (name) => MONTHS[String(name).slice(0, 3).toLowerCase()] || null;

export function parseDateOfBirth(value, today = new Date()) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: "" };
  let out = null;
  let ambiguous = false;
  let m;
  if ((m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    out = isoDate(+m[1], +m[2], +m[3]);
  } else if ((m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
    const a = +m[1];
    const b = +m[2];
    const [day, month] = a > 12 || b <= 12 ? [a, b] : [b, a];
    ambiguous = a <= 12 && b <= 12 && a !== b;
    out = isoDate(+m[3], month, day);
  } else if ((m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{2}|\d{4})$/))) {
    out = monthOf(m[2]) && isoDate(+m[3], monthOf(m[2]), +m[1]);
  } else if ((m = raw.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/))) {
    out = monthOf(m[1]) && isoDate(+m[3], monthOf(m[1]), +m[2]);
  } else if (/^\d{4,5}$/.test(raw) && +raw > 3000) {
    out = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000).toISOString().slice(0, 10);
  }
  if (!out) return { error: `Date of birth "${raw}" isn't a date we can read — use YYYY-MM-DD, e.g. 2015-03-12` };
  if (out > today.toISOString().slice(0, 10)) return { error: `Date of birth ${out} is in the future` };
  if (out < "1900-01-01") return { error: `Date of birth ${out} is too long ago` };
  return { value: out, ambiguous };
}

const nameKey = (r) => `${String(r.firstName || "").trim().toLowerCase().replace(/\s+/g, " ")}|${String(r.lastName || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-9);
export function sameLearner(a, b) {
  if (nameKey(a) !== nameKey(b)) return false;
  const pa = phoneKey(a.guardianPhone);
  if (pa && pa === phoneKey(b.guardianPhone)) return true;
  return Boolean(a.dateOfBirth && b.dateOfBirth && a.dateOfBirth === b.dateOfBirth);
}

const isTemplateExample = (row) =>
  (row.firstName || "").toLowerCase() === "amina" && (row.lastName || "").toLowerCase() === "otieno"
  && (row.guardianEmail || "").toLowerCase() === "grace.otieno@example.com";

// "kenyan" → "Kenyan"; a country name the list doesn't hold is kept as typed (and flagged).
const byLower = (list) => new Map(list.map((v) => [v.toLowerCase(), v]));
const NATIONALITY_BY_LOWER = byLower(NATIONALITIES);
const LANGUAGE_BY_LOWER = byLower(LANGUAGES);
const COUNTRY_TO_NATIONALITY = { kenya: "Kenyan", uganda: "Ugandan", tanzania: "Tanzanian", rwanda: "Rwandan", burundi: "Burundian", ethiopia: "Ethiopian", somalia: "Somali", "south sudan": "South Sudanese", nigeria: "Nigerian", ghana: "Ghanaian" };

// One row tidied for the preview: { data, errors, notes }. `notes` aren't errors — the row still
// imports — but say how something was read (an ambiguous date) or that a value isn't on the list.
export function cleanRow(input) {
  const data = {};
  Object.entries(input).forEach(([k, v]) => { data[k] = (v ?? "").toString().trim(); });
  const errors = [];
  const notes = [];
  if (data.gender) data.gender = normalizeGender(data.gender);
  if (data.guardianPhone) {
    const p = normalizePhone(data.guardianPhone);
    if (p.error) errors.push(p.error); else data.guardianPhone = p.value;
  }
  if (data.dateOfBirth) {
    const d = parseDateOfBirth(data.dateOfBirth);
    if (d.error) errors.push(d.error);
    else {
      if (d.ambiguous) notes.push(`date of birth "${data.dateOfBirth}" read as ${new Date(`${d.value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
      data.dateOfBirth = d.value;
    }
  }
  if (data.guardianEmail) data.guardianEmail = data.guardianEmail.toLowerCase();
  if (data.nationality) {
    const lower = data.nationality.toLowerCase();
    const match = NATIONALITY_BY_LOWER.get(lower) || COUNTRY_TO_NATIONALITY[lower];
    if (match) data.nationality = match; else notes.push(`nationality "${data.nationality}" isn't on the list — kept as typed`);
  }
  if (data.languages) {
    data.languages = data.languages.split(/[,;/]/).map((l) => l.trim()).filter(Boolean)
      .map((l) => LANGUAGE_BY_LOWER.get(l.toLowerCase()) || l).join(", ");
  }

  if (!data.firstName) errors.push("First name is required");
  if (!data.lastName) errors.push("Last name is required");
  if (!["male", "female"].includes(data.gender || "")) errors.push("Gender must be male or female (M / F also work)");
  if (!data.guardianName) errors.push("Guardian name is required");
  if (!data.guardianPhone && !errors.some((e) => e.startsWith("Guardian phone"))) errors.push("Guardian phone is required");
  if (data.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guardianEmail)) errors.push("Guardian email isn't valid");
  if (isTemplateExample(data)) errors.push("This is the template's example row — delete it before importing");
  return { data, errors, notes };
}

// The rows to fix, as a CSV in the template's columns plus what's wrong — to correct and upload
// again. `rows`: [{ sheetRow, data, error }].
export function fixFileRows(rows) {
  return [
    ["Row in your file", ...TEMPLATE_HEADERS, "What to fix"],
    ...rows.map((r) => [r.sheetRow, ...TEMPLATE_FIELDS.map((f) => r.data[f] || ""), r.error]),
  ];
}
