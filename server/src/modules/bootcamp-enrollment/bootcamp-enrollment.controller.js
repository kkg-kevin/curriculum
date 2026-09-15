const asyncHandler = require("express-async-handler");
const BootcampEnrollmentService = require("./bootcamp-enrollment.service");
const { submitBootcampEnrollmentSchema, markLeadPaidSchema } = require("./bootcamp-enrollment.validation");

const submitBootcampEnrollment = asyncHandler(async (req, res) => {
  const data = submitBootcampEnrollmentSchema.parse(req.body);
  const result = await BootcampEnrollmentService.submitBootcampEnrollment(data);
  res.status(201).json({ success: true, data: result });
});

const markLeadPaid = asyncHandler(async (req, res) => {
  const data = markLeadPaidSchema.parse(req.body);
  const result = await BootcampEnrollmentService.markLeadPaid(req.params.id, data, req.user.id);
  res.json({ success: true, data: result });
});

module.exports = { submitBootcampEnrollment, markLeadPaid };
