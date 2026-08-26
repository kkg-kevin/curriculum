import { formatAddress } from "./shared";

// Reused as-is on Invoice, Receipt, and Statement documents (only the `label` differs — "Bill to"
// / "Received from" / "Statement for") so a payer's identity always reads identically wherever
// it appears, on screen and on the printed document.
export default function BillToCard({ billTo, label = "Bill to" }) {
  if (!billTo) return null;
  const address = formatAddress(billTo.address);
  return (
    <section style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 22px" }}>
      <div style={{ color: "#9CA3AF", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{billTo.name || "Not provided"}</div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#6B7280", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        {billTo.email && <span>{billTo.email}</span>}
        {billTo.phone && <span>{billTo.phone}</span>}
        {address && <span>{address}</span>}
      </div>
    </section>
  );
}
