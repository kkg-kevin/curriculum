import logo from "../../../assets/Logo-image.png";

// Printed financial documents (Invoice/Receipt/Statement) carry the Digifunzi mark, same as any
// real invoicing system — same white/inverted treatment already used on the dark sidebar, since
// it sits on the same navy gradient header here.
export default function BrandMark() {
  return <img src={logo} alt="Digifunzi" style={{ height: 22, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.92 }} />;
}
