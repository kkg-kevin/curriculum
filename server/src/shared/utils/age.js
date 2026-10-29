const { z } = require("zod");

// The website asks every family for a child's date of birth, never an age; the age is worked out
// from it here, on the Kenyan calendar (UTC+3, no daylight saving).

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const kenyaToday = (now = new Date()) => new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Whole years old on `today` for a "YYYY-MM-DD" date of birth — null if missing, unreadable or in the future. */
function ageFrom(dateOfBirth, today = kenyaToday()) {
  if (!dateOfBirth) return null;
  const dob = String(dateOfBirth).slice(0, 10);
  if (!DATE.test(dob) || dob > today) return null;
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age < 120 ? age : null;
}

// An optional learner date of birth on a public form — a child of 3 to 19, like the website's own check.
const learnerDateOfBirth = z
  .string()
  .trim()
  .regex(DATE, "Enter the learner's date of birth")
  .refine((dob) => {
    const age = ageFrom(dob);
    return age !== null && age >= 3 && age <= 19;
  }, "The learner must be between 3 and 19 years old")
  .optional()
  .nullable();

module.exports = { ageFrom, kenyaToday, learnerDateOfBirth };
