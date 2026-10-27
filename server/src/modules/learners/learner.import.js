// Cleaning up a bulk-import spreadsheet row (learner.controller.js's bulkImportLearners) — the
// shapes Excel and people actually produce. The client mirrors these for its preview
// (client/src/modules/learners/utils/importRows.js); this is the source of truth.

// The template's own example row (BulkImportLearnersPanel.jsx's TEMPLATE_EXAMPLE) — left in by
// mistake, it would create a learner who doesn't exist.
const TEMPLATE_EXAMPLE = { firstName: "Amina", lastName: "Otieno", guardianEmail: "grace.otieno@example.com" };

const GENDERS = { m: "male", male: "male", boy: "male", f: "female", female: "female", girl: "female" };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// "M", "Boy", "FEMALE" → male / female. Anything else is left for the schema to refuse.
function normalizeGender(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return GENDERS[key] || key;
}

// A Kenyan mobile in one form: +2547XXXXXXXX (or +2541…). "0712…", "254712…", "712 345 678"
// (Excel dropped the 0) all become that; another country's number (+…) or a landline is kept, digits
// only. A number Excel turned into "2.54712E+11" has lost digits — it can't be recovered.
function normalizePhone(value) {
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

// A date of birth as YYYY-MM-DD, from the ways a sheet writes one: 2015-03-12, 12/03/2015 (day
// first, as in Kenya — unless only month-first can be right, like 03/25/2015), 12-3-15, 12 Mar 2015,
// March 12, 2015, or Excel's day number (42075). `ambiguous` — read day first when either order
// works, so the preview can say how it was read.
function parseDateOfBirth(value, today = new Date()) {
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
    // Excel's date serial: days since 30 Dec 1899.
    const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    out = date.toISOString().slice(0, 10);
  }
  if (!out) return { error: `Date of birth "${raw}" isn't a date we can read — use YYYY-MM-DD, e.g. 2015-03-12` };
  const todayIso = today.toISOString().slice(0, 10);
  if (out > todayIso) return { error: `Date of birth ${out} is in the future` };
  if (out < "1900-01-01") return { error: `Date of birth ${out} is too long ago` };
  return { value: out, ambiguous };
}

const isTemplateExample = (row) =>
  String(row.firstName || "").trim().toLowerCase() === TEMPLATE_EXAMPLE.firstName.toLowerCase()
  && String(row.lastName || "").trim().toLowerCase() === TEMPLATE_EXAMPLE.lastName.toLowerCase()
  && String(row.guardianEmail || "").trim().toLowerCase() === TEMPLATE_EXAMPLE.guardianEmail;

// The same child twice: same first and last name, and the same guardian phone (its last 9
// digits, so 07… and +254 7… match) or the same date of birth.
const nameKey = (r) => `${String(r.firstName || "").trim().toLowerCase().replace(/\s+/g, " ")}|${String(r.lastName || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-9);
function sameLearner(a, b) {
  if (nameKey(a) !== nameKey(b)) return false;
  const pa = phoneKey(a.guardianPhone);
  if (pa && pa === phoneKey(b.guardianPhone)) return true;
  return Boolean(a.dateOfBirth && b.dateOfBirth && String(a.dateOfBirth).slice(0, 10) === String(b.dateOfBirth).slice(0, 10));
}

// One row, tidied: trimmed, gender / phone / date of birth in their one form, email lower-case —
// plus what's wrong with it beyond what the schema checks.
function cleanImportRow(raw) {
  const row = {};
  for (const [key, value] of Object.entries(raw || {})) row[key] = typeof value === "string" ? value.trim() : value;
  const errors = [];
  if (row.gender) row.gender = normalizeGender(row.gender);
  if (row.guardianPhone) {
    const phone = normalizePhone(row.guardianPhone);
    if (phone.error) errors.push(phone.error); else row.guardianPhone = phone.value;
  }
  if (row.dateOfBirth) {
    const dob = parseDateOfBirth(row.dateOfBirth);
    if (dob.error) errors.push(dob.error); else row.dateOfBirth = dob.value;
  }
  if (row.guardianEmail) row.guardianEmail = String(row.guardianEmail).toLowerCase();
  if (isTemplateExample(row)) errors.push("This is the template's example row — delete it before importing");
  return { row, errors };
}

module.exports = { TEMPLATE_EXAMPLE, normalizeGender, normalizePhone, parseDateOfBirth, isTemplateExample, sameLearner, cleanImportRow };
