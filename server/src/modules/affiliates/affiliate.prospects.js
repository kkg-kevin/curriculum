const crypto = require("crypto");
const db = require("../../config/db");
const env = require("../../config/env");
const { generateId, toJson } = require("../../shared/utils/model.utils");
const NotificationService = require("../notifications/notification.service");
const { queueMail } = require("../../shared/mail/mail.service");
const { renderEmail, appUrl } = require("../../shared/mail/mail.layout");
const { normaliseSettings, phoneKey, emailKey, nameKey, prospectState, stageOf, stageProblem, PROSPECT_STAGES, PROGRAMMES, PROGRAMME_LABEL } = require("./affiliate.rules");

// Prospects (19 Nov 2026) — families an affiliate has talked to and pre-registers. While the claim
// is open (Settings' claimDays, 60 by default), a sign-up whose parent phone or email matches is that
// affiliate's referral, code or no code (affiliate.service.js's recordReferral, via "prospect").
//
// Fair by design:
//   - phone or email is required (a name alone never claims anyone);
//   - one open claim per family: a second affiliate is refused with the same words whoever holds
//     it ("This family can't be added") — never told who;
//   - families already with us (a learner's guardian, a parent login, an earlier referral) can't
//     be claimed;
//   - the affiliate can't claim themself; at most `prospectDailyLimit` a day;
//   - a sign-up with only the same parent name is a *possible match* for an admin to decide.
// Privacy (Data Protection Act): the affiliate confirms the family agreed to be contacted; an
// invite carries an opt-out link; an expired, released or opted-out claim keeps the first name only.
//
// 26 Nov 2026: a family our TEAM registers (Affiliates -> Prospects -> Register a family) is the
// team's own (affiliateId empty): no affiliate earns from it, it has no claim clock, and while it's
// open no affiliate can add them. Every prospect has a stage (new, contacted, interested... see
// affiliate.rules.js's PROSPECT_STAGES), set by its affiliate or our team; the affiliate and our
// team can both correct its details. Move and Release are gone.

const T = "affiliate_prospects";
const N = "affiliate_prospect_notes";
const A = "affiliates";
const R = "affiliate_referrals";
const now = () => new Date();
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const CANT_ADD = "This family can't be added — they're already with us or already on a list.";

async function settingsFor(ownerAdminId) {
  const row = ownerAdminId ? await db("affiliate_settings").where({ ownerAdminId }).first() : null;
  const raw = typeof row?.settings === "string" ? JSON.parse(row.settings || "{}") : row?.settings;
  return normaliseSettings(raw);
}

function websiteUrl() {
  const sites = String(env.PUBLIC_SITE_URL || "").split(",").map((o) => o.trim()).filter(Boolean);
  return (sites.find((o) => /^https:\/\//i.test(o)) || sites[0] || "").replace(/\/+$/, "");
}
const linkFor = (code) => (websiteUrl() ? `${websiteUrl()}/?ref=${encodeURIComponent(code)}` : null);
const optOutUrl = (token) => appUrl(`/no-thanks/${token}`);

// What is wiped when a claim closes without a sign-up: everything but the first name.
const wiped = (p, status, reason) => ({
  status, closedReason: reason || null, updatedAt: now(),
  parentName: firstName(p.parentName) || "Family", phone: null, phoneKey: null, email: null, emailKey: null, childName: null, notes: null, followUpOn: null,
});
// The team's follow-up notes can hold personal details too: they go when the details go.
const dropNotes = (ids) => db(N).whereIn("prospectId", [].concat(ids).filter(Boolean)).del();
// Still holding the family: the team's own (no clock), or an affiliate's before its end date.
const live = (q) => q.where((w) => w.whereNull("affiliateId").orWhere("expiresAt", ">", now()));
const isTeam = (p) => !p.affiliateId;

// ---- Housekeeping -----------------------------------------------------------------------------------
// Open claims past their end date become expired (and lose their details). Cheap; run before any
// read or match.
async function expireDue(ownerAdminId = null) {
  const q = db(T).where({ status: "open" }).whereNotNull("affiliateId").where("expiresAt", "<", now());
  if (ownerAdminId) q.where({ ownerAdminId });
  const due = await q.select("id", "parentName");
  for (const p of due) await db(T).where({ id: p.id, status: "open" }).update(wiped(p, "expired", "The claim period ended"));
  if (due.length) await dropNotes(due.map((p) => p.id));
  return due.length;
}

// ---- Checks when adding ---------------------------------------------------------------------------------
// Already with us: a learner's guardian or a parent login with this email or phone, or a family an
// affiliate already referred.
async function alreadyWithUs({ pKey, eKey }) {
  if (eKey) {
    if (await db("learners").whereRaw("LOWER(guardianEmail) = ?", [eKey]).first("id")) return true;
    if (await db("users").whereRaw("LOWER(email) = ?", [eKey]).first("id")) return true;
    if (await db(R).whereRaw("LOWER(parentEmail) = ?", [eKey]).whereNot({ status: "cancelled" }).first("id")) return true;
  }
  if (pKey) {
    const tail = pKey.slice(-6);
    const learners = await db("learners").where("guardianPhone", "like", `%${tail}%`).select("guardianPhone").limit(50);
    if (learners.some((l) => phoneKey(l.guardianPhone) === pKey)) return true;
    const users = await db("users").where("phone", "like", `%${tail}%`).select("phone").limit(50);
    if (users.some((u) => phoneKey(u.phone) === pKey)) return true;
    const refs = await db(R).where("parentPhone", "like", `%${tail}%`).whereNot({ status: "cancelled" }).select("parentPhone").limit(50);
    if (refs.some((r) => phoneKey(r.parentPhone) === pKey)) return true;
  }
  return false;
}

async function openClaimOn(ownerAdminId, { pKey, eKey }) {
  if (!pKey && !eKey) return null;
  return live(db(T).where({ ownerAdminId, status: "open" }))
    .where((q) => {
      if (pKey) q.orWhere({ phoneKey: pKey });
      if (eKey) q.orWhere({ emailKey: eKey });
    }).orderBy("createdAt").first();
}

const isSelf = (affiliate, { pKey, eKey }) => Boolean(
  (eKey && emailKey(affiliate.email) === eKey) || (pKey && (phoneKey(affiliate.phone) === pKey || phoneKey(affiliate.payoutPhone) === pKey)),
);

// One prospect, checked and saved. `data` is validated by the routes. → the saved row.
// `affiliate` null + `teamOf` (an ownerAdminId): our team's own family.
async function add(affiliate, data, { source = "portal", createdBy = null, skipDailyLimit = false, teamOf = null } = {}) {
  const team = !affiliate && teamOf;
  if (!team && (!affiliate || affiliate.status !== "active")) fail("Only an active affiliate can add families", 403);
  const ownerAdminId = team ? teamOf : affiliate.ownerAdminId;
  const settings = await settingsFor(ownerAdminId);
  if (!team && (!settings.enabled || !settings.prospectsEnabled)) fail("Adding families isn't open at the moment", 403);
  await expireDue(ownerAdminId);
  const pKey = phoneKey(data.phone);
  const eKey = emailKey(data.email);
  if (!pKey && !eKey) fail("Give the parent's phone number or email — that's how we recognise them when they sign up");
  if (!team && isSelf(affiliate, { pKey, eKey })) fail("You can't add yourself");
  if (!team && !skipDailyLimit) {
    const since = new Date(Date.now() - 24 * 3600e3);
    const today = Number((await db(T).where({ affiliateId: affiliate.id }).where("createdAt", ">", since).count({ n: "*" }).first()).n) || 0;
    if (today >= settings.prospectDailyLimit) fail(`You can add up to ${settings.prospectDailyLimit} families a day — try again tomorrow`, 429);
  }
  const held = await openClaimOn(ownerAdminId, { pKey, eKey });
  if (held && (team ? isTeam(held) : held.affiliateId === affiliate.id)) fail(team ? "This family is already on our list" : "This family is already on your list", 409);
  if (held && team) fail(`${await affiliateName(held.affiliateId)} already has this family on their list (until ${new Date(held.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}).`, 409);
  if (held || await alreadyWithUs({ pKey, eKey })) fail(team ? "This family is already with us (a parent, a learner's guardian or an earlier sign-up)." : CANT_ADD, 409);
  const row = {
    id: generateId(),
    ownerAdminId,
    affiliateId: team ? null : affiliate.id,
    parentName: String(data.parentName).trim().slice(0, 150),
    phone: data.phone ? String(data.phone).trim().slice(0, 40) : null,
    phoneKey: pKey,
    email: data.email ? String(data.email).trim().slice(0, 255) : null,
    emailKey: eKey,
    childName: data.childName ? String(data.childName).trim().slice(0, 150) : null,
    childAge: data.childAge ? Number(data.childAge) : null,
    programme: PROGRAMMES.includes(data.programme) ? data.programme : null,
    notes: data.notes ? String(data.notes).trim().slice(0, 1000) : null,
    source,
    createdBy,
    consentAt: now(),
    status: "open",
    stage: "new",
    expiresAt: new Date(Date.now() + settings.claimDays * 864e5), // not used for the team's own
    inviteToken: crypto.randomBytes(24).toString("hex"),
    createdAt: now(),
    updatedAt: now(),
  };
  await db(T).insert(row);
  return row;
}

const affiliateName = async (id) => (id ? (await db(A).where({ id }).first("name"))?.name : null) || "An affiliate";

// Several at once (a spreadsheet): each row added or refused on its own. → [{ row, ok, id?, error? }]
async function addMany(affiliate, rows, opts = {}) {
  const settings = await settingsFor(affiliate?.ownerAdminId);
  const since = new Date(Date.now() - 24 * 3600e3);
  let room = settings.prospectDailyLimit - (Number((await db(T).where({ affiliateId: affiliate.id }).where("createdAt", ">", since).count({ n: "*" }).first()).n) || 0);
  const results = [];
  for (const [i, r] of rows.entries()) {
    if (!opts.skipDailyLimit && room <= 0) { results.push({ row: i + 1, ok: false, error: `Over today's limit of ${settings.prospectDailyLimit}` }); continue; }
    try {
      const saved = await add(affiliate, r, { ...opts, skipDailyLimit: true });
      room -= 1;
      results.push({ row: i + 1, ok: true, id: saved.id, name: saved.parentName });
    } catch (err) {
      results.push({ row: i + 1, ok: false, name: r.parentName, error: err.message });
    }
  }
  return results;
}

// ---- At sign-up (affiliate.service.js's recordReferral) -------------------------------------------
// The open claim on this family's phone or email, with its affiliate — the oldest first; a claim
// whose affiliate is no longer active is passed over. → { prospect, affiliate } or null.
async function matchFor(ownerAdminId, parent = {}) {
  await expireDue(ownerAdminId);
  const pKey = phoneKey(parent.phone);
  const eKey = emailKey(parent.email);
  if (!pKey && !eKey) return null;
  const rows = await live(db(T).where({ ownerAdminId, status: "open" }))
    .where((q) => {
      if (pKey) q.orWhere({ phoneKey: pKey });
      if (eKey) q.orWhere({ emailKey: eKey });
    }).orderBy("createdAt");
  for (const p of rows) {
    if (isTeam(p)) return { prospect: p, affiliate: null, team: true }; // our own family: nobody earns
    const affiliate = await db(A).where({ id: p.affiliateId }).first();
    if (affiliate && affiliate.status === "active") return { prospect: p, affiliate };
  }
  return null;
}

// The claim's outcome once the referral is recorded: theirs (signed up), or another affiliate's
// typed code won (lost).
async function settle(prospect, referral, winnerAffiliateId) {
  if (!prospect) return;
  // Our team's own family is ours whoever (if anyone) the sign-up was credited to.
  if (isTeam(prospect) || prospect.affiliateId === winnerAffiliateId) {
    await db(T).where({ id: prospect.id }).update({ status: "signed_up", stage: "signed_up", referralId: referral?.id || null, convertedAt: now(), updatedAt: now() });
  } else {
    await db(T).where({ id: prospect.id, status: "open" }).update(wiped(prospect, "lost", "The family signed up with another affiliate's code"));
    await dropNotes(prospect.id);
  }
}

// A sign-up the affiliate rules never looked at (the programme switched off, prospects off, a
// referral already recorded): our team's own families matching it are still marked signed up.
async function settleTeamFor(ownerAdminId, parent = {}) {
  const pKey = phoneKey(parent.phone);
  const eKey = emailKey(parent.email);
  if (!ownerAdminId || (!pKey && !eKey)) return 0;
  return db(T).where({ ownerAdminId, status: "open" }).whereNull("affiliateId")
    .where((q) => {
      if (pKey) q.orWhere({ phoneKey: pKey });
      if (eKey) q.orWhere({ emailKey: eKey });
    }).update({ status: "signed_up", stage: "signed_up", convertedAt: now(), updatedAt: now() });
}

// A sign-up nobody is credited for, whose parent has the same name as an open claim: kept on the
// claim for an admin to approve or dismiss, and the workspace's admins are told.
async function notePossibleMatch(ownerAdminId, parent = {}, ctx = {}) {
  const key = nameKey(parent.name);
  if (!key || !key.includes(" ")) return null; // a first name alone is too common to suggest
  const candidates = await live(db(T).where({ ownerAdminId, status: "open" })).whereNull("possibleMatch").select("id", "parentName", "affiliateId");
  const hit = candidates.find((p) => nameKey(p.parentName) === key);
  if (!hit) return null;
  const match = { programme: ctx.programme, recordId: ctx.recordId, invoiceId: ctx.invoiceId || null, parent: { name: parent.name || null, email: parent.email || null, phone: parent.phone || null, userId: parent.userId || null }, detail: ctx.detail || null, at: now().toISOString() };
  await db(T).where({ id: hit.id }).update({ possibleMatch: toJson(match), updatedAt: now() });
  await NotificationService._notify(ownerAdminId, {
    type: "affiliate_possible_match",
    title: "A sign-up may be an affiliate's family",
    message: `${parent.name} signed up for ${PROGRAMME_LABEL[ctx.programme] || "a programme"} with the same name as a family ${hit.affiliateId ? "an affiliate" : "our team"} registered. Check and decide.`,
    ownerAdminId,
    payload: { route: "/affiliates?tab=prospects&filter=matches" },
    dedupeKey: `affiliate_possible_match:${hit.id}:${ctx.recordId}`,
  }).catch(() => {});
  return hit.id;
}

// ---- Views --------------------------------------------------------------------------------------------
async function referralsById(rows) {
  const ids = rows.map((p) => p.referralId).filter(Boolean);
  const refs = ids.length ? await db(R).whereIn("id", ids).select("id", "status", "programme", "createdAt") : [];
  return new Map(refs.map((r) => [r.id, r]));
}

// The affiliate's own list. Contact details only while their claim is open.
async function listMine(affiliate) {
  if (!affiliate) return { prospects: [], settings: null };
  await expireDue(affiliate.ownerAdminId);
  const settings = await settingsFor(affiliate.ownerAdminId);
  const rows = await db(T).where({ affiliateId: affiliate.id }).orderBy("createdAt", "desc").limit(500);
  const refs = await referralsById(rows);
  return {
    settings: { enabled: settings.enabled && settings.prospectsEnabled, claimDays: settings.claimDays, dailyLimit: settings.prospectDailyLimit, claimOrder: settings.claimOrder },
    stages: PROSPECT_STAGES,
    canInvite: Boolean(websiteUrl()),
    link: linkFor(affiliate.code),
    prospects: rows.map((p) => {
      const ref = refs.get(p.referralId);
      const state = prospectState(p, ref);
      const open = state.key === "open";
      return {
        id: p.id, parentName: open ? p.parentName : firstName(p.parentName), phone: open ? p.phone : null, email: open ? p.email : null,
        childName: open ? p.childName : null, childAge: open ? p.childAge : null, programme: p.programme, programmeLabel: PROGRAMME_LABEL[p.programme] || null,
        notes: open ? p.notes : null, state, stage: stageOf(p).key, stageLabel: stageOf(p).label, stageAt: p.stageAt,
        expiresAt: p.expiresAt, createdAt: p.createdAt, invitedAt: p.invitedAt, inviteCount: p.inviteCount,
        signedUpFor: ref ? PROGRAMME_LABEL[ref.programme] : null, convertedAt: p.convertedAt,
      };
    }),
  };
}

// Every claim in the workspace, for the Affiliates page. `filter`: open | signed_up | closed | matches.
async function listAll(ownerAdminId, { filter = null, affiliateId = null, stage = null } = {}) {
  await expireDue(ownerAdminId);
  let q = db(T).where({ ownerAdminId });
  if (affiliateId === "team") q = q.whereNull("affiliateId");
  else if (affiliateId) q = q.where({ affiliateId });
  if (stage === "signed_up") q = q.where({ status: "signed_up" });
  else if (stage) q = q.where({ stage }).where({ status: "open" });
  if (filter === "open") q = q.where({ status: "open" });
  if (filter === "signed_up") q = q.where({ status: "signed_up" });
  if (filter === "closed") q = q.whereIn("status", ["lost", "expired", "released", "opted_out"]);
  if (filter === "matches") q = q.whereNotNull("possibleMatch").where({ status: "open" });
  const rows = await q.orderBy("createdAt", "desc").limit(1000);
  const affIds = [...new Set(rows.map((p) => p.affiliateId).filter(Boolean))];
  const affs = affIds.length ? await db(A).whereIn("id", affIds).select("id", "name", "code", "status") : [];
  const affById = new Map(affs.map((a) => [a.id, a]));
  const refs = await referralsById(rows);
  const all = await db(T).where({ ownerAdminId }).select("status", "possibleMatch", "stage", "affiliateId");
  const notes = rows.length ? await db(N).whereIn("prospectId", rows.map((p) => p.id)).orderBy("createdAt", "desc").select("prospectId", "body", "authorName", "createdAt") : [];
  const latestNote = new Map();
  const noteCount = new Map();
  for (const n of notes) {
    if (!latestNote.has(n.prospectId)) latestNote.set(n.prospectId, n);
    noteCount.set(n.prospectId, (noteCount.get(n.prospectId) || 0) + 1);
  }
  return {
    counts: {
      open: all.filter((p) => p.status === "open").length,
      signed_up: all.filter((p) => p.status === "signed_up").length,
      closed: all.filter((p) => ["lost", "expired", "released", "opted_out"].includes(p.status)).length,
      matches: all.filter((p) => p.status === "open" && p.possibleMatch).length,
      stages: Object.fromEntries(PROSPECT_STAGES.map((st) => [st.key, all.filter((p) => (p.status === "open" || p.status === "signed_up") && stageOf(p).key === st.key).length])),
    },
    stages: PROSPECT_STAGES,
    prospects: rows.map((p) => {
      const match = typeof p.possibleMatch === "string" ? JSON.parse(p.possibleMatch) : p.possibleMatch;
      return {
        ...p,
        possibleMatch: match ? { ...match, programmeLabel: PROGRAMME_LABEL[match.programme] || match.programme } : null,
        affiliate: affById.get(p.affiliateId) || null,
        team: isTeam(p),
        state: prospectState(p, refs.get(p.referralId)),
        stage: stageOf(p).key,
        stageLabel: stageOf(p).label,
        stageHistory: undefined,
        programmeLabel: PROGRAMME_LABEL[p.programme] || null,
        latestNote: latestNote.get(p.id) ? { body: latestNote.get(p.id).body, authorName: latestNote.get(p.id).authorName, at: latestNote.get(p.id).createdAt } : null,
        noteCount: noteCount.get(p.id) || 0,
        followUpOn: dateOnly(p.followUpOn),
        inviteToken: undefined,
      };
    }),
  };
}

const dateOnly = (d) => (d ? (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : String(d).slice(0, 10)) : null);

// One prospect, everything about it, for its own page on the Affiliates screen.
async function detail(ownerAdminId, id) {
  await expireDue(ownerAdminId);
  const p = await owned(id, { ownerAdminId });
  const [affiliate, notes, createdBy, refs, settings] = await Promise.all([
    p.affiliateId ? db(A).where({ id: p.affiliateId }).first("id", "name", "code", "email", "phone", "status", "kind") : null,
    db(N).where({ prospectId: p.id }).orderBy("createdAt", "asc"),
    p.createdBy ? db("users").where({ id: p.createdBy }).first("name") : null,
    referralsById([p]),
    settingsFor(ownerAdminId),
  ]);
  const ref = refs.get(p.referralId) || null;
  const match = typeof p.possibleMatch === "string" ? JSON.parse(p.possibleMatch) : p.possibleMatch;
  return {
    ...p,
    inviteToken: undefined, phoneKey: undefined, emailKey: undefined,
    possibleMatch: match ? { ...match, programmeLabel: PROGRAMME_LABEL[match.programme] || match.programme } : null,
    affiliate: affiliate || null,
    team: isTeam(p),
    state: prospectState(p, ref),
    stage: stageOf(p).key,
    stageLabel: stageOf(p).label,
    stages: PROSPECT_STAGES,
    stageHistory: (typeof p.stageHistory === "string" ? JSON.parse(p.stageHistory || "[]") : p.stageHistory || []).map((h) => ({ ...h, label: PROSPECT_STAGES.find((st) => st.key === h.stage)?.label || h.stage })),
    programmeLabel: PROGRAMME_LABEL[p.programme] || null,
    referral: ref ? { id: ref.id, status: ref.status, programme: ref.programme, programmeLabel: PROGRAMME_LABEL[ref.programme] || ref.programme, createdAt: ref.createdAt } : null,
    followUpOn: dateOnly(p.followUpOn),
    createdByName: createdBy?.name || null,
    claimDays: settings.claimDays,
    affiliateNote: p.notes || null,
    notes: undefined,
    followUps: notes.map((n) => ({ id: n.id, body: n.body, authorName: n.authorName, authorUserId: n.authorUserId, createdAt: n.createdAt })),
  };
}

// A follow-up note from the team. Only while the family's details are kept (an open claim, or one
// that signed up).
async function addNote(ownerAdminId, id, author, body) {
  const p = await owned(id, { ownerAdminId });
  if (!["open", "signed_up"].includes(p.status)) fail("This claim has closed — its details and notes were removed.", 409);
  const text = String(body || "").trim().slice(0, 2000);
  if (!text) fail("Write the note first");
  await db(N).insert({ id: generateId(), prospectId: p.id, ownerAdminId, authorUserId: author.id || null, authorName: author.name || null, body: text, createdAt: now() });
  await db(T).where({ id: p.id }).update({ updatedAt: now() });
  return detail(ownerAdminId, id);
}

async function deleteNote(ownerAdminId, id, noteId) {
  await owned(id, { ownerAdminId });
  const removed = await db(N).where({ id: noteId, prospectId: id }).del();
  if (!removed) fail("Note not found", 404);
  return detail(ownerAdminId, id);
}

// When to get back to the family ("YYYY-MM-DD"), or null to clear it.
async function setFollowUp(ownerAdminId, id, date) {
  const p = await owned(id, { ownerAdminId });
  if (p.status !== "open" && date) fail("Only an open claim can have a follow-up date", 409);
  await db(T).where({ id: p.id }).update({ followUpOn: date || null, updatedAt: now() });
  return detail(ownerAdminId, id);
}

// ---- Changes ------------------------------------------------------------------------------------------
async function owned(id, { affiliateId = null, ownerAdminId = null }) {
  const p = await db(T).where({ id }).first();
  if (!p || (affiliateId && p.affiliateId !== affiliateId) || (ownerAdminId && p.ownerAdminId !== ownerAdminId)) fail("Family not found", 404);
  return p;
}

// The family's details, corrected by its affiliate (`scope.affiliateId`) or our team
// (`scope.ownerAdminId`) while the prospect is open. A new phone or email is checked as when adding:
// one of them stays, and it can't be a family already with us or on someone else's list.
async function updateDetails(id, scope, data) {
  const p = await owned(id, scope);
  if (p.status !== "open") fail(p.status === "signed_up" ? "They've signed up, so their details are on their account now" : "This claim has closed", 409);
  const pKey = phoneKey(data.phone);
  const eKey = emailKey(data.email);
  if (!pKey && !eKey) fail("Give the parent's phone number or email — that's how we recognise them when they sign up");
  if (p.affiliateId) {
    const affiliate = await db(A).where({ id: p.affiliateId }).first();
    if (affiliate && isSelf(affiliate, { pKey, eKey })) fail("That's the affiliate's own phone or email");
  }
  const newP = pKey && pKey !== p.phoneKey ? pKey : null;
  const newE = eKey && eKey !== p.emailKey ? eKey : null;
  if (newP || newE) {
    const held = await openClaimOn(p.ownerAdminId, { pKey: newP, eKey: newE });
    if ((held && held.id !== p.id) || await alreadyWithUs({ pKey: newP, eKey: newE })) {
      fail("That phone or email belongs to a family who is already with us or on another list.", 409);
    }
  }
  await db(T).where({ id }).update({
    parentName: String(data.parentName).trim().slice(0, 150),
    phone: data.phone ? String(data.phone).trim().slice(0, 40) : null,
    phoneKey: pKey,
    email: data.email ? String(data.email).trim().slice(0, 255) : null,
    emailKey: eKey,
    childName: data.childName ? String(data.childName).trim().slice(0, 150) : null,
    childAge: data.childAge ? Number(data.childAge) : null,
    programme: PROGRAMMES.includes(data.programme) ? data.programme : null,
    notes: data.notes ? String(data.notes).trim().slice(0, 1000) : null,
    updatedAt: now(),
  });
  return { ok: true };
}

// Where the conversation stands (`stage`), by its affiliate or our team; every change is kept.
async function setStage(id, scope, stage, byName) {
  const p = await owned(id, scope);
  const problem = stageProblem(p, stage);
  if (problem) fail(problem, 409);
  if ((p.stage || "new") === stage) return { ok: true };
  const history = typeof p.stageHistory === "string" ? JSON.parse(p.stageHistory || "[]") : p.stageHistory || [];
  history.push({ stage, from: p.stage || "new", at: now().toISOString(), by: byName || null });
  await db(T).where({ id }).update({ stage, stageAt: now(), stageBy: byName ? String(byName).slice(0, 150) : null, stageHistory: toJson(history.slice(-100)), updatedAt: now() });
  return { ok: true };
}

// An admin decides a possible match. Approve: the sign-up becomes the claim's affiliate's referral
// (unless it was already credited — then it's changed on the Referrals tab). Dismiss: forgotten.
async function decideMatch(ownerAdminId, id, approve, recordReferralFn) {
  const p = await owned(id, { ownerAdminId });
  const match = typeof p.possibleMatch === "string" ? JSON.parse(p.possibleMatch) : p.possibleMatch;
  if (!match) fail("There's no possible match to decide", 409);
  if (!approve) {
    await db(T).where({ id }).update({ possibleMatch: null, updatedAt: now() });
    return { ok: true, approved: false };
  }
  if (p.status !== "open") fail("This claim has closed", 409);
  if (isTeam(p)) {
    // Our own family: nobody earns; it's simply marked signed up.
    await db(T).where({ id }).update({ status: "signed_up", stage: "signed_up", convertedAt: now(), possibleMatch: null, updatedAt: now() });
    return { ok: true, approved: true, team: true };
  }
  if (await db(R).where({ programme: match.programme, recordId: match.recordId }).first("id")) fail("That sign-up is already credited to an affiliate — change it on the Referrals tab", 409);
  const referral = await recordReferralFn({ ownerAdminId, programme: match.programme, recordId: match.recordId, invoiceId: match.invoiceId, parent: match.parent, detail: match.detail, forceProspectId: p.id });
  if (!referral) fail("The referral couldn't be recorded — is the programme switched on and the affiliate active?", 409);
  await db(T).where({ id }).update({ possibleMatch: null, updatedAt: now() });
  return { ok: true, approved: true };
}

// ---- Invites and opting out ----------------------------------------------------------------------------
function inviteText(affiliate, p) {
  const link = linkFor(affiliate.code);
  const prog = PROGRAMME_LABEL[p.programme];
  return [
    `Hi ${firstName(p.parentName) || "there"}, it was great talking to you${prog ? ` about Digifunzi ${prog}` : " about Digifunzi"}.`,
    link ? `You can sign up here: ${link}` : null,
    `If you'd rather not hear from us, tap: ${optOutUrl(p.inviteToken)}`,
    `— ${affiliate.name}`,
  ].filter(Boolean).join("\n\n");
}

// WhatsApp: the message and a link that opens it on the affiliate's phone (they send it themselves).
// Email: sent from Digifunzi, naming the affiliate. Either way the invite is recorded.
async function invite(affiliate, id, channel) {
  const p = await owned(id, { affiliateId: affiliate.id });
  if (p.status !== "open" || new Date(p.expiresAt) < now()) fail("This claim has closed", 409);
  if (!linkFor(affiliate.code)) fail("Invites aren't available yet — the website address isn't set up", 409);
  const text = inviteText(affiliate, p);
  let waUrl = null;
  if (channel === "whatsapp") {
    if (!p.phone) fail("Add the parent's phone number to send a WhatsApp invite");
    const digits = String(p.phone).replace(/\D/g, "");
    const intl = digits.startsWith("0") ? `254${digits.slice(1)}` : digits.length === 9 ? `254${digits}` : digits;
    waUrl = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  } else {
    if (!p.email) fail("Add the parent's email to send an email invite");
    const prog = PROGRAMME_LABEL[p.programme];
    const { html, text: plain } = renderEmail({
      tone: "info", icon: "envelope", eyebrow: "Your invitation",
      heading: `${firstName(affiliate.name)} thought you'd like Digifunzi`,
      greeting: `Hi ${firstName(p.parentName) || "there"},`,
      paragraphs: [
        `${affiliate.name} told us you're interested in Digifunzi${prog ? ` ${prog}` : ""} — thank you for talking to them.`,
        "When you're ready, you can sign up on our website. It only takes a few minutes.",
      ],
      button: { label: "Sign up", url: linkFor(affiliate.code) },
      afterParagraphs: [`Rather not hear from us? Use this link and we won't contact you again: ${optOutUrl(p.inviteToken)}`],
      footerNote: `You're getting this because ${affiliate.name} shared your email with Digifunzi with your agreement.`,
    });
    await queueMail({ to: p.email, subject: `${firstName(affiliate.name)} from Digifunzi — your sign-up link`, html, text: plain, template: "affiliate_prospect_invite", dedupeKey: `affiliate_prospect_invite:${p.id}:${(p.inviteCount || 0) + 1}` });
  }
  await db(T).where({ id }).update({ invitedAt: now(), inviteCount: (p.inviteCount || 0) + 1, updatedAt: now() });
  return { channel, waUrl, message: text };
}

// The family's "no thanks" link (no sign-in): the claim closes and their details go.
async function optOut(token) {
  const clean = String(token || "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
  if (clean.length < 32) fail("This link isn't valid", 404);
  const p = await db(T).where({ inviteToken: clean }).first();
  if (!p) fail("This link isn't valid", 404);
  if (p.status === "open") {
    await db(T).where({ id: p.id }).update({ ...wiped(p, "opted_out", "The family asked not to be contacted"), optedOutAt: now() });
    await dropNotes(p.id);
  }
  return { ok: true, firstName: firstName(p.parentName) };
}

module.exports = {
  CANT_ADD, settingsFor, expireDue, add, addMany, matchFor, settle, notePossibleMatch, listMine, listAll, updateDetails, setStage, settleTeamFor, decideMatch, invite, optOut, inviteText,
  detail, addNote, deleteNote, setFollowUp,
};
