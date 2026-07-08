const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "../../../data/users.json");

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const readAll = () => {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, "utf-8").trim();
  return raw ? JSON.parse(raw) : [];
};

const writeAll = (data) => {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
};

const UserModel = {
  create(data) {
    const all = readAll();
    const user = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    all.push(user);
    writeAll(all);
    return user;
  },

  findAll() {
    return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return readAll().find((u) => u.id === id) || null;
  },

  findByEmail(email) {
    return readAll().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  update(id, data) {
    const all = readAll();
    const index = all.findIndex((u) => u.id === id);
    if (index === -1) return null;
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    all[index] = { ...all[index], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[index];
  },

  delete(id) {
    const all = readAll();
    const index = all.findIndex((u) => u.id === id);
    if (index === -1) return false;
    all.splice(index, 1);
    writeAll(all);
    return true;
  },
};

module.exports = UserModel;
