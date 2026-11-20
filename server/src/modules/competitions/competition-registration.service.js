const crypto = require("crypto");
const db = require("../../config/db");
const BillingModel = require("../billing/billing.model");
const LeadModel = require("../leads/lead.model");
const PaymentLinks = require("../payments/payment-links");
const NotificationService = require("../notifications/notification.service");
const { createRecord, toJson } = require("../../shared/utils/model.utils");
const { kenyaToday, ageFrom } = require("../../shared/utils/age");
const R = require("./competition-registration.rules");
const emails = require("./competition-registration.emails");

// Competition registrations (20 Nov 2026). Someone registers on the website — one participant, or
// a whole team entered by one person (a parent, teacher or school) — for one track. The entry fee
// is the track's individual price or its one fee per team, on ONE invoice (invoiceType
// "competition", billed to the person registering, paid through the usual Payment step). Paying
// it in full confirms the registration (billing.paid-hooks.js → onInvoicePaid); a free track is
// confirmed at once. No accounts are made (user's choice) — the registration and an enquiry
// (leads.source "competition") are the record. competition_registrations has a newer collation
// than the older tables: never SQL-join it to them.

const TABLE = "competition_registrations";
const TOKEN_BYTES = 24;

function fail(statusCode, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  throw err;
}

const parse = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const shape = (row) => (row ? { ...row, participants: parse(row.participants, []), visitSource: parse(row.visitSource, null), amount: Number(row.amount) } : row);
const competitionName = (c) => [c.name, c.edition].filter(Boolean).join(" — ");

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

// The hub an invoice is filed under (billing_invoices.hubId is required): a hub the competition
// runs at, else the workspace's first active hub that isn't the Home Learning holder.
async function invoiceHubFor(competition) {
  const offering = await db("competition_hubs").where({ competitionId: competition.id }).orderBy("createdAt", "asc").first("hubId");
  if (offering?.hubId) return offering.hubId;
  const hub = await db("learning_hubs").where({ ownerAdminId: competition.ownerAdminId, status: "active" })
    .where((q) => q.where({ isHomeLearning: false }).orWhereNull("isHomeLearning")).orderBy("createdAt", "asc").first("id");
  return hub?.id || null;
}

function leadMessage({ competition, registration }) {
  const lines = [
    `Registered for ${competitionName(competition)} — ${registration.trackName} (${R.ENTRY_LABELS[registration.entryType]}).`,
    registration.entryType === "group" ? `Team: ${registration.teamName} (${registration.participantCount} members)` : null,
    registration.organisation ? `School / organisation: ${registration.organisation}` : null,
    `${registration.entryType === "group" ? "Members" : "Participant"}: ${registration.participants.map((p) => `${p.name}${ageFrom(p.dateOfBirth) != null ? ` (${ageFrom(p.dateOfBirth)})` : ""}`).join(", ")}`,
    `Registration ${registration.registrationNumber}${registration.amount > 0 ? ` — fee ${registration.currency} ${registration.amount}` : " — free"}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

const CompetitionRegistrationService = {
  // POST /api/public/competitions/:idOrSlug/registrations — from the website.
  async register(idOrSlug, input, visitSource = null) {
    // A bot filled the hidden field: answer as if it worked, keep nothing.
    if (input.hp_field) return { ok: true };
    const PublicCompetitionService = require("../public-site/public-competition.service");
    const competition = await PublicCompetitionService.findPublicRow(idOrSlug);
    if (!competition) fail(404, "Competition not found");
    const tracks = Array.isArray(competition.tracks) ? competition.tracks : parse(competition.tracks, []);
    const track = tracks.find((t, i) => (t.id || `track-${i + 1}`) === input.trackId) || null;
    const today = kenyaToday();
    const problems = R.registrationProblems({ competition, track, input, today });
    if (problems.length) fail(400, problems[0], { problems });

    // The same entry twice from the same person (a double click, a second try) — say so.
    const existing = await db(TABLE).where({ competitionId: competition.id, trackId: input.trackId, contactEmail: input.contactEmail, entryType: input.entryType }).whereNot({ status: "cancelled" });
    const sameEntry = existing.map(shape).find((r) => (input.entryType === "group"
      ? String(r.teamName || "").trim().toLowerCase() === String(input.teamName || "").trim().toLowerCase()
      : String(r.participants?.[0]?.name || "").trim().toLowerCase() === String(input.participants[0].name).trim().toLowerCase()));
    if (sameEntry) fail(409, `This ${input.entryType === "group" ? "team is" : "participant is"} already registered for this track (${sameEntry.registrationNumber}). Check your email for the details, or contact us.`);

    const entry = R.trackEntry(competition, track);
    const amount = R.feeFor(entry, input.entryType);
    const currency = entry.currency || "KES";
    const hubId = amount > 0 ? await invoiceHubFor(competition) : null;
    if (amount > 0 && !hubId) fail(503, "Registration isn't available just now — please contact us to register.");

    const participants = input.participants.map((p) => ({ name: p.name.trim(), dateOfBirth: p.dateOfBirth, school: (p.school || "").trim() }));
    const now = new Date();
    const year = Number(today.slice(0, 4));
    let registration;
    let invoice = null;
    await BillingModel.transaction(async (trx) => {
      registration = await createRecord(trx, TABLE, {
        ownerAdminId: competition.ownerAdminId,
        competitionId: competition.id,
        registrationNumber: R.registrationNumberFor(year, await BillingModel.nextNumber("competition_registration", year, trx)),
        trackId: input.trackId,
        trackName: track.name,
        entryType: input.entryType,
        teamName: input.entryType === "group" ? input.teamName.trim() : null,
        organisation: input.organisation || null,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactRole: input.contactRole || null,
        participants: toJson(participants),
        participantCount: participants.length,
        amount, currency,
        hubId,
        status: amount > 0 ? "pending_payment" : "confirmed",
        confirmedAt: amount > 0 ? null : now,
        token: crypto.randomBytes(TOKEN_BYTES).toString("hex"),
        visitSource: visitSource ? toJson(visitSource) : null,
      });
      if (amount > 0) {
        const label = `${competitionName(competition)} — ${track.name} · ${input.entryType === "group" ? `Team ${input.teamName.trim()} (${participants.length} members)` : `Individual entry: ${participants[0].name}`}`;
        invoice = await BillingModel.createInvoice({
          invoiceNumber: await nextInvoiceNumber(trx),
          issuerType: "platform", issuerHubId: null, payerUserId: null, payerHubId: null,
          learnerId: null, hubId, invoiceType: "competition", status: "issued", currency,
          subtotal: amount, discount: 0, total: amount, amountPaid: 0, issuedAt: now,
          notes: `Competition registration ${registration.registrationNumber}`,
        }, trx);
        await BillingModel.createItem({
          invoiceId: invoice.id, learnerId: null, courseId: null, description: label.slice(0, 250),
          quantity: 1, unitAmount: amount, totalAmount: amount,
          metadata: { competitionId: competition.id, registrationId: registration.id, trackId: input.trackId, entryType: input.entryType },
        }, trx);
        await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: null, eventType: "invoice_issued", newStatus: "issued", amount, metadata: { source: "competition_registration", registrationNumber: registration.registrationNumber } }, trx);
        await trx(TABLE).where({ id: registration.id }).update({ invoiceId: invoice.id });
        registration.invoiceId = invoice.id;
      }
    });
    registration = shape({ ...registration, participants });

    // An enquiry, so the team can follow up — never fails the registration.
    try {
      const lead = await LeadModel.create({
        source: "competition", status: "new", referenceId: competition.id,
        name: registration.contactName, email: registration.contactEmail, phone: registration.contactPhone,
        learnerName: registration.entryType === "group" ? `Team ${registration.teamName}` : participants[0].name,
        learnerDateOfBirth: registration.entryType === "individual" ? participants[0].dateOfBirth : null,
        learnerAge: registration.entryType === "individual" ? ageFrom(participants[0].dateOfBirth) : null,
        message: leadMessage({ competition, registration }),
        hubId, invoiceId: invoice?.id || null,
        visitSource: visitSource || null,
      });
      await db(TABLE).where({ id: registration.id }).update({ leadId: lead.id });
    } catch (err) {
      console.error("[competitions] enquiry for a registration failed:", err.message);
    }

    const pay = invoice ? await PaymentLinks.forWebsite(invoice, "competition_registration", { ttlHours: 14 * 24 }) : null;
    const name = competitionName(competition);
    if (invoice) emails.sendRegistrationReceived({ registration, competitionName: name, payToken: pay?.token }).catch(() => {});
    else emails.sendRegistrationConfirmed({ registration, competitionName: name }).catch(() => {});
    await NotificationService._notify(competition.ownerAdminId, {
      type: "competition_registration",
      title: "New competition registration",
      message: `${R.entryLabel(registration)} registered for ${name} — ${track.name}${amount > 0 ? ` (${currency} ${amount.toLocaleString("en-KE")} to pay)` : " (free)"}.`,
      payload: { route: `/competitions/${competition.id}?tab=registrations` },
      dedupeKey: `competition_registration:${registration.id}`,
      ownerAdminId: competition.ownerAdminId,
    }).catch(() => {});

    return {
      registrationNumber: registration.registrationNumber,
      status: registration.status,
      competitionName: name,
      trackName: track.name,
      entryType: registration.entryType,
      teamName: registration.teamName,
      participants: participants.map((p) => p.name),
      amountDue: amount,
      currency,
      invoiceNumber: invoice?.invoiceNumber || null,
      pay,
    };
  },

  // Staff: every registration of a competition, newest first, with its invoice's payment state.
  async listForCompetition(competitionId) {
    const rows = (await db(TABLE).where({ competitionId }).orderBy("createdAt", "desc")).map(shape);
    const invoiceIds = rows.map((r) => r.invoiceId).filter(Boolean);
    const invoices = invoiceIds.length
      ? await db("billing_invoices").whereIn("id", invoiceIds).select("id", "invoiceNumber", "status", "total", "amountPaid")
      : [];
    const byId = new Map(invoices.map((i) => [i.id, i]));
    return rows.map((r) => {
      const inv = r.invoiceId ? byId.get(r.invoiceId) : null;
      const { token, ...rest } = r;
      return {
        ...rest,
        invoice: inv ? { id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, total: Number(inv.total), amountPaid: Number(inv.amountPaid) } : null,
        participants: r.participants.map((p) => ({ ...p, age: ageFrom(p.dateOfBirth) })),
      };
    });
  },

  // Staff cancel one. An unpaid invoice is cancelled with it (nobody owes for an entry that's
  // gone); a paid one stays as it is — any refund is handled by hand.
  async cancel(competitionId, registrationId, { reason, actorUserId }) {
    const reg = shape(await db(TABLE).where({ id: registrationId, competitionId }).first());
    if (!reg) fail(404, "Registration not found");
    if (reg.status === "cancelled") fail(409, "This registration is already cancelled.");
    const now = new Date();
    await BillingModel.transaction(async (trx) => {
      await trx(TABLE).where({ id: reg.id }).update({ status: "cancelled", cancelledAt: now, cancelReason: reason, cancelledBy: actorUserId || null, updatedAt: now });
      if (reg.invoiceId) {
        const invoice = await BillingModel.findInvoiceById(reg.invoiceId, trx, true);
        if (invoice && Number(invoice.amountPaid) === 0 && !["cancelled", "paid"].includes(invoice.status)) {
          await BillingModel.updateInvoice(invoice.id, { status: "cancelled" }, trx);
          await BillingModel.createAuditEvent({ invoiceId: invoice.id, actorUserId: actorUserId || null, eventType: "invoice_cancelled", previousStatus: invoice.status, newStatus: "cancelled", metadata: { registrationNumber: reg.registrationNumber, reason } }, trx);
        }
      }
    });
    const competition = await db("competitions").where({ id: competitionId }).first("name", "edition");
    emails.sendRegistrationCancelled({ registration: reg, competitionName: competitionName(competition || {}), reason }).catch(() => {});
    return { ...reg, status: "cancelled", cancelledAt: now, cancelReason: reason };
  },

  // billing.paid-hooks.js: a competition invoice paid in full confirms its registration.
  async onInvoicePaid(invoice) {
    if (!invoice || invoice.invoiceType !== "competition") return;
    const reg = shape(await db(TABLE).where({ invoiceId: invoice.id }).first());
    if (!reg || reg.status !== "pending_payment") return;
    const now = new Date();
    await db(TABLE).where({ id: reg.id }).update({ status: "confirmed", confirmedAt: now, updatedAt: now });
    const competition = await db("competitions").where({ id: reg.competitionId }).first("id", "name", "edition", "ownerAdminId");
    const name = competitionName(competition || {});
    emails.sendRegistrationConfirmed({ registration: { ...reg, status: "confirmed" }, competitionName: name }).catch(() => {});
    if (competition) {
      await NotificationService._notify(competition.ownerAdminId, {
        type: "competition_registration_paid",
        title: "Competition entry paid",
        message: `${R.entryLabel(reg)} paid for ${name} — ${reg.trackName}. Their registration is confirmed.`,
        payload: { route: `/competitions/${competition.id}?tab=registrations` },
        dedupeKey: `competition_registration_paid:${reg.id}`,
        ownerAdminId: competition.ownerAdminId,
      }).catch(() => {});
    }
  },

  // billing.service.js's resolvePayerIdentity: a competition invoice is billed to whoever registered.
  async payerFor(invoiceId) {
    const reg = await db(TABLE).where({ invoiceId }).first("contactName", "contactEmail", "contactPhone", "organisation");
    return reg ? { name: reg.contactName, email: reg.contactEmail, phone: reg.contactPhone, address: reg.organisation || null } : null;
  },
};

module.exports = CompetitionRegistrationService;
