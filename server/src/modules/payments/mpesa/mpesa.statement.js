// Reads an M-Pesa statement exported from the M-Pesa business portal (org portal → Statement →
// export as CSV) — pure, no database, so it's tested on its own (test/mpesa.test.js).
//
// The export starts with a few lines about the account, then a table whose header has
// "Receipt No.", "Completion Time", "Details", "Transaction Status", "Paid In", "Withdrawn",
// "Balance", "Reason Type", "Other Party Info" and "A/C No." (the account number the payer typed).
// Column order and the exact headings vary a little between exports, so columns are found by name.
//
// Only money received from customers is kept — Paybill payments, by prompt or by hand. Charges,
// withdrawals, settlements and failed rows are counted as skipped.

// One CSV line → fields. Handles quoted fields with commas and doubled quotes. A quoted field
// spanning lines isn't expected in these exports.
function splitCsvLine(line) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(field); field = ""; } else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

const norm = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMNS = {
  receipt: ["receiptno", "receiptnumber", "receipt", "transactionid"],
  completed: ["completiontime", "completiondate", "transactiontime", "date"],
  initiated: ["initiationtime"],
  details: ["details", "description"],
  status: ["transactionstatus", "status"],
  paidIn: ["paidin", "moneyin", "credit"],
  withdrawn: ["withdrawn", "moneyout", "debit"],
  reason: ["reasontype", "type"],
  otherParty: ["otherpartyinfo", "otherparty", "customer"],
  account: ["acno", "accountno", "accountnumber", "billrefnumber", "account"],
};

function findColumns(header) {
  const names = header.map(norm);
  const found = {};
  for (const [key, options] of Object.entries(COLUMNS)) {
    const index = options.map((o) => names.indexOf(o)).find((i) => i >= 0);
    if (index !== undefined) found[key] = index;
  }
  return found;
}

const amountOf = (value) => {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

// "21-10-2026 14:30:05", "2026-10-21 14:30:05", "21/10/2026 14:30" — Kenyan time → a Date.
function parseStatementTime(value) {
  const text = String(value || "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
  let y; let mo; let d;
  if (m) [, y, mo, d] = m;
  else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(text);
    if (!m) return null;
    [, d, mo, y] = m;
  }
  const [h, mi, s] = [m[4], m[5], m[6] || "0"].map(Number);
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), h - 3, mi, s));
  return Number.isNaN(date.getTime()) ? null : date;
}

// "254712***678 - JANE W DOE" or "JANE DOE" → { msisdn, name }.
function parseOtherParty(value) {
  const text = String(value || "").trim();
  if (!text) return { msisdn: null, name: null };
  const m = /^([0-9*#]{6,})\s*-\s*(.+)$/.exec(text);
  if (m) return { msisdn: m[1], name: m[2].trim() || null };
  return /^[0-9*#]{6,}$/.test(text) ? { msisdn: text, name: null } : { msisdn: null, name: text };
}

// The account number from a Details line like "Pay Bill Online from 2547… - NAME Acc. 2026000123".
function accountFromDetails(details) {
  const m = /\bAcc(?:ount)?\.?\s*(?:No\.?)?\s*[:#]?\s*([A-Za-z0-9-]{2,40})/i.exec(String(details || ""));
  return m ? m[1] : null;
}

const CUSTOMER_PAYMENT = /pay\s*bill|paybill|utility|c2b|customer|lipa|merchant payment/i;

function parseStatement(csvText) {
  const lines = String(csvText || "").replace(/^﻿/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /receipt\s*no/i.test(line) || /^"?receipt"?\s*,/i.test(line));
  if (headerIndex < 0) {
    return { rows: [], skipped: [], error: "This doesn't look like an M-Pesa statement: no \"Receipt No.\" column was found. Export the statement as CSV from the M-Pesa business portal." };
  }
  const columns = findColumns(splitCsvLine(lines[headerIndex]));
  if (columns.receipt === undefined || columns.paidIn === undefined) {
    return { rows: [], skipped: [], error: "The statement needs \"Receipt No.\" and \"Paid In\" columns." };
  }
  const rows = [];
  const skipped = [];
  const seen = new Set();
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const fields = splitCsvLine(lines[i]);
    const at = (key) => (columns[key] === undefined ? "" : fields[columns[key]] || "");
    const receipt = at("receipt").toUpperCase();
    if (!/^[A-Z0-9]{8,20}$/.test(receipt)) continue; // a total or footer line
    const paidIn = amountOf(at("paidIn"));
    const status = at("status");
    const reason = at("reason");
    const why = !(paidIn > 0) ? "Money paid out, not in"
      : status && !/complete/i.test(status) ? `Not completed (${status})`
        : reason && !CUSTOMER_PAYMENT.test(reason) ? `Not a customer payment (${reason})`
          : seen.has(receipt) ? "Listed twice in the file" : null;
    if (why) { skipped.push({ line: i + 1, receipt, amount: paidIn || amountOf(at("withdrawn")), reason: why }); continue; }
    seen.add(receipt);
    const { msisdn, name } = parseOtherParty(at("otherParty"));
    rows.push({
      line: i + 1,
      transId: receipt,
      transTime: parseStatementTime(at("completed")) || parseStatementTime(at("initiated")),
      amount: paidIn,
      msisdn,
      payerName: name,
      billRefNumber: (at("account") || accountFromDetails(at("details")) || "").trim() || null,
      details: at("details") || null,
    });
  }
  return { rows, skipped, error: null };
}

module.exports = { parseStatement, splitCsvLine, parseStatementTime, parseOtherParty, accountFromDetails };
