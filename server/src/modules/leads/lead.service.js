const LeadModel = require("./lead.model");
const LeadMessageModel = require("./lead-message.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const PathwayTemplateModel = require("../settings/pathways/pathway-template.model");
const { slugify } = require("../../shared/utils/slugify");
const { sendLeadAcknowledgement, sendLeadReply } = require("./lead.emails");

const LeadService = {
  // Enroll form → POST /api/public/leads. `note` (EnrollForm's optional "Anything else?") maps
  // onto the shared `message` column.
  async submitLead(data) {
    const record = await LeadModel.create({
      source: "enroll",
      name: data.parentName,
      email: data.parentEmail,
      phone: data.parentPhone || null,
      learnerName: data.learnerName || null,
      learnerAge: data.learnerAge ?? null,
      interestedIn: data.interestedIn,
      referenceId: data.referenceId || null,
      message: data.note || null,
    });
    await LeadService._notifyAdmins(record);
    // Fire-and-forget — a slow/failed/no-op SMTP send must never delay or fail the visitor's
    // POST response (the ack copy already promises "our team will contact you", not an email).
    sendLeadAcknowledgement(record).catch(() => {});
    return record;
  },

  // Contact form's simpler default endpoint → POST /api/public/contact.
  async submitContact(data) {
    const record = await LeadModel.create({
      source: "contact",
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message,
    });
    await LeadService._notifyAdmins(record);
    sendLeadAcknowledgement(record).catch(() => {});
    return record;
  },

  // Every admin login gets an in-app notification (see NotificationBell) — no email yet, this
  // just reuses the existing notifications table/UI so a new enquiry is impossible to miss on
  // next login without needing SMTP credentials set up.
  async _notifyAdmins(lead) {
    const admins = await UserModel.findAll();
    const adminIds = admins.filter((u) => u.role === "admin").map((u) => u.id);
    const label = lead.source === "enroll" ? "New enrolment interest" : "New contact message";
    const message =
      lead.source === "enroll"
        ? `${lead.name} is interested in ${lead.interestedIn === "general" ? "our programmes" : lead.interestedIn}${lead.learnerName ? ` for ${lead.learnerName}` : ""}.`
        : `${lead.name} sent a message via the contact form.`;
    await Promise.all(
      adminIds.map((recipientId) =>
        NotificationService._notify(recipientId, {
          type: "lead_submitted",
          title: label,
          message,
          payload: { leadId: lead.id, source: lead.source, route: "/enquiries" },
        })
      )
    );
  },

  // referenceId arrives as a bare, untyped string (slug or uuid — see the public leads schema's
  // comment). The bootcamp/project public catalogs were removed (see Guide/DEPLOYMENT.md) — only
  // pathways are resolvable now. This only ever feeds a display label, never an authorization
  // decision, so an unresolved referenceId (still tagged bootcamp/project/quarky by
  // interestedIn) just shows no reference label rather than erroring.
  async _resolveReference(referenceId) {
    if (!referenceId) return null;
    // pathway_templates has no slug column (see public-site.service.js) — same findById-then-
    // scan-by-computed-slug approach getPathway() uses.
    let pathway = await PathwayTemplateModel.findById(referenceId);
    if (!pathway) {
      const all = await PathwayTemplateModel.findAll();
      pathway = all.find((t) => (slugify(t.name) || "pathway") === referenceId) || null;
    }
    if (pathway) return { referenceType: "pathway", referenceName: pathway.name, referenceSlug: slugify(pathway.name) || "pathway" };
    return null;
  },

  // Admin Enquiries list — each row gets its referenceId resolved to a human-readable
  // { referenceType, referenceName, referenceSlug } (null when there's no referenceId, or it no
  // longer resolves to anything — e.g. the pathway was since deleted, or it points at a
  // bootcamp/project that no longer has a public catalog to resolve against).
  async listAll(filters) {
    const records = await LeadModel.findAll(filters);
    const resolved = await Promise.all(records.map((r) => LeadService._resolveReference(r.referenceId)));
    return records.map((r, i) => ({ ...r, reference: resolved[i] }));
  },

  async updateStatus(id, status) {
    const record = await LeadModel.update(id, { status });
    if (!record) {
      const err = new Error("Lead not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  // The Enquiries card's thread: every reply and note, oldest first.
  async getTimeline(leadId) {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      const err = new Error("Lead not found");
      err.statusCode = 404;
      throw err;
    }
    const messages = await LeadMessageModel.findByLead(leadId);
    return { lead, messages };
  },

  // Staff reply, sent from the Enquiries page — POST /api/leads/:id/reply. Persists the message
  // first (so the record survives even if the send fails), then emails the lead. Sending the
  // first reply auto-flips status new → contacted, same "first real action = contacted" logic a
  // human would apply manually, done automatically instead.
  async reply(leadId, { subject, body }, sentByUserId) {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      const err = new Error("Lead not found");
      err.statusCode = 404;
      throw err;
    }
    const message = await LeadMessageModel.create({
      leadId,
      direction: "outbound",
      subject: subject || null,
      body,
      sentByUserId: sentByUserId || null,
    });
    const sent = await sendLeadReply(lead, { subject, body });
    if (lead.status === "new") {
      await LeadModel.update(leadId, { status: "contacted" });
    }
    return { message, emailSent: sent };
  },

  // Staff-only follow-up note — never emailed, just a shared timeline entry so the next person
  // picking up the enquiry has context ("left voicemail, try Tuesday").
  async addNote(leadId, body, authorUserId) {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      const err = new Error("Lead not found");
      err.statusCode = 404;
      throw err;
    }
    return LeadMessageModel.create({
      leadId,
      direction: "note",
      subject: null,
      body,
      sentByUserId: authorUserId || null,
    });
  },
};

module.exports = LeadService;
