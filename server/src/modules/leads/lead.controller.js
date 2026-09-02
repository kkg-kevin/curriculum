const asyncHandler = require("express-async-handler");
const LeadService = require("./lead.service");
const { createLeadSchema, createContactSchema, updateLeadStatusSchema } = require("./lead.validation");

// Public — POST /api/public/leads. digifunzi-landing's EnrollForm (and ContactForm, when
// useLeadsEndpoint is set) both post here. Always 201s with the same shape a real account-
// creating endpoint would, but nothing here creates a login — see lead.service.js.
const submitLead = asyncHandler(async (req, res) => {
  const data = createLeadSchema.parse(req.body);
  const record = await LeadService.submitLead(data);
  res.status(201).json({
    success: true,
    message: "Thanks! Our team will contact you to arrange next steps.",
    data: record,
  });
});

// Public — POST /api/public/contact. digifunzi-landing's ContactForm default path.
const submitContact = asyncHandler(async (req, res) => {
  const data = createContactSchema.parse(req.body);
  const record = await LeadService.submitContact(data);
  res.status(201).json({
    success: true,
    message: "Message received. We usually reply within one working day.",
    data: record,
  });
});

// Admin — GET /api/leads?status=&source= — the Enquiries page's list.
const getAllLeads = asyncHandler(async (req, res) => {
  const { status, source } = req.query;
  const records = await LeadService.listAll({ status, source });
  res.json({ success: true, data: records, count: records.length });
});

// Admin — PATCH /api/leads/:id/status — the Enquiries page's New → Contacted → Closed control.
const updateLeadStatus = asyncHandler(async (req, res) => {
  const { status } = updateLeadStatusSchema.parse(req.body);
  const record = await LeadService.updateStatus(req.params.id, status);
  res.json({ success: true, data: record });
});

module.exports = { submitLead, submitContact, getAllLeads, updateLeadStatus };
