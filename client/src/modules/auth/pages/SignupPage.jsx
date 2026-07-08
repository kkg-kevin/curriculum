import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { FiUser, FiMail, FiLock, FiUsers, FiBookOpen } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { signupSchema } from "../schemas/auth.schema";
import { FieldWrap, IconInput, PasswordInput, RoleTile } from "../components/AuthFields";

const ROLE_TILES = [
  {
    value: "teacher",
    label: "Teacher",
    icon: FiUsers,
    description: "Deliver sessions, grade assessments, and track your learners' progress.",
  },
  {
    value: "learner",
    label: "Learner",
    icon: FiBookOpen,
    description: "Access your courses, complete assessments, and see how you're progressing.",
  },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", role: "" },
    mode: "onTouched",
  });

  const role = watch("role");

  const goToStep2 = async () => {
    const valid = await trigger("role");
    if (valid) setStep(2);
  };

  const onSubmit = async ({ confirmPassword, ...payload }) => {
    setSubmitting(true);
    try {
      await signup(payload);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Could not create your account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "22px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "21px", fontWeight: "700", color: "#111827" }}>
          Create your account
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
          Start with your role, then finish your details.
        </p>
      </div>

      <div className="df-step-tabs">
        <button type="button" className={`df-step-tab${step === 1 ? " active" : ""}`} onClick={() => setStep(1)}>
          1. Choose Role
        </button>
        <button
          type="button"
          className={`df-step-tab${step === 2 ? " active" : ""}`}
          onClick={goToStep2}
          disabled={!role}
        >
          2. Account Details
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {step === 1 && (
          <div>
            <div className="df-role-grid">
              {ROLE_TILES.map((tile) => (
                <RoleTile
                  key={tile.value}
                  icon={tile.icon}
                  label={tile.label}
                  description={tile.description}
                  selected={role === tile.value}
                  onSelect={() => setValue("role", tile.value, { shouldValidate: true })}
                />
              ))}
            </div>
            {errors.role && (
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#EF4444" }}>{errors.role.message}</p>
            )}

            <button type="button" className="df-btn-primary" style={{ marginTop: "20px" }} disabled={!role} onClick={goToStep2}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <FieldWrap label="Full name" error={errors.name?.message}>
              <IconInput
                icon={FiUser}
                type="text"
                placeholder="e.g. Jane Wanjiru"
                autoComplete="name"
                error={errors.name}
                {...register("name")}
              />
            </FieldWrap>

            <FieldWrap label="Email address" error={errors.email?.message}>
              <IconInput
                icon={FiMail}
                type="email"
                placeholder="you@school.ac.ke"
                autoComplete="username"
                error={errors.email}
                {...register("email")}
              />
            </FieldWrap>

            <FieldWrap label="Password" error={errors.password?.message}>
              <PasswordInput
                icon={FiLock}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                error={errors.password}
                {...register("password")}
              />
            </FieldWrap>

            <FieldWrap label="Confirm password" error={errors.confirmPassword?.message}>
              <PasswordInput
                icon={FiLock}
                placeholder="Re-enter password"
                autoComplete="new-password"
                error={errors.confirmPassword}
                {...register("confirmPassword")}
              />
            </FieldWrap>

            <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
              <button type="button" className="df-btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="df-btn-primary" disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </div>
          </div>
        )}
      </form>

      <p style={{ textAlign: "center", marginTop: "22px", fontSize: "13px", color: "#6B7280" }}>
        Already a member? <Link to="/login" className="df-link">Login</Link>
      </p>
    </>
  );
}
