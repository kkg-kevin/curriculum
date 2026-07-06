const TemplateModel = require("./template.model");

const TemplateService = {
  getTemplates(type) {
    const all = TemplateModel.findAll();
    return type ? all.filter((t) => t.type === type) : all;
  },

  createTemplate(data) {
    return TemplateModel.create(data);
  },

  updateTemplate(id, data) {
    const existing = TemplateModel.findById(id);
    if (!existing) {
      const err = new Error("Template not found");
      err.statusCode = 404;
      throw err;
    }
    return TemplateModel.update(id, data);
  },

  deleteTemplate(id) {
    const existing = TemplateModel.findById(id);
    if (!existing) {
      const err = new Error("Template not found");
      err.statusCode = 404;
      throw err;
    }
    TemplateModel.delete(id);
  },
};

module.exports = TemplateService;
