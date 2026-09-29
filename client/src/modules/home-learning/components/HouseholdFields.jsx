import { priceForPackage } from "../services/homeLearningApi";
import PhotoGalleryField from "../../learning-hubs/components/PhotoGalleryField";
import { formatMoney, inputStyle, labelStyle } from "./ui";

const sectionHeading = { gridColumn: "1/-1", margin: "8px 0 -4px", paddingBottom: 6, borderBottom: "1px solid #EEF1F5", color: "#25476a", fontSize: 12, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" };

// Package + number of children. The children field only appears for a package that takes extra
// children; otherwise the household gets the package's included places.
function PackageFields({ values, setValue, packages, currentPackageId }) {
  const offered = packages.filter((pkg) => pkg.status === "active" || pkg.id === currentPackageId);
  const pkg = packages.find((p) => p.id === values.packageId);
  const price = priceForPackage(pkg, values.childCount);
  return <>
    <label style={labelStyle}>Package<select style={inputStyle} required value={values.packageId || ""} onChange={(e) => { setValue("packageId", e.target.value); setValue("childCount", ""); }}>
      <option value="">{offered.length ? "Choose package" : "Create a package first"}</option>
      {offered.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.childrenIncluded} {p.childrenIncluded === 1 ? "child" : "children"} · {formatMoney(p.monthlyAmount)}/month{p.status === "archived" ? " (archived)" : ""}</option>)}
    </select></label>
    {pkg?.allowExtraChildren && <label style={labelStyle}>Number of children<input style={inputStyle} type="number" min={pkg.childrenIncluded} max={pkg.maxChildren} value={values.childCount || pkg.childrenIncluded} onChange={(e) => setValue("childCount", e.target.value)} /></label>}
    {pkg && <div style={{ alignSelf: "end", paddingBottom: 10, fontSize: 13, color: price ? "#25476a" : "#B91C1C", fontWeight: 700 }}>
      {price ? `${formatMoney(price.monthlyAmount)}/month · ${price.childCount} places` : `Up to ${pkg.maxChildren} children on this package`}
    </div>}
  </>;
}

// The household contact/package/address fields, shared by "Add a household" and each card's edit
// form. Rendered into the parent's grid, with a full-width heading per group.
export function HouseholdFields({ values, setValue, packages, currentPackageId, showStatus }) {
  const bind = (key) => ({ value: values[key] ?? "", onChange: (event) => setValue(key, event.target.value) });
  return <>
    <h4 style={sectionHeading}>Parent / guardian</h4>
    <label style={labelStyle}>Parent / guardian name<input style={inputStyle} required {...bind("guardianName")} /></label>
    <label style={labelStyle}>Phone<input style={inputStyle} required minLength={7} maxLength={20} {...bind("guardianPhone")} /></label>
    <label style={labelStyle}>Email<input style={inputStyle} type="email" {...bind("guardianEmail")} /></label>
    <label style={labelStyle}>
      Parent portal password (optional)
      <input style={inputStyle} type="password" autoComplete="new-password" minLength={8} disabled={!values.guardianEmail} placeholder={values.guardianEmail ? "Sets or resets their login" : "Add the parent's email first"} {...bind("portalPassword")} />
      <span style={{ fontWeight: 400, fontSize: 11, color: "#6B7280" }}>The parent signs in with their email to see their children and invoices.</span>
    </label>

    <h4 style={sectionHeading}>Package</h4>
    <PackageFields values={values} setValue={setValue} packages={packages} currentPackageId={currentPackageId} />
    {showStatus && <label style={labelStyle}>Enrollment status<select style={inputStyle} {...bind("status")}><option value="pending">Pending</option><option value="active">Active</option><option value="paused">Paused</option></select></label>}
    <label style={labelStyle}>Start date<input style={inputStyle} type="date" {...bind("startDate")} /></label>

    <h4 style={sectionHeading}>Home location</h4>
    <label style={labelStyle}>County<input style={inputStyle} {...bind("county")} /></label>
    <label style={labelStyle}>Sub-county<input style={inputStyle} {...bind("subCounty")} /></label>
    <label style={labelStyle}>Town / area<input style={inputStyle} {...bind("town")} /></label>
    <label style={labelStyle}>Home address<input style={inputStyle} {...bind("addressLine")} /></label>
    <label style={labelStyle}>Landmark / directions<input style={inputStyle} {...bind("landmark")} /></label>
    <label style={labelStyle}>Google Maps link<input style={inputStyle} type="url" maxLength={2048} placeholder="https://maps.app.goo.gl/…" {...bind("mapUrl")} /></label>
    <div style={{ gridColumn: "1/-1" }}>
      <PhotoGalleryField label="Location photos (up to 2)" max={2} hint="e.g. the gate, building or a nearby landmark — helps the educator find the home" value={values.locationPhotos || []} onChange={(photos) => setValue("locationPhotos", photos)} />
    </div>
    <label style={{ ...labelStyle, gridColumn: "1/-1" }}>Internal notes<textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} {...bind("notes")} /></label>
  </>;
}

// Curriculum → grade/level → educator. The grade decides which courses the child's class gets.
export function EnrollmentFields({ values, setValue, curricula, educators }) {
  const curriculum = curricula.find((c) => c.id === values.curriculumId);
  const grades = Array.isArray(curriculum?.classes) ? curriculum.classes : [];
  return <>
    <label style={labelStyle}>Curriculum<select style={inputStyle} required value={values.curriculumId || ""} onChange={(e) => { setValue("curriculumId", e.target.value); setValue("gradeId", ""); }}><option value="">Choose curriculum</option>{curricula.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label style={labelStyle}>Grade / level<select style={inputStyle} required value={values.gradeId || ""} onChange={(e) => setValue("gradeId", e.target.value)} disabled={!grades.length}><option value="">{values.curriculumId && !grades.length ? "No grades in this curriculum" : "Choose grade"}</option>{grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <label style={labelStyle}>Educator (optional)<select style={inputStyle} value={values.educatorId || ""} onChange={(e) => setValue("educatorId", e.target.value)}><option value="">Unassigned</option>{educators.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></label>
  </>;
}
