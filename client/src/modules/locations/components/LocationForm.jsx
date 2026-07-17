import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  KENYA_COUNTIES, LOCATION_TYPES, AMENITY_OPTIONS, DAYS_OF_WEEK, SPACE_TYPES, PRICING_MODELS,
} from "../schemas/location.schema";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import PhotoGalleryField from "./PhotoGalleryField";

const ACCENT = "#25476a";

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#374151",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

const inputBaseStyle = (error) => ({
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1.5px solid ${error ? "#FCA5A5" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: error ? "#FFF5F5" : "#F9FAFB",
  color: "#374151",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
});

function Field({ label, error, required, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "flex", alignItems: "center", gap: "3px" }}>
        {label}
        {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {hint && !error && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

function Input({ name, placeholder, type = "text", ...rest }) {
  const { register, formState: { errors } } = useFormContext();
  const keys = name.split(".");
  const error = keys.reduce((obj, k) => obj?.[k], errors)?.message;

  return (
    <Field label={rest.label} error={error} required={rest.required} hint={rest.hint}>
      <input
        type={type}
        placeholder={placeholder}
        {...register(name, type === "number" ? { valueAsNumber: true } : undefined)}
        style={inputBaseStyle(error)}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", cursor: "pointer" }}
    >
      <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</span>
      <span style={{ width: "38px", height: "22px", borderRadius: "999px", backgroundColor: checked ? "#38aae1" : "#D1D5DB", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "2px", left: checked ? "18px" : "2px", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </span>
    </div>
  );
}

function Chip({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
        borderRadius: "10px", border: `1.5px solid ${active ? "#38aae1" : "#E5E7EB"}`,
        backgroundColor: active ? "#e8f5fb" : "#fff",
        color: active ? "#25476a" : "#6B7280",
        fontSize: "13px", fontWeight: active ? "700" : "500", fontFamily: "Inter, sans-serif",
        cursor: "pointer", transition: "all 0.15s", textAlign: "left",
      }}
    >
      {icon && <span style={{ fontSize: "15px" }}>{icon}</span>}
      {label}
    </button>
  );
}

function AmenitiesField() {
  const { control } = useFormContext();
  return (
    <Controller
      name="amenities"
      control={control}
      render={({ field }) => {
        const selected = field.value || [];
        const toggle = (value) => {
          field.onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
        };
        const customOnly = selected.filter((v) => !AMENITY_OPTIONS.some((a) => a.value === v));

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              {AMENITY_OPTIONS.map((a) => (
                <Chip key={a.value} icon={a.icon} label={a.label} active={selected.includes(a.value)} onClick={() => toggle(a.value)} />
              ))}
            </div>

            {customOnly.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {customOnly.map((v) => (
                  <span key={v} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "20px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", fontSize: "12px", fontWeight: "600", color: "#25476a" }}>
                    {v}
                    <button type="button" onClick={() => toggle(v)} style={{ background: "none", border: "none", color: "#25476a", cursor: "pointer", fontSize: "12px", padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            <CustomAmenityInput onAdd={(value) => { if (value && !selected.includes(value)) field.onChange([...selected, value]); }} />
          </div>
        );
      }}
    />
  );
}

function CustomAmenityInput({ onAdd }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = e.target.value.trim();
      if (value) { onAdd(value); e.target.value = ""; }
    }
  };
  return (
    <div>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "5px" }}>Add Custom Amenity</label>
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="e.g., Standing Desks, Pet Friendly"
          onKeyDown={handleKeyDown}
          style={inputBaseStyle(false)}
        />
        <button
          type="button"
          onClick={(e) => {
            const input = e.currentTarget.previousElementSibling;
            const value = input.value.trim();
            if (value) { onAdd(value); input.value = ""; }
          }}
          style={{ padding: "10px 18px", borderRadius: "10px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: ACCENT, fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function OperatingDaysField() {
  const { control } = useFormContext();
  return (
    <Controller
      name="operatingHours.days"
      control={control}
      render={({ field }) => {
        const selected = field.value || [];
        const toggle = (day) => {
          field.onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]);
        };
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            {DAYS_OF_WEEK.map((day) => (
              <label key={day} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${selected.includes(day) ? "#38aae1" : "#E5E7EB"}`, backgroundColor: selected.includes(day) ? "#e8f5fb" : "#fff", cursor: "pointer", fontSize: "13px", fontWeight: selected.includes(day) ? "700" : "500", color: selected.includes(day) ? "#25476a" : "#374151" }}>
                <input type="checkbox" checked={selected.includes(day)} onChange={() => toggle(day)} style={{ accentColor: "#38aae1" }} />
                {day}
              </label>
            ))}
          </div>
        );
      }}
    />
  );
}

function SpaceConfigCard({ index, onRemove }) {
  const { register, control, watch } = useFormContext();
  const nameValue = watch(`spaces.${index}.name`);
  const minCapacity = watch(`spaces.${index}.minCapacity`);
  const maxCapacity = watch(`spaces.${index}.maxCapacity`);
  const pricingModel = watch(`spaces.${index}.pricingModel`);

  return (
    <div style={{ padding: "18px 20px", borderRadius: "14px", border: "1.5px solid #E5E7EB", backgroundColor: "#FAFBFF", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>{nameValue || `Space ${index + 1}`}</p>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
            {minCapacity || 1}-{maxCapacity || 1} learners · {PRICING_MODELS.find((p) => p.value === pricingModel)?.label || "Hourly"} Rate
          </p>
        </div>
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", padding: "4px 8px" }}>
          Remove
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Input name={`spaces.${index}.name`} label="Space / Seating Name" placeholder="e.g. Small Desk" required />
        <Field label="Space Type">
          <select {...register(`spaces.${index}.spaceType`)} style={selectStyle}>
            {SPACE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Input name={`spaces.${index}.minCapacity`} label="Minimum Capacity" type="number" required />
        <Input name={`spaces.${index}.maxCapacity`} label="Maximum Capacity" type="number" required />
      </div>

      <div style={{ padding: "14px 16px", borderRadius: "12px", backgroundColor: "#fff", border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pricing details</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Field label="Pricing Model" required>
            <select {...register(`spaces.${index}.pricingModel`)} style={selectStyle}>
              {PRICING_MODELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Input name={`spaces.${index}.rate`} label="Rate (KES)" type="number" required />
        </div>
        <Field label="Price Unit">
          <select {...register(`spaces.${index}.priceUnit`)} style={selectStyle}>
            <option value="per hour">Per hour</option>
            <option value="per day">Per day</option>
            <option value="per session">Per session</option>
            <option value="flat rate">Flat rate</option>
          </select>
        </Field>
      </div>

      <Controller
        name={`spaces.${index}.reservable`}
        control={control}
        render={({ field }) => (
          <Toggle checked={!!field.value} onChange={field.onChange} label="This option can be reserved" />
        )}
      />

      <Input name={`spaces.${index}.notes`} label="Notes" placeholder="e.g., Good for quiet study, includes sockets, booking instructions…" />
    </div>
  );
}

export default function LocationForm() {
  const { register, watch, control, formState: { errors } } = useFormContext();
  const { data: curriculaData } = useCurriculaQuery();
  const curricula = curriculaData?.data || [];
  const locationType = watch("locationType");
  const isSchool = locationType === "school";

  const { fields, append, remove } = useFieldArray({ control, name: "spaces" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          border: "1.5px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {/* Section: Basic info */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Basic Information
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input name="name" label="Location Name" placeholder="e.g. Nairobi Academy, Main Campus" required />
              <Field label="Location Type" required error={errors?.locationType?.message}>
                <select {...register("locationType")} style={selectStyle}>
                  {LOCATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input
                name="code"
                label="Code"
                placeholder="e.g. NA-001"
                required={isSchool}
                hint={isSchool ? "Required for the School type" : "Optional for this type"}
              />
              <Field label="Status" required>
                <select {...register("status")} style={selectStyle}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                {...register("description")}
                placeholder="Describe the location, its atmosphere, and what makes it suitable for learning sessions…"
                rows={4}
                style={{ ...inputBaseStyle(false), resize: "vertical", fontFamily: "Inter, sans-serif" }}
              />
            </Field>

            <Controller
              name="photos"
              control={control}
              render={({ field }) => (
                <PhotoGalleryField value={field.value || []} onChange={field.onChange} label="Location Photos" />
              )}
            />
          </div>
        </div>

        {/* Section: Contact */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Contact Details
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input name="contactPerson" label="Contact Person" placeholder="e.g. Jane Mwangi" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input name="email" label="Email Address" placeholder="info@location.ac.ke" type="email" />
              <Input name="phone" label="Phone Number" placeholder="+254 700 000 000" />
            </div>
          </div>
        </div>

        {/* Section: Address */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Address
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input name="address.street" label="Street / Area" placeholder="e.g. Ngong Road, Karen" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input name="address.city" label="City / Town" placeholder="e.g. Nairobi" />
              <Field
                label="County"
                required
                error={errors?.address?.county?.message}
              >
                <select
                  {...register("address.county")}
                  style={{
                    ...selectStyle,
                    borderColor: errors?.address?.county ? "#FCA5A5" : "#E5E7EB",
                    backgroundColor: errors?.address?.county ? "#FFF5F5" : "#F9FAFB",
                  }}
                >
                  <option value="">Select county…</option>
                  {KENYA_COUNTIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        {/* Section: Curriculum */}
        <div style={{ padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Assigned Curriculum
          </h3>
          <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#9CA3AF" }}>
            The curriculum this location follows. Can be updated at any time.
          </p>
          <Field label="Curriculum" error={errors?.curriculumId?.message}>
            <select {...register("curriculumId")} style={selectStyle}>
              <option value="">No curriculum assigned</option>
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) — {c.framework} {c.academicYear}
                </option>
              ))}
            </select>
          </Field>
          {curricula.length === 0 && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#F59E0B" }}>
              No curricula found. Create a curriculum first to assign it here.
            </p>
          )}
        </div>
      </div>

      {/* Section: Amenities / Facilities */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          Amenities / Facilities
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#9CA3AF" }}>
          Select all available amenities and facilities.
        </p>
        <AmenitiesField />
      </div>

      {/* Section: Operational Information — not meaningful for a "School" (it runs on the
          curriculum's term/session schedule instead of open/close hours) */}
      {!isSchool && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Operational Information
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#9CA3AF" }}>
            Working hours and availability schedule.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Input name="operatingHours.opensAt" label="Opening Time" type="time" required />
              <Input name="operatingHours.closesAt" label="Closing Time" type="time" required />
            </div>
            <Field label="Available Days" required>
              <OperatingDaysField />
            </Field>
          </div>
        </div>
      )}

      {/* Section: Spaces, Capacity & Pricing — data capture only; there is no learner-facing
          booking/reservation flow built yet, this just records what's on offer. Not applicable
          to "School", which enrolls learners rather than renting seats. */}
      {!isSchool && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            Spaces, Capacity & Pricing
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "12px", color: "#9CA3AF" }}>
            Define each bookable seating option, its capacity, reservation rules, and pricing model.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {fields.map((field, index) => (
              <SpaceConfigCard key={field.id} index={index} onRemove={() => remove(index)} />
            ))}
            <button
              type="button"
              onClick={() => append({ name: "", spaceType: "desk", minCapacity: 1, maxCapacity: 1, pricingModel: "hourly", rate: 0, priceUnit: "per hour", reservable: true, notes: "" })}
              style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "10px", border: `1.5px dashed #a8d5ee`, backgroundColor: "#F8FBFE", color: ACCENT, fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              + Add Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
