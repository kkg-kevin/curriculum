import { FiExternalLink, FiNavigation } from "react-icons/fi";

// The household's Google Maps link and up to two photos that help the educator find the home.
// Renders nothing when neither is recorded.
export default function HomeLocation({ mapUrl, photos = [] }) {
  const images = Array.isArray(photos) ? photos : [];
  if (!mapUrl && images.length === 0) return null;
  return <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
    {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#1D4ED8", border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
      <FiNavigation /> Open in Google Maps <FiExternalLink size={11} />
    </a>}
    {images.map((url, index) => <a key={url + index} href={url} target="_blank" rel="noopener noreferrer" title={`Location photo ${index + 1}`}>
      <img src={url} alt={`Location photo ${index + 1}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB", display: "block" }} />
    </a>)}
  </div>;
}
