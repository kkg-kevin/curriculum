const express = require("express");
const { verifyCertificate } = require("./certificate.controller");

const router = express.Router();

// Mounted in app.js WITHOUT `protect` — a certificate has to be checkable by someone with no
// account (a school, an employer, a relative scanning the QR). The unguessable token in the URL
// is the only access control; verify() returns only what is printed on the certificate.
router.get("/:token", verifyCertificate);

module.exports = router;
