// General events (Events → General events, 12 Nov 2026): events anyone can come to — a bootcamp's
// showcase, an open day, a talk. Rules in general-event.rules.js. Who uses what:
//   admins / staff ("general-events" permission)  make and publish events, see who registered,
//                    check people in on the day (and add walk-ins), message them, invite a
//                    bootcamp's families or everyone in the workspace, cancel
//   the website     its Events section and pop-up (PUBLIC_CONTENT_ADMIN_ID's public events), and
//                    the registration itself — every registration from outside the system is also
//                    an enquiry (leads.source "event"), so the team follows it up like any other
//   everyone signed in  the sign-in pop-up (any portal), registering with their details filled in
//   the person registered  their own page on the website (/events/registration/<token>): their
//                    details, the optional "about you", add to calendar, cancel
// Capacity counts people; when full, registrations wait on a list and move up as places free.
// Tickets (13 Nov 2026): every registration has a code (ticketCode, "EV-7K3M9Q"); once it has a
// place, its emails carry the ticket — the code and a QR image served by this API
// (/api/public/event-registrations/<token>/ticket.png) holding the portal's /ticket/<code> — and so
// does its website page (printable). At the door: Check-in → Scan tickets (the camera, same tab) or
// the code typed; a ticket admits its whole party once (ticket / ticketCheckIn).
// Events are free for now: a price is kept (priceAmount) but refused until paid tickets are built
// (they'd raise an invoice per registration — general_event_registrations.invoiceId).
const crypto = require("crypto");
const QRCode = require("qrcode");
const db = require("../../config/db");
const env = require("../../config/env");
const R = require("./general-event.rules");
const Emails = require("./general-event.emails");
const NotificationService = require("../notifications/notification.service");
const { toJson, generateId } = require("../../shared/utils/model.utils");
const { slugify } = require("../../shared/utils/slugify");
const { adminIdsOf, organisationIdOf } = require("../../shared/utils/organisation");
const { htmlToText } = require("../../shared/utils/public-content");

const EVENTS = "general_events";
const REGS = "general_event_registrations";
const POPUPS = "general_event_popup_states";
const JSON_EVENT = ["images", "systemAudience", "highlights"];
const JSON_REG = ["childrenAges", "interests", "visitSource"];

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status, ...extra });
const parseJson = (v, fallback = null) => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const rowEvent = (e) => (e ? { ...e, images: parseJson(e.images, []) || [], systemAudience: parseJson(e.systemAudience, null), highlights: parseJson(e.highlights, []) || [], registrationOpen: !!e.registrationOpen, waitlistOn: !!e.waitlistOn, askAboutYou: !!e.askAboutYou, isPublic: !!e.isPublic, websitePopup: !!e.websitePopup, systemPopup: !!e.systemPopup } : null);
const rowReg = (r) => (r ? { ...r, childrenAges: parseJson(r.childrenAges, []) || [], interests: parseJson(r.interests, []) || [], visitSource: parseJson(r.visitSource, null), marketingConsent: !!r.marketingConsent } : null);
const newToken = () => crypto.randomBytes(24).toString("base64url");
// A ticket code no registration has (UNIQUE in the table too).
async function freshTicketCode(trx = db) {
  for (;;) {
    const code = R.newTicketCode();
    if (!(await trx(REGS).where({ ticketCode: code }).first("id"))) return code;
  }
}

// The address a ticket's QR code opens: the portal's check-in for that ticket (staff signed in mark
// the person arrived; anyone else is told to show it at the door).
const ticketCheckInUrl = (code) => `${String(env.CLIENT_URL || "").replace(/\/+$/, "")}/ticket/${code}`;
const lowerEmail = (e) => String(e || "").trim().toLowerCase();
const now = () => new Date();

// ---- Loading ----------------------------------------------------------------------------------

async function findEvent(id, ownerAdminId = null) {
  const q = db(EVENTS).where({ id });
  if (ownerAdminId) q.andWhere({ ownerAdminId });
  return rowEvent(await q.first());
}
async function regsOf(eventId, trx = db) {
  return (await trx(REGS).where({ eventId }).orderBy("createdAt", "asc")).map(rowReg);
}
async function hubNameOf(event) {
  if (!event?.hubId) return null;
  const hub = await db("learning_hubs").where({ id: event.hubId }).first("name");
  return hub?.name || null;
}
// A hub's address is { street, city, county } — one line of it ("Garissa Road, Thika, Kiambu").
function addressLine(address) {
  const a = parseJson(address, address);
  if (!a) return null;
  if (typeof a === "string") return a.trim() || null;
  return [a.street, a.city, a.county].map((x) => String(x || "").trim()).filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(", ") || null;
}
// The event as people see it: at a hub with no venue typed, the hub's name, address and map link.
async function placed(event) {
  if (!event?.hubId || event.format === "online") return event;
  const hub = await db("learning_hubs").where({ id: event.hubId }).first("name", "address", "mapLink");
  if (!hub) return event;
  return { ...event, venueName: event.venueName || hub.name, venueAddress: event.venueAddress || addressLine(hub.address), mapUrl: event.mapUrl || hub.mapLink || null };
}
const QUESTIONS = { personTypes: R.PERSON_TYPES, interests: R.INTERESTS, heardFrom: R.HEARD_FROM };

// What anyone may see of an event (the website, the pop-ups). Never the join link or numbers
// beyond "places left".
async function publicView(raw, { regs = null } = {}) {
  const event = await placed(raw);
  const all = regs || (await regsOf(event.id));
  const taken = R.seatsTaken(all);
  const reg = R.registrationState(event, taken);
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    kind: event.kind,
    kindLabel: R.KINDS[event.kind] || "Event",
    tagline: event.tagline || null,
    description: event.description || null, // rich text (HTML) written by staff
    descriptionText: htmlToText(event.description) || null,
    coverImage: event.coverImage || null,
    images: event.images || [],
    startDate: event.startDate,
    startTime: event.startTime,
    endDate: event.endDate || null,
    endTime: event.endTime || null,
    when: R.describeWhen(event),
    startsAt: R.startsAt(event)?.toISOString() || null,
    endsAt: R.endsAt(event)?.toISOString() || null,
    format: event.format,
    formatLabel: R.FORMATS[event.format] || event.format,
    where: R.whereText(event),
    venueName: event.venueName || null,
    venueAddress: event.venueAddress || null,
    mapUrl: event.mapUrl || null,
    state: R.eventState(event),
    free: R.isFree(event),
    registration: {
      open: reg.open,
      reason: reg.reason,
      full: reg.full,
      waitlist: reg.waitlist,
      // Only told when it's getting close — "12 places left".
      seatsLeft: reg.seatsLeft != null && reg.seatsLeft <= 30 ? reg.seatsLeft : null,
      maxPartySize: event.maxPartySize || 5,
    },
    askAboutYou: event.askAboutYou,
    questions: QUESTIONS,
    // What helps a family say yes (13 Nov 2026).
    ageMin: event.ageMin ?? null,
    ageMax: event.ageMax ?? null,
    ages: R.agesText(event),
    highlights: R.highlightsOf(event),
    ownHighlights: Array.isArray(event.highlights) && event.highlights.length > 0,
    // "38 people are coming" — only once it's worth saying (5 or more).
    going: taken >= 5 ? taken : null,
    bootcamp: await linkedBootcamp(event),
    cancelReason: event.status === "cancelled" ? event.cancelReason || null : null,
  };
}

// The bootcamp an event is for, when it's on sale on the website — the event page links to it.
async function linkedBootcamp(event) {
  if (!event.bootcampId) return null;
  const b = await db("bootcamps").where({ id: event.bootcampId }).first("id", "name", "saleStatus", "startDate", "endDate", "coverImage");
  if (!b || b.saleStatus !== "for_sale") return null;
  return { name: b.name, slug: slugify(b.name) || "bootcamp", startDate: b.startDate || null, endDate: b.endDate || null, coverImage: b.coverImage || null };
}

// The registration as its owner sees it.
function ownView(reg) {
  return {
    id: reg.id,
    token: reg.token,
    name: reg.name,
    email: reg.email,
    phone: reg.phone,
    partySize: reg.partySize,
    status: reg.status,
    personType: reg.personType || null,
    organisation: reg.organisation || null,
    childrenAges: reg.childrenAges || [],
    interests: reg.interests || [],
    heardFrom: reg.heardFrom || null,
    detailsDone: Boolean(reg.detailsAt),
    marketingConsent: reg.marketingConsent,
    attended: Boolean(reg.attendedAt),
    // The ticket is only theirs once they have a place.
    ticketCode: reg.status === "registered" ? reg.ticketCode || null : null,
  };
}

// ---- Saving an event ----------------------------------------------------------------------------

async function uniqueSlug(ownerAdminId, title, exceptId = null) {
  const base = slugify(title) || "event";
  let slug = base;
  for (let n = 2; n < 200; n += 1) {
    const q = db(EVENTS).where({ ownerAdminId, slug });
    if (exceptId) q.whereNot({ id: exceptId });
    if (!(await q.first("id"))) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

function cleanEventInput(data) {
  if (data.priceAmount != null && Number(data.priceAmount) > 0) throw fail(400, "Paid events aren't available yet — leave the price empty for a free event.");
  if (data.endDate && R.dateOnly(data.endDate) < R.dateOnly(data.startDate)) throw fail(400, "The end date can't be before the start date.");
  if (data.format !== "in_person" && data.meetingLink && !/^https?:\/\//i.test(data.meetingLink)) throw fail(400, "The online link must start with https://");
  if (data.ageMin && data.ageMax && Number(data.ageMin) > Number(data.ageMax)) throw fail(400, "The youngest age can't be above the oldest.");
  if (data.format === "online" && !data.meetingLink) throw fail(400, "Add the link people join with (Google Meet, Zoom…) for an online event.");
  const audience = Array.isArray(data.systemAudience) ? data.systemAudience.filter((g) => R.AUDIENCE_GROUPS[g]) : null;
  return {
    title: data.title.trim(),
    kind: R.KINDS[data.kind] ? data.kind : "other",
    tagline: data.tagline || null,
    description: data.description || null,
    coverImage: data.coverImage || null,
    images: toJson((data.images || []).filter(Boolean).slice(0, 12)),
    startDate: data.startDate,
    startTime: data.startTime,
    endDate: data.endDate && data.endDate !== data.startDate ? data.endDate : null,
    endTime: data.endTime || null,
    format: R.FORMATS[data.format] ? data.format : "in_person",
    hubId: data.format === "online" ? null : data.hubId || null,
    venueName: data.format === "online" ? null : data.venueName || null,
    venueAddress: data.format === "online" ? null : data.venueAddress || null,
    mapUrl: data.format === "online" ? null : data.mapUrl || null,
    meetingLink: data.format === "in_person" ? null : data.meetingLink || null,
    bootcampId: data.bootcampId || null,
    capacity: data.capacity ? Math.max(1, Math.round(Number(data.capacity))) : null,
    waitlistOn: data.waitlistOn !== false,
    maxPartySize: Math.min(20, Math.max(1, Math.round(Number(data.maxPartySize) || 5))),
    registrationOpen: data.registrationOpen !== false,
    registrationClosesOn: data.registrationClosesOn || null,
    askAboutYou: data.askAboutYou !== false,
    isPublic: data.isPublic !== false,
    websitePopup: data.websitePopup !== false,
    systemPopup: data.systemPopup !== false,
    systemAudience: audience && audience.length && audience.length < Object.keys(R.AUDIENCE_GROUPS).length ? toJson(audience) : null,
    popupFrom: data.popupFrom || null,
    popupUntil: data.popupUntil || null,
    priceAmount: null,
    ageMin: data.ageMin ? Math.round(Number(data.ageMin)) : null,
    ageMax: data.ageMax ? Math.round(Number(data.ageMax)) : null,
    highlights: toJson((data.highlights || []).map((h) => String(h || "").trim().slice(0, 160)).filter(Boolean).slice(0, 8)),
  };
}

// ---- Registering --------------------------------------------------------------------------------

// The one way a registration is made (website, pop-ups, staff, walk-ins). Inside a transaction
// that holds the event's row, so two people can't take the last place at once.
//   input  { name, email, phone, partySize, marketingConsent, details?, source, userId?,
//            visitSource?, referralCode?, walkIn?, trusted? }
//   trusted  staff (or the signed-in owner of the email): may change an existing registration
// Returns { registration, event, already } — `already` when that email was registered before
// (a stranger typing someone's email learns nothing more and can't change it).
async function register(eventId, input) {
  const email = lowerEmail(input.email);
  const result = await db.transaction(async (trx) => {
    const event = rowEvent(await trx(EVENTS).where({ id: eventId }).forUpdate().first());
    if (!event) throw fail(404, "Event not found");
    const regs = await regsOf(event.id, trx);
    const taken = R.seatsTaken(regs);
    const state = R.registrationState(event, taken);
    const partySize = Math.min(Math.max(1, Math.round(Number(input.partySize) || 1)), event.maxPartySize || 5);
    const existing = regs.find((r) => r.email === email) || null;
    if (!state.open && !input.walkIn && !(input.trusted && existing)) throw fail(409, state.reason || "Registration is closed.", { code: "REGISTRATION_CLOSED" });

    const at = now();
    const details = input.details ? cleanDetails(input.details) : null;
    if (existing && existing.status !== "cancelled") {
      if (!input.trusted) return { event, registration: existing, already: true };
      // Their own (signed in / staff): the party size can change. Someone with a place keeps it
      // only if the bigger party still fits; someone waiting moves up if it now fits.
      const others = R.seatsTaken(regs.filter((r) => r.id !== existing.id));
      const fits = R.placeFor(event, others, partySize) === "registered";
      if (!input.walkIn && existing.status === "registered" && !fits) {
        const left = Math.max(0, Number(event.capacity) - others);
        throw fail(409, `Only ${left} ${left === 1 ? "place is" : "places are"} left — we can't keep ${partySize}.`, { code: "EVENT_FULL" });
      }
      const status = input.walkIn || fits ? "registered" : "waitlisted";
      await trx(REGS).where({ id: existing.id }).update({
        name: input.name?.trim() || existing.name, phone: input.phone?.trim() || existing.phone, partySize, status,
        ...(details || {}), ...(input.walkIn ? { attendedAt: existing.attendedAt || at, checkedInBy: input.checkedInBy || null } : {}),
        marketingConsent: input.marketingConsent == null ? existing.marketingConsent : !!input.marketingConsent, updatedAt: at,
      });
      return { event, registration: rowReg(await trx(REGS).where({ id: existing.id }).first()), already: false, changed: true };
    }

    const place = input.walkIn ? "registered" : R.placeFor(event, taken, partySize);
    if (place === "full") throw fail(409, "This event is full.", { code: "EVENT_FULL" });
    const record = {
      name: input.name.trim(),
      email,
      phone: input.phone.trim(),
      partySize,
      status: place,
      marketingConsent: !!input.marketingConsent,
      source: input.source || "website",
      userId: input.userId || null,
      visitSource: toJson(input.visitSource || null),
      referralCode: input.referralCode || null,
      attendedAt: input.walkIn ? at : null,
      checkedInBy: input.walkIn ? input.checkedInBy || null : null,
      cancelledAt: null,
      ...(details || {}),
      updatedAt: at,
    };
    if (existing) {
      // Cancelled before, back again: the same row (and link), a fresh place in the queue.
      await trx(REGS).where({ id: existing.id }).update({ ...record, ticketCode: existing.ticketCode || await freshTicketCode(trx), createdAt: at });
      return { event, registration: rowReg(await trx(REGS).where({ id: existing.id }).first()), already: false, returned: true };
    }
    const id = generateId();
    await trx(REGS).insert({ id, eventId: event.id, ownerAdminId: event.ownerAdminId, token: newToken(), ticketCode: await freshTicketCode(trx), createdAt: at, ...record });
    return { event, registration: rowReg(await trx(REGS).where({ id }).first()), already: false };
  });

  const { event, registration, already } = result;
  const shown = await placed(event);
  if (already) {
    // Tell the address's owner (not whoever typed it) — once a day at most.
    Emails.confirmation(shown, registration, { again: true }).catch(() => {});
    return result;
  }
  if (!input.walkIn) Emails.confirmation(shown, registration).catch(() => {});
  await syncLead(event, registration).catch((err) => console.error("[general-events] enquiry not saved:", err.message));
  await tellAdmins(event).catch(() => {});
  return result;
}

function cleanDetails(d = {}) {
  const out = {};
  if (d.personType !== undefined) out.personType = R.PERSON_TYPES[d.personType] ? d.personType : null;
  if (d.organisation !== undefined) out.organisation = d.organisation ? String(d.organisation).trim().slice(0, 200) : null;
  if (d.childrenAges !== undefined) out.childrenAges = toJson(R.cleanAges(d.childrenAges));
  if (d.interests !== undefined) out.interests = toJson(R.cleanKeys(d.interests, R.INTERESTS));
  if (d.heardFrom !== undefined) out.heardFrom = R.HEARD_FROM[d.heardFrom] ? d.heardFrom : null;
  if (d.marketingConsent !== undefined) out.marketingConsent = !!d.marketingConsent;
  if (Object.keys(out).length) out.detailsAt = now();
  return Object.keys(out).length ? out : null;
}

// The enquiry for a registration from outside the system (not a signed-in person — they're
// already ours). Made once, kept in step with what they tell us after.
async function syncLead(event, reg) {
  if (reg.userId) return null;
  const message = R.leadMessage(event, reg) + (reg.status === "cancelled" ? "\nThey've since cancelled." : "");
  const fields = { message, interestedIn: R.leadInterestOf(reg.interests), name: reg.name, phone: reg.phone, updatedAt: now() };
  if (reg.leadId) {
    await db("leads").where({ id: reg.leadId }).update(fields);
    return reg.leadId;
  }
  const leadId = generateId();
  const at = now();
  await db("leads").insert({
    id: leadId,
    source: "event",
    email: reg.email,
    referenceId: event.id,
    generalEventId: event.id,
    status: "new",
    visitSource: toJson(reg.visitSource || null),
    createdAt: at,
    ...fields,
    updatedAt: at,
  });
  await db(REGS).where({ id: reg.id }).update({ leadId });
  return leadId;
}

// "People are registering for X" — to the workspace's admins, once a day per event.
async function tellAdmins(event) {
  const adminIds = await adminIdsOf(event.ownerAdminId);
  const day = R.kenyaDateOf();
  await Promise.all([...new Set(adminIds.length ? adminIds : [event.ownerAdminId])].map((recipientId) => NotificationService.notifyPerson(recipientId, {
    type: "general_event_registrations",
    title: `New registrations: ${event.title}`,
    message: `People are registering for ${event.title} (${R.describeWhen(event)}). See who's coming.`,
    payload: { eventId: event.id, route: `/events/general/${event.id}?tab=registrations` },
    dedupeKey: `general_event_registrations:${event.id}:${day}`,
    ownerAdminId: event.ownerAdminId,
  })));
}

// Places freed (a cancellation, a smaller party, more capacity): the waiting list moves up.
async function promoteWaiting(eventId) {
  const moved = await db.transaction(async (trx) => {
    const event = rowEvent(await trx(EVENTS).where({ id: eventId }).forUpdate().first());
    if (!event || event.status !== "published" || R.eventState(event) === "ended") return { event, ids: [] };
    const ids = R.promotions(event, await regsOf(eventId, trx));
    if (ids.length) await trx(REGS).whereIn("id", ids).update({ status: "registered", promotedAt: now(), updatedAt: now() });
    return { event, ids };
  });
  if (!moved.ids.length) return 0;
  const shown = await placed(moved.event);
  const regs = (await db(REGS).whereIn("id", moved.ids)).map(rowReg);
  for (const reg of regs) {
    Emails.promoted(shown, reg).catch(() => {});
    syncLead(moved.event, reg).catch(() => {});
  }
  return regs.length;
}

async function cancelRegistration(reg, { by = "them" } = {}) {
  if (reg.status === "cancelled") return reg;
  const at = now();
  await db(REGS).where({ id: reg.id }).update({ status: "cancelled", cancelledAt: at, updatedAt: at });
  const updated = rowReg(await db(REGS).where({ id: reg.id }).first());
  const event = await findEvent(reg.eventId);
  if (by === "them") Emails.youCancelled(event, updated).catch(() => {});
  await syncLead(event, updated).catch(() => {});
  await promoteWaiting(reg.eventId);
  return updated;
}

async function saveDetails(reg, details) {
  const fields = cleanDetails(details);
  if (!fields) return reg;
  await db(REGS).where({ id: reg.id }).update({ ...fields, updatedAt: now() });
  const updated = rowReg(await db(REGS).where({ id: reg.id }).first());
  const event = await findEvent(reg.eventId);
  await syncLead(event, updated).catch(() => {});
  return updated;
}

// ---- Who's in a workspace (pop-up for private events, invitations) -----------------------------

const STAFF_ROLES = ["admin", "collaborator", "curriculumAdmin"];

// The workspaces a signed-in person belongs to (organisation keys, as events' ownerAdminId).
async function workspacesOf(req) {
  const user = req.user;
  const out = new Set();
  if (req.ownerAdminId) out.add(req.ownerAdminId);
  if (user.organisationId) out.add(user.organisationId);
  const hubOwners = async (hubIds) => (hubIds.length ? db("learning_hubs").whereIn("id", hubIds).pluck("ownerAdminId") : []);
  try {
    if (user.role === "admin" || user.role === "curriculumAdmin") out.add(user.organisationId || user.id);
    if ((user.role === "collaborator" || user.role === "supervisor") && user.invitedByAdminId) {
      const admin = await db("users").where({ id: user.invitedByAdminId }).first("id", "organisationId");
      if (admin) out.add(organisationIdOf(admin));
    }
    if (user.role === "learner") {
      const learners = user.username
        ? await db("learners").where({ username: user.username }).pluck("id")
        : user.email ? await db("learners").where({ guardianEmail: user.email }).pluck("id") : [];
      const hubIds = learners.length ? await db("learner_hub_links").whereIn("learnerId", learners).pluck("hubId") : [];
      (await hubOwners(hubIds)).forEach((o) => out.add(o));
    }
    if ((user.role === "teacher" || req.user.totLearner) && user.email) {
      const teacherIds = await db("teachers").where({ email: user.email }).pluck("id");
      const hubIds = teacherIds.length ? await db("teacher_hub_links").whereIn("teacherId", teacherIds).pluck("hubId") : [];
      (await hubOwners(hubIds)).forEach((o) => out.add(o));
    }
    if (user.role === "school" && user.email) (await db("learning_hubs").where({ email: user.email }).pluck("ownerAdminId")).forEach((o) => out.add(o));
    if (user.role === "affiliate") (await db("affiliates").where({ userId: user.id }).pluck("ownerAdminId")).forEach((o) => out.add(o));
  } catch (err) {
    console.error("[general-events] workspace lookup:", err.message);
  }
  out.delete(null);
  return out;
}

// Every login of a workspace in the chosen groups → Map userId → group.
async function workspaceMembers(ownerAdminId, groups) {
  const want = new Set(groups && groups.length ? groups : Object.keys(R.AUDIENCE_GROUPS));
  const members = new Map();
  const add = (ids, group) => ids.forEach((id) => { if (id && !members.has(id)) members.set(id, group); });
  const adminIds = await adminIdsOf(ownerAdminId);
  const hubs = await db("learning_hubs").where({ ownerAdminId }).select("id", "email");
  const hubIds = hubs.map((h) => h.id);
  const active = (q) => q.whereNull("deactivatedAt");
  if (want.has("staff")) {
    add(adminIds, "staff");
    if (adminIds.length) add(await active(db("users").whereIn("invitedByAdminId", adminIds).whereIn("role", ["collaborator"])).pluck("id"), "staff");
  }
  if (want.has("supervisors") && adminIds.length) add(await active(db("users").whereIn("invitedByAdminId", adminIds).where({ role: "supervisor" })).pluck("id"), "supervisors");
  if (want.has("hubs")) {
    const emails = hubs.map((h) => h.email).filter(Boolean);
    if (emails.length) add(await active(db("users").whereIn("email", emails).where({ role: "school" })).pluck("id"), "hubs");
  }
  if (want.has("educators") && hubIds.length) {
    const teacherIds = await db("teacher_hub_links").whereIn("hubId", hubIds).pluck("teacherId");
    const emails = teacherIds.length ? (await db("teachers").whereIn("id", teacherIds).pluck("email")).filter(Boolean) : [];
    if (emails.length) add(await active(db("users").whereIn("email", emails).where({ role: "teacher" })).pluck("id"), "educators");
  }
  if ((want.has("parents") || want.has("learners")) && hubIds.length) {
    const learnerIds = await db("learner_hub_links").whereIn("hubId", hubIds).pluck("learnerId");
    const learners = learnerIds.length ? await db("learners").whereIn("id", [...new Set(learnerIds)]).select("guardianEmail", "username") : [];
    const parentEmails = [...new Set(learners.map((l) => l.guardianEmail).filter(Boolean))];
    const usernames = [...new Set(learners.map((l) => l.username).filter(Boolean))];
    if (want.has("parents") && parentEmails.length) add(await active(db("users").whereIn("email", parentEmails).where({ role: "learner" })).pluck("id"), "parents");
    if (want.has("learners") && usernames.length) add(await active(db("users").whereIn("username", usernames).where({ role: "learner" })).pluck("id"), "learners");
  }
  if (want.has("affiliates")) add((await db("affiliates").where({ ownerAdminId }).whereNotNull("userId").pluck("userId")), "affiliates");
  return members;
}

// Where a person's pop-up opens the event: their portal's home with ?event=<id>.
function portalHomeOf(user) {
  if (user.role === "learner") return user.username && !user.email ? "/learner-portal" : "/parent";
  return { teacher: "/teacher-portal", school: "/school-portal", supervisor: "/supervisor-portal", affiliate: "/affiliate-portal" }[user.role] || "/";
}

// ---- Statistics (the event page's Overview) -----------------------------------------------------

function countBy(list, keyOf) {
  const out = {};
  for (const item of list) for (const key of [].concat(keyOf(item) ?? [])) if (key != null && key !== "") out[key] = (out[key] || 0) + 1;
  return out;
}
const AGE_BANDS = [[3, 5], [6, 8], [9, 11], [12, 14], [15, 18]];

async function statsFor(event, regs) {
  const live = regs.filter((r) => r.status !== "cancelled");
  const registered = live.filter((r) => r.status === "registered");
  const waitlisted = live.filter((r) => r.status === "waitlisted");
  const arrived = live.filter((r) => r.attendedAt);
  const people = (list) => list.reduce((s, r) => s + (Number(r.partySize) || 1), 0);
  // Already with us (a learner's guardian before they registered) or joined since.
  const emails = [...new Set(live.map((r) => r.email))];
  const learnerRows = emails.length ? await db("learners").whereIn("guardianEmail", emails).select("guardianEmail", "createdAt") : [];
  const firstLearner = new Map();
  for (const l of learnerRows) {
    const key = lowerEmail(l.guardianEmail);
    const prev = firstLearner.get(key);
    if (!prev || new Date(l.createdAt) < prev) firstLearner.set(key, new Date(l.createdAt));
  }
  const already = live.filter((r) => firstLearner.has(r.email) && firstLearner.get(r.email) <= new Date(r.createdAt));
  const joined = live.filter((r) => firstLearner.has(r.email) && firstLearner.get(r.email) > new Date(r.createdAt));
  const ages = live.flatMap((r) => r.childrenAges || []);
  const byDay = countBy(live, (r) => R.kenyaDateOf(r.createdAt));
  const visit = countBy(live, (r) => {
    const v = r.visitSource;
    if (!v) return r.source.startsWith("system") ? "In the system" : r.source === "walk_in" ? "Walked in" : r.source === "staff" ? "Added by staff" : "Direct";
    if (v.utmSource) return v.utmSource;
    if (v.referrer) { try { return new URL(v.referrer).hostname.replace(/^www\./, ""); } catch { return "Other site"; } }
    return "Direct";
  });
  return {
    registrations: live.length,
    people: people(registered),
    waitlisted: { registrations: waitlisted.length, people: people(waitlisted) },
    arrived: { registrations: arrived.length, people: people(arrived) },
    walkIns: live.filter((r) => r.source === "walk_in").length,
    cancelled: regs.length - live.length,
    capacity: event.capacity || null,
    consent: live.filter((r) => r.marketingConsent).length,
    detailsDone: live.filter((r) => r.detailsAt).length,
    alreadyFamilies: already.length,
    newPeople: live.length - already.length,
    joinedSince: joined.length,
    byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
    sources: countBy(live, (r) => r.source),
    visitSources: Object.entries(visit).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    personTypes: countBy(live, (r) => r.personType),
    interests: countBy(live, (r) => r.interests),
    heardFrom: countBy(live, (r) => r.heardFrom),
    ages: AGE_BANDS.map(([lo, hi]) => ({ label: `${lo}–${hi}`, count: ages.filter((a) => a >= lo && a <= hi).length })),
  };
}

function adminRow(event, regs, hubName, bootcampName) {
  const live = regs.filter((r) => r.status !== "cancelled");
  return {
    ...event,
    state: R.eventState(event),
    when: R.describeWhen(event),
    where: R.whereText(event, hubName),
    hubName,
    bootcampName,
    people: R.seatsTaken(regs),
    registrations: live.length,
    waitlisted: live.filter((r) => r.status === "waitlisted").reduce((s, r) => s + (Number(r.partySize) || 1), 0),
    arrived: live.filter((r) => r.attendedAt).reduce((s, r) => s + (Number(r.partySize) || 1), 0),
    websiteUrl: event.isPublic && event.status === "published" ? Emails.eventUrl(event) : null,
  };
}

function staffRegView(r) {
  return {
    ...ownView(r),
    source: r.source,
    createdAt: r.createdAt,
    attendedAt: r.attendedAt || null,
    cancelledAt: r.cancelledAt || null,
    promotedAt: r.promotedAt || null,
    leadId: r.leadId || null,
    userId: r.userId || null,
    detailsAt: r.detailsAt || null,
    visitSource: r.visitSource || null,
    referralCode: r.referralCode || null,
    ticketCode: r.ticketCode || null,
  };
}

// ---- The service --------------------------------------------------------------------------------

const GeneralEventService = {
  // Admin -----------------------------------------------------------------------------------------
  async list(ownerAdminId) {
    const events = (await db(EVENTS).where({ ownerAdminId }).orderBy("startDate", "desc")).map(rowEvent);
    const ids = events.map((e) => e.id);
    const regs = ids.length ? (await db(REGS).whereIn("eventId", ids).select("eventId", "status", "partySize", "attendedAt")) : [];
    const byEvent = new Map(ids.map((id) => [id, []]));
    regs.forEach((r) => byEvent.get(r.eventId)?.push(r));
    const hubIds = [...new Set(events.map((e) => e.hubId).filter(Boolean))];
    const hubs = hubIds.length ? new Map((await db("learning_hubs").whereIn("id", hubIds).select("id", "name")).map((h) => [h.id, h.name])) : new Map();
    return events.map((e) => adminRow(e, byEvent.get(e.id) || [], hubs.get(e.hubId) || null, null));
  },

  // What the event form picks from.
  async options(ownerAdminId) {
    const [hubs, bootcamps] = await Promise.all([
      db("learning_hubs").where({ ownerAdminId }).whereNotIn("status", ["inactive", "removed"]).orderBy("name").select("id", "name", "address", "mapLink", "isHomeLearning"),
      db("bootcamps").where({ ownerAdminId }).orderBy("startDate", "desc").select("id", "name", "startDate", "endDate"),
    ]);
    return {
      hubs: hubs.filter((h) => !h.isHomeLearning).map(({ id, name, address, mapLink }) => ({ id, name, address: addressLine(address), mapLink: mapLink || null })),
      bootcamps,
      kinds: R.KINDS,
      formats: R.FORMATS,
      audienceGroups: R.AUDIENCE_GROUPS,
      questions: QUESTIONS,
      defaultHighlights: R.DEFAULT_HIGHLIGHTS,
    };
  },

  async get(ownerAdminId, id) {
    const event = await findEvent(id, ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    const regs = await regsOf(id);
    const hubName = await hubNameOf(event);
    const bootcamp = event.bootcampId ? await db("bootcamps").where({ id: event.bootcampId }).first("id", "name") : null;
    return { ...adminRow(event, regs, hubName, bootcamp?.name || null), stats: await statsFor(event, regs), public: await publicView(event, { regs }) };
  },

  async create(req, data) {
    const fields = cleanEventInput(data);
    const id = generateId();
    const at = now();
    const status = data.status === "published" ? "published" : "draft";
    await db(EVENTS).insert({
      id, ownerAdminId: req.ownerAdminId, slug: await uniqueSlug(req.ownerAdminId, fields.title), status,
      publishedAt: status === "published" ? at : null, createdBy: req.user.id, createdAt: at, updatedAt: at, ...fields,
    });
    return this.get(req.ownerAdminId, id);
  },

  async update(req, id, data) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    if (event.status === "cancelled") throw fail(409, "This event is cancelled — make a new one instead.");
    const fields = cleanEventInput(data);
    const status = data.status === "published" ? "published" : data.status === "draft" ? "draft" : event.status;
    if (status === "draft" && event.status === "published" && (await db(REGS).where({ eventId: id }).whereNot({ status: "cancelled" }).first("id"))) {
      throw fail(409, "People have registered — it can't go back to a draft. Close registration or cancel the event instead.");
    }
    const slug = fields.title !== event.title && event.status === "draft" ? await uniqueSlug(req.ownerAdminId, fields.title, id) : event.slug;
    await db(EVENTS).where({ id }).update({
      ...fields, slug, status, publishedAt: status === "published" ? event.publishedAt || now() : event.publishedAt, updatedAt: now(),
    });
    // More room (or a bigger list) may move people up.
    if (status === "published") await promoteWaiting(id);
    return this.get(req.ownerAdminId, id);
  },

  async remove(req, id) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    await db(POPUPS).where({ eventId: id }).del();
    await db(EVENTS).where({ id }).del();
    return { deleted: true };
  },

  // Cancelling tells everyone registered (and waiting) by email; nothing is deleted.
  async cancel(req, id, { reason, notify = true }) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    if (event.status === "cancelled") return this.get(req.ownerAdminId, id);
    await db(EVENTS).where({ id }).update({ status: "cancelled", cancelReason: reason || null, cancelledAt: now(), registrationOpen: false, updatedAt: now() });
    const cancelled = await placed(await findEvent(id));
    if (notify) {
      const regs = (await regsOf(id)).filter((r) => r.status !== "cancelled");
      for (const reg of regs) Emails.eventCancelled(cancelled, reg, { reason }).catch(() => {});
    }
    return this.get(req.ownerAdminId, id);
  },

  async registrations(ownerAdminId, id) {
    const event = await findEvent(id, ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    return (await regsOf(id)).map(staffRegView).reverse();
  },

  // Staff add someone: in advance (counts against capacity, may wait) or a walk-in on the day
  // (arrived; always let in).
  async addRegistration(req, id, data) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    const { registration } = await register(id, {
      ...data, source: data.walkIn ? "walk_in" : "staff", trusted: true, walkIn: !!data.walkIn, checkedInBy: req.user.id,
      details: data.details || null,
    });
    return staffRegView(registration);
  },

  // Staff change a registration: party size, place (registered / waiting / cancelled — staff may
  // let someone in over capacity), details.
  async updateRegistration(req, id, regId, data) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    const reg = rowReg(await db(REGS).where({ id: regId, eventId: id }).first());
    if (!reg) throw fail(404, "Registration not found");
    if (data.status === "cancelled") return staffRegView(await cancelRegistration(reg, { by: "staff" }));
    const fields = { updatedAt: now() };
    if (data.partySize != null) fields.partySize = Math.min(Math.max(1, Math.round(Number(data.partySize))), 50);
    if (data.status === "registered" || data.status === "waitlisted") {
      fields.status = data.status;
      fields.cancelledAt = null;
      if (data.status === "registered" && reg.status === "waitlisted") fields.promotedAt = now();
    }
    for (const key of ["name", "phone"]) if (data[key]) fields[key] = String(data[key]).trim();
    await db(REGS).where({ id: regId }).update({ ...fields, ...(cleanDetails(data.details || {}) || {}) });
    let updated = rowReg(await db(REGS).where({ id: regId }).first());
    if (fields.promotedAt) Emails.promoted(await placed(event), updated).catch(() => {});
    await syncLead(event, updated).catch(() => {});
    if (fields.partySize != null || data.status === "waitlisted") await promoteWaiting(id);
    updated = rowReg(await db(REGS).where({ id: regId }).first());
    return staffRegView(updated);
  },

  async markArrived(req, id, regId, arrived) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    const reg = await db(REGS).where({ id: regId, eventId: id }).first();
    if (!reg) throw fail(404, "Registration not found");
    await db(REGS).where({ id: regId }).update({ attendedAt: arrived ? reg.attendedAt || now() : null, checkedInBy: arrived ? req.user.id : null, updatedAt: now() });
    return staffRegView(rowReg(await db(REGS).where({ id: regId }).first()));
  },

  // A ticket scanned or typed at the door (the portal's /ticket/<code>, the Check-in tab): who it
  // is, for which event, and whether it lets them in. Only this workspace's events.
  async ticket(req, rawCode) {
    const code = R.normaliseTicketCode(rawCode);
    if (!code) throw fail(400, "That isn't a ticket code — it looks like EV-7K3M9Q.");
    const reg = rowReg(await db(REGS).where({ ticketCode: code }).first());
    const event = reg ? await findEvent(reg.eventId, req.ownerAdminId) : null;
    if (!reg || !event) throw fail(404, `No ticket ${code} for your events.`);
    return {
      code,
      ticket: R.ticketState(reg, event),
      registration: staffRegView(reg),
      event: { id: event.id, title: event.title, when: R.describeWhen(event), where: R.whereText(event, await hubNameOf(event)), state: R.eventState(event) },
    };
  },

  // Let them in: a valid ticket not used yet is marked arrived (the whole party). A used one says
  // when; a waiting-list, cancelled or cancelled-event ticket is refused.
  async ticketCheckIn(req, rawCode) {
    const found = await this.ticket(req, rawCode);
    if (!found.ticket.valid) throw fail(409, `Ticket ${found.code}: ${found.ticket.label}.`, { code: "TICKET_NOT_VALID" });
    if (found.ticket.used) return { ...found, justCheckedIn: false };
    await this.markArrived(req, found.event.id, found.registration.id, true);
    return { ...(await this.ticket(req, found.code)), justCheckedIn: true };
  },

  // The QR code (PNG) on a ticket — for the emails (mail apps need an image address) and the
  // website's registration page. It holds the check-in address, nothing private.
  async ticketPng(token) {
    const reg = await this.byToken(token);
    if (!reg.ticketCode) throw fail(404, "No ticket");
    return QRCode.toBuffer(ticketCheckInUrl(reg.ticketCode), { type: "png", width: 360, margin: 2, errorCorrectionLevel: "M", color: { dark: "#14283c", light: "#ffffff" } });
  },

  // An email to a group of the people registered: everyone, registered, waiting, came, didn't come.
  async message(req, id, { to, subject, body }) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    const regs = (await regsOf(id)).filter((r) => r.status !== "cancelled");
    const pick = {
      everyone: () => true,
      registered: (r) => r.status === "registered",
      waitlisted: (r) => r.status === "waitlisted",
      came: (r) => !!r.attendedAt,
      missed: (r) => r.status === "registered" && !r.attendedAt,
    }[to] || (() => false);
    const chosen = regs.filter(pick);
    const key = generateId();
    const shown = await placed(event);
    await Promise.all(chosen.map((reg) => Emails.message(shown, reg, { subject, body, key })));
    return { sent: chosen.length };
  },

  // Invitations: a bootcamp's families (an email to every parent, with or without a login, plus the
  // bell for those with one) or everyone signed in to the workspace in the event's audience (the
  // bell, and an email where they allow it). Each person once per event.
  async invite(req, id, { audience }) {
    const event = await findEvent(id, req.ownerAdminId);
    if (!event) throw fail(404, "Event not found");
    if (event.status !== "published" || R.eventState(event) !== "upcoming") throw fail(409, "Publish the event first — and only before it starts.");
    const registered = new Set((await regsOf(id)).filter((r) => r.status !== "cancelled").map((r) => r.email));
    const shown = await placed(event);
    let emailed = 0;
    let notified = 0;
    let userIds = new Map();
    if (audience === "bootcamp") {
      if (!event.bootcampId) throw fail(400, "Link the event to a bootcamp first.");
      const bootcamp = await db("bootcamps").where({ id: event.bootcampId, ownerAdminId: req.ownerAdminId }).first();
      if (!bootcamp) throw fail(404, "Bootcamp not found");
      const { participants } = await require("../bootcamps/bootcamp-participants.service").list(bootcamp, { scope: "run" });
      const families = new Map();
      for (const p of participants) {
        const email = lowerEmail(p.parentEmail);
        if (email && !families.has(email)) families.set(email, { email, name: p.parentName });
      }
      for (const person of families.values()) {
        if (registered.has(person.email)) continue;
        await Emails.invitation(shown, person);
        emailed += 1;
      }
      const emails = [...families.keys()];
      const usernames = participants.map((p) => p.username).filter(Boolean);
      const logins = [
        ...(emails.length ? await db("users").whereIn("email", emails).where({ role: "learner" }).select("id", "role", "email", "username") : []),
        ...(usernames.length ? await db("users").whereIn("username", usernames).select("id", "role", "email", "username") : []),
      ];
      userIds = new Map(logins.map((u) => [u.id, u]));
    } else {
      const members = await workspaceMembers(event.ownerAdminId, event.systemAudience);
      const logins = members.size ? await db("users").whereIn("id", [...members.keys()]).select("id", "role", "email", "username") : [];
      userIds = new Map(logins.map((u) => [u.id, u]));
    }
    for (const user of userIds.values()) {
      if (user.email && registered.has(lowerEmail(user.email))) continue;
      const created = await NotificationService.notifyPerson(user.id, {
        type: "general_event_invite",
        title: `You're invited: ${event.title}`,
        message: `${R.describeWhen(event)} · ${R.whereText(shown)}. It's free — register to keep your place.`,
        payload: { eventId: event.id, route: `${portalHomeOf(user)}?event=${event.id}` },
        dedupeKey: `general_event_invite:${event.id}`,
        ownerAdminId: event.ownerAdminId,
      });
      if (created) notified += 1;
    }
    return { emailed, notified };
  },

  // The website ---------------------------------------------------------------------------------
  async publicList(ownerAdminId, { past = false } = {}) {
    const events = (await db(EVENTS).where({ ownerAdminId, status: "published", isPublic: true }).orderBy("startDate", past ? "desc" : "asc")).map(rowEvent);
    const chosen = events.filter((e) => (R.eventState(e) === "ended") === past).slice(0, past ? 12 : 50);
    return Promise.all(chosen.map((e) => publicView(e)));
  },

  async publicBySlug(ownerAdminId, slug) {
    const event = rowEvent(await db(EVENTS).where({ ownerAdminId, slug }).whereIn("status", ["published", "cancelled"]).where({ isPublic: true }).first());
    if (!event) throw fail(404, "Event not found");
    return event;
  },

  async publicDetail(ownerAdminId, slug) {
    return publicView(await this.publicBySlug(ownerAdminId, slug));
  },

  // The website's pop-up: the soonest event that has one showing today.
  async publicPopup(ownerAdminId) {
    const events = (await db(EVENTS).where({ ownerAdminId, status: "published", isPublic: true, websitePopup: true })).map(rowEvent);
    const showing = events.filter((e) => R.popupShows(e, "website"));
    const event = R.soonest(showing);
    if (!event) return null;
    return { ...(await publicView(event)), others: showing.length - 1 };
  },

  async publicRegister(ownerAdminId, slug, input) {
    const event = await this.publicBySlug(ownerAdminId, slug);
    const { registration, already } = await register(event.id, { ...input, trusted: false });
    // Someone typing an address that's already registered gets no link to it — its owner is emailed.
    if (already) return { already: true, status: registration.status, event: await publicView(await findEvent(event.id)) };
    return { already: false, registration: ownView(registration), event: await publicView(await findEvent(event.id)) };
  },

  async byToken(token) {
    const reg = rowReg(await db(REGS).where({ token: String(token || "") }).first());
    if (!reg) throw fail(404, "We couldn't find that registration. Check the link in your email.");
    return reg;
  },

  async tokenView(token) {
    const reg = await this.byToken(token);
    const event = await findEvent(reg.eventId);
    const view = await publicView(event);
    const showLink = reg.status === "registered" && event.meetingLink && ["upcoming", "on_now"].includes(R.eventState(event)) && R.daysUntil(event) <= 1;
    return { registration: ownView(reg), event: { ...view, slug: event.slug, meetingLink: showLink ? event.meetingLink : null } };
  },

  async tokenDetails(token, details) {
    const reg = await this.byToken(token);
    if (reg.status === "cancelled") throw fail(409, "This registration is cancelled.");
    return ownView(await saveDetails(reg, details));
  },

  async tokenCancel(token) {
    const reg = await this.byToken(token);
    return ownView(await cancelRegistration(reg, { by: "them" }));
  },

  async calendar(event) {
    const shown = await placed(event);
    const location = shown.format === "online" ? "Online" : [shown.venueName, shown.venueAddress].filter(Boolean).join(", ");
    return R.calendarFile(shown, { url: Emails.eventUrl(event), location, details: event.tagline || event.title });
  },

  // Signed in (any portal) ------------------------------------------------------------------------
  async visibleTo(req) {
    const user = await db("users").where({ id: req.user.id }).first("id", "name", "email", "phone", "username", "role");
    const group = R.audienceGroupOf({ ...req.user, email: user?.email, username: user?.username });
    const events = (await db(EVENTS).where({ status: "published" })).map(rowEvent).filter((e) => R.eventState(e) === "upcoming" && R.audienceAllows(e.systemAudience, group));
    // Public events are for anyone; a system-only event only for its own workspace.
    const needsWorkspace = events.some((e) => !e.isPublic);
    const mine = needsWorkspace ? await workspacesOf(req) : new Set();
    return { user, group, events: events.filter((e) => e.isPublic || mine.has(e.ownerAdminId)) };
  },

  async myRegistrations(user, eventIds) {
    if (!eventIds.length) return new Map();
    const rows = (await db(REGS).whereIn("eventId", eventIds).whereNot({ status: "cancelled" }).andWhere((q) => {
      q.where({ userId: user.id });
      if (user.email) q.orWhere({ email: lowerEmail(user.email) });
    })).map(rowReg);
    return new Map(rows.map((r) => [r.eventId, r]));
  },

  // The sign-in pop-up: the soonest event showing today that they haven't registered for or put off.
  // `eventId` (from a notification's ?event=) opens that one whatever.
  async myPopup(req, { eventId = null } = {}) {
    const { user, group, events } = await this.visibleTo(req);
    const regs = await this.myRegistrations(user, events.map((e) => e.id));
    const hidden = new Set((await db(POPUPS).where({ userId: user.id }).where("hiddenUntil", ">", now()).pluck("eventId")));
    let event = eventId ? events.find((e) => e.id === eventId) : null;
    const showing = events.filter((e) => R.popupShows(e, "system") && !regs.has(e.id) && !hidden.has(e.id));
    if (!event) event = R.soonest(showing);
    if (!event) return null;
    const child = group === "learners";
    return {
      event: await publicView(event),
      registration: regs.has(event.id) ? ownView(regs.get(event.id)) : null,
      others: showing.filter((e) => e.id !== event.id).length,
      canRegister: !child,
      prefill: child ? null : { name: user.name || "", email: user.email || "", phone: user.phone || "" },
      websiteUrl: Emails.siteUrl("/events"),
    };
  },

  async myList(req) {
    const { user, events } = await this.visibleTo(req);
    const regs = await this.myRegistrations(user, events.map((e) => e.id));
    const sorted = [...events].sort((a, b) => R.startsAt(a) - R.startsAt(b));
    return Promise.all(sorted.map(async (e) => ({ event: await publicView(e), registration: regs.has(e.id) ? ownView(regs.get(e.id)) : null })));
  },

  async myRegister(req, eventId, input) {
    const { user, group, events } = await this.visibleTo(req);
    if (group === "learners") throw fail(403, "Ask your parent to register — they'll see it when they sign in.");
    const event = events.find((e) => e.id === eventId);
    if (!event) throw fail(404, "Event not found");
    const email = lowerEmail(input.email || user.email);
    if (!email) throw fail(400, "Enter your email address");
    const ownEmail = user.email && lowerEmail(user.email) === email;
    const { registration, already } = await register(eventId, {
      name: input.name || user.name || "", email, phone: input.phone, partySize: input.partySize,
      marketingConsent: input.marketingConsent, source: input.fromPopup ? "system_popup" : "system",
      userId: user.id, trusted: ownEmail,
    });
    if (already) return { already: true, registration: null, event: await publicView(await findEvent(eventId)) };
    if (!registration.userId) await db(REGS).where({ id: registration.id }).update({ userId: user.id });
    return { already: false, registration: ownView(registration), event: await publicView(await findEvent(eventId)) };
  },

  async myOwnRegistration(req, regId) {
    const user = await db("users").where({ id: req.user.id }).first("id", "email");
    const reg = rowReg(await db(REGS).where({ id: regId }).first());
    if (!reg || !(reg.userId === user.id || (user.email && reg.email === lowerEmail(user.email)))) throw fail(404, "Registration not found");
    return reg;
  },

  async myDetails(req, regId, details) {
    return ownView(await saveDetails(await this.myOwnRegistration(req, regId), details));
  },

  async myCancel(req, regId) {
    return ownView(await cancelRegistration(await this.myOwnRegistration(req, regId), { by: "them" }));
  },

  // "Not now" on the pop-up: hidden for `days` (default 3).
  async myHide(req, eventId, days = 3) {
    const until = new Date(Date.now() + Math.min(Math.max(Number(days) || 3, 1), 365) * 86400000);
    const at = now();
    const existing = await db(POPUPS).where({ userId: req.user.id, eventId }).first();
    if (existing) await db(POPUPS).where({ id: existing.id }).update({ hiddenUntil: until, updatedAt: at });
    else await db(POPUPS).insert({ id: generateId(), userId: req.user.id, eventId, hiddenUntil: until, createdAt: at, updatedAt: at });
    return { hiddenUntil: until };
  },

  // Cron (npm run events:process, and every hour with checkins:process) -------------------------
  // Reminders to the people registered — two days before (one day, for a registration made the
  // day before) and on the morning of the day — and, the day after, a nudge to the admins to
  // thank the people who came. Every send is keyed, so running it again sends nothing twice.
  async processAll(at = new Date()) {
    const counts = { soon: 0, today: 0, ended: 0 };
    const events = (await db(EVENTS).where({ status: "published" })).map(rowEvent);
    const kenyaHour = Number(new Date(at.getTime() + 3 * 3600 * 1000).toISOString().slice(11, 13));
    for (const event of events) {
      const days = R.daysUntil(event, at);
      const state = R.eventState(event, at);
      if (state === "upcoming" && days >= 0 && days <= 2) {
        const shown = await placed(event);
        const regs = (await regsOf(event.id)).filter((r) => r.status === "registered");
        for (const reg of regs) {
          const age = at - new Date(reg.createdAt);
          if (days === 0 && kenyaHour >= 6) {
            await Emails.reminder(shown, reg, { when: "today" });
            counts.today += 1;
          } else if (days > 0 && age > 20 * 3600 * 1000) {
            await Emails.reminder(shown, reg, { when: "soon" });
            counts.soon += 1;
          }
        }
      }
      if (state === "ended" && at - R.endsAt(event) < 3 * 86400000) {
        const regs = await regsOf(event.id);
        const came = regs.filter((r) => r.attendedAt).reduce((s, r) => s + (Number(r.partySize) || 1), 0);
        const adminIds = await adminIdsOf(event.ownerAdminId);
        for (const recipientId of [...new Set(adminIds.length ? adminIds : [event.ownerAdminId])]) {
          await NotificationService.notifyPerson(recipientId, {
            type: "general_event_ended",
            title: `${event.title} is over — say thank you`,
            message: `${came ? `${came} ${came === 1 ? "person" : "people"} came` : "No one was marked as arrived"}. Send a thank-you (with what's next) to the people who came, and a "sorry we missed you" to the rest.`,
            payload: { eventId: event.id, route: `/events/general/${event.id}?tab=messages` },
            dedupeKey: `general_event_ended:${event.id}`,
            ownerAdminId: event.ownerAdminId,
          });
        }
        counts.ended += 1;
      }
    }
    return counts;
  },
};

GeneralEventService._internal = { register, promoteWaiting, cancelRegistration, workspaceMembers, workspacesOf, statsFor, publicView };
module.exports = GeneralEventService;
