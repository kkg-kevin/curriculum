// Removing a person — the rules, kept pure so they're tested on their own (test/removals.test.js).
//
// Every removal runs in the same order: deactivate → transfer → delete.
//   deactivate  switched off first, so nothing new lands on them while their work is handed over
//   transfer    each piece of ongoing work (an item) goes to someone of the same role — one person
//               for everything by default, any item to someone else (overrides), some items may be
//               cancelled instead (a mentor booking) or left with nobody (a supervisor's educators)
//   delete      once nothing is left to hand over or sort out; history about them stays under
//               their name (the record becomes a tombstone — see removal.service.js)

const STEPS = ["deactivate", "transfer", "delete"];
const CANCEL = "cancel"; // an item that may be cancelled instead of handed over
const NOBODY = "none";   // an item that may be left with nobody

const itemKey = (type, id) => `${type}:${id}`;

// Where the removal stands: removed already, else the first step not done yet.
function stepOf({ removed = false, deactivated = false, items = [], toSettle = [] } = {}) {
  if (removed) return "done";
  if (!deactivated) return "deactivate";
  if (items.length || toSettle.length) return "transfer";
  return "delete";
}

// Who an item goes to: its own choice, else the one person for everything, else nobody yet (null).
function assignmentFor(item, { to = null, overrides = {} } = {}) {
  const own = overrides && Object.prototype.hasOwnProperty.call(overrides, item.key) ? overrides[item.key] : undefined;
  const chosen = own !== undefined && own !== null && own !== "" ? own : to;
  return chosen || null;
}

// Why `target` can't take `item` (a sentence), or null when it can. `candidateIds` are the people
// of the same role who can take work; `selfId` is the person being removed.
function targetProblem(item, target, { candidateIds = [], selfId = null } = {}) {
  if (!target) return "Choose who it goes to";
  if (target === CANCEL) return item.canCancel ? null : "This can't be cancelled — choose who it goes to";
  if (target === NOBODY) return item.allowNone ? null : "Choose who it goes to";
  if (target === selfId) return "Choose someone else — they're the one being removed";
  if (!candidateIds.includes(target)) return "Choose someone from the list";
  return null;
}

// What delete still waits for, as sentences (empty when it can go ahead).
function deleteBlockers({ deactivated = false, items = [], toSettle = [] } = {}) {
  const out = [];
  if (!deactivated) out.push("Deactivate them first.");
  if (items.length) out.push(`Hand over ${items.length === 1 ? "the last thing" : `the ${items.length} things`} they still hold.`);
  if (toSettle.length) out.push(`Sort out ${toSettle.length === 1 ? "the item" : `the ${toSettle.length} items`} under "Sort these out first".`);
  return out;
}

// "3 classes", "1 class" — for the lists of what's kept and what happens automatically.
const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

module.exports = { STEPS, CANCEL, NOBODY, itemKey, stepOf, assignmentFor, targetProblem, deleteBlockers, counted };
