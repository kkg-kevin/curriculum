import { useState } from "react";
import toast from "react-hot-toast";
import { Print as PrintIcon, Download as DownloadIcon } from "@mui/icons-material";
import { downloadElementAsPdf } from "./pdf";

const actionButtonStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 };

// Print and Download are deliberately separate actions: Print hands off to the browser's own
// print dialog (pick a printer, or "Save as PDF" there); Download generates and saves an actual
// .pdf file directly, no dialog involved — see pdf.js.
export default function DocumentActions({ targetId, filename }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadElementAsPdf(targetId, filename);
    } catch {
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
