import { BRAND_NAME, BRAND_LOGO_DARK_BG, BRAND_LOGO_DARK_BG_FILTER } from "../../../branding";

// Printed financial documents (Invoice/Receipt/Statement) carry the brand mark, same as any
// real invoicing system — same white/inverted treatment already used on the dark sidebar, since
// it sits on the same navy gradient header here.
export default function BrandMark() {
  return <img src={BRAND_LOGO_DARK_BG} alt={BRAND_NAME} style={{ height: 22, width: "auto", objectFit: "contain", filter: BRAND_LOGO_DARK_BG_FILTER, opacity: 0.92 }} />;
}
