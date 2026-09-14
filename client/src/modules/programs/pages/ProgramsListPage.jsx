import { useNavigate } from "react-router-dom";
import { FiFlag, FiAward, FiAlertTriangle, FiEye, FiEyeOff } from "react-icons/fi";
import { useCompetitionsQuery } from "../../competitions/hooks/useCompetitions";
import { useBootcampsQuery } from "../../bootcamps/hooks/useBootcamps";

const COMP_STATUS = {
  draft:  { bg: "#F3F4F6", fg: "#6B7280", label: "Draft" },
  open:   { bg: "#DCFCE7", fg: "#15803D", label: "Open" },
  closed: { bg: "#FEE2E2", fg: "#B91C1C", label: "Closed" },
};
const FORMAT_LABEL = { individual: "Individual", pairs: "Pairs", team: "Team" };
const BOOTCAMP_FORMAT_LABEL = { holiday: "Holiday", weekend: "Weekend", after_school: "After school", online: "Online" };

function formatBootcampPrice(b) {
  if (b.priceAmount == null) return "Enquire for pricing";
  return `${b.priceCurrency || "KES"} ${Number(b.priceAmount).toLocaleString()}`;
}

function formatDateRange(item) {
  if (!item.startDate) return "";
  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return item.endDate ? `${fmt(item.startDate)} – ${fmt(item.endDate)}` : fmt(item.startDate);
}

function SectionHeader({ title, hint, actionLabel, onAction }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
      <div>
        <h2 style={{ margin: "0 0 3px", fontSize: 17, fontWeight: 800, color: "#111827" }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, maxWidth: 560 }}>{hint}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> {actionLabel}
      </button>
    </div>
  );
}

function ErrorRow({ label, message }) {
  return (
    <div style={{ padding: "16px 20px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, color: "#EF4444", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <FiAlertTriangle size={15} /> Failed to load {label}: {message}
    </div>
  );
}

function CompetitionCard({ competition, onOpen }) {
  const s = COMP_STATUS[competition.status] || COMP_STATUS.draft;
  const trackCount = competition.trackCount ?? (competition.tracks?.length || 0);
  const live = competition.isPublic && competition.status !== "draft";
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ textAlign: "left", backgroundColor: "#ffffff", borderRadius: 16, padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB", cursor: "pointer", fontFamily: "Inter, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ height: 96, background: competition.coverImage ? `center / cover no-repeat url(${competition.coverImage})` : "linear-gradient(135deg, #1a3550, #2e7db5)", position: "relative" }}>
        <span title={live ? "On the website" : "Not published"} style={{ position: "absolute", top: 10, right: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.92)", color: live ? "#15803D" : "#9CA3AF" }}>
          {live ? <FiEye size={13} /> : <FiEyeOff size={13} />}
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#111827", lineHeight: 1.35 }}>{competition.name}</h3>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, backgroundColor: s.bg, color: s.fg, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{s.label}</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", marginTop: "auto" }}>
          {[competition.edition, competition.format && FORMAT_LABEL[competition.format], `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`, formatDateRange(competition), competition.curriculumName].filter(Boolean).join(" · ")}
        </p>
      </div>
    </button>
  );
}

function BootcampCard({ bootcamp, onOpen }) {
  const live = bootcamp.saleStatus === "for_sale";
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ textAlign: "left", backgroundColor: "#ffffff", borderRadius: 16, padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1.5px solid #E5E7EB", cursor: "pointer", fontFamily: "Inter, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ height: 96, background: bootcamp.coverImage ? `center / cover no-repeat url(${bootcamp.coverImage})` : "linear-gradient(135deg, #1a3550, #2e7db5)", position: "relative" }}>
        <span title={live ? "On the website" : "Not published"} style={{ position: "absolute", top: 10, right: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.92)", color: live ? "#15803D" : "#9CA3AF" }}>
          {live ? <FiEye size={13} /> : <FiEyeOff size={13} />}
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#111827", lineHeight: 1.35 }}>{bootcamp.name}</h3>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", marginTop: "auto" }}>
          {[bootcamp.format && BOOTCAMP_FORMAT_LABEL[bootcamp.format], formatBootcampPrice(bootcamp), formatDateRange(bootcamp), bootcamp.curriculumName].filter(Boolean).join(" · ")}
        </p>
      </div>
    </button>
  );
}

export default function ProgramsListPage() {
  const navigate = useNavigate();
  const {
    data: competitions = [],
    isLoading: loadingComps,
    isError: compsError,
    error: compsErr,
  } = useCompetitionsQuery();
  const {
    data: bootcamps = [],
    isLoading: loadingBootcamps,
    isError: bootcampsError,
    error: bootcampsErr,
  } = useBootcampsQuery();

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Programs
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5, maxWidth: 560 }}>
              Competitions and bootcamps — their dates, their registration windows, and the hubs that run them.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => navigate("/events/competitions/create")}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}
            >
              <FiFlag size={14} /> New Competition
            </button>
            <button
              type="button"
              onClick={() => navigate("/events/bootcamps/create")}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <FiAward size={14} /> New Bootcamp
            </button>
          </div>
        </div>
      </div>

      {/* ── Competitions ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <SectionHeader
          title="Competitions"
          hint="Editions with tracks and a registration window. Link one to a curriculum or let it stand alone. Publish it to feature it on the website."
          actionLabel="New Competition"
          onAction={() => navigate("/events/competitions/create")}
        />
        {loadingComps ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ height: 96, backgroundColor: "#F3F4F6" }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 14, width: "70%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  <div style={{ height: 10, width: "45%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        ) : compsError ? (
          <ErrorRow label="competitions" message={compsErr?.message} />
        ) : competitions.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 14, border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "1.5px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", flexShrink: 0 }}>
              <FiFlag size={20} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>No competitions yet</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>
                Create one — an edition with its tracks and a registration window.{" "}
                <button type="button" onClick={() => navigate("/events/competitions/create")} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>+ New Competition</button>
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {competitions.map((c) => (
              <CompetitionCard key={c.id} competition={c} onOpen={() => navigate(`/events/competitions/${c.id}/view`)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bootcamps ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="Bootcamps"
          hint="Sellable listings for the public website. Link one to a curriculum or let it stand alone."
          actionLabel="New Bootcamp"
          onAction={() => navigate("/events/bootcamps/create")}
        />
        {loadingBootcamps ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ height: 96, backgroundColor: "#F3F4F6" }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ height: 14, width: "70%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  <div style={{ height: 10, width: "45%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        ) : bootcampsError ? (
          <ErrorRow label="bootcamps" message={bootcampsErr?.message} />
        ) : bootcamps.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 14, border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "1.5px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", flexShrink: 0 }}>
              <FiAward size={20} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>No bootcamps yet</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>
                Create one — a sellable listing for the public website.{" "}
                <button type="button" onClick={() => navigate("/events/bootcamps/create")} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "Inter, sans-serif", padding: 0 }}>+ New Bootcamp</button>
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {bootcamps.map((b) => (
              <BootcampCard key={b.id} bootcamp={b} onOpen={() => navigate(`/events/bootcamps/${b.id}/view`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
