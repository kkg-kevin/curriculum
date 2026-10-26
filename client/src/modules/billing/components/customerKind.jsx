// B2B / B2C on billing: an invoice billed to an organisation (a learning hub or school) is
// business (B2B), one billed to a person (a parent, household or website buyer) is a family (B2C).
// The server works it out from the payer (billing.service.js's customerKindOf) and sends it as
// `customerKind` on every invoice, receipt and customer.

export const CUSTOMER_KINDS = {
  b2b: { label: "Business", short: "B2B", hint: "Learning hubs and schools", color: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
  b2c: { label: "Families", short: "B2C", hint: "Parents, households and website buyers", color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
};

export const matchesKind = (kind, value) => kind === "all" || value === kind;

export function KindPill({ kind }) {
  const k = CUSTOMER_KINDS[kind];
  if (!k) return null;
  return (
    <span title={k.hint} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", color: k.color, background: k.bg, border: `1px solid ${k.border}`, borderRadius: 999, padding: "2px 7px", whiteSpace: "nowrap" }}>
      {k.short}
    </span>
  );
}

// All | Business (B2B) | Families (B2C), each with how many there are.
export function KindSwitch({ value, onChange, counts = {} }) {
  const options = [
    { key: "all", label: "All customers", hint: "Business and families" },
    { key: "b2b", label: `${CUSTOMER_KINDS.b2b.label} (B2B)`, hint: CUSTOMER_KINDS.b2b.hint, color: CUSTOMER_KINDS.b2b.color },
    { key: "b2c", label: `${CUSTOMER_KINDS.b2c.label} (B2C)`, hint: CUSTOMER_KINDS.b2c.hint, color: CUSTOMER_KINDS.b2c.color },
  ];
  return (
    <div role="tablist" aria-label="Business or families" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = value === o.key;
        const color = o.color || "#25476a";
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            style={{ textAlign: "left", padding: "9px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? color : "#E5E7EB"}`, background: active ? color : "#fff", color: active ? "#fff" : "#374151", minWidth: 150 }}
          >
            <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{o.label}{counts[o.key] != null && <span style={{ opacity: 0.75 }}> ({counts[o.key]})</span>}</span>
            <span style={{ display: "block", fontSize: 11, marginTop: 1, color: active ? "rgba(255,255,255,.8)" : "#6B7280" }}>{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
