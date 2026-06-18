const crypto = require("crypto");

const curricula = [];

const generateId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const CurriculumModel = {
  create(data) {
    const curriculum = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    curricula.push(curriculum);
    return curriculum;
  },

  findAll({ framework, academicYear } = {}) {
    let result = [...curricula];
    if (framework) result = result.filter((c) => c.framework === framework);
    if (academicYear) result = result.filter((c) => c.academicYear === academicYear);
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return curricula.find((c) => c.id === id) || null;
  },

  update(id, data) {
    const index = curricula.findIndex((c) => c.id === id);
    if (index === -1) return null;
    curricula[index] = {
      ...curricula[index],
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    return curricula[index];
  },

  delete(id) {
    const index = curricula.findIndex((c) => c.id === id);
    if (index === -1) return false;
    curricula.splice(index, 1);
    return true;
  },
};

module.exports = CurriculumModel;
