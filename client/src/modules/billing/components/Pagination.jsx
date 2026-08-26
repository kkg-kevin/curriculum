import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "@mui/icons-material";

const buttonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "1px solid #E5E7EB", borderRadius: 7, background: "#fff", color: "#374151", cursor: "pointer", fontFamily: "inherit" };

// Shared page-flip control for anything that would otherwise render an unbounded list on one
// page (invoice list, statement ledger) — keeps every billing view a short, scannable read
// regardless of how much history has accumulated.
export default function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 20px", borderTop: "1px solid #F3F4F6" }}>
      <button type="button" className="no-print" disabled={page <= 1} onClick={() => onChange(page - 1)} style={{ ...buttonStyle, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "default" : "pointer" }} aria-label="Previous page"><ChevronLeftIcon sx={{ fontSize: 18 }} /></button>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Page {page} of {pageCount}</span>
      <button type="button" className="no-print" disabled={page >= pageCount} onClick={() => onChange(page + 1)} style={{ ...buttonStyle, opacity: page >= pageCount ? 0.4 : 1, cursor: page >= pageCount ? "default" : "pointer" }} aria-label="Next page"><ChevronRightIcon sx={{ fontSize: 18 }} /></button>
    </div>
  );
}
