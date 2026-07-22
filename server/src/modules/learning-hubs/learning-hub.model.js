const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/learning-hubs.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) =>
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");

const LearningHubModel = {
  create(data) {
    const all = readAll();
    const record = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(record);
    writeAll(all);
    return record;
  },

  findAll({ status, county, curriculumId, email, hubType, includeDrafts } = {}) {
    let all = readAll();
    if (status)            all = all.filter((l) => l.status === status);
    // Drafts are staged records still being set up in Settings — hidden from every listing by
    // default so they don't leak into pickers/dashboards until an admin activates them. Callers
    // that need to see them (Settings' own management view, a school viewing its own record)
    // pass includeDrafts explicitly. An explicit `status` filter already implies this.
    else if (!includeDrafts) all = all.filter((l) => l.status !== "draft");
    if (county)       all = all.filter((l) => l.address?.county === county);
    if (curriculumId) all = all.filter((l) => l.curriculumId === curriculumId);
    if (email)        all = all.filter((l) => l.email?.toLowerCase() === email.toLowerCase());
    if (hubType)      all = all.filter((l) => l.hubType === hubType);
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((l) => l.id === id) || null;
  },

  update(id, data) {
    const all = readAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  delete(id) {
    const all = readAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    writeAll(all);
    return true;
  },
};

module.exports = LearningHubModel;
