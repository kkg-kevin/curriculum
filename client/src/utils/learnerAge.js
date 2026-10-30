// A learner's age today — the client copy of server/src/shared/utils/age.js's learnerAge: from the
// date of birth, else from an age given without one (statedAge on statedAgeOn, plus the whole
// years since). Dates are "YYYY-MM-DD" on the Kenyan calendar.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const kenyaToday = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Whole years old today for a "YYYY-MM-DD" date — null if missing, unreadable or in the future. */
export function ageFrom(dateOfBirth, today = kenyaToday()) {
  if (!dateOfBirth) return null;
  const dob = String(dateOfBirth).slice(0, 10);
  if (!DATE.test(dob) || dob > today) return null;
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age < 120 ? age : null;
}

/** { age, fromBirthDate } — age null when neither a date of birth nor an age is on record. */
export function learnerAge(learner) {
  const fromBirth = ageFrom(learner?.dateOfBirth);
  if (fromBirth !== null) return { age: fromBirth, fromBirthDate: true };
  if (learner?.statedAge == null || learner.statedAge === "") return { age: null, fromBirthDate: false };
  return { age: Number(learner.statedAge) + (ageFrom(learner.statedAgeOn) ?? 0), fromBirthDate: false };
}

// Why a learner has no Developmental Stage at the selected hub, in a few words — or null when there's
// nothing to explain. `inClass`: they have a class there (and so a curriculum); `stages`: that
// curriculum's stages.
export function stagePendingReason({ learner, inClass, stages = [], staff = false }) {
  if (!inClass) return staff ? "Placed once they join a class" : "Placed once you join a class";
  const { age } = learnerAge(learner);
  if (age === null) return staff ? "Add a date of birth (or age) to place them" : "Needs your date of birth";
  const fits = stages.some((s) => (s.minAge == null || age >= s.minAge) && (s.maxAge == null || age <= s.maxAge));
  if (!fits) return `No stage for age ${age} in this curriculum`;
  return `Age ${age} — not placed yet`;
}
