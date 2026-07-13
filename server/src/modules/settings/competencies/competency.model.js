const fs   = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../../../data/competencies.json");

function read()      { return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []; }
function write(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function genId() {
  try { return require("crypto").randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }
}

function withIndicatorIds(indicators) {
  return (indicators || []).map((ind) => ({ ...ind, id: ind.id || genId() }));
}

const CompetencyModel = {
  findAll() {
    return read();
  },

  findByIds(ids) {
    const idSet = new Set(ids);
    return read().filter((c) => idSet.has(c.id));
  },

  findById(id) {
    return read().find((c) => c.id === id) || null;
  },

  create(data) {
    const all  = read();
    const now  = new Date().toISOString();
    const item = { id: genId(), ...data, indicators: withIndicatorIds(data.indicators), createdAt: now, updatedAt: now };
    all.push(item);
    write(all);
    return item;
  },

  update(id, data) {
    const all = read();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const indicators = data.indicators ? withIndicatorIds(data.indicators) : all[idx].indicators;
    all[idx] = { ...all[idx], ...data, indicators, id, updatedAt: new Date().toISOString() };
    write(all);
    return all[idx];
  },

  delete(id) {
    const all      = read();
    const filtered = all.filter((c) => c.id !== id);
    if (filtered.length === all.length) return false;
    write(filtered);
    return true;
  },
};

module.exports = CompetencyModel;
