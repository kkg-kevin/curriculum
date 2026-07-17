import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLocationQuery, useDeleteLocation } from "../hooks/useLocation";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { teacherApi } from "../../teachers/services/teacherApi";
import { classApi } from "../../classes/services/classApi";
import { learnerApi } from "../../learners/services/learnerApi";
import { LOCATION_TYPES, AMENITY_OPTIONS, PRICING_MODELS } from "../schemas/location.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";
const TEAL = "#38aae1";

function Section({ title, count, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
        {count !== undefined && (
          <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#e8f5fb", color: "#38aae1", border: "1px solid #a8d5ee" }}>
            {count}
          </span>
        )}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

function EmptyList({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
      <p style={{ margin: 0, fontSize: "13px" }}>{text}</p>
    </div>
  );
}

export default function LocationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: location, isLoading, isError } = useLocationQuery(id);
  const { data: curriculum } = useCurriculumQuery(location?.curriculumId);
  const { mutate: deleteLocation } = useDeleteLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSchool = location?.locationType === "school";

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", id],
    queryFn:  () => teacherApi.getAll({ schoolId: id }),
    enabled:  !!id && isSchool,
  });
  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", id],
    queryFn:  () => classApi.getAll({ schoolId: id }),
    enabled:  !!id && isSchool,
  });
  const { data: learnersData } = useQuery({
    queryKey: ["learners", "bySchool", id],
    queryFn:  () => learnerApi.getAll({ schoolId: id }),
    enabled:  !!id && isSchool,
  });
  const teachers = teachersData?.data || [];
  const classes  = classesData?.data  || [];
  const learners = learnersData?.data || [];

  if (isLoading) {
    return <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>Loading location…</div>;
  }
  if (isError || !location) {
    return <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>⚠ Location not found.</div>;
  }

  const typeLabel = LOCATION_TYPES.find((t) => t.value === location.locationType)?.label || location.locationType;
  const address = [location.address?.street, location.address?.city, location.address?.county ? `${location.address.county} County` : null]
    .filter(Boolean).join(", ");
  const statusStyle = location.status === "active"
    ? { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" }
    : { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <button type="button" onClick={() => navigate("/locations")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
          Locations
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span style={{ color: "#111827", fontSize: "13px", fontWeight: "500" }}>{location.name}</span>
      </div>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
              {isSchool ? "🏫" : "📍"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff" }}>{location.name}</h1>
                <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                  {location.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)" }}>
                {typeLabel}{location.code ? ` · ${location.code}` : ""}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button type="button" onClick={() => navigate(`/locations/${id}/edit`)} style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Photo gallery */}
      {location.photos?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: location.photos.length === 1 ? "1fr" : "2fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {location.photos.slice(0, 3).map((url, i) => (
            <div key={url + i} style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 180 }}>
              <img src={url} alt={`${location.name} ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 2 && location.photos.length > 3 && (
                <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(17,24,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700 }}>
                  +{location.photos.length - 3} more
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {location.description && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{location.description}</p>
        </div>
      )}

      {/* Stats row — only meaningful for school-type locations, which are the only ones Classes/
          Teachers/Learners currently attach to */}
      {isSchool && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Teachers", value: teachers.length, icon: "👩‍🏫", bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
            { label: "Classes",  value: classes.length,  icon: "🏫",   bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
            { label: "Learners", value: learners.length, icon: "🎒",   bg: "#d6edf8", color: "#25476a", border: "#b8d9ee" },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${s.border}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: isSchool ? "16px" : 0 }}>
        <Section title="Location Details">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <DetailRow icon={<span>🏷️</span>} label="Type" value={typeLabel} />
            {location.code && <DetailRow icon={<span>#️⃣</span>} label="Code" value={location.code} />}
            <DetailRow
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>}
              label="Address" value={address || "Not provided"}
            />
          </div>
        </Section>

        <Section title="Contact">
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <DetailRow icon={<span>👤</span>} label="Contact Person" value={location.contactPerson} />
            <DetailRow
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>}
              label="Email" value={location.email}
            />
            <DetailRow
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/></svg>}
              label="Phone" value={location.phone}
            />
            {!location.contactPerson && !location.email && !location.phone && (
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>No contact details on file.</p>
            )}
          </div>
        </Section>

        <Section title="Assigned Curriculum">
          {curriculum ? (
            <div
              onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "12px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", cursor: "pointer" }}
            >
              <div>
                <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#25476a" }}>{curriculum.name}</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{curriculum.framework} · {curriculum.academicYear}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: "#a8d5ee", flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "16px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>No curriculum assigned to this location yet.</p>
              <button type="button" onClick={() => navigate(`/locations/${id}/edit`)} style={{ padding: "8px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Assign Curriculum
              </button>
            </div>
          )}
        </Section>

        <Section title="Record Info">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <DetailRow
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></svg>}
              label="Created" value={new Date(location.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            />
            <DetailRow
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              label="Last Updated" value={new Date(location.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
            />
          </div>
        </Section>
      </div>

      {/* Amenities + Operating Hours */}
      {(location.amenities?.length > 0 || !isSchool) && (
        <div style={{ display: "grid", gridTemplateColumns: !isSchool ? "1fr 1fr" : "1fr", gap: "16px", marginBottom: "16px" }}>
          {location.amenities?.length > 0 && (
            <Section title="Amenities / Facilities">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {location.amenities.map((a) => {
                  const preset = AMENITY_OPTIONS.find((o) => o.value === a);
                  return (
                    <span key={a} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", fontSize: "12px", fontWeight: "600", color: "#25476a" }}>
                      {preset?.icon && <span>{preset.icon}</span>}
                      {preset?.label || a}
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          {!isSchool && (location.operatingHours?.opensAt || location.operatingHours?.days?.length > 0) && (
            <Section title="Operating Hours">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <DetailRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                  label="Hours"
                  value={location.operatingHours?.opensAt && location.operatingHours?.closesAt ? `${location.operatingHours.opensAt} – ${location.operatingHours.closesAt}` : null}
                />
                {location.operatingHours?.days?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {location.operatingHours.days.map((d) => (
                      <span key={d} style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB" }}>{d}</span>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Spaces, Capacity & Pricing — data capture only, no booking flow exists yet */}
      {!isSchool && location.spaces?.length > 0 && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
            <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Spaces, Capacity & Pricing</h2>
          </div>
          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
            {location.spaces.map((s, i) => (
              <div key={i} style={{ padding: "14px 16px", borderRadius: "12px", border: "1.5px solid #E5E7EB", backgroundColor: "#FAFBFF" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{s.name}</p>
                  {s.reservable && (
                    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>Bookable</span>
                  )}
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#9CA3AF" }}>
                  {s.minCapacity}-{s.maxCapacity} learners · {PRICING_MODELS.find((p) => p.value === s.pricingModel)?.label || s.pricingModel}
                </p>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#25476a" }}>
                  {s.pricingModel === "free" ? "Free" : `KES ${s.rate}`}
                  {s.pricingModel !== "free" && <span style={{ fontSize: "12px", fontWeight: "500", color: "#9CA3AF" }}> {s.priceUnit}</span>}
                </p>
                {s.notes && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6B7280" }}>{s.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teachers/Classes/Learners are still keyed by schoolId, so they only make sense for
          school-type locations */}
      {isSchool && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <Section title="Teachers" count={teachers.length}>
            {teachers.length === 0 ? (
              <EmptyList icon="👩‍🏫" text="No teachers yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {teachers.slice(0, 5).map((t) => (
                  <div key={t.id} onClick={() => navigate(`/teachers/${t.id}/view`)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 13, color: "#111827" }}>
                    {t.firstName} {t.lastName}
                  </div>
                ))}
                {teachers.length > 5 && (
                  <button type="button" onClick={() => navigate(`/teachers?schoolId=${id}`)} style={{ padding: "6px", background: "none", border: "none", color: TEAL, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                    View all {teachers.length} →
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section title="Classes" count={classes.length}>
            {classes.length === 0 ? (
              <EmptyList icon="🏫" text="No classes yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {classes.slice(0, 5).map((c) => (
                  <div key={c.id} onClick={() => navigate(`/classes/${c.id}/view`)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 13, color: "#111827" }}>
                    {c.gradeName}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Learners" count={learners.length}>
            {learners.length === 0 ? (
              <EmptyList icon="🎒" text="No learners yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {learners.slice(0, 5).map((l) => (
                  <div key={l.id} onClick={() => navigate(`/learners/${l.id}/view`)}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", fontSize: 13, color: "#111827" }}>
                    {l.firstName} {l.lastName}
                  </div>
                ))}
                {learners.length > 5 && (
                  <button type="button" onClick={() => navigate(`/learners?schoolId=${id}`)} style={{ padding: "6px", background: "none", border: "none", color: TEAL, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                    View all {learners.length} →
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Location"
        message={`"${location.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteLocation(id, { onSuccess: () => navigate("/locations") });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
