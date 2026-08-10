const SystemLevelModel = require("./system-level.model");
const CurriculumModel = require("../../curriculum/curriculum.model");

// Unlike the Learning Area catalog (copied into a curriculum on import, so the catalog and a
// curriculum's copy are independent afterward), a curriculum's classes[] reference a System
// Level by id directly and permanently — deleting one out from under a curriculum that still
// maps a grade onto it would leave that grade pointing at nothing. Block it instead.
async function assertNotInUse(id) {
  const curricula = await CurriculumModel.findAll();
  const inUse = curricula.some((c) => (c.classes || []).some((cls) => cls.systemLevelId === id));
  if (inUse) {
    const err = new Error("This level is mapped to a grade in at least one curriculum and can't be deleted");
    err.statusCode = 409;
    throw err;
  }
}

const SystemLevelService = {
  async getSystemLevels() {
    return SystemLevelModel.findAll();
  },

  async createSystemLevel(data) {
    const existing = await SystemLevelModel.findAll();
    if (existing.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A system level with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return SystemLevelModel.create(data);
  },

  async updateSystemLevel(id, data) {
    const level = await SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const all = await SystemLevelModel.findAll();
      const others = all.filter((l) => l.id !== id);
      if (others.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A system level with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return SystemLevelModel.update(id, data);
  },

  async deleteSystemLevel(id) {
    const level = await SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    await assertNotInUse(id);
    await SystemLevelModel.delete(id);
  },

  async reorderSystemLevels(orderedIds) {
    return SystemLevelModel.reorder(orderedIds);
  },
};

module.exports = SystemLevelService;
