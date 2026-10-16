const asyncHandler = require("express-async-handler");
const DraftService = require("./draft.service");
const { createDraftSchema, updateDraftSchema } = require("./draft.validation");

const queryString = (value) => (typeof value === "string" && value ? value : undefined);
// What a write answers with — the form only needs where its draft now stands.
const position = (draft) => ({ id: draft.id, revision: draft.revision, updatedAt: draft.updatedAt });

// One set of handlers per mount, serving only that mount's kinds (see draft.routes.js).
function draftController(kinds) {
  return {
    listDrafts: asyncHandler(async (req, res) => {
      const data = await DraftService.list(req.ownerAdminId, kinds, {
        kind: queryString(req.query.kind),
        recordId: queryString(req.query.recordId),
        parentId: queryString(req.query.parentId),
      });
      res.json({ success: true, data });
    }),

    getDraft: asyncHandler(async (req, res) => {
      const data = await DraftService.get(req.params.id, req.ownerAdminId, kinds);
      res.json({ success: true, data });
    }),

    createDraft: asyncHandler(async (req, res) => {
      const body = createDraftSchema.parse(req.body);
      const data = await DraftService.create(req.ownerAdminId, req.user.id, kinds, body);
      res.status(201).json({ success: true, data: position(data) });
    }),

    updateDraft: asyncHandler(async (req, res) => {
      const body = updateDraftSchema.parse(req.body);
      const data = await DraftService.update(req.params.id, req.ownerAdminId, req.user.id, kinds, body);
      res.json({ success: true, data: position(data) });
    }),

    deleteDraft: asyncHandler(async (req, res) => {
      const result = await DraftService.remove(req.params.id, req.ownerAdminId, kinds);
      res.json({ success: true, ...result });
    }),
  };
}

module.exports = { draftController };
