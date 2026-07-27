import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAssignCurriculumAdmin, useUnassignCurriculumAdmin } from "../hooks/useCurriculum";
import PasswordRevealDialog from "../../../components/ui/PasswordRevealDialog";

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};

const input = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "9px",
  border: "1.5px solid #E5E7EB",
  fontSize: "13px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

// Assigns the one account delegated to run this specific curriculum day-to-day — they can
// author everything within it (structure, versions, competencies, assessments), scoped to just
// this curriculum, while the platform admin retains full rights over every curriculum. Only one
// at a time (curriculum.curriculumAdminId, mirrors class.classTeacherId) — assigning again just
// replaces whoever was there before. Only an admin ever sees this card.
export default function CurriculumAdminsCard({ curriculum }) {
  const [showForm, setShowForm] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState(null);
  const { mutate: assignAdmin, isPending: isAssigning } = useAssignCurriculumAdmin(curriculum.id);
  const { mutate: unassignAdmin, isPending: isUnassigning } = useUnassignCurriculumAdmin(curriculum.id);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = (data) => {
    assignAdmin(data, {
      onSuccess: () => {
        reset();
        setShowForm(false);
        setPasswordReveal({ password: data.password, name: data.name });
      },
    });
  };

  const admin = curriculum.curriculumAdmin;

  return (
    <div style={card}>
      <div style={{ marginBottom: "14px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Curriculum Admin</h4>
        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
          The one account delegated to author this curriculum only — not any other.
        </p>
      </div>

      {admin && !showForm && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", backgroundColor: "#F9FAFB", border: "1px solid #F3F4F6", borderRadius: "9px", marginBottom: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>{admin.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: "12px", color: "#9CA3AF" }}>{admin.email}</p>
          </div>
          <button
            type="button"
            onClick={() => unassignAdmin()}
            disabled={isUnassigning}
            style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "600", cursor: isUnassigning ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
          >
            {isUnassigning ? "Removing…" : "Unassign"}
          </button>
        </div>
      )}

      {!admin && !showForm && (
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#9CA3AF" }}>No admin assigned to this curriculum yet.</p>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{ padding: "8px 16px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          {admin ? "Reassign" : "+ Assign Admin"}
        </button>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "12px" }}
        >
          {admin && (
            <p style={{ margin: "0 0 2px", fontSize: "12px", color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", padding: "8px 10px" }}>
              This replaces <strong>{admin.name}</strong> — there's only ever one admin per curriculum.
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1 }}>
              <input placeholder="Full name" style={input} {...register("name", { required: true })} />
              {errors.name && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>Name is required</p>}
            </div>
            <div style={{ flex: 1 }}>
              <input placeholder="Email" type="email" style={input} {...register("email", { required: true })} />
              {errors.email && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>Valid email is required</p>}
            </div>
          </div>
          <div>
            <input placeholder="Password (min 8 characters)" type="password" style={input} {...register("password", { required: true, minLength: 8 })} />
            {errors.password && <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#EF4444" }}>Password must be at least 8 characters</p>}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              type="submit"
              disabled={isAssigning}
              style={{ padding: "8px 16px", backgroundColor: isAssigning ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isAssigning ? "not-allowed" : "pointer" }}
            >
              {isAssigning ? "Assigning…" : admin ? "Reassign" : "Assign Admin"}
            </button>
            <button
              type="button"
              onClick={() => { reset(); setShowForm(false); }}
              style={{ padding: "8px 16px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <PasswordRevealDialog
        isOpen={!!passwordReveal}
        password={passwordReveal?.password}
        subjectName={passwordReveal?.name}
        onClose={() => setPasswordReveal(null)}
      />
    </div>
  );
}
