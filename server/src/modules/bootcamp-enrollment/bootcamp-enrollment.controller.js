const asyncHandler = require("express-async-handler");
const BootcampEnrollmentService = require("./bootcamp-enrollment.service");
const { visitSourceFrom } = require("../leads/visit-source");
const EducatorEnrollmentService = require("./educator-enrollment.service");
const { submitBootcampEnrollmentSchema, submitEducatorEnrollmentSchema, markLeadPaidSchema } = require("./bootcamp-enrollment.validation");

const submitBootcampEnrollment = asyncHandler(async (req, res) => {
  const data = submitBootcampEnrollmentSchema.parse(req.body);
  const result = await BootcampEnrollmentService.submitBootcampEnrollment(data, visitSourceFrom(req));
  res.status(201).json({ success: true, data: result });
});

// A TOT bootcamp's sign-up — the educator enrols themself (educator-enrollment.service.js).
const submitEducatorEnrollment = asyncHandler(async (req, res) => {
  const data = submitEducatorEnrollmentSchema.parse(req.body);
  const result = await EducatorEnrollmentService.submitEducatorEnrollment(data, visitSourceFrom(req));
  res.status(201).json({ success: true, data: result });
});

const markLeadPaid = asyncHandler(async (req, res) => {
  const data = markLeadPaidSchema.parse(req.body);
  const result = await BootcampEnrollmentService.markLeadPaid(req.params.id, data, req.user.id);
  res.json({ success: true, data: result });
});

module.exports = { submitBootcampEnrollment, submitEducatorEnrollment, markLeadPaid };
