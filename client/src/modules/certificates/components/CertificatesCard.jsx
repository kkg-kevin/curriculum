import { Link } from "react-router-dom";
import { FiAward, FiChevronRight } from "react-icons/fi";
import { certificateFields, formatCertificateDate } from "../utils/certificate";

const ACCENT = "#25476a";
const GOLD = "#feb139";
const INK = "#111827";
const INK_MUTED = "#6B7280";
const INK_FAINT = "#9CA3AF";
const BORDER = "#E5E7EB";

/**
 * The list of certificates a learner holds — on their own profile, on the staff view of them,
 * and on the shared public profile. Takes the certificates and how to open one (`hrefFor`), so
 * it carries no data fetching of its own.
 *
 *  - hrefFor(certificate) → where a row leads; `newTab` opens it in a new tab (the public
 *    verification page, from places that aren't the learner's own portal)
 *  - showRevoked: staff see revoked certificates too, marked as such; a row for one isn't a link
 *  - emptyText: shown when there are none
 */
export default function CertificatesCard({ certificates = [], isLoading = false, hrefFor, newTab = false, showRevoked = false, emptyText, title = "Certificates", style }) {
  const visible = showRevoked ? certificates : certificates.filter((c) => (c.status || "issued") === "issued");

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: 20, fontFamily: "Inter, sans-serif", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <FiAward size={15} color={GOLD} />
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
        {visible.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: INK_FAINT }}>{visible.length}</span>}
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: INK_FAINT }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: INK_MUTED, lineHeight: 1.5 }}>
          {emptyText || "No certificates yet. One is awarded for each course, pathway or bootcamp completed."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((certificate) => {
            const c = certificateFields(certificate);
            const revoked = c.status === "revoked";
            const href = !revoked && hrefFor ? hrefFor(certificate) : null;
            // A new-tab row is a plain link (it leaves the app's layout); an in-app one uses the router.
            const Row = !href ? "div" : newTab ? "a" : Link;
            const linkProps = !href ? {} : newTab ? { href, target: "_blank", rel: "noopener noreferrer" } : { to: href };
            return (
              <Row
                key={c.number}
                {...linkProps}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                  border: `1px solid ${BORDER}`, textDecoration: "none", color: "inherit",
                  backgroundColor: revoked ? "#F9FAFB" : "#FFFDF8", opacity: revoked ? 0.75 : 1,
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: revoked ? "#F3F4F6" : "#FEF3E2", color: revoked ? INK_FAINT : "#B45309", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FiAward size={18} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.title}
                    {/* A pathway or bootcamp certificate says so; a course one is the default. */}
                    {c.kind !== "course" && (
                      <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: ACCENT, backgroundColor: "#e8f5fb", borderRadius: 20, padding: "2px 8px", verticalAlign: "middle" }}>{c.kindLabel}</span>
                    )}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: INK_MUTED }}>
                    {[formatCertificateDate(c.issuedAt), c.hubName, c.number].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {revoked ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#B91C1C", backgroundColor: "#FEF2F2", borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>Revoked</span>
                ) : (
                  href && <FiChevronRight size={18} color={ACCENT} style={{ flexShrink: 0 }} />
                )}
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}
