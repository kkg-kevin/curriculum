import { useState } from "react";
import toast from "react-hot-toast";
import { Print as PrintIcon, Download as DownloadIcon } from "@mui/icons-material";
import { buildInvoicePdf, buildReceiptPdf, buildStatementPdf, downloadElementAsPdf } from "./pdf";

const actionButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 };

const BUILDERS = { invoice: buildInvoicePdf, receipt: buildReceiptPdf, statement: buildStatementPdf };

// Print and Download are deliberately separate actions: Print hands off to the browser's own
// print dialog (which renders the on-screen HTML — vector, selectable — to paper or "Save as
// PDF"); Download generates a purpose-built vector PDF from the document data via the matching
// builder in pdf.js — logos, an "Issued by" block, page-safe tables, and PDF metadata.
//
// `kind` + `doc` drive the builder. `targetId` / `filename` remain as a fallback (old
// html2canvas element-snapshot) for anything that hasn't been migrated, and as a safety net if
// a builder throws.
export default function DocumentActions({ kind, doc, targetId, filename }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const builder = kind && BUILDERS[kind];
      if (builder && doc) {
        await builder(doc);
      } else if (targetId) {
        await downloadElementAsPdf(targetId, filename || "document.pdf");
      } else {
        throw new Error("Nothing to download");
      }
    } catch {
      // Last-ditch fallback to the element snapshot, if we have a target for it.
      if (targetId) {
        try {
          await downloadElementAsPdf(targetId, filename || "document.pdf");
          return;
        } catch { /* fall through to the toast */ }
      }
      toast.error("Could not generate the PDF. You can still use Print instead.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button type="button" onClick={() => window.print()} style={actionButtonStyle}><PrintIcon sx={{ fontSize: 16 }} />Print</button>
      <button type="button" onClick={download} disabled={downloading} style={{ ...actionButtonStyle, opacity: downloading ? 0.6 : 1, cursor: downloading ? "default" : "pointer" }}><DownloadIcon sx={{ fontSize: 16 }} />{downloading ? "Preparing…" : "Download PDF"}</button>
    </div>
  );
}
