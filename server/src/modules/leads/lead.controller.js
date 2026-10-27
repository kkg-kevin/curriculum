const asyncHandler = require("express-async-handler");
const LeadService = require("./lead.service");
const { visitSourceFrom } = require("./visit-source");
const {
  createLeadSchema,
  createContactSchema,
  updateLeadStatusSchema,
  replyLeadSchema,
  addLeadNoteSchema,
  enquirySettingsSchema,
} = require("./lead.validation");
const Housekeeping = require("./lead.housekeeping");

// Public — POST /api/public/leads. digifunzi-landing's EnrollForm (and ContactForm, when
// useLeadsEndpoint is set) both post here. Nothing here creates a login — see lead.service.js.
//
// `ok: true` is the flag the landing site's form hooks check (useLeadSubmission.js); `success`
// and `data` keep the shape consistent with the rest of this API. 201 because a record is
// created; the landing site's axios treats any 2xx as success. See
// Guide/WEBSITE_INTEGRATION_CONTRACT.md §3.
const submitLead = asyncHandler(async (req, res) => {
  const data = createLeadSchema.parse(req.body);
  const record = await LeadService.submitLead(data, visitSourceFrom(req));
  res.status(201).json({
    ok: true,
    success: true,
    message: "Thanks! Our team will contact you to arrange next steps.",
    data: record,
  });
});

// Public — POST /api/public/contact. digifunzi-landing's ContactForm default path.
const submitContact = asyncHandler(async (req, res) => {
  const data = createContactSchema.parse(req.body);
  const record = await LeadService.submitContact(data, visitSourceFrom(req));
  res.status(201).json({
    ok: true,
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

// Admin — GET /api/leads/:id/timeline — the Enquiries card's thread (replies + notes).
const getLeadTimeline = asyncHandler(async (req, res) => {
  const { lead, messages } = await LeadService.getTimeline(req.params.id);
  res.json({ success: true, data: { lead, messages } });
});

// Admin — POST /api/leads/:id/reply — staff compose box. Emails the lead (Reply-To: the shared
// inbox), persists the message regardless of whether the send actually succeeded, and auto-flips
// New → Contacted on the first reply.
const replyToLead = asyncHandler(async (req, res) => {
  const data = replyLeadSchema.parse(req.body);
  const { message, emailSent } = await LeadService.reply(req.params.id, data, req.user?.id);
  res.status(201).json({ success: true, data: message, emailSent });
});

// Admin — POST /api/leads/:id/notes — staff-only follow-up note, never emailed.
const addLeadNote = asyncHandler(async (req, res) => {
  const { body } = addLeadNoteSchema.parse(req.body);
  const message = await LeadService.addNote(req.params.id, body, req.user?.id);
  res.status(201).json({ success: true, data: message });
});

const convertHomeLearningLead = asyncHandler(async (req, res) => {
  const household = await LeadService.convertHomeLearningLead(req.params.id, req.ownerAdminId);
  res.status(201).json({ success: true, data: household });
});

// Settings → Enquiries — the reminder, auto-close and anonymise rules (lead.housekeeping.js).
const getEnquirySettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Housekeeping.getSettings() });
});
const saveEnquirySettings = asyncHandler(async (req, res) => {
  const data = enquirySettingsSchema.parse(req.body);
  res.json({ success: true, data: await Housekeeping.saveSettings(data, req.user?.id) });
});

module.exports = {
  getEnquirySettings,
  saveEnquirySettings,
  submitLead,
  submitContact,
  getAllLeads,
  updateLeadStatus,
  getLeadTimeline,
  replyToLead,
  addLeadNote,
  convertHomeLearningLead,
};
