const asyncHandler = require("express-async-handler");
const ClubService = require("./club.service");
const ClubSignupService = require("./club-signup.service");
const { can } = require("../access/access.service");
const UsageService = require("../usage/usage.service");

// Same rule as home-learning.controller.js: raising a club invoice creates a billing invoice, so
// staff need Billing → Create (access.registry.js maps these routes to it; repeated here so the
// route can never become a side door into billing).
function assertNotCollaborator(req) {
  if (req.user.actualRole === "collaborator" && !can(req.user.permissions, "billing", "create")) {
    throw Object.assign(new Error("Your role doesn't allow you to raise invoices"), { statusCode: 403 });
  }
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const list = asyncHandler(async (req, res) => ok(res, await ClubService.list(req.ownerAdminId, { hubId: req.query.hubId })));
const listClubs = asyncHandler(async (req, res) => ok(res, await ClubService.listClubs(req.ownerAdminId)));
const listPackages = asyncHandler(async (req, res) => ok(res, await ClubService.listPackages(req.ownerAdminId)));
const createPackage = asyncHandler(async (req, res) => ok(res, await ClubService.createPackage(req.ownerAdminId, req.body), 201));
const updatePackage = asyncHandler(async (req, res) => ok(res, await ClubService.updatePackage(req.ownerAdminId, req.params.packageId, req.body)));
const deletePackage = asyncHandler(async (req, res) => {
  if (await UsageService.guardDelete(req, res, "clubPackage", req.params.packageId, "This package")) return;
  ok(res, await ClubService.deletePackage(req.ownerAdminId, req.params.packageId));
});
const update = asyncHandler(async (req, res) => ok(res, await ClubService.update(req.ownerAdminId, req.params.id, req.body)));
const placeChild = asyncHandler(async (req, res) => ok(res, await ClubService.placeChild(req.ownerAdminId, req.params.id, req.params.learnerId, req.body)));
const removeChild = asyncHandler(async (req, res) => ok(res, await ClubService.removeChild(req.ownerAdminId, req.params.id, req.params.learnerId)));
const restoreChild = asyncHandler(async (req, res) => ok(res, await ClubService.restoreChild(req.ownerAdminId, req.params.id, req.params.learnerId)));

const generateInvoice = asyncHandler(async (req, res) => {
  assertNotCollaborator(req);
  const result = await ClubService.generateInvoice(req.ownerAdminId, req.params.id, req.body, req.user.id);
  ok(res, result, result.created ? 201 : 200);
});

const generateDueInvoices = asyncHandler(async (req, res) => {
  assertNotCollaborator(req);
  ok(res, await ClubService.generateDueInvoices(req.ownerAdminId, req.body, req.user.id));
});

// Website sign-ups: approving records a payment (Billing → Edit for staff, enforced by
// scope.middleware via access.registry.js); declining removes the sign-up's accounts.
const approveSignup = asyncHandler(async (req, res) => ok(res, await ClubSignupService.approveSignup(req, req.params.id, req.body)));
const declineSignup = asyncHandler(async (req, res) => ok(res, await ClubSignupService.declineSignup(req, req.params.id)));

// Parent portal → My Family (the parent's own login only — see club-signup.service.js).
const getFamily = asyncHandler(async (req, res) => ok(res, await ClubSignupService.getFamily(req.user)));
const addFamilyChild = asyncHandler(async (req, res) => ok(res, await ClubSignupService.addChildFromParent(req.user, req.params.membershipId, req.body), 201));

module.exports = {
  list, listClubs, listPackages, createPackage, updatePackage, deletePackage, update, placeChild, removeChild, restoreChild,
  generateInvoice, generateDueInvoices, approveSignup, declineSignup, getFamily, addFamilyChild,
};
