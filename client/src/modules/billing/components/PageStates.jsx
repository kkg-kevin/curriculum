import { CircularProgress } from "@mui/material";
import { ErrorOutlineRounded as ErrorOutlineIcon } from "@mui/icons-material";
import { cardStyle } from "./shared";

// A real spinner, not the plain "Loading…" text every billing page used to show independently —
// consistent with how Settings' catalog panels already load.
export function LoadingState({ label = "Loading…", inline = false }) {
  const content = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: inline ? "42px 20px" : "64px 20px", color: "#6B7280" }}>
      <CircularProgress size={28} thickness={4} sx={{ color: "#38aae1" }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </div>
  );
  return inline ? <section style={cardStyle}>{content}</section> : content;
}

export function ErrorState({ label = "Something went wrong.", detail }) {
  return (
    <section style={{ ...cardStyle, padding: "42px 20px", textAlign: "center" }}>
      <ErrorOutlineIcon sx={{ fontSize: 34, color: "#F0A5A5" }} />
      <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>{label}</p>
      {detail && <p style={{ margin: "5px 0 0", fontSize: 12, color: "#9CA3AF" }}>{detail}</p>}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ padding: "42px 20px", textAlign: "center" }}>
      {Icon && <Icon sx={{ fontSize: 36, color: "#B8C8D5", marginBottom: 1 }} />}
      <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "#374151" }}>{title}</p>
      {subtitle && <p style={{ margin: "5px 0 0", fontSize: 12, color: "#9CA3AF", maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}
