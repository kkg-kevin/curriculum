const asyncHandler = require("express-async-handler");
const HomeLearningService = require("./home-learning.service");

// Collaborators are aliased to "admin" by scope.middleware.js but are deliberately kept off every
// billing surface (/api/billing is a restricted path for them). Home Learning invoicing lives under
// /api/home-learning, so it has to refuse them itself or it'd be a side door into billing.
function assertNotCollaborator(req) {
  if (req.user.actualRole === "collaborator") {
    throw Object.assign(new Error("Only the workspace administrator can raise Home Learning invoices"), { statusCode: 403 });
  }
}

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.list(req.ownerAdminId) });
});

const listPackages = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.listPackages(req.ownerAdminId) });
});

const createPackage = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await HomeLearningService.createPackage(req.ownerAdminId, req.body) });
});

const updatePackage = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.updatePackage(req.ownerAdminId, req.params.packageId, req.body) });
});

const deletePackage = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.deletePackage(req.ownerAdminId, req.params.packageId) });
});

const create = asyncHandler(async (req, res) => {
  const household = await HomeLearningService.create(req.ownerAdminId, req.body);
  res.status(201).json({ success: true, data: household });
});

const update = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.update(req.ownerAdminId, req.params.id, req.body) });
});

const setEnrollment = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await HomeLearningService.setEnrollment(req.ownerAdminId, req.params.id, req.body) });
});

const createLearner = asyncHandler(async (req, res) => {
  const learner = await HomeLearningService.createLearner(req.ownerAdminId, req.params.id, req.body);
  res.status(201).json({ success: true, data: learner });
});

const removeEnrollment = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.removeEnrollment(req.ownerAdminId, req.params.id, req.params.learnerId) });
});

const generateInvoice = asyncHandler(async (req, res) => {
  assertNotCollaborator(req);
  const result = await HomeLearningService.generateInvoice(req.ownerAdminId, req.params.id, req.body, req.user.id);
  res.status(result.created ? 201 : 200).json({ success: true, data: result });
});

const generateMonthlyInvoices = asyncHandler(async (req, res) => {
  assertNotCollaborator(req);
  res.json({ success: true, data: await HomeLearningService.generateMonthlyInvoices(req.ownerAdminId, req.body, req.user.id) });
});

const getForLearner = asyncHandler(async (req, res) => {
  if (req.ownLearner?.id !== req.params.learnerId) {
    return res.status(403).json({ success: false, message: "You do not have permission to access this learner" });
  }
  res.json({ success: true, data: await HomeLearningService.getForLearner(req.params.learnerId) });
});

const getForEducator = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.getForEducator(req.ownTeacher?.id) });
});

module.exports = {
  list, listPackages, createPackage, updatePackage, deletePackage, create, update, setEnrollment, createLearner, removeEnrollment,
  generateInvoice, generateMonthlyInvoices, getForLearner, getForEducator,
};
