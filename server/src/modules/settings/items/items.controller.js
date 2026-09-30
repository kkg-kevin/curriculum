const asyncHandler = require("express-async-handler");
const ItemsService = require("./items.service");
const { createItemSchema, updateItemSchema, listItemsQuerySchema } = require("./items.validation");

// One controller for both mounts (see items.routes.js):
//   /api/items      — the whole catalog. `?kind=goods|service` filters; a create with no `kind`
//                     is a Service (what this endpoint always created, when it was billing items).
//   /api/inventory  — Goods only (onlyKind). What Courses/Projects' material pickers have always
//                     called; a Service is invisible here and `kind` can't be changed through it.
function makeItemsController({ onlyKind = null, defaultKind = "service" } = {}) {
  return {
    getItems: asyncHandler(async (req, res) => {
      const { kind } = listItemsQuerySchema.parse(req.query);
      const data = await ItemsService.getItems(req.ownerAdminId, { kind: onlyKind || kind });
      res.json({ success: true, data });
    }),

    createItem: asyncHandler(async (req, res) => {
      const body = createItemSchema.parse(req.body);
      const kind = onlyKind || body.kind || defaultKind;
      const data = await ItemsService.createItem({ ...body, kind, ownerAdminId: req.ownerAdminId });
      res.status(201).json({ success: true, data });
    }),

    updateItem: asyncHandler(async (req, res) => {
      const body = updateItemSchema.parse(req.body);
      if (onlyKind) delete body.kind;
      const data = await ItemsService.updateItem(req.params.itemId, body, req.ownerAdminId, { onlyKind });
      res.json({ success: true, data });
    }),

    deleteItem: asyncHandler(async (req, res) => {
      await ItemsService.deleteItem(req.params.itemId, req.ownerAdminId, { onlyKind });
      res.json({ success: true });
    }),
  };
}

module.exports = { makeItemsController };
