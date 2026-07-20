const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/competencies.json");
const STOP_WORDS = new Set(["the", "and", "of", "for", "a", "an", "in", "on", "at", "to", "by", "with", "from", "or"]);

function read() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : [];
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function genId() {
  try {
    return require("crypto").randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

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
  let changed = false;

  const normalized = list.map((indicator) => {
    const item = { ...indicator };
    if (!item.id) {
      item.id = genId();
      changed = true;
    }

    const baseCode = `${competencyCode}-${codeFromName(item.name, "IND")}`;
    const code = uniqueCode(baseCode, usedCodes, `${competencyCode}-IND`);
    if (code !== item.code) changed = true;
    item.code = code;
    return item;
  });

  return { indicators: normalized, changed };
}

function normalizeCompetencies(records) {
  const list = Array.isArray(records) ? records : [];
  const usedCodes = new Set();
  let changed = false;

  const normalized = list.map((item) => {
    const record = { ...item };
    if (!record.id) {
      record.id = genId();
      changed = true;
    }

    const baseCode = codeFromName(record.name, "COMP");
    const code = uniqueCode(baseCode, usedCodes, "COMP");
    if (code !== record.code) changed = true;
    record.code = code;

    const normalizedIndicators = normalizeIndicators(record.indicators, record.code);
    record.indicators = normalizedIndicators.indicators;
    if (normalizedIndicators.changed) changed = true;

    return record;
  });

  return { normalized, changed };
}

function readNormalized() {
  const records = read();
  const { normalized, changed } = normalizeCompetencies(records);
  if (changed) write(normalized);
  return normalized;
}

const CompetencyModel = {
  findAll() {
    return readNormalized();
  },

  findByIds(ids) {
    const idSet = new Set(ids);
    return readNormalized().filter((c) => idSet.has(c.id));
  },

  findById(id) {
    return readNormalized().find((c) => c.id === id) || null;
  },

  create(data) {
    const all = readNormalized();
    const now = new Date().toISOString();
    const baseCode = codeFromName(data.name, "COMP");
    const code = uniqueCode(baseCode, new Set(all.map((item) => item.code)), "COMP");
    const indicators = normalizeIndicators(data.indicators, code).indicators;
    const item = {
      ...data,
      id: genId(),
      code,
      indicators,
      createdAt: now,
      updatedAt: now,
    };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = readNormalized();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const nextName = typeof data.name === "string" ? data.name : all[idx].name;
    const baseCode = codeFromName(nextName, "COMP");
    const usedCodes = new Set(all.filter((item) => item.id !== id).map((item) => item.code));
    const code = uniqueCode(baseCode, usedCodes, "COMP");
    const indicators = data.indicators
      ? normalizeIndicators(data.indicators, code).indicators
      : normalizeIndicators(all[idx].indicators, code).indicators;

    all[idx] = {
      ...all[idx],
      ...data,
      code,
      indicators,
      id,
      updatedAt: new Date().toISOString(),
    };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all = readNormalized();
    const filtered = all.filter((c) => c.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },
};

module.exports = CompetencyModel;
