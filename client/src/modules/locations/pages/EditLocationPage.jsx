import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocationQuery, useUpdateLocation } from "../hooks/useLocation";
import { locationSchema } from "../schemas/location.schema";
import LocationForm from "../components/LocationForm";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

export default function EditLocationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: location, isLoading, isError } = useLocationQuery(id);
  const { mutate: updateLocation, isPending } = useUpdateLocation();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const methods = useForm({
    resolver: zodResolver(locationSchema),
    mode: "onTouched",
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  useEffect(() => {
    if (location) {
      reset({
        name: location.name || "",
        locationType: location.locationType || "school",
        code: location.code || "",
        address: {
          street: location.address?.street || "",
          city: location.address?.city || "",
          county: location.address?.county || "",
        },
        contactPerson: location.contactPerson || "",
        email: location.email || "",
        phone: location.phone || "",
        curriculumId: location.curriculumId || "",
        status: location.status || "active",
        description: location.description || "",
        photos: location.photos || [],
        amenities: location.amenities || [],
        operatingHours: {
          opensAt: location.operatingHours?.opensAt || "",
          closesAt: location.operatingHours?.closesAt || "",
          days: location.operatingHours?.days || [],
        },
        spaces: location.spaces || [],
      });
    }
  }, [location, reset]);

  const onSubmit = (data) => {
    const payload = { ...data, curriculumId: data.curriculumId || null };
    updateLocation({ id, data: payload }, {
      onSuccess: () => navigate(`/locations/${id}/view`),
    });
  };

  const handleCancel = () => {
    if (isDirty) setConfirmLeave(true);
    else navigate(`/locations/${id}/view`);
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading location…
      </div>
    );
  }

  if (isError || !location) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Location not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
            <button type="button" onClick={() => navigate(`/locations/${id}/view`)} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              ← {location.name}
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Location</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Update location details or reassign its curriculum.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-location-form"
            disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            {isPending ? (
              <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Saving…</>
            ) : "Save Changes"}
          </button>
        </div>
      </div>

      <FormProvider {...methods}>
        <form id="edit-location-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <LocationForm />
        </form>
      </FormProvider>

      <ConfirmDialog
        isOpen={confirmLeave}
        title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => navigate(`/locations/${id}/view`)}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  );
}
