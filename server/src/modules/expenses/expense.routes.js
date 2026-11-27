const express = require("express");
const asyncHandler = require("express-async-handler");
const ExpenseService = require("./expense.service");
const Files = require("./expense.files");
const { claimSchema, decisionSchema, paySchema, settingsSchema, linkQuerySchema, linkedQuerySchema, byLinkQuerySchema } = require("./expense.validation");

// /api/expenses — mounted in app.js behind protect + expenseContext (expense.context.js), which
// says who is asking and what they may review. Everyone who works for the organisation claims their
// own; the service decides who may see, decide and pay each claim.
// Named routes come before "/:id".

const router = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

// The claimant's own
router.get("/mine", asyncHandler(async (req, res) => ok(res, await ExpenseService.listMine(req.expense))));
router.get("/options", asyncHandler(async (req, res) => ok(res, await ExpenseService.options(req.expense))));

// What an expense was for: the picker, a record's expenses, spending per record.
router.get("/link-options", asyncHandler(async (req, res) => ok(res, await ExpenseService.linkOptions(req.expense, linkQuerySchema.parse(req.query)))));
router.get("/linked", asyncHandler(async (req, res) => ok(res, await ExpenseService.linked(req.expense, linkedQuerySchema.parse(req.query)))));
router.get("/by-link", asyncHandler(async (req, res) => ok(res, await ExpenseService.byLink(req.expense, byLinkQuerySchema.parse(req.query)))));

// Reviewers
router.get("/review", asyncHandler(async (req, res) => ok(res, await ExpenseService.listForReview(req.expense))));
router.get("/settings", asyncHandler(async (req, res) => ok(res, await ExpenseService.settings(req.ownerAdminId))));
router.put("/settings", asyncHandler(async (req, res) => ok(res, await ExpenseService.saveSettings(req.expense, settingsSchema.parse(req.body)))));

// Proof files — uploaded first, then attached to a line when the claim is saved.
router.post("/files", Files.receiveFile, asyncHandler(async (req, res) => ok(res, await ExpenseService.saveUpload(req.expense, req.file), 201)));
router.get("/files/:fileId", asyncHandler(async (req, res) => {
  const file = await ExpenseService.fileFor(req.expense, req.params.fileId);
  Files.sendStored(res, file, { download: req.query.download === "1" });
}));

router.post("/", asyncHandler(async (req, res) => ok(res, await ExpenseService.create(req.expense, claimSchema.parse(req.body)), 201)));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await ExpenseService.get(req.expense, req.params.id))));
router.put("/:id", asyncHandler(async (req, res) => ok(res, await ExpenseService.update(req.expense, req.params.id, claimSchema.parse(req.body)))));
router.delete("/:id", asyncHandler(async (req, res) => ok(res, await ExpenseService.remove(req.expense, req.params.id))));
router.post("/:id/submit", asyncHandler(async (req, res) => ok(res, await ExpenseService.submit(req.expense, req.params.id))));
router.post("/:id/withdraw", asyncHandler(async (req, res) => ok(res, await ExpenseService.withdraw(req.expense, req.params.id))));
router.post("/:id/decision", asyncHandler(async (req, res) => ok(res, await ExpenseService.decide(req.expense, req.params.id, decisionSchema.parse(req.body)))));
router.post("/:id/pay", asyncHandler(async (req, res) => ok(res, await ExpenseService.pay(req.expense, req.params.id, paySchema.parse(req.body)))));

module.exports = router;
