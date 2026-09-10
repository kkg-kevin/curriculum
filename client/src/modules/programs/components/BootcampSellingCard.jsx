import { useEffect, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import ImageUploadField from "../../../components/ImageUploadField";
import { useUpdateCurriculum } from "../../curriculum/hooks/useCurriculum";

/**
 * Program-only "Selling" card, shown on ProgramViewPage. Flip "List on the website" on and the
 * marketing fields (cover image, tagline, format, duration, age range, price, highlights) appear.
 * When off, everything stays saved but GET /api/public/bootcamps won't serve this program.
 *
 * A bootcamp = a `curricula` row with isProgram: true. This card patches that same row via
 * useUpdateCurriculum (which already invalidates the program query too), so the panel writes
 * straight to the curriculum — the description a parent sees comes from the curriculum's own
 * Description (edited in Basic Info); this card only adds the shopfront metadata.
 *
 * Mirrors AssessmentBuilderPage.jsx's SellingPanel (the sibling "sell a Project" feature).
 */

const FORMAT_LABELS = {
  holiday: "Holiday",
  weekend: "Weekend",
  after_school: "After school",
  online: "Online",
};

const Label = ({ children }) => (
  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
    {children}
  </label>
);

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: 9,
  border: "1.5px solid #E5E7EB",
  fontSize: 13,
  fontFamily: "Inter, sans-serif",
  color: "#111827",
  background: "#F9FAFB",
  outline: "none",
};

// Blank/empty form state for a curriculum that has never been put up for sale.
function saleFromCurriculum(c) {
  return {
    saleStatus: c.saleStatus || "internal",
    coverImage: c.coverImage || "",
    saleTagline: c.saleTagline || "",
    saleFormat: c.saleFormat || "",
    durationLabel: c.durationLabel || "",
    priceCurrency: c.priceCurrency || "KES",
    priceAmount: c.priceAmount ?? "",
    priceNote: c.priceNote || "",
    ageMin: c.ageMin ?? "",
    ageMax: c.ageMax ?? "",
    highlights: Array.isArray(c.highlights) ? c.highlights : [],
  };
}

// Empty strings from the number/text inputs become null so the DB stores a clean "not set"
// rather than 0 / "". Mirrors buildPayload's `numOrNull` in the Assessment Builder.
function toPayload(form) {
  const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
  return {
    saleStatus: form.saleStatus === "for_sale" ? "for_sale" : "internal",
    coverImage: form.coverImage || null,
    saleTagline: form.saleTagline.trim(),
    saleFormat: form.saleFormat || null,
    durationLabel: form.durationLabel.trim(),
    priceCurrency: (form.priceCurrency || "KES").trim(),
    priceAmount: numOrNull(form.priceAmount),
    priceNote: form.priceNote.trim(),
    ageMin: numOrNull(form.ageMin),
    ageMax: numOrNull(form.ageMax),
    highlights: form.highlights.map((h) => h.trim()).filter(Boolean),
  };
}

export default function BootcampSellingCard({ curriculum }) {
  const [form, setForm] = useState(() => saleFromCurriculum(curriculum));
  const [newHighlight, setNewHighlight] = useState("");
  const { mutate: updateCurriculum, isPending } = useUpdateCurriculum();

  // Keep the form in sync if the curriculum reloads (e.g. after a save invalidates its query).
  useEffect(() => {
    setForm(saleFromCurriculum(curriculum));
  }, [curriculum]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const on = form.saleStatus === "for_sale";
  const ageInvalid =
    form.ageMin !== "" && form.ageMax !== "" && Number(form.ageMax) < Number(form.ageMin);

  const addHighlight = () => {
    const v = newHighlight.trim();
    if (!v || form.highlights.length >= 20) return;
    set({ highlights: [...form.highlights, v] });
    setNewHighlight("");
  };

  const save = (nextForm = form) => {
    updateCurriculum({ id: curriculum.id, data: toPayload(nextForm) });
  };

  // Toggling the switch saves immediately (same feel as the Inventory / Assessment panels) so
  // "flip it on" is one click; the detail fields save on their own explicit Save button.
  const toggle = (checked) => {
    const next = { ...form, saleStatus: checked ? "for_sale" : "internal" };
    setForm(next);
    save(next);
  };

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Selling
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
        List this bootcamp on the public website (africa.digifunzi.com/bootcamps) with a price and
        an &ldquo;Enquire to book&rdquo; button.
      </p>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={on}
          disabled={isPending}
          onChange={(e) => toggle(e.target.checked)}
          style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0 }}
        />
        <span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>List on the website</span>
          <span style={{ display: "block", fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>
            Off = internal use only. The bootcamp still runs and deploys either way.
          </span>
        </span>
      </label>

      {on && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          <div>
            <Label>Cover image</Label>
            <ImageUploadField value={form.coverImage} onChange={(url) => set({ coverImage: url || "" })} />
          </div>

          <div>
            <Label>Short tagline</Label>
            <input
              style={inputStyle}
              placeholder="e.g. A full robot build, coded and driven, in one week"
              maxLength={200}
              value={form.saleTagline}
              onChange={(e) => set({ saleTagline: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <Label>Format</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(FORMAT_LABELS).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => set({ saleFormat: form.saleFormat === fmt ? "" : fmt })}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1.5px solid ${form.saleFormat === fmt ? "#25476a" : "#E5E7EB"}`,
                      background: form.saleFormat === fmt ? "#e8f5fb" : "#fff",
                      color: form.saleFormat === fmt ? "#25476a" : "#6B7280",
                    }}
                  >
                    {FORMAT_LABELS[fmt]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: "0 1 160px" }}>
              <Label>Duration</Label>
              <input
                style={inputStyle}
                placeholder="e.g. 1 week"
                maxLength={60}
                value={form.durationLabel}
                onChange={(e) => set({ durationLabel: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Price</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ ...inputStyle, width: 70, flexShrink: 0 }}
                value={form.priceCurrency}
                onChange={(e) => set({ priceCurrency: e.target.value })}
                aria-label="Currency"
              />
              <input
                style={{ ...inputStyle, width: 120, flexShrink: 0 }}
                type="number"
                min="0"
                placeholder="12000"
                value={form.priceAmount}
                onChange={(e) => set({ priceAmount: e.target.value })}
                aria-label="Amount"
              />
              <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                Leave blank to show &ldquo;Enquire for pricing&rdquo;
              </span>
            </div>
            <input
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Price note (e.g. Includes all materials. Sibling discount available.)"
              maxLength={300}
              value={form.priceNote}
              onChange={(e) => set({ priceNote: e.target.value })}
            />
          </div>

          <div>
            <Label>
              Age range <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span>
            </Label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                style={{ ...inputStyle, width: 80 }} type="number" min="0" max="25"
                placeholder="Min" value={form.ageMin}
                onChange={(e) => set({ ageMin: e.target.value })}
              />
              <span style={{ color: "#9CA3AF", fontSize: 13 }}>to</span>
              <input
                style={{ ...inputStyle, width: 80 }} type="number" min="0" max="25"
                placeholder="Max" value={form.ageMax}
                onChange={(e) => set({ ageMax: e.target.value })}
              />
              <span style={{ color: "#9CA3AF", fontSize: 12 }}>years</span>
            </div>
            {ageInvalid && (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "#DC2626" }}>
                Max age must be greater than or equal to min age.
              </p>
            )}
          </div>

          <div>
            <Label>What you&rsquo;ll build / learn</Label>
            {form.highlights.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {form.highlights.map((h, i) => (
                  <div key={`${h}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#FAFBFF" }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: "#374151" }}>{h}</span>
                    <button
                      type="button"
                      onClick={() => set({ highlights: form.highlights.filter((_, x) => x !== i) })}
                      aria-label="Remove"
                      style={{ display: "flex", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 2 }}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={inputStyle}
                placeholder="Add a selling point, press Enter"
                maxLength={200}
                value={newHighlight}
                onChange={(e) => setNewHighlight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHighlight();
                  }
                }}
              />
              <button
                type="button"
                onClick={addHighlight}
                disabled={!newHighlight.trim() || form.highlights.length >= 20}
                style={{
                  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "0 14px",
                  borderRadius: 9, border: "1.5px solid #a8d5ee", background: "#e8f5fb", color: "#25476a",
                  fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                  cursor: newHighlight.trim() ? "pointer" : "not-allowed",
                }}
              >
                <FiPlus size={13} /> Add
              </button>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>
            The parent also sees this bootcamp&rsquo;s Description (edit it in Basic Info) and its
            upcoming runs (each hub you deploy it to, with dates).
          </p>

          <div>
            <button
              type="button"
              onClick={() => save()}
              disabled={isPending || ageInvalid}
              style={{
                padding: "9px 22px", borderRadius: 10, border: "none",
                background: isPending || ageInvalid ? "#b8d9ee" : "#25476a", color: "#fff",
                fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                cursor: isPending || ageInvalid ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Saving…" : "Save selling details"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
