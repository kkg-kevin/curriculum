import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiAward, FiPlus, FiEye, FiEyeOff, FiAlertTriangle } from "react-icons/fi";
import { useBootcampsQuery } from "../hooks/useBootcamps";

const FORMAT_LABEL = { holiday: "Holiday", weekend: "Weekend", after_school: "After school", online: "Online" };

function formatPrice(b) {
  if (b.priceAmount == null) return "Enquire for pricing";
  return `${b.priceCurrency || "KES"} ${Number(b.priceAmount).toLocaleString()}`;
}

/**
 * The "Bootcamps" section shown inside an Event (on its curriculum view, and on a
 * deployment's view). Bootcamps are their own module server-side and on the public website;
 * on the admin side they're only reachable from inside an Event.
 *
 * `curriculumId` is the Event's `curricula.id` — it's both what a bootcamp's `eventId`
 * links to AND the `:eventId` route segment for the nested bootcamp pages.
 * `variant` tweaks the outer card to match the surrounding page ("plain" card on
 * EventViewPage, bordered like the other sections on CurriculumViewPage).
 */
export default function EventBootcampsSection({ curriculumId, variant = "card" }) {
  const navigate = useNavigate();
  const { data: bootcamps = [], isLoading, isError, error } = useBootcampsQuery(
    curriculumId ? { eventId: curriculumId } : undefined,
  );

  const createPath = `/events/bootcamps/create?eventId=${curriculumId}`;
  const viewPath = (id) => `/events/bootcamps/${id}/view`;

  const outerStyle =
    variant === "bordered"
      ? { backgroundColor: "#ffffff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "16px 20px", marginBottom: 20 }
      : { backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 };
  const titleStyle =
    variant === "bordered"
      ? { margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#111827" }
      : { margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" };
  const subStyle =
    variant === "bordered"
      ? { margin: 0, fontSize: 11, color: "#9CA3AF" }
      : { margin: 0, fontSize: 13, color: "#6B7280" };

  return (
    <div style={outerStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h2 style={titleStyle}>Bootcamps</h2>
          <p style={subStyle}>
            Sellable listings for the public website. Publish one to feature it on africa.digifunzi.com/bootcamps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(createPath)}
          disabled={!curriculumId}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: variant === "bordered" ? 8 : 10, border: "none", backgroundColor: !curriculumId ? "#e5e7eb" : variant === "bordered" ? "#25476a" : "#feb139", color: variant === "bordered" ? "#ffffff" : "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: curriculumId ? "pointer" : "not-allowed", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          <FiPlus size={13} /> New Bootcamp
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((n) => (
              <div key={n} style={{ height: 48, borderRadius: 10, backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6" }} />
            ))}
          </div>
        ) : isError ? (
          <div style={{ padding: "12px 16px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 10, color: "#EF4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <FiAlertTriangle size={14} /> Couldn’t load bootcamps: {error?.message}
          </div>
        ) : bootcamps.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "1.5px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", flexShrink: 0 }}>
              <FiAward size={17} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#374151" }}>No bootcamps in this event yet</p>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280" }}>
                Add one with{" "}
                <button type="button" onClick={() => navigate(createPath)} disabled={!curriculumId} style={{ background: "none", border: "none", color: "#25476a", fontWeight: 600, cursor: curriculumId ? "pointer" : "not-allowed", fontSize: 12.5, fontFamily: "Inter, sans-serif", padding: 0 }}>+ New Bootcamp</button>.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bootcamps.map((b) => {
              const live = b.saleStatus === "for_sale";
              return (
                <div
                  key={b.id}
                  onClick={() => navigate(viewPath(b.id))}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F9FAFB"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span title={live ? "On the website" : "Not published"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: live ? "#EEF6FC" : "#F3F4F6", color: live ? "#15803D" : "#9CA3AF", flexShrink: 0 }}>
                      {live ? <FiEye size={14} /> : <FiEyeOff size={14} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                        {[b.format && FORMAT_LABEL[b.format], formatPrice(b)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <FiArrowRight size={14} strokeWidth={2} color="#25476a" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
