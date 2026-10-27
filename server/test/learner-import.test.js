const test = require("node:test");
const assert = require("node:assert/strict");

// Bulk-importing learners: tidying a spreadsheet row and spotting the same child twice — pure,
// no database (modules/learners/learner.import.js).
const { normalizeGender, normalizePhone, parseDateOfBirth, sameLearner, cleanImportRow } = require("../src/modules/learners/learner.import");

test("dates of birth in the ways a sheet writes them", () => {
  const today = new Date("2026-10-27T12:00:00Z");
  const read = (v) => parseDateOfBirth(v, today).value;
  assert.equal(read("2015-03-12"), "2015-03-12");
  assert.equal(read("2015/3/9"), "2015-03-09");
  assert.equal(read("12/03/2015"), "2015-03-12"); // day first, as in Kenya
  assert.equal(parseDateOfBirth("12/03/2015", today).ambiguous, true);
  assert.equal(read("25/03/2015"), "2015-03-25");
  assert.equal(read("03/25/2015"), "2015-03-25"); // only month-first can be right
  assert.equal(read("12-3-15"), "2015-03-12");
  assert.equal(read("12 Mar 2015"), "2015-03-12");
  assert.equal(read("12th March 2015"), "2015-03-12");
  assert.equal(read("March 12, 2015"), "2015-03-12");
  assert.equal(read("42075"), "2015-03-12"); // Excel's day number
  assert.equal(read(""), "");
});

test("dates of birth that can't be right are refused", () => {
  const today = new Date("2026-10-27T12:00:00Z");
  assert.match(parseDateOfBirth("31/02/2015", today).error, /isn't a date we can read/);
  assert.match(parseDateOfBirth("next year", today).error, /isn't a date we can read/);
  assert.match(parseDateOfBirth("2027-01-01", today).error, /in the future/);
});

test("phone numbers end up in one form", () => {
  assert.equal(normalizePhone("0712345678").value, "+254712345678");
  assert.equal(normalizePhone("0712 345 678").value, "+254712345678");
  assert.equal(normalizePhone("254712345678").value, "+254712345678");
  assert.equal(normalizePhone("+254 712-345-678").value, "+254712345678");
  assert.equal(normalizePhone("712345678").value, "+254712345678"); // Excel dropped the 0
  assert.equal(normalizePhone("0110123456").value, "+254110123456");
  assert.equal(normalizePhone("+44 20 7946 0958").value, "+442079460958");
  assert.match(normalizePhone("2.54712E+11").error, /turned into a number by Excel/);
  assert.match(normalizePhone("call me").error, /isn't a phone number/);
  assert.match(normalizePhone("123").error, /doesn't look like a phone number/);
});

test("gender words people use", () => {
  assert.equal(normalizeGender("M"), "male");
  assert.equal(normalizeGender("Girl"), "female");
  assert.equal(normalizeGender(" FEMALE "), "female");
  assert.equal(normalizeGender("other"), "other");
});

test("the same child, by name and guardian phone or date of birth", () => {
  const a = { firstName: "Amani", lastName: "Kip", guardianPhone: "0712345678", dateOfBirth: "" };
  assert.equal(sameLearner(a, { firstName: "amani ", lastName: "KIP", guardianPhone: "+254712345678" }), true);
  assert.equal(sameLearner({ ...a, guardianPhone: "", dateOfBirth: "2015-03-12" }, { firstName: "Amani", lastName: "Kip", dateOfBirth: "2015-03-12" }), true);
  assert.equal(sameLearner(a, { firstName: "Amani", lastName: "Kip", guardianPhone: "0799999999" }), false);
  assert.equal(sameLearner(a, { firstName: "Baraka", lastName: "Kip", guardianPhone: "0712345678" }), false);
});

test("a row is tidied, and the template's example row refused", () => {
  const { row, errors } = cleanImportRow({ firstName: " Zawadi ", lastName: "Mwangi", gender: "F", guardianPhone: "0722000111", dateOfBirth: "05/06/2016", guardianEmail: "Mama@Example.com" });
  assert.deepEqual(errors, []);
  assert.equal(row.firstName, "Zawadi");
  assert.equal(row.gender, "female");
  assert.equal(row.guardianPhone, "+254722000111");
  assert.equal(row.dateOfBirth, "2016-06-05");
  assert.equal(row.guardianEmail, "mama@example.com");
  const example = cleanImportRow({ firstName: "Amina", lastName: "Otieno", gender: "female", guardianPhone: "+254712345678", guardianEmail: "grace.otieno@example.com" });
  assert.match(example.errors.join(), /template's example row/);
});
