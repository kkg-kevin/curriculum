import { useMemo, useState } from "react";
import { CircularProgress } from "@mui/material";
import { MarkEmailUnread as MarkEmailUnreadIcon, ErrorOutlineRounded as ErrorOutlineIcon } from "@mui/icons-material";
import { useLeadsQuery, useUpdateLeadStatus } from "../hooks/useLeads";

const cardStyle = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14 };
const inputStyle = { padding: "8px 10px", border: "1px solid #D7DEE8", borderRadius: 8, fontSize: 13, fontFamily: "inherit" };

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

const STATUS_COLORS = {
  new: { bg: "#FEF3C7", fg: "#92400E" },
  contacted: { bg: "#DBEAFE", fg: "#1E40AF" },
  closed: { bg: "#DCFCE7", fg: "#166534" },
};

const SOURCE_LABELS = { enroll: "Enrol interest", contact: "Contact form" };

const INTEREST_LABELS = {
  bootcamp: "A bootcamp",
  project: "A project / course",
  quarky: "The Quarky robot",
  general: "Not sure yet",
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "capitalize", background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

function LeadRow({ lead }) {
  const updateStatus = useUpdateLeadStatus();
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "minmax(200px, 1.6fr) minmax(160px, 1fr) auto auto", alignItems: "start", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 13, color: "#111827" }}>{lead.name}</strong>
          <span style={{ fontSize: 11, color: "#6B7280" }}>· {SOURCE_LABELS[lead.source] || lead.source}</span>
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          {lead.email} {lead.phone && <>· {lead.phone}</>}
        </div>
        {lead.source === "enroll" && (
          <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>
            Learner: <strong>{lead.learnerName || "—"}</strong>{lead.learnerAge ? ` (age ${lead.learnerAge})` : ""}
            {lead.interestedIn && <> · {INTEREST_LABELS[lead.interestedIn] || lead.interestedIn}</>}
          </div>
        )}
        {lead.message && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4B5563", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{lead.message}</p>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{formatDateTime(lead.createdAt)}</div>
      <StatusBadge status={lead.status} />
      <select
        value={lead.status}
        onChange={(e) => updateStatus.mutate({ id: lead.id, status: e.target.value })}
        disabled={updateStatus.isPending}
        style={{ ...inputStyle, cursor: "pointer" }}
      >
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}

export default function EnquiriesListPage() {
  const [status, setStatus] = useState("");
  const { data: leads = [], isLoading, isError, error } = useLeadsQuery(status ? { status } : {});

  const stats = useMemo(() => ({
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
  }), [leads]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#111827" }}>
      <div style={{ background: "linear-gradient(135deg, #142F4A 0%, #25476a 48%, #2e7db5 100%)", borderRadius: 18, padding: "26px 28px", marginBottom: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "#9BD7F2", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>
          <MarkEmailUnreadIcon sx={{ fontSize: 16 }} /> Public site
        </div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900 }}>Enquiries</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.75)" }}>
          Enrolment interest and contact messages submitted on digifunzi.com.
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EEF1F5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>All enquiries</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
              {stats.total} total {stats.new > 0 && <span style={{ color: "#92400E", fontWeight: 700 }}>· {stats.new} new</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid " + (status === tab.value ? "#25476a" : "#D7DEE8"),
                  background: status === tab.value ? "#25476a" : "#fff",
                  color: status === tab.value ? "#fff" : "#374151",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 20px", color: "#6B7280" }}>
            <CircularProgress size={28} thickness={4} sx={{ color: "#38aae1" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Loading enquiries…</span>
          </div>
        ) : isError ? (
          <div style={{ padding: "42px 20px", textAlign: "center" }}>
            <ErrorOutlineIcon sx={{ fontSize: 34, color: "#F0A5A5" }} />
            <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: "#B91C1C" }}>Failed to load enquiries</p>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#9CA3AF" }}>{error?.message}</p>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: "42px 20px", textAlign: "center" }}>
            <MarkEmailUnreadIcon sx={{ fontSize: 36, color: "#B8C8D5" }} />
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color: "#374151" }}>
              {status ? `No ${status} enquiries` : "No enquiries yet"}
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#9CA3AF" }}>Enrol and contact submissions from digifunzi.com appear here.</p>
          </div>
        ) : (
          leads.map((lead) => <LeadRow key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
