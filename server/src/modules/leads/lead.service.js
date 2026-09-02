const LeadModel = require("./lead.model");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");

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

  listAll(filters) {
    return LeadModel.findAll(filters);
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
};

module.exports = LeadService;
