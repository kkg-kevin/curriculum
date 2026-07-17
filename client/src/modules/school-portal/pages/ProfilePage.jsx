import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../../context/AuthContext";
import { locationApi as schoolApi } from "../../locations/services/locationApi";
import { useUpdateLocation as useUpdateSchool } from "../../locations/hooks/useLocation";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { locationProfileSchema as schoolProfileSchema, KENYA_COUNTIES } from "../../locations/schemas/location.schema";
import { classApi } from "../../classes/services/classApi";
import { teacherApi } from "../../teachers/services/teacherApi";
import { learnerApi } from "../../learners/services/learnerApi";
import { classesListPath, teachersListPath, learnersListPath } from "../../../routes/portalPaths";

const ACCENT = "#25476a";

const inputStyle = (hasError) => ({
  padding: "10px 12px",
  borderRadius: "10px",
  border: `1.5px solid ${hasError ? "#FCA5A5" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#F9FAFB",
  color: "#374151",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
});

const selectStyle = (hasError) => ({
  ...inputStyle(hasError),
  appearance: "none",
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "32px",
});

function Section({ title, children, action }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value, empty = "—", tint = "#e8f5fb", iconColor = "#25476a" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: tint, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ paddingTop: 3, minWidth: 0 }}>
        <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: 14, color: "#111827", wordBreak: "break-word" }}>{value || empty}</p>
      </div>
    </div>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 3 }}>
        {label}{required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {error && <p style={{ margin: 0, fontSize: 12, color: "#EF4444" }}>{error}</p>}
    </div>
  );
}

function TextInput({ name, label, placeholder, type = "text", required }) {
  const { register, formState: { errors } } = useFormContext();
  const keys = name.split(".");
  const error = keys.reduce((o, k) => o?.[k], errors)?.message;
  return (
    <Field label={label} error={error} required={required}>
      <input type={type} placeholder={placeholder} {...register(name)} style={inputStyle(!!error)} />
    </Field>
  );
}

function EditForm({ school, onDone, onCancel }) {
  const { mutate: updateSchool, isPending } = useUpdateSchool();
  const methods = useForm({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: {
      name: school.name || "",
      email: school.email || "",
      phone: school.phone || "",
      address: {
        street: school.address?.street || "",
        city: school.address?.city || "",
        county: school.address?.county || "",
      },
    },
    mode: "onTouched",
  });
  const { handleSubmit, register, formState: { errors } } = methods;

  const onSubmit = (data) => {
    updateSchool({ id: school.id, data }, { onSuccess: onDone });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <TextInput name="name" label="School Name" required />
          <TextInput name="email" label="Email Address" type="email" />
        </div>
        <TextInput name="phone" label="Phone Number" placeholder="+254 700 000 000" />
        <TextInput name="address.street" label="Street / Area" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <TextInput name="address.city" label="City / Town" />
          <Field label="County" required error={errors?.address?.county?.message}>
            <select {...register("address.county")} style={selectStyle(!!errors?.address?.county)}>
              <option value="">Select county…</option>
              {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{ padding: "9px 18px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={{ padding: "9px 20px", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

const iconMail = <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>;
const iconPhone = <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/></svg>;
const iconPin = <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/></svg>;
const iconCalendar = <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></svg>;

function StatTile({ icon, num, label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, border: "1.5px solid #E5E7EB", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: onClick ? "pointer" : "default", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#e8f5fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{num}</p>
        <p style={{ margin: "3px 0 0", fontSize: 11.5, fontWeight: 600, color: "#9CA3AF" }}>{label}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: schoolsData, isLoading, refetch } = useQuery({
    queryKey: ["schools", "byEmail", user?.email],
    queryFn: () => schoolApi.getAll({ email: user.email }),
    enabled: !!user?.email,
  });
  const school = schoolsData?.data?.[0] || null;
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);

  // Trailing "" mirrors the unfiltered default of the statusFilter state on the list pages, so
  // navigating between here and there reuses the same cache entry instead of re-fetching.
  const { data: classesData }  = useQuery({ queryKey: ["classes", "bySchool", school?.id, ""],  queryFn: () => classApi.getAll({ schoolId: school.id }),  enabled: !!school?.id });
  const { data: teachersData } = useQuery({ queryKey: ["teachers", "bySchool", school?.id, ""], queryFn: () => teacherApi.getAll({ schoolId: school.id }), enabled: !!school?.id });
  const { data: learnersData } = useQuery({ queryKey: ["learners", "bySchool", school?.id, ""], queryFn: () => learnerApi.getAll({ schoolId: school.id }), enabled: !!school?.id });
  const classesCount  = classesData?.data?.length  || 0;
  const teachersCount = teachersData?.data?.length || 0;
  const learnersCount = learnersData?.data?.length || 0;

  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: "#9CA3AF", fontSize: 14 }}>Loading…</div>;
  }

  if (!school) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>🏫</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#111827" }}>No school profile linked yet</h3>
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
          Your account ({user?.email}) isn't linked to a school yet. Ask a platform admin to add this school using
          this same email address as its contact email.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {school.name?.[0]?.toUpperCase() || "S"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{school.name}</h1>
              <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.16)", color: "#fff" }}>
                {school.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
              {school.code}{school.address?.county ? ` · ${school.address.county} County` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatTile icon="📚" num={classesCount} label="Classes" onClick={() => navigate(classesListPath("school", school.id))} />
        <StatTile icon="👩‍🏫" num={teachersCount} label="Teachers" onClick={() => navigate(teachersListPath("school", school.id))} />
        <StatTile icon="🎓" num={learnersCount} label="Learners" onClick={() => navigate(learnersListPath("school", school.id))} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section
            title="Profile"
            action={!editing && (
              <button type="button" onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: ACCENT, fontWeight: 600, fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                Edit
              </button>
            )}
          >
            {editing ? (
              <EditForm
                school={school}
                onDone={() => { setEditing(false); refetch(); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <DetailRow icon={iconMail} label="Email" value={school.email} />
                <DetailRow icon={iconPhone} label="Phone" value={school.phone} />
                <DetailRow
                  icon={iconPin}
                  label="Address"
                  value={[school.address?.street, school.address?.city, school.address?.county].filter(Boolean).join(", ")}
                />
              </div>
            )}
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="School Info">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DetailRow icon={<span>🏷️</span>} label="Code" value={school.code} />
              <DetailRow icon={<span>📘</span>} label="Curriculum" value={curriculum?.name} empty="Not assigned yet" />
              <DetailRow
                icon={iconCalendar}
                label="Member Since"
                value={school.createdAt ? new Date(school.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : null}
              />
              <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
                School code, status, and curriculum assignment are managed by a platform admin.
              </p>
            </div>
          </Section>

          <Section title="Account">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <DetailRow icon={iconMail} label="Login Email" value={user?.email} />
              <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
                This is the email you sign in with — it can differ from the school's public contact email above.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

