import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiLock } from "react-icons/fi";
import { authApi } from "../services/authApi";
import { resetPasswordSchema } from "../schemas/auth.schema";
import { FieldWrap, PasswordInput } from "../components/AuthFields";

// Where an emailed reset link lands (/reset-password?token=…). The token is checked as soon as
// the page opens, so an expired or already-used link says so before anyone types a new password.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  // "checking" | "ready" | "invalid"
  const [linkState, setLinkState] = useState(token ? "checking" : "invalid");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    authApi.checkResetToken(token)
      .then(() => { if (!cancelled) setLinkState("ready"); })
      .catch(() => { if (!cancelled) setLinkState("invalid"); });
    return () => { cancelled = true; };
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
    mode: "onTouched",
  });

  const onSubmit = async ({ newPassword }) => {
    setSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword);
      toast.success("Password reset. Sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      if (err.code === "RESET_LINK_INVALID") setLinkState("invalid");
      else toast.error(err.message || "Could not reset the password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (linkState === "checking") {
    return <p style={{ textAlign: "center", fontSize: "13.5px", color: "#6B7280" }}>Checking your reset link…</p>;
  }

  if (linkState === "invalid") {
    return (
      <>
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "#FFF7E8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <FiAlertTriangle size={22} color="#feb139" />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#111827" }}>This link can't be used</h2>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.6 }}>
            Password reset links expire after a short while and work only once. Request a new one to continue.
          </p>
        </div>
        <Link to="/forgot-password" className="df-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
          Request a new link
        </Link>
        <p style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "#6B7280" }}>
          <Link to="/login" className="df-link">Back to login</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#111827" }}>Choose a new password</h2>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.6 }}>
          Once it's saved, the account is signed out everywhere and you can sign in with the new password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FieldWrap label="New password" error={errors.newPassword?.message}>
            <PasswordInput
              icon={FiLock}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              error={errors.newPassword}
              {...register("newPassword")}
            />
          </FieldWrap>

          <FieldWrap label="Confirm new password" error={errors.confirmPassword?.message}>
            <PasswordInput
              icon={FiLock}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              error={errors.confirmPassword}
              {...register("confirmPassword")}
            />
          </FieldWrap>
        </div>

        <button type="submit" className="df-btn-primary" disabled={submitting} style={{ marginTop: "22px" }}>
          {submitting ? "Saving..." : "Reset password"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "22px", fontSize: "13px", color: "#6B7280" }}>
        <Link to="/login" className="df-link">Back to login</Link>
      </p>
    </>
  );
}
