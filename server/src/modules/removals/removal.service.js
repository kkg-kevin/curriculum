const R = require("./removal.rules");

// Removing a person: deactivate → transfer → delete (13 Nov 2026). One driver for every kind; what
// each kind holds, who can take it and how it's handed over is in its own file:
//   teacher     removal.teacher.js     educators
//   supervisor  removal.supervisor.js  claims / QA supervisors (a login)
//   affiliate   removal.affiliate.js   affiliates
//   hub         removal.hub.js         learning hubs
//
// A kind exports:
//   load(req, id)            → ctx { req, id, person, ownerAdminId } — 404 / 403 when not this workspace's
//   describe(ctx)            → { id, name, detail, status, deactivated, removed, removedAt }
//   holdings(ctx)            → items still to hand over: [{ key, type, group, id, label, detail?, canCancel?, allowNone? }]
//   candidates(ctx)          → [{ id, name, detail? }] people of the same role who can take work
//   transferItem(ctx, item, target)  hands one item over (throws with a sentence when it can't)
//   toSettle(ctx)            → [{ label, detail?, href? }] what must be sorted out elsewhere first
//   automatic(ctx)           → [sentence] what happens by itself on delete; runAutomatic(ctx) does it
//   history(ctx)             → [sentence] what stays under their name
//   deactivate(ctx)
//   remove(ctx, { history }) → deletes outright when there's no history, else keeps a tombstone
//
// Never deleted from under anyone: every step re-reads what they hold, and delete is refused until
// nothing is left (R.deleteBlockers).

const KINDS = {
  teacher: () => require("./removal.teacher"),
  supervisor: () => require("./removal.supervisor"),
  affiliate: () => require("./removal.affiliate"),
  hub: () => require("./removal.hub"),
};

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

function kindOf(kind) {
  const load = KINDS[kind];
  if (!load) fail("Unknown kind of record", 404);
  return load();
}

async function planFor(K, ctx) {
  const person = await K.describe(ctx);
  if (person.removed) {
    return { person, step: "done", items: [], candidates: [], toSettle: [], automatic: [], history: await K.history(ctx), blockers: [] };
  }
  const [items, candidates, toSettle, automatic, history] = await Promise.all([
    K.holdings(ctx), K.candidates(ctx), K.toSettle(ctx), K.automatic(ctx), K.history(ctx),
  ]);
  const state = { deactivated: person.deactivated, items, toSettle };
  return { person, step: R.stepOf(state), items, candidates, toSettle, automatic, history, blockers: R.deleteBlockers(state) };
}

const RemovalService = {
  async plan(req, kind, id) {
    const K = kindOf(kind);
    return { kind, ...(await planFor(K, await K.load(req, id))) };
  },

  async deactivate(req, kind, id) {
    const K = kindOf(kind);
    const ctx = await K.load(req, id);
    const person = await K.describe(ctx);
    if (person.removed) fail("Already removed", 409);
    if (!person.deactivated) await K.deactivate(ctx);
    return { kind, ...(await planFor(K, await K.load(req, id))) };
  },

  // { to, overrides } → each item handed over (or cancelled / left with nobody) one at a time; an
  // item that can't go is reported with the reason and left where it was, the rest still go.
  async transfer(req, kind, id, { to = null, overrides = {} } = {}) {
    const K = kindOf(kind);
    const ctx = await K.load(req, id);
    const person = await K.describe(ctx);
    if (person.removed) fail("Already removed", 409);
    if (!person.deactivated) fail("Deactivate them first, so nothing new is given to them while their work is handed over", 409);
    const [items, candidates] = await Promise.all([K.holdings(ctx), K.candidates(ctx)]);
    const candidateIds = candidates.map((c) => c.id);
    const results = [];
    for (const item of items) {
      const target = R.assignmentFor(item, { to, overrides });
      if (!target) continue; // nobody chosen for it yet — stays for the next go
      const problem = R.targetProblem(item, target, { candidateIds, selfId: id });
      if (problem) {
        results.push({ key: item.key, label: item.label, ok: false, message: problem });
        continue;
      }
      try {
        await K.transferItem(ctx, item, target);
        const name = target === R.CANCEL ? "Cancelled" : target === R.NOBODY ? "Nobody" : candidates.find((c) => c.id === target)?.name;
        results.push({ key: item.key, label: item.label, ok: true, to: name || null });
      } catch (err) {
        if (!err.statusCode || err.statusCode >= 500) console.error("[removals] transfer failed:", err);
        results.push({ key: item.key, label: item.label, ok: false, message: err.statusCode && err.statusCode < 500 ? err.message : "Something went wrong handing this over — try again" });
      }
    }
    return { kind, results, ...(await planFor(K, await K.load(req, id))) };
  },

  async remove(req, kind, id) {
    const K = kindOf(kind);
    const ctx = await K.load(req, id);
    const plan = await planFor(K, ctx);
    if (plan.person.removed) fail("Already removed", 409);
    if (plan.blockers.length) fail(plan.blockers.join(" "), 409);
    await K.runAutomatic(ctx);
    const outcome = await K.remove(ctx, { history: plan.history });
    return { kind, removed: true, kept: outcome === "tombstone", history: plan.history };
  },
};

module.exports = RemovalService;
module.exports.KINDS = Object.keys(KINDS);
