const db = require("../../../config/db");
const { generateId, filterDefined } = require("../../../shared/utils/model.utils");

const TABLE = "competencies";
const INDICATOR_TABLE = "competency_indicators";
const STOP_WORDS = new Set(["the", "and", "of", "for", "a", "an", "in", "on", "at", "to", "by", "with", "from", "or"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractWords(name) {
  const cleaned = normalizeText(name)
    .replace(/^\d+(?:[.)-]\s*|\s+)/, "")
    .replace(/^[ivxlcdm]+\.\s*/i, "");

  return cleaned
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !STOP_WORDS.has(part.toLowerCase()));
}

function codeFromName(name, fallback, maxLetters = 6) {
  const words = extractWords(name);
  if (words.length === 0) return fallback;

  let code = words.map((word) => word[0].toUpperCase()).join("");
  if (code.length < 2) {
    code = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  code = code.slice(0, maxLetters).replace(/[^a-zA-Z0-9]/g, "");
  return code || fallback;
}

function uniqueCode(baseCode, usedCodes, fallback) {
  let code = baseCode || fallback;
  if (!usedCodes.has(code)) {
    usedCodes.add(code);
    return code;
  }

  let suffix = 2;
  while (usedCodes.has(`${code}${suffix}`)) suffix += 1;
  const unique = `${code}${suffix}`;
  usedCodes.add(unique);
  return unique;
}

function normalizeIndicators(indicators, competencyCode) {
  const list = Array.isArray(indicators) ? indicators : [];
  const usedCodes = new Set();

  return list.map((indicator) => {
    const item = { ...indicator };
    if (!item.id) item.id = generateId();

    const baseCode = `${competencyCode}-${codeFromName(item.name, "IND")}`;
    item.code = uniqueCode(baseCode, usedCodes, `${competencyCode}-IND`);
    return item;
  });
}

// Attaches an `indicators` array (in stored display order) to each competency row — the
// shape every caller expects, matching the JSON-file era's embedded competencies[].indicators[].
async function attachIndicators(competencies) {
  if (!competencies.length) return competencies;
  const ids = competencies.map((c) => c.id);
  const indicatorRows = await db(INDICATOR_TABLE).whereIn("competencyId", ids).orderBy("order", "asc");
  const byCompetency = new Map();
  for (const row of indicatorRows) {
    const list = byCompetency.get(row.competencyId) || [];
    list.push({ id: row.id, name: row.name, description: row.description, code: row.code });
    byCompetency.set(row.competencyId, list);
  }
  return competencies.map((c) => ({ ...c, indicators: byCompetency.get(c.id) || [] }));
}

async function replaceIndicators(trx, competencyId, indicators) {
  await trx(INDICATOR_TABLE).where({ competencyId }).del();
  if (!indicators.length) return;
  const now = new Date();
  await trx(INDICATOR_TABLE).insert(
    indicators.map((ind, index) => ({
      id: ind.id,
      competencyId,
      name: ind.name,
      description: ind.description ?? null,
      code: ind.code,
      order: index,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

const CompetencyModel = {
  async findAll() {
    const rows = await db(TABLE).orderBy("createdAt", "asc");
    return attachIndicators(rows);
  },

  async findByIds(ids) {
    const rows = await db(TABLE).whereIn("id", ids).orderBy("createdAt", "asc");
    return attachIndicators(rows);
  },

  async findById(id) {
    const row = await db(TABLE).where({ id }).first();
    if (!row) return null;
    const [withIndicators] = await attachIndicators([row]);
    return withIndicators;
  },

  async create(data) {
    const { indicators: inputIndicators, ...rest } = data;
    const existing = await db(TABLE).select("code");
    const usedCodes = new Set(existing.map((c) => c.code).filter(Boolean));
    const baseCode = codeFromName(data.name, "COMP");
    const code = uniqueCode(baseCode, usedCodes, "COMP");
    const indicators = normalizeIndicators(inputIndicators, code);

    const now = new Date();
    const competency = { ...filterDefined(rest), id: generateId(), code, createdAt: now, updatedAt: now };

    await db.transaction(async (trx) => {
      await trx(TABLE).insert(competency);
      await replaceIndicators(trx, competency.id, indicators);
    });

    return { ...competency, indicators };
  },

  async update(id, data) {
    const current = await db(TABLE).where({ id }).first();
    if (!current) return null;

    const { indicators: inputIndicators, ...rest } = data;
    const nextName = typeof rest.name === "string" ? rest.name : current.name;
    const baseCode = codeFromName(nextName, "COMP");
    const otherCodes = await db(TABLE).where("id", "!=", id).select("code");
    const usedCodes = new Set(otherCodes.map((c) => c.code).filter(Boolean));
    const code = uniqueCode(baseCode, usedCodes, "COMP");

    const sourceIndicators = inputIndicators || (await db(INDICATOR_TABLE).where({ competencyId: id }).orderBy("order", "asc"));
    const indicators = normalizeIndicators(sourceIndicators, code);

    const patch = filterDefined(rest);
    delete patch.id;
    patch.code = code;
    patch.updatedAt = new Date();

    await db.transaction(async (trx) => {
      await trx(TABLE).where({ id }).update(patch);
      await replaceIndicators(trx, id, indicators);
    });

    const updatedRow = await db(TABLE).where({ id }).first();
    return { ...updatedRow, indicators };
  },

  async delete(id) {
    const count = await db.transaction(async (trx) => {
      await trx(INDICATOR_TABLE).where({ competencyId: id }).del();
      return trx(TABLE).where({ id }).del();
    });
    return count > 0;
  },
};

module.exports = CompetencyModel;
