const SchoolModel  = require("../../modules/schools/school.model");
const TeacherModel = require("../../modules/teachers/teacher.model");
const LearnerModel = require("../../modules/learners/learner.model");

// Resolves the caller's own School/Teacher/Learner record from their JWT email and attaches it
// to req — school and teacher accounts match on their own email; a learner account logs in as
// the guardian, so it matches guardianEmail instead. Route handlers scope every query and
// ownership check off these attached records, never off client-supplied ids, so a role can't
// widen its own access by editing a query param or path param.
function attachOwnRecords(req, res, next) {
  const { role, email } = req.user;
  if (role === "school")  req.ownSchool  = SchoolModel.findAll({ email })[0] || null;
  if (role === "teacher") req.ownTeacher = TeacherModel.findAll({ email })[0] || null;
  if (role === "learner") req.ownLearner = LearnerModel.findAll({ guardianEmail: email })[0] || null;
  next();
}

// Throws a 403 unless `condition` holds — used once a record is loaded to confirm it actually
// belongs to the caller's own scope (their school, their class, their own learner record, etc).
function assertOwn(condition) {
  if (!condition) {
    const err = new Error("You do not have permission to access this record");
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { attachOwnRecords, assertOwn };
