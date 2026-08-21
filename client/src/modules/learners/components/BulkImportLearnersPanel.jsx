import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { useBulkImportLearners } from "../hooks/useLearners";
import { formatClassName } from "../../classes/utils/classDisplay";

const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

const TEMPLATE_HEADERS = ["First Name", "Last Name", "Gender", "Guardian Name", "Guardian Phone", "Guardian Email", "Username", "Date of Birth", "Nationality", "Languages"];
const TEMPLATE_EXAMPLE = ["Amina", "Otieno", "female", "Grace Otieno", "+254712345678", "grace.otieno@example.com", "amina.otieno", "2015-03-12", "Kenyan", "English, Swahili"];

// Maps a spreadsheet's own header text (case/spacing/punctuation-insensitive) to the field name
// the server's bulkImportRowSchema expects — matches TEMPLATE_HEADERS above but tolerant of
// reasonable variations ("Date of Birth", "DOB", "dob" all resolve the same field).
const FIELD_ALIASES = {
  firstname: "firstName", lastname: "lastName", gender: "gender",
  guardianname: "guardianName", guardianphone: "guardianPhone", guardianemail: "guardianEmail",
  username: "username", dateofbirth: "dateOfBirth", dob: "dateOfBirth",
  nationality: "nationality", languages: "languages",
};

function normalizeHeader(header) {
  return (header || "").toLowerCase().replace(/[^a-z]/g, "");
}

function rowErrors(row) {
  const errors = [];
  if (!row.firstName) errors.push("First name is required");
  if (!row.lastName) errors.push("Last name is required");
  if (!["male", "female", "other"].includes((row.gender || "").toLowerCase())) errors.push("Gender must be male, female, or other");
  if (!row.guardianName) errors.push("Guardian name is required");
  if (!row.guardianPhone) errors.push("Guardian phone is required");
  return errors;
}

function downloadTemplate() {
  const csv = Papa.unparse([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "learner-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// Uploads a CSV (export any Excel sheet as CSV first) and enrolls every valid row into one hub
// and one class, chosen up front, in a single request — see learner.routes.js's POST /bulk-import.
// A bulk import always targets one specific class (never "no class yet" — that's only sensible
// for a single manual enrollment) so a whole spreadsheet can't land in the wrong place or the
// hub's arbitrary "first active class". Validation happens twice: here, so the user can fix typos
// before spending a request; and again server-side via bulkImportRowSchema, since this file's
// checks are a convenience, not the source of truth.
export default function BulkImportLearnersPanel({ schoolId, hubId, classes, onClose, onImported }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]); // [{ data, errors }]
  const [parseError, setParseError] = useState("");
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0].id : "");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [results, setResults] = useState(null); // { created, failed, results }
  const { mutate: runImport, isPending: importing } = useBulkImportLearners();
  const targetHubId = hubId || schoolId;

  useEffect(() => {
    if (classes.length === 1) {
      setClassId(classes[0].id);
      return;
    }
    if (classes.length > 1 && classId && !classes.some((cls) => cls.id === classId)) {
      setClassId("");
    }
  }, [classes, classId]);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;
  const passwordError = defaultPassword && defaultPassword.length < 8 ? "Password must be at least 8 characters" : "";
  const noClasses = classes.length === 0;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    setParseError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headerMap = {};
        (result.meta.fields || []).forEach((h) => {
          const canonical = FIELD_ALIASES[normalizeHeader(h)];
          if (canonical) headerMap[h] = canonical;
        });
        const parsed = result.data.map((raw) => {
          const data = {};
          Object.entries(raw).forEach(([h, v]) => {
            const field = headerMap[h];
            if (field) data[field] = (v ?? "").toString().trim();
          });
          if (data.gender) data.gender = data.gender.toLowerCase();
          return { data, errors: rowErrors(data) };
        });
        if (parsed.length === 0) setParseError("No rows found in this file.");
        setRows(parsed);
      },
      error: (err) => setParseError(err.message || "Could not read this file"),
    });
  };

  const handleImport = () => {
    if (validRows.length === 0 || !targetHubId || !classId || passwordError) return;
    runImport(
      { hubId: targetHubId, classId, defaultPassword, learners: validRows.map((r) => r.data) },
      { onSuccess: (data) => { setResults(data); if (data.created > 0) onImported?.(); } },
    );
  };

  // Leaves classId as-is — re-importing another file into the SAME class is the common case
  // (e.g. splitting one big sheet into batches), so there's no reason to make them re-pick it.
  const reset = () => {
    setFileName(""); setRows([]); setParseError(""); setResults(null); setDefaultPassword("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Bulk import learners</p>
        <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Close</button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
        Upload a CSV file to enroll many learners into one class at once — export your Excel sheet as CSV first. Each row needs at least a first name, last name, gender, guardian name, and guardian phone.{" "}
        <button type="button" onClick={downloadTemplate} style={{ background: "none", border: "none", padding: 0, color: "#25476a", fontWeight: 700, fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer", textDecoration: "underline" }}>
          Download CSV template
        </button>
      </p>

      {noClasses ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>
          This hub has no classes yet — create one before bulk importing learners.
        </p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>Import into class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...selectStyle, minWidth: 200 }}>
            <option value="">Select a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{formatClassName(c)}</option>)}
          </select>
        </div>
      )}

      {!noClasses && classId && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ fontSize: 12, fontFamily: "Inter, sans-serif" }} />
            {fileName && (
              <button type="button" onClick={reset} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear file</button>
            )}
          </div>

          {parseError && <p style={{ margin: 0, fontSize: 12.5, color: "#B91C1C" }}>{parseError}</p>}

          {rows.length > 0 && !results && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 12px", backgroundColor: "#FAFBFF", border: "1px solid #E5E7EB", borderRadius: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{rows.length} row{rows.length !== 1 ? "s" : ""} found</span>
                <span style={{ fontSize: 12.5, color: "#15803d" }}>{validRows.length} ready to import</span>
                {invalidCount > 0 && <span style={{ fontSize: 12.5, color: "#B91C1C" }}>{invalidCount} with errors (will be skipped)</span>}
              </div>

              {invalidCount > 0 && (
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #FCA5A5", borderRadius: 10, padding: "8px 12px", backgroundColor: "#FEF2F2" }}>
                  {rows.map((r, i) => r.errors.length > 0 && (
                    <p key={i} style={{ margin: "4px 0", fontSize: 11.5, color: "#991B1B" }}>
                      Row {i + 2}{(r.data.firstName || r.data.lastName) ? ` (${r.data.firstName} ${r.data.lastName})`.trim() : ""}: {r.errors.join(", ")}
                    </p>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder="Shared login password (optional)"
                  style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${passwordError ? "#FCA5A5" : "#E5E7EB"}`, fontSize: 13, fontFamily: "Inter, sans-serif", minWidth: 220 }}
                />
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validRows.length === 0 || !!passwordError || importing}
                  style={{ padding: "8px 16px", backgroundColor: (validRows.length === 0 || passwordError || importing) ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: (validRows.length === 0 || passwordError || importing) ? "not-allowed" : "pointer" }}
                >
                  {importing ? "Importing…" : `Import ${validRows.length} learner${validRows.length !== 1 ? "s" : ""}`}
                </button>
              </div>
              {passwordError && <p style={{ margin: 0, fontSize: 11.5, color: "#B91C1C" }}>{passwordError}</p>}
              {defaultPassword && !passwordError && (
                <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
                  This password is set on every guardian/learner login in this batch — share it with families and have them change it after first login.
                </p>
              )}
            </>
          )}
        </>
      )}

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{results.created} imported</span>
            {results.failed > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>{results.failed} failed</span>}
          </div>
          {results.failed > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #FCA5A5", borderRadius: 10, padding: "8px 12px", backgroundColor: "#FEF2F2" }}>
              {results.results.filter((r) => !r.success).map((r) => (
                <p key={r.row} style={{ margin: "4px 0", fontSize: 11.5, color: "#991B1B" }}>{r.name}: {r.error}</p>
              ))}
            </div>
          )}
          <button type="button" onClick={reset} style={{ alignSelf: "flex-start", padding: "8px 16px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
