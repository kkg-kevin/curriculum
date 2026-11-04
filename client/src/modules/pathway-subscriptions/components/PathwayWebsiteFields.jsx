import ImageUploadField from "../../../components/ImageUploadField";

// The chosen pathway's website details, inside a pathway plan's form (Billing → Packages → Pathway
// plans): its picture and the hubs it runs at — families pick one when they subscribe. They belong
// to the pathway, so every plan of it shares them (saved with PUT /api/pathway-templates/:id/website
// when the plan is saved). Hubs already teaching one of the pathway's curricula come first.
// `value`: { hubIds, image }.
export default function PathwayWebsiteFields({ pathway, hubs, value, onChange }) {
  const curriculumIds = new Set((pathway.curricula || []).map((c) => c.curriculumId));
  const teaches = (h) => (h.curriculumIds || []).some((id) => curriculumIds.has(id));
  const ordered = [...hubs].sort((a, b) => Number(teaches(b)) - Number(teaches(a)) || a.name.localeCompare(b.name));
  const toggleHub = (id) => onChange({ ...value, hubIds: value.hubIds.includes(id) ? value.hubIds.filter((x) => x !== id) : [...value.hubIds, id] });

  return (
    <div style={{ gridColumn: "1/-1", display: "grid", gap: 10, gridTemplateColumns: "100%", padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff" }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {pathway.name} on the website <span style={{ fontWeight: 500, color: "#6B7280" }}>— shared by every plan of this pathway</span>
      </p>
      <ImageUploadField
        label="Picture (optional)"
        value={value.image}
        onChange={(url) => onChange({ ...value, image: url || "" })}
        width="240px"
        height="150px"
        cropAspect={16 / 10}
        guide="Shown on the pathway's card and page. Without one, the website uses its first course's cover."
      />
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6B7280" }}>
          Where it runs — families choose one of these when they subscribe. {value.hubIds.length === 0 && "With none ticked, they pick from the hubs that teach its curriculum (or every active hub if none do)."}
        </p>
        {ordered.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>No active hubs yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))" }}>
            {ordered.map((h) => {
              const on = value.hubIds.includes(h.id);
              return (
                <label key={h.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${on ? "#38aae1" : "#E5E7EB"}`, backgroundColor: on ? "#F0F9FF" : "#fff", cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={() => toggleHub(h.id)} style={{ marginTop: 2 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827" }}>{h.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "#6B7280" }}>
                      {h.town || (h.deliveryMode === "virtual" ? "Online" : "No town set")}
                      {teaches(h) && <span style={{ color: "#047857", fontWeight: 700 }}> · teaches this curriculum</span>}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
