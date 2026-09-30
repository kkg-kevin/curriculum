const asyncHandler = require("express-async-handler");
const HomeLearningService = require("./home-learning.service");
const { can } = require("../access/access.service");
const HomeLearningSignupService = require("./home-learning-signup.service");

// Staff are aliased to "admin" by scope.middleware.js. Raising a Home Learning invoice creates a
// billing invoice, so it needs the Billing → Create permission (access.registry.js maps these
// routes to it and the middleware already enforces that); this repeats the check here so the
// route can never become a side door into billing.
function assertNotCollaborator(req) {
  if (req.user.actualRole === "collaborator" && !can(req.user.permissions, "billing", "create")) {
    throw Object.assign(new Error("Your role doesn't allow you to raise invoices"), { statusCode: 403 });
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

// Website sign-ups: approving records a payment (Billing → Edit for staff, enforced by
// scope.middleware via access.registry.js); declining removes the sign-up's accounts.
const approveSignup = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningSignupService.approveSignup(req, req.params.id, req.body) });
});

const declineSignup = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningSignupService.declineSignup(req, req.params.id) });
});

const getForLearner = asyncHandler(async (req, res) => {
  if (req.ownLearner?.id !== req.params.learnerId) {
    return res.status(403).json({ success: false, message: "You do not have permission to access this learner" });
  }
  res.json({ success: true, data: await HomeLearningService.getForLearner(req.params.learnerId) });
});

// Parent portal → My Family (the parent's own login only — see home-learning-signup.service.js).
const getFamily = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningSignupService.getFamily(req.user) });
});

const addFamilyChild = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: await HomeLearningSignupService.addChildFromParent(req.user, req.params.householdId, req.body) });
});

const getForEducator = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await HomeLearningService.getForEducator(req.ownTeacher?.id) });
});

module.exports = {
  list, listPackages, createPackage, updatePackage, deletePackage, create, update, setEnrollment, createLearner, removeEnrollment,
  generateInvoice, generateMonthlyInvoices, getForLearner, getForEducator, approveSignup, declineSignup,
  getFamily, addFamilyChild,
};
