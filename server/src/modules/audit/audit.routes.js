const express = require("express");
const asyncHandler = require("express-async-handler");
const AuditService = require("./audit.service");

// The Activity page's reads. Mounted admin-only (app.js); a staff member reaches it only when
// their role grants Activity log → View (access.registry.js maps /api/audit to "activity").
// Deliberately read-only: there is no route that changes or removes an entry.
const router = express.Router();

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function filtersFrom(query) {
  const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const from = text(query.from);
  const to = text(query.to);
  return {
    view: text(query.view), // a tab of the Activity page: signins | added | edited | deleted | problems
    actorUserId: text(query.actor),
    module: text(query.module),
    action: text(query.action),
    outcome: text(query.outcome),
    entityType: text(query.entityType),
    entityId: text(query.entityId),
    q: text(query.q),
    // Whole days, as the date pickers give them.
    from: from && DAY.test(from) ? new Date(`${from}T00:00:00`) : undefined,
    to: to && DAY.test(to) ? new Date(`${to}T23:59:59.999`) : undefined,
  };
}

router.get("/", asyncHandler(async (req, res) => {
  const result = await AuditService.list(req.ownerAdminId, filtersFrom(req.query), { page: req.query.page, pageSize: req.query.pageSize });
  res.json({ success: true, data: result });
}));

router.get("/counts", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AuditService.counts(req.ownerAdminId, filtersFrom(req.query)) });
}));

router.get("/facets", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await AuditService.facets(req.ownerAdminId) });
}));

// A spreadsheet of the same entries the page is showing (same filters), newest first.
router.get("/export.csv", asyncHandler(async (req, res) => {
  const rows = await AuditService.exportRows(req.ownerAdminId, filtersFrom(req.query));
  // Quoted, with quotes doubled; a leading = + - @ is defused so a spreadsheet can't run it.
  const cell = (value) => {
    const text = value == null ? "" : String(value);
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const header = ["When", "Who", "Email", "Account", "Staff role", "Area", "Action", "Record", "What happened", "Changes", "Outcome", "Reason", "IP address"];
  const lines = rows.map((row) => [
    new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19),
    row.actorName, row.actorEmail, row.actorRole, row.actorAccessRole, row.module, row.action, row.entityLabel, row.summary,
    (row.changes || []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; "),
    row.outcome, row.reason, row.ip,
  ].map(cell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"`);
  // The BOM makes Excel read the file as UTF-8 (names with accents, the → in Changes).
  res.send(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`);
}));

module.exports = router;
