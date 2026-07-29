const SystemLevelModel = require("./system-level.model");
const CurriculumModel = require("../../curriculum/curriculum.model");

// Unlike the Learning Area catalog (copied into a curriculum on import, so the catalog and a
// curriculum's copy are independent afterward), a curriculum's classes[] reference a System
// Level by id directly and permanently — deleting one out from under a curriculum that still
// maps a grade onto it would leave that grade pointing at nothing. Block it instead.
function assertNotInUse(id) {
  const inUse = CurriculumModel.findAll().some((c) => (c.classes || []).some((cls) => cls.systemLevelId === id));
  if (inUse) {
    const err = new Error("This level is mapped to a grade in at least one curriculum and can't be deleted");
    err.statusCode = 409;
    throw err;
  }
}

const SystemLevelService = {
  getSystemLevels() {
    return SystemLevelModel.findAll();
  },

  createSystemLevel(data) {
    const existing = SystemLevelModel.findAll();
    if (existing.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
      const err = new Error("A system level with this name already exists");
      err.statusCode = 409;
      throw err;
    }
    return SystemLevelModel.create(data);
  },

  updateSystemLevel(id, data) {
    const level = SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    if (data.name) {
      const others = SystemLevelModel.findAll().filter((l) => l.id !== id);
      if (others.some((l) => l.name.toLowerCase() === data.name.toLowerCase())) {
        const err = new Error("A system level with this name already exists");
        err.statusCode = 409;
        throw err;
      }
    }
    return SystemLevelModel.update(id, data);
  },

  deleteSystemLevel(id) {
    const level = SystemLevelModel.findById(id);
    if (!level) {
      const err = new Error("System level not found");
      err.statusCode = 404;
      throw err;
    }
    assertNotInUse(id);
    SystemLevelModel.delete(id);
  },

  reorderSystemLevels(orderedIds) {
    return SystemLevelModel.reorder(orderedIds);
  },
};

module.exports = SystemLevelService;
