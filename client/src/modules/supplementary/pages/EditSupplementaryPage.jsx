import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSupplementaryQuery, useUpdateSupplementary } from "../hooks/useSupplementary";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  code: z.string().min(1, "Code is required").max(20).regex(/^[A-Z0-9-]+$/i, "Only letters, numbers, hyphens"),
  description: z.string().max(500).optional().default(""),
});

const inputStyle = (err) => ({
  width: "100%", padding: "10px 12px", border: `1.5px solid ${err ? "#FCA5A5" : "#E5E7EB"}`,
  borderRadius: "10px", fontSize: "14px", fontFamily: "Inter, sans-serif", color: "#111827",
  outline: "none", backgroundColor: "#FAFAFA", boxSizing: "border-box", transition: "border-color 0.15s",
});

export default function EditSupplementaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sup, isLoading } = useSupplementaryQuery(id);
  const { mutate: updateSup, isPending } = useUpdateSupplementary(id);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", description: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    if (sup) reset({ name: sup.name, code: sup.code, description: sup.description || "" });
  }, [sup, reset]);

  const onSubmit = (data) => {
    updateSup(data, { onSuccess: () => navigate(`/supplementary/${id}/view`) });
  };

  const handleCancel = () => (isDirty ? setConfirmLeave(true) : navigate(`/supplementary/${id}/view`));

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <div style={{ height: "60px", backgroundColor: "#EEF2F7", borderRadius: "12px", marginBottom: "16px" }} />
        <div style={{ height: "300px", backgroundColor: "#F3F4F6", borderRadius: "16px" }} />
      </div>
    );
  }

  const typeMeta = sup ? SUPPLEMENTARY_TYPE_META[sup.type] : null;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/supplementary")} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>← Supplementary</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <button type="button" onClick={() => navigate(`/supplementary/${id}/view`)} style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>{sup?.name}</button>
            <span style={{ color: "#D1D5DB" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Edit</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Edit Details</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6B7280" }}>Type and term cannot be changed after creation.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={handleCancel} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
          <button type="submit" form="edit-sup-form" disabled={isPending || !isDirty}
            style={{ padding: "10px 24px", backgroundColor: isPending || !isDirty ? "#93C5FD" : "#0D47A1", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending || !isDirty ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
            {isPending
              ? <><span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />Saving…</>
              : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Locked type banner */}
      {typeMeta && (
        <div style={{ padding: "14px 18px", backgroundColor: typeMeta.bg, border: `1.5px solid ${typeMeta.border}`, borderRadius: "12px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: "700", color: typeMeta.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>Type — {typeMeta.label}</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#374151", lineHeight: "1.5" }}>{typeMeta.description}</p>
          </div>
          <span style={{ padding: "3px 10px", backgroundColor: "#ffffff", color: typeMeta.color, border: `1px solid ${typeMeta.border}`, borderRadius: "20px", fontSize: "11px", fontWeight: "700", flexShrink: 0 }}>Locked</span>
        </div>
      )}

      <form id="edit-sup-form" onSubmit={handleSubmit(onSubmit)} noValidate style={{ maxWidth: "560px" }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Name <span style={{ color: "#EF4444" }}>*</span></label>
            <input {...register("name")} type="text" style={inputStyle(!!errors.name)}
              onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
              onBlur={(e) => { e.target.style.borderColor = errors.name ? "#FCA5A5" : "#E5E7EB"; }} />
            {errors.name && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.name.message}</p>}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Code <span style={{ color: "#EF4444" }}>*</span></label>
            <input {...register("code")} type="text" style={{ ...inputStyle(!!errors.code), textTransform: "uppercase" }}
              onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
              onBlur={(e) => { e.target.style.borderColor = errors.code ? "#FCA5A5" : "#E5E7EB"; }} />
            {errors.code && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.code.message}</p>}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Description</label>
            <textarea {...register("description")} rows={4} style={{ ...inputStyle(false), resize: "vertical", lineHeight: "1.5" }}
              onFocus={(e) => { e.target.style.borderColor = "#93C5FD"; }}
              onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; }} />
          </div>
        </div>
      </form>

      <ConfirmDialog isOpen={confirmLeave} title="Discard changes?"
        message="You have unsaved changes that will be lost if you leave."
        confirmLabel="Leave" cancelLabel="Stay"
        onConfirm={() => navigate(`/supplementary/${id}/view`)}
        onCancel={() => setConfirmLeave(false)} />
    </div>
  );
}
