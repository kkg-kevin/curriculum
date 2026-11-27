const db = require("../../config/db");
const ExpenseModel = require("./expense.model");
const R = require("./expense.rules");
const Notify = require("./expense.notifications");
const Files = require("./expense.files");
const Links = require("./expense.links");
const { rolesOf } = require("../auth/account-roles");

// Expenses — people who work for the organisation claiming back what they spent from their own
// pocket on its work. See expense.rules.js for the rules, expense.context.js for who may do what.
//
// draft → (send) → pending_supervisor (an educator with a supervisor) | pending_admin (everyone
// else) → approved → paid. A reviewer can instead send it back (returned — the claimant changes it
// and sends again) or decline it (rejected), and can turn single lines down while approving the
// rest. Every step is written to the claim's timeline, which the claimant and reviewers both see.

const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};

const nameOf = (u) => u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Someone";

async function actorName(ctx) {
  if (ctx.teacher) return nameOf(ctx.teacher);
  return nameOf(await db("users").where({ id: ctx.userId }).first("name", "email"));
}

const entry = (ctx, byName, action, extra = {}) => ({ at: new Date().toISOString(), byId: ctx.userId, byName, action, ...extra });

async function settingsFor(ownerAdminId) {
  return R.settingsOf(await ExpenseModel.settingsRow(ownerAdminId));
}

// The supervisor an educator's claim goes to — only one who can still sign in as a supervisor.
async function activeSupervisor(teacher) {
  if (!teacher?.supervisorId) return null;
  const user = await db("users").where({ id: teacher.supervisorId }).first();
  if (!user || user.deactivatedAt || user.removedAt) return null;
  if (!rolesOf(user).includes("supervisor")) return null;
  return user;
}

// May this person see this claim? The claimant; anyone who sees the workspace's expenses; the
// supervisor it was sent to.
function canSee(claim, ctx) {
  if (!claim || claim.ownerAdminId !== ctx.ownerAdminId) return false;
  if (claim.claimantUserId === ctx.userId) return true;
  if (claim.status === "draft") return false;
  if (ctx.canViewAll) return true;
  return ctx.role === "supervisor" && claim.supervisorId === ctx.userId;
}

async function loadVisible(ctx, id) {
  const claim = await ExpenseModel.findClaim(id);
  if (!canSee(claim, ctx)) fail("Expense claim not found", 404);
  return claim;
}

async function loadOwn(ctx, id) {
  const claim = await ExpenseModel.findClaim(id);
  if (!claim || claim.ownerAdminId !== ctx.ownerAdminId || claim.claimantUserId !== ctx.userId) fail("Expense claim not found", 404);
  return claim;
}

// Whether the claimant is the only person who could approve their own claim (then they may, and
// the claim says so).
async function soleApproverFor(claim) {
  return (await Notify.approverIds(claim.ownerAdminId, claim.claimantUserId)).length === 0;
}

// A claim's lines with their files (and the files taken off after sending).
async function enrich(claims, settings) {
  if (!claims.length) return [];
  const ids = claims.map((c) => c.id);
  const [items, files] = await Promise.all([ExpenseModel.itemsOf(ids), ExpenseModel.filesOf(ids, { includeRemoved: true })]);
  const live = files.filter((f) => !f.removedAt);
  return claims.map((claim) => {
    const own = items.filter((i) => i.claimId === claim.id);
    const ownFiles = live.filter((f) => f.claimId === claim.id);
    const fileView = (f) => ({ id: f.id, filename: f.filename, mimeType: f.mimeType, size: f.size, createdAt: f.createdAt, removedAt: f.removedAt || null });
    return {
      ...claim,
      items: own.map((i) => ({
        ...i,
        categoryLabel: R.categoryLabel(settings, i.category),
        linkTypeLabel: i.linkType === Links.GENERAL ? "General work" : Links.typeOf(i.linkType)?.label || null,
        files: ownFiles.filter((f) => f.itemId === i.id).map(fileView),
      })),
      removedFiles: files.filter((f) => f.claimId === claim.id && f.removedAt).map(fileView),
    };
  });
}

// What this person may do with the claim right now (drives the buttons).
async function abilities(claim, ctx) {
  const own = claim.claimantUserId === ctx.userId;
  const sole = own && ctx.canApprove ? await soleApproverFor(claim) : false;
  const viewer = { userId: ctx.userId, role: ctx.role, canApprove: ctx.canApprove };
  return {
    isClaimant: own,
    canEdit: own && R.EDITABLE.has(claim.status),
    canSubmit: own && R.EDITABLE.has(claim.status),
    canDelete: own && claim.status === "draft" && !claim.firstSubmittedAt,
    canWithdraw: own && R.PENDING.has(claim.status),
    canDecide: R.canDecide(claim, viewer, { soleApprover: sole }),
    canPay: R.canPay(claim, viewer, { soleApprover: sole }),
    selfApproval: own && sole,
  };
}

// The claim's lines as sent, checked against the workspace's categories and this person's files,
// then saved with their files attached.
async function saveContent(ctx, claim, rawItems, settings) {
  // What each line was for: checked against what this person may link, and named.
  const items = await Links.resolveLines(ctx, rawItems);
  for (const item of items) {
    if (!R.categoryOf(settings, item.category)) fail(`"${item.category}" isn't one of the expense categories`);
    item.mpesaCode = R.normaliseMpesaCode(item.mpesaCode);
  }
  const fileIds = [...new Set(items.flatMap((i) => i.fileIds || []))];
  const files = await ExpenseModel.filesByIds(fileIds);
  const byId = new Map(files.map((f) => [f.id, f]));
  for (const fid of fileIds) {
    const f = byId.get(fid);
    if (!f || f.uploadedBy !== ctx.userId || (f.claimId && f.claimId !== claim.id) || f.removedAt) fail("One of the attached files can't be used — upload it again", 409);
  }
  const saved = await ExpenseModel.saveItems(claim.id, claim.ownerAdminId, items);
  const keepFiles = new Set();
  for (const [index, item] of items.entries()) {
    for (const fid of item.fileIds || []) {
      keepFiles.add(fid);
      await ExpenseModel.updateFile(fid, { claimId: claim.id, itemId: saved[index].id, ownerAdminId: claim.ownerAdminId });
    }
  }
  // Files taken off: before the claim was ever sent they simply go; after, they're kept (marked
  // removed) so a reviewer still sees what had been sent.
  const before = await ExpenseModel.filesOf(claim.id);
  const dropped = before.filter((f) => !keepFiles.has(f.id));
  if (claim.firstSubmittedAt) {
    for (const f of dropped) await ExpenseModel.updateFile(f.id, { removedAt: new Date() });
  } else {
    await ExpenseModel.deleteFiles(dropped.map((f) => f.id));
    dropped.forEach((f) => Files.removeStored(f.storedName));
  }
  const { total } = R.totalsOf(saved);
  return { saved, total };
}

async function hubFor(ctx, hubId) {
  if (!hubId) return null;
  const hub = await db("learning_hubs").where({ id: hubId }).first("id", "name", "ownerAdminId");
  if (!hub || hub.ownerAdminId !== ctx.ownerAdminId) fail("That learning hub isn't in this workspace");
  return hub;
}

const ExpenseService = {
  canSee,

  async settings(ownerAdminId) {
    return settingsFor(ownerAdminId);
  },

  async saveSettings(ctx, data) {
    if (!ctx.canApprove) fail("Only people who approve expenses can change these settings", 403);
    // A category no longer listed is kept (switched off) so older claims still name it.
    const current = await settingsFor(ctx.ownerAdminId);
    const keys = new Set(data.categories.map((c) => c.key));
    if (keys.size !== data.categories.length) fail("Two categories have the same key");
    const categories = [...data.categories, ...current.categories.filter((c) => !keys.has(c.key)).map((c) => ({ ...c, active: false }))];
    const row = await ExpenseModel.saveSettings(ctx.ownerAdminId, { categories, requireLink: !!data.requireLink });
    return R.settingsOf(row);
  },

  // What the claim form needs: categories and limits, the hubs to choose from, who reviews.
  async options(ctx) {
    const settings = await settingsFor(ctx.ownerAdminId);
    let hubs;
    if (ctx.teacher) {
      const links = await db("teacher_hub_links").where({ teacherId: ctx.teacher.id }).pluck("hubId");
      const all = await db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "removed" }).select("id", "name").orderBy("name");
      const linked = new Set(links);
      hubs = [...all.filter((h) => linked.has(h.id)), ...all.filter((h) => !linked.has(h.id))].map((h) => ({ ...h, mine: linked.has(h.id) }));
    } else {
      hubs = (await db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "removed" }).select("id", "name").orderBy("name")).map((h) => ({ ...h, mine: false }));
    }
    const supervisor = ctx.teacher ? await activeSupervisor(ctx.teacher) : null;
    const reviewer = supervisor ? `your supervisor, ${nameOf(supervisor)}, then an admin pays it` : ctx.role === "admin" ? "another admin" : "an admin";
    return { settings, hubs, reviewer, canApprove: ctx.canApprove, canViewAll: ctx.canViewAll, role: ctx.role, linkTypes: Links.typesFor(ctx) };
  },

  // ---- What an expense was for (expense.links.js) ------------------------------------------------
  // The picker: this person's records of one kind matching what they typed.
  async linkOptions(ctx, { type, q }) {
    return Links.search(ctx, type, q);
  },

  // A record's page: every sent line linked to it, with who claimed it and where the claim stands.
  // For people who see the workspace's expenses (admins, staff with Expenses → View).
  async linked(ctx, { type, id }) {
    if (!ctx.canViewAll) fail("Your role doesn't include seeing the team's expenses", 403);
    const settings = await settingsFor(ctx.ownerAdminId);
    const { items, claims } = await ExpenseModel.linkedItems(ctx.ownerAdminId, type, id);
    const byId = new Map(claims.map((c) => [c.id, c]));
    const lines = items.filter((i) => byId.has(i.claimId)).map((i) => {
      const c = byId.get(i.claimId);
      return {
        id: i.id, claimId: c.id, number: c.number, title: c.title, claimantName: c.claimantName, status: c.status,
        spentOn: String(i.spentOn).slice(0, 10), category: i.category, categoryLabel: R.categoryLabel(settings, i.category),
        description: i.description, amount: i.amount, rejected: i.status === "rejected", currency: c.currency,
      };
    });
    const [summary] = R.summariseByLink(lines.map((l) => ({ item: { ...items.find((i) => i.id === l.id) }, claim: byId.get(l.claimId) })));
    return { lines, totals: summary ? { claimed: summary.claimed, approved: summary.approved, paid: summary.paid, claims: summary.claims, people: summary.people } : { claimed: 0, approved: 0, paid: 0, claims: 0, people: 0 }, currency: settings.currency };
  },

  // Finance → Expenses → "What it was for": spending per linked record and per kind in a period.
  async byLink(ctx, { from, to }) {
    if (!ctx.canViewAll) fail("Your role doesn't include seeing the team's expenses", 403);
    const settings = await settingsFor(ctx.ownerAdminId);
    const { items, claims } = await ExpenseModel.itemsBetween(ctx.ownerAdminId, from, to);
    const byId = new Map(claims.map((c) => [c.id, c]));
    const lines = items.filter((i) => byId.has(i.claimId)).map((item) => ({ item, claim: byId.get(item.claimId) }));
    const records = R.summariseByLink(lines).map((r) => ({
      ...r, typeLabel: r.linkType === Links.GENERAL ? "General work" : r.linkType ? Links.typeOf(r.linkType)?.label || r.linkType : "Not said",
    }));
    const kinds = new Map();
    for (const r of records) {
      const key = r.linkType || "none";
      const k = kinds.get(key) || { linkType: r.linkType, typeLabel: r.typeLabel, claimed: 0, approved: 0, paid: 0, records: 0 };
      k.claimed = R.round2(k.claimed + r.claimed); k.approved = R.round2(k.approved + r.approved); k.paid = R.round2(k.paid + r.paid);
      if (r.linkId) k.records += 1;
      kinds.set(key, k);
    }
    const total = R.round2(records.reduce((n, r) => n + r.claimed, 0));
    const linked = R.round2(records.filter((r) => r.linkType).reduce((n, r) => n + r.claimed, 0));
    return { records, kinds: [...kinds.values()].sort((a, b) => b.claimed - a.claimed), total, linked, currency: settings.currency, from: from || null, to: to || null };
  },

  async listMine(ctx) {
    const claims = await ExpenseModel.findClaims({ ownerAdminId: ctx.ownerAdminId, claimantUserId: ctx.userId });
    const items = await ExpenseModel.itemsOf(claims.map((c) => c.id));
    return claims.map((c) => ({ ...c, itemCount: items.filter((i) => i.claimId === c.id).length }));
  },

  // The review list: the workspace's claims (admins, staff with Expenses), or the ones sent to a
  // supervisor.
  async listForReview(ctx) {
    let claims;
    if (ctx.canViewAll) claims = await ExpenseModel.findClaims({ ownerAdminId: ctx.ownerAdminId, excludeDrafts: true });
    else if (ctx.role === "supervisor") claims = await ExpenseModel.findClaims({ ownerAdminId: ctx.ownerAdminId, supervisorId: ctx.userId, excludeDrafts: true });
    else fail("Your role doesn't include reviewing expenses", 403);
    const items = await ExpenseModel.itemsOf(claims.map((c) => c.id));
    const viewer = { userId: ctx.userId, role: ctx.role, canApprove: ctx.canApprove };
    const ownSole = claims.some((c) => c.claimantUserId === ctx.userId) ? await soleApproverFor({ ownerAdminId: ctx.ownerAdminId, claimantUserId: ctx.userId }) : false;
    return claims.map((c) => {
      const opts = { soleApprover: c.claimantUserId === ctx.userId && ownSole };
      return {
        ...c,
        itemCount: items.filter((i) => i.claimId === c.id).length,
        canDecide: R.canDecide(c, viewer, opts),
        canPay: R.canPay(c, viewer, opts),
      };
    });
  },

  async get(ctx, id) {
    const claim = await loadVisible(ctx, id);
    const settings = await settingsFor(ctx.ownerAdminId);
    const [full] = await enrich([claim], settings);
    return { ...full, settings, can: await abilities(claim, ctx) };
  },

  async create(ctx, data) {
    const settings = await settingsFor(ctx.ownerAdminId);
    const hub = await hubFor(ctx, data.hubId);
    const name = await actorName(ctx);
    const user = await db("users").where({ id: ctx.userId }).first("email", "phone");
    const claim = await ExpenseModel.createClaim({
      ownerAdminId: ctx.ownerAdminId,
      claimantUserId: ctx.userId,
      claimantRole: ctx.role,
      claimantName: name,
      claimantEmail: ctx.teacher?.email || user?.email || null,
      claimantPhone: ctx.teacher?.phone || user?.phone || null,
      teacherId: ctx.teacher?.id || null,
      title: data.title,
      purpose: data.purpose,
      hubId: hub?.id || null,
      hubName: hub?.name || null,
      currency: settings.currency,
      status: "draft",
      timeline: [entry(ctx, name, "created")],
    });
    const { total } = await saveContent(ctx, claim, data.items, settings);
    await ExpenseModel.updateClaim(claim.id, { totalAmount: total });
    return ExpenseService.get(ctx, claim.id);
  },

  async update(ctx, id, data) {
    const claim = await loadOwn(ctx, id);
    if (!R.EDITABLE.has(claim.status)) fail("This claim has been sent — withdraw it first to change it", 409);
    const settings = await settingsFor(ctx.ownerAdminId);
    const hub = await hubFor(ctx, data.hubId);
    const { total } = await saveContent(ctx, claim, data.items, settings);
    const timeline = claim.status === "returned" && Number(claim.totalAmount) !== total
      ? [...claim.timeline, entry(ctx, await actorName(ctx), "edited", { note: `Total ${claim.currency} ${Number(claim.totalAmount).toLocaleString("en-KE")} → ${total.toLocaleString("en-KE")}` })]
      : undefined;
    await ExpenseModel.updateClaim(id, { title: data.title, purpose: data.purpose, hubId: hub?.id || null, hubName: hub?.name || null, totalAmount: total, timeline });
    return ExpenseService.get(ctx, id);
  },

  // Only a draft never sent can be deleted — a sent one keeps its history (withdraw instead).
  async remove(ctx, id) {
    const claim = await loadOwn(ctx, id);
    if (claim.status !== "draft" || claim.firstSubmittedAt) fail("A claim that has been sent can't be deleted", 409);
    const files = await ExpenseModel.filesOf(id, { includeRemoved: true });
    await ExpenseModel.deleteFiles(files.map((f) => f.id));
    files.forEach((f) => Files.removeStored(f.storedName));
    await ExpenseModel.deleteClaim(id);
    return { deleted: true };
  },

  async submit(ctx, id) {
    const claim = await loadOwn(ctx, id);
    if (!R.EDITABLE.has(claim.status)) fail("This claim has already been sent", 409);
    // Sending checks nothing beyond what saving already did (18 Nov 2026, the user's choice): no
    // proof requirement, no M-Pesa duplicate check, no date check, no declaration.
    const items = await ExpenseModel.itemsOf(id);
    if (!items.length) fail("Add at least one expense");
    const unlinked = R.unlinkedLines(await settingsFor(ctx.ownerAdminId), items);
    if (unlinked.length) fail(`Say what ${unlinked.length === 1 ? `expense ${unlinked[0]} was` : `expenses ${unlinked.join(", ")} were`} for — a record, or "General work"`);
    const supervisor = ctx.teacher ? await activeSupervisor(ctx.teacher) : null;
    const status = R.routeFor({ claimantRole: claim.claimantRole, supervisorId: supervisor?.id });
    const name = await actorName(ctx);
    const now = new Date();
    await ExpenseModel.reopenItems(id);
    const { total } = R.totalsOf(items.map((i) => ({ ...i, status: "open" })));
    const updated = await ExpenseModel.transition(id, ["draft", "returned"], {
      status,
      number: claim.number || await ExpenseModel.nextNumber(ctx.ownerAdminId),
      supervisorId: status === "pending_supervisor" ? supervisor.id : null,
      supervisorName: status === "pending_supervisor" ? nameOf(supervisor) : null,
      supervisorDecidedAt: null,
      adminDecidedBy: null,
      adminName: null,
      adminDecidedAt: null,
      selfApproved: false,
      returnReason: claim.status === "returned" ? claim.returnReason : null,
      rejectionReason: null,
      totalAmount: total,
      approvedAmount: null,
      submittedAt: now,
      firstSubmittedAt: claim.firstSubmittedAt || now,
      timeline: [...claim.timeline, entry(ctx, name, claim.firstSubmittedAt ? "resubmitted" : "submitted", { amount: total, note: status === "pending_supervisor" ? `Sent to ${nameOf(supervisor)}` : "Sent for approval" })],
    });
    if (!updated) fail("This claim has just changed — reload it", 409);
    await Notify.submitted(updated);
    return ExpenseService.get(ctx, id);
  },

  // Taking a sent claim back before anyone has decided it — it becomes a draft again.
  async withdraw(ctx, id) {
    const claim = await loadOwn(ctx, id);
    if (!R.PENDING.has(claim.status)) fail("Only a claim still waiting for review can be withdrawn", 409);
    const updated = await ExpenseModel.transition(id, [claim.status], {
      status: "draft",
      timeline: [...claim.timeline, entry(ctx, await actorName(ctx), "withdrew")],
    });
    if (!updated) fail("Someone has just reviewed this claim", 409);
    return ExpenseService.get(ctx, id);
  },

  async decide(ctx, id, { decision, reason, lines }) {
    const claim = await loadVisible(ctx, id);
    const own = claim.claimantUserId === ctx.userId;
    const sole = own ? await soleApproverFor(claim) : false;
    const viewer = { userId: ctx.userId, role: ctx.role, canApprove: ctx.canApprove };
    if (!R.canDecide(claim, viewer, { soleApprover: sole })) {
      fail(own ? "You can't approve your own expense claim — another approver must" : "This claim isn't yours to decide at this stage", 403);
    }
    const items = await ExpenseModel.itemsOf(id);
    const itemIds = new Set(items.map((i) => i.id));
    const lineDecisions = (lines || []).filter((l) => itemIds.has(l.id));
    const name = await actorName(ctx);
    const stage = claim.status;
    const stamp = stage === "pending_supervisor"
      ? { supervisorName: name, supervisorDecidedAt: new Date() }
      : { adminDecidedBy: ctx.userId, adminName: name, adminDecidedAt: new Date() };
    let patch;
    let event;
    if (decision === "approve") {
      if (stage === "approved") fail("This claim is already approved — pay it, or send it back", 409);
      const rejectedIds = new Set(lineDecisions.filter((l) => l.rejected).map((l) => l.id));
      const after = items.map((i) => ({ ...i, status: rejectedIds.has(i.id) ? "rejected" : "open" }));
      if (after.every((i) => i.status === "rejected")) fail("Every expense is turned down — decline the claim instead");
      await ExpenseModel.setItemDecisions(id, items.map((i) => ({ id: i.id, rejected: rejectedIds.has(i.id), reason: lineDecisions.find((l) => l.id === i.id)?.reason })));
      const { approved } = R.totalsOf(after);
      patch = { ...stamp, status: "approved", approvedAmount: approved, selfApproved: own };
      event = entry(ctx, name, "approved", { amount: approved, note: [rejectedIds.size ? `${rejectedIds.size} ${rejectedIds.size === 1 ? "expense" : "expenses"} turned down` : null, reason].filter(Boolean).join(" — ") || null });
    } else if (decision === "return") {
      // Lines marked here tell the claimant which to fix; sending again clears them.
      if (lineDecisions.length) await ExpenseModel.setItemDecisions(id, lineDecisions);
      patch = { ...stamp, status: "returned", returnReason: reason, approvedAmount: null, selfApproved: false };
      event = entry(ctx, name, "returned", { note: reason });
    } else {
      patch = { ...stamp, status: "rejected", rejectionReason: reason, approvedAmount: null, selfApproved: false };
      event = entry(ctx, name, "rejected", { note: reason });
    }
    const updated = await ExpenseModel.transition(id, [stage], { ...patch, timeline: [...claim.timeline, event] });
    if (!updated) fail("Someone else has just acted on this claim", 409);
    if (decision === "approve") await Notify.approved(updated, { bySupervisor: stage === "pending_supervisor" });
    else if (decision === "return") await Notify.returned(updated);
    else await Notify.rejected(updated);
    return ExpenseService.get(ctx, id);
  },

  async pay(ctx, id, { method, reference, paidAt, note }) {
    const claim = await loadVisible(ctx, id);
    const own = claim.claimantUserId === ctx.userId;
    const sole = own ? await soleApproverFor(claim) : false;
    if (!R.canPay(claim, { userId: ctx.userId, role: ctx.role, canApprove: ctx.canApprove }, { soleApprover: sole })) {
      fail(claim.status !== "approved" ? "Only an approved claim can be paid" : own ? "You can't pay your own expense claim — another approver must" : "Your role can't pay expenses", 403);
    }
    if (R.REFERENCE_REQUIRED.has(method) && !reference) fail(method === "mpesa" ? "Give the M-Pesa transaction code of the payment" : "Give the bank reference of the payment");
    if (paidAt && paidAt > R.kenyaDay()) fail("The payment date can't be in the future");
    const name = await actorName(ctx);
    const when = paidAt ? new Date(`${paidAt}T09:00:00+03:00`) : new Date();
    const updated = await ExpenseModel.transition(id, ["approved"], {
      status: "paid",
      paidAt: when,
      paidBy: ctx.userId,
      paidByName: name,
      paymentMethod: method,
      paymentReference: reference || null,
      paymentNote: note || null,
      selfApproved: claim.selfApproved || own,
      timeline: [...claim.timeline, entry(ctx, name, "paid", { amount: claim.approvedAmount, note: [method === "mpesa" ? "M-Pesa" : method === "bank" ? "Bank" : method === "cash" ? "Cash" : "Other", reference, note].filter(Boolean).join(" · ") })],
    });
    if (!updated) fail("This claim has just changed — reload it", 409);
    await Notify.paid(updated);
    return ExpenseService.get(ctx, id);
  },

  // ---- Proof files ---------------------------------------------------------------------------
  async saveUpload(ctx, file) {
    if (!file) fail("Choose a file");
    const sha256 = await Files.sha256Of(file.path);
    const record = await ExpenseModel.createFile({
      ownerAdminId: ctx.ownerAdminId,
      uploadedBy: ctx.userId,
      storedName: file.filename,
      filename: String(file.originalname || "proof").slice(0, 255),
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
      sha256,
    });
    // Tidy up this person's uploads that never made it onto a claim (a form closed unsaved).
    const stray = await ExpenseModel.strayFiles(ctx.userId, new Date(Date.now() - 24 * 3600 * 1000));
    if (stray.length) {
      await ExpenseModel.deleteFiles(stray.map((f) => f.id));
      stray.forEach((f) => Files.removeStored(f.storedName));
    }
    return { id: record.id, filename: record.filename, mimeType: record.mimeType, size: record.size, createdAt: record.createdAt };
  },

  // A proof file, for its uploader or anyone who may see the claim it is on.
  async fileFor(ctx, fileId) {
    const file = await ExpenseModel.findFile(fileId);
    if (!file) fail("File not found", 404);
    if (file.uploadedBy === ctx.userId) return file;
    if (!file.claimId) fail("File not found", 404);
    const claim = await ExpenseModel.findClaim(file.claimId);
    if (!canSee(claim, ctx)) fail("File not found", 404);
    return file;
  },
};

module.exports = ExpenseService;
