// Turns a record's before and after into a short, readable list of what changed:
//   [{ field: "Price amount", from: "12,000", to: "15,000" }, …]
// Written for a person scanning the Activity page, not for restoring data: long text is
// shortened, lists and structured content are summarised, and secrets never appear.

// Never shown, whatever happened to them.
const SECRET = /password|token|secret|hash/i;
// Bookkeeping that changes on every save and says nothing.
const IGNORED = new Set(["id", "createdAt", "updatedAt", "ownerAdminId"]);
const MAX_TEXT = 140;
const MAX_CHANGES = 25;

// "priceAmount" → "Price amount"; "curriculumId" → "Curriculum"
function fieldLabel(key) {
  const words = key.replace(/Ids?$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

const isEmpty = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

function sameValue(a, b) {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (typeof a === "object" || typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  // MySQL hands booleans back as 0/1 and decimals as strings.
  return String(a) === String(b);
}

function describe(value) {
  if (isEmpty(value)) return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 16).replace("T", " ");
  if (Array.isArray(value)) {
    const simple = value.every((v) => typeof v === "string" || typeof v === "number");
    if (simple && value.join(", ").length <= MAX_TEXT) return value.join(", ");
    return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  }
  if (typeof value === "object") return "(details)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  // Rich text is stored as HTML — show the words, not the markup.
  const text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text || "—";
}

// `names` resolves an id held in a "…Id" column to what it points at (see audit.service.js);
// an id it can't name is shown as "changed" rather than as a meaningless uuid.
function diffRecords(before, after, names = () => null) {
  if (!before || !after) return [];
  const changes = [];
  for (const key of Object.keys(after)) {
    if (IGNORED.has(key) || SECRET.test(key)) continue;
    const from = before[key];
    const to = after[key];
    if (sameValue(from, to)) continue;

    if (/Ids$/.test(key)) {
      // A list of ids (a bootcamp's games, its pathways) — how many, never the ids themselves.
      const count = (v) => `${Array.isArray(v) ? v.length : 0} selected`;
      const same = count(from) === count(to);
      changes.push({ field: fieldLabel(key).replace(/([^s])$/, "$1s"), from: count(from), to: same ? `${count(to)} (changed)` : count(to) });
    } else if (/Id$/.test(key)) {
      changes.push({ field: fieldLabel(key), from: isEmpty(from) ? "—" : names(key, from) || "(previous)", to: isEmpty(to) ? "—" : names(key, to) || "(changed)" });
    } else if (Array.isArray(from) && Array.isArray(to) && describe(from) === describe(to)) {
      // Same length, different content — e.g. one question in an assessment reworded.
      changes.push({ field: fieldLabel(key), from: describe(from), to: `${describe(to)} (content changed)` });
    } else if (typeof to === "object" && to !== null && !Array.isArray(to) && !(to instanceof Date)) {
      changes.push({ field: fieldLabel(key), from: "—", to: "changed" });
    } else {
      changes.push({ field: fieldLabel(key), from: describe(from), to: describe(to) });
    }
    if (changes.length >= MAX_CHANGES) break;
  }
  return changes;
}

module.exports = { diffRecords, fieldLabel };
