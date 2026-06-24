const ClassModel = require("./class.model");

const ClassService = {
  async createClass(data) {
    return ClassModel.create(data);
  },

  async getAllClasses(filters) {
    return ClassModel.findAll(filters);
  },

  async getClassById(id) {
    const record = ClassModel.findById(id);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateClass(id, data) {
    const record = ClassModel.update(id, data);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async bulkCreateClasses(items) {
    return Promise.all(items.map((item) => ClassModel.create(item)));
  },

  async deleteClass(id) {
    const deleted = ClassModel.delete(id);
    if (!deleted) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return { message: "Class deleted successfully" };
  },
};

module.exports = ClassService;
