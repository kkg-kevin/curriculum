import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiAward, FiExternalLink, FiSearch } from "react-icons/fi";
import { useAllCertificates, useRevokeCertificate, useReinstateCertificate } from "../hooks/useCertificates";
import { certificateFields, formatCertificateDate, verifyUrl, KIND_LABELS } from "../utils/certificate";

const T = {
  accent: "#25476a", accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
const th = { padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
const td = { padding: "12px", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.ink, verticalAlign: "top" };
const select = { padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 13, fontFamily: "Inter, sans-serif", color: T.ink };
const smallBtn = (color) => ({ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", color, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" });

// Revoking by hand always asks why: the reason is kept with the certificate, and marks it as a
// deliberate decision that nothing reinstates automatically.
function RevokeDialog({ certificate, isPending, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const c = certificateFields(certificate);
  const ready = reason.trim().length >= 3;
  return (
    <div role="dialog" aria-modal="true" aria-label="Revoke certificate" style={{ position: "fixed", inset: 0, zIndex: 1300, backgroundColor: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 460, padding: 24, fontFamily: "Inter, sans-serif" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: T.ink }}>Revoke this certificate?</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T.inkMuted, lineHeight: 1.55 }}>
          {c.number} — {c.learnerName}, {c.title}. Its verification link will say it has been withdrawn, and it disappears from the learner's profile.
          {c.kind === "course" && " Any pathway or bootcamp certificate earned on it is revoked too."}
        </p>
        <label htmlFor="revoke-reason" style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Reason (kept on record, not shown publicly)</label>
        <textarea
          id="revoke-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={300}
          autoFocus
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={smallBtn(T.inkMuted)}>Cancel</button>
          <button
            type="button"
            disabled={!ready || isPending}
            onClick={() => onConfirm(reason.trim())}
            style={{ ...smallBtn("#fff"), background: "#DC2626", borderColor: "#DC2626", opacity: !ready || isPending ? 0.55 : 1, cursor: !ready || isPending ? "default" : "pointer" }}
          >
            {isPending ? "Revoking…" : "Revoke certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Every certificate issued in the workspace (admin) or at this hub (school) — who completed
 * what, and when. Reached from the Reports page. Filter by hub, kind, status or a search; open
 * any certificate's public verification page; revoke one by hand, or reinstate it.
 *
 * `backTo` is the Reports page this was opened from.
 */
export default function CertificatesListPage({ backTo = "/reports" }) {
  const navigate = useNavigate();
  // One fetch, filtered here: a workspace's certificates are few enough that filtering in the
  // browser keeps the hub list and the counts stable while the filters change.
  const { data: certificates = [], isLoading, isError } = useAllCertificates({});
  const { mutate: revoke, isPending: revoking } = useRevokeCertificate();
  const { mutate: reinstate, isPending: reinstating } = useReinstateCertificate();

  const [hubId, setHubId] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);

  const hubs = useMemo(() => {
    const byId = new Map();
    certificates.forEach((c) => { if (c.hubId) byId.set(c.hubId, c.snapshot?.hubName || "Learning hub"); });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [certificates]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const c = certificateFields(certificate);
      if (hubId && certificate.hubId !== hubId) return false;
      if (kind && c.kind !== kind) return false;
      if (status && c.status !== status) return false;
      if (q && ![c.number, c.learnerName, c.title, c.hubName].some((v) => String(v).toLowerCase().includes(q))) return false;
      return true;
    });
  }, [certificates, hubId, kind, status, query]);

  const issuedCount = certificates.filter((c) => c.status === "issued").length;
  const revokedCount = certificates.length - issuedCount;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "24px 32px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <button type="button" onClick={() => navigate(backTo)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, color: "rgba(255,255,255,0.8)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            <FiArrowLeft size={14} /> Reports
          </button>
          <h1 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Certificates</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 640 }}>
            Every certificate of completion issued here. A course certificate is issued when a learner's final course report is published; pathway and bootcamp certificates follow once all of their courses are complete.
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 11, top: 10 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by learner, course or certificate number"
            aria-label="Search certificates"
            style={{ ...select, width: "100%", boxSizing: "border-box", paddingLeft: 32 }}
          />
        </div>
        {hubs.length > 1 && (
          <select value={hubId} onChange={(e) => setHubId(e.target.value)} aria-label="Learning hub" style={select}>
            <option value="">All learning hubs</option>
            {hubs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" style={select}>
          <option value="">All kinds</option>
          {Object.entries(KIND_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" style={select}>
          <option value="">Valid and revoked</option>
          <option value="issued">Valid</option>
          <option value="revoked">Revoked</option>
        </select>
        <span style={{ fontSize: 12.5, color: T.inkMuted, marginLeft: "auto", whiteSpace: "nowrap" }}>
          {issuedCount} valid{revokedCount > 0 ? ` · ${revokedCount} revoked` : ""}
        </span>
      </div>

      <div style={{ ...cardStyle, padding: "6px 8px 10px" }}>
        {isLoading ? (
          <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 13, color: T.inkFaint }}>Loading…</p>
        ) : isError ? (
          <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 13, color: "#B91C1C" }}>Couldn't load certificates — try refreshing the page.</p>
        ) : certificates.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <FiAward size={28} color={T.inkFaint} />
            <h3 style={{ margin: "10px 0 6px", fontSize: 16, fontWeight: 700, color: T.ink }}>No certificates yet</h3>
            <p style={{ margin: 0, fontSize: 13, color: T.inkMuted }}>The first one is issued when a learner's final course report is published.</p>
          </div>
        ) : visible.length === 0 ? (
          <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 13, color: T.inkMuted }}>No certificates match these filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Number</th>
                  <th style={th}>Learner</th>
                  <th style={th}>Completed</th>
                  <th style={th}>Learning hub</th>
                  <th style={th}>Awarded</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((certificate) => {
                  const c = certificateFields(certificate);
                  const revoked = c.status === "revoked";
                  return (
                    <tr key={certificate.id}>
                      <td style={{ ...td, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 700 }}>{c.number}</td>
                      <td style={td}>{c.learnerName}</td>
                      <td style={td}>
                        {c.title}
                        <span style={{ display: "block", fontSize: 11.5, color: T.inkFaint, marginTop: 2 }}>{c.kindLabel}</span>
                      </td>
                      <td style={td}>{c.hubName || "—"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{formatCertificateDate(c.issuedAt)}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", color: revoked ? "#B91C1C" : "#047857", backgroundColor: revoked ? "#FEF2F2" : "#ECFDF5" }}>
                          {revoked ? "Revoked" : "Valid"}
                        </span>
                        {revoked && (
                          <span style={{ display: "block", fontSize: 11.5, color: T.inkMuted, marginTop: 5, maxWidth: 220 }}>
                            {c.revokeReason || (c.kind === "course" ? "Its final report was withdrawn." : "A course certificate it was earned on was revoked.")}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <a href={verifyUrl(c.verifyToken)} target="_blank" rel="noopener noreferrer" style={{ ...smallBtn(T.accent), display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                            <FiExternalLink size={13} /> Open
                          </a>
                          {revoked ? (
                            <button type="button" disabled={reinstating} onClick={() => reinstate(certificate.id)} style={smallBtn(T.accent)}>Reinstate</button>
                          ) : (
                            <button type="button" onClick={() => setRevokeTarget(certificate)} style={smallBtn("#B91C1C")}>Revoke</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {revokeTarget && (
        <RevokeDialog
          certificate={revokeTarget}
          isPending={revoking}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={(reason) => revoke({ id: revokeTarget.id, reason }, { onSuccess: () => setRevokeTarget(null) })}
        />
      )}
    </div>
  );
}
