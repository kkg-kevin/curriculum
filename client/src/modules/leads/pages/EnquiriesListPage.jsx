import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import {
  MarkEmailUnread as MarkEmailUnreadIcon,
  ErrorOutlineRounded as ErrorOutlineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as LinkIcon,
} from "@mui/icons-material";
import {
  useLeadsQuery,
  useUpdateLeadStatus,
  useLeadTimeline,
  useReplyToLead,
  useAddLeadNote,
} from "../hooks/useLeads";

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

const REFERENCE_TYPE_LABELS = { bootcamp: "Bootcamp", project: "Project", pathway: "Pathway" };

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "capitalize", background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

// The reply/note thread for one lead — fetched lazily, only while its card is expanded.
function LeadThread({ leadId }) {
  const { data, isLoading } = useLeadTimeline(leadId, true);
  const replyMutation = useReplyToLead();
  const noteMutation = useAddLeadNote();
  const [mode, setMode] = useState("reply"); // "reply" | "note"
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (mode === "reply") {
      replyMutation.mutate(
        { id: leadId, subject: subject.trim(), body: body.trim() },
        { onSuccess: () => { setSubject(""); setBody(""); } }
      );
    } else {
      noteMutation.mutate({ id: leadId, body: body.trim() }, { onSuccess: () => setBody("") });
    }
  };

  const sending = replyMutation.isPending || noteMutation.isPending;

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #E5E7EB" }}>
      {isLoading ? (
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>Loading thread…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {(data?.messages || []).length === 0 ? (
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>No replies or notes yet.</div>
          ) : (
            data.messages.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  background: m.direction === "note" ? "#FFFBEB" : "#EFF6FF",
                  border: "1px solid " + (m.direction === "note" ? "#FDE68A" : "#BFDBFE"),
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <strong style={{ color: m.direction === "note" ? "#92400E" : "#1E40AF" }}>
                    {m.direction === "note" ? "Internal note" : `Reply${m.subject ? `: ${m.subject}` : ""}`}
                  </strong>
                  <span style={{ color: "#9CA3AF" }}>{formatDateTime(m.createdAt)}</span>
                </div>
                <p style={{ margin: 0, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.body}</p>
              </div>
            ))
          )}
        </div>
      )}

      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["reply", "note"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                border: "1px solid " + (mode === m ? "#25476a" : "#D7DEE8"),
                background: mode === m ? "#25476a" : "#fff",
                color: mode === m ? "#fff" : "#374151",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {m === "reply" ? "Reply by email" : "Internal note"}
            </button>
          ))}
        </div>
        {mode === "reply" && (
          <input
            type="text"
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={inputStyle}
          />
        )}
        <textarea
          placeholder={mode === "reply" ? "Write a reply to be emailed to the enquirer…" : "Add a follow-up note (not emailed)…"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
        <div>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              background: sending || !body.trim() ? "#B8C8D5" : "#25476a",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: sending || !body.trim() ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {sending ? "Sending…" : mode === "reply" ? "Send reply" : "Save note"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeadRow({ lead, highlighted, rowRef }) {
  const updateStatus = useUpdateLeadStatus();
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      ref={rowRef}
      style={{
        padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
        backgroundColor: highlighted ? "#FEF9E7" : "transparent",
        transition: "background-color 600ms ease",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.6fr) minmax(160px, 1fr) auto auto auto", alignItems: "start", gap: 16 }}>
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
          {lead.reference && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "#2e7db5" }}>
              <LinkIcon sx={{ fontSize: 14 }} />
              Enquired from: <strong>{lead.reference.referenceName}</strong>
              <span style={{ color: "#9CA3AF" }}>({REFERENCE_TYPE_LABELS[lead.reference.referenceType] || lead.reference.referenceType})</span>
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
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "6px 10px",
            borderRadius: 8, border: "1px solid #D7DEE8", background: "#fff",
            color: "#25476a", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
          {expanded ? "Hide" : "Reply / Notes"}
        </button>
      </div>
      {expanded && <LeadThread leadId={lead.id} />}
    </div>
  );
}

export default function EnquiriesListPage() {
  const [status, setStatus] = useState("");
  const { data: leads = [], isLoading, isError, error } = useLeadsQuery(status ? { status } : {});

  // ?lead=<id> — set when arriving from a "New enquiry" notification. Scroll that row into view
  // and flash it. Cleared from the URL once handled so a manual refresh doesn't re-trigger.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusLeadId = searchParams.get("lead");
  const [flashId, setFlashId] = useState(null);
  const focusRowRef = useRef(null);

  useEffect(() => {
    if (!focusLeadId || isLoading) return;
    const exists = leads.some((l) => l.id === focusLeadId);
    if (exists) {
      setFlashId(focusLeadId);
      // let the row render before scrolling to it
      requestAnimationFrame(() => focusRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      const t = setTimeout(() => setFlashId(null), 2500);
      setSearchParams({}, { replace: true });
      return () => clearTimeout(t);
    }
    // The lead isn't in the current (filtered) view — drop back to "All" so it can show.
    if (status) setStatus("");
  }, [focusLeadId, isLoading, leads, status, setSearchParams]);

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
          leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              highlighted={lead.id === flashId}
              rowRef={lead.id === flashId ? focusRowRef : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
