const AuditService = require("../../modules/audit/audit.service");

// Records every change-making request in the activity log (modules/audit/) — mounted once on
// /api, ahead of every route, so a new route is covered the day it is written.
//
// Before the handler: note the record as it stands. After the response has been sent: write who
// did what and what changed. The request itself never waits on the write and can never fail
// because of it.
function auditTrail(req, res, next) {
  let started = null;
  let body;

  // What the handler answers with — a new record's id and name live there.
  const sendJson = res.json.bind(res);
  res.json = (payload) => {
    body = payload;
    return sendJson(payload);
  };

  res.on("finish", () => {
    if (!started) return;
    setImmediate(() => AuditService.finish(req, res, started, body));
  });

  AuditService.begin(req)
    .then((context) => { started = context; })
    .catch(() => { started = null; })
    .finally(next);
}

module.exports = { auditTrail };
