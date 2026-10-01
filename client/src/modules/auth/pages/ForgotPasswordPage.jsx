import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { FiMail, FiSend } from "react-icons/fi";
import { authApi } from "../services/authApi";
import { forgotPasswordSchema } from "../schemas/auth.schema";
import { FieldWrap, IconInput } from "../components/AuthFields";

// Asks for the email or username and has the server email a reset link. The confirmation is the
// same whether or not an account matched — the server never says which emails/usernames exist.
export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sentFor, setSentFor] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
    mode: "onTouched",
  });

  const onSubmit = async ({ identifier }) => {
    setSubmitting(true);
    try {
      await authApi.forgotPassword(identifier);
      setSentFor(identifier);
    } catch (err) {
      toast.error(err.message || "Could not send the reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sentFor) {
    return (
      <>
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <FiSend size={21} color="#059669" />
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#111827" }}>Check your email</h2>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.6 }}>
            If <strong style={{ color: "#374151" }}>{sentFor}</strong> belongs to an account, we've emailed a link to reset its password. It can take a few minutes to arrive — check your spam folder too.
          </p>
          <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#9CA3AF", lineHeight: 1.6 }}>
            For a learner who signs in with a username, the link goes to their parent or guardian's email. No email on file? Ask your school administrator to reset the password.
          </p>
        </div>

        <Link to="/login" className="df-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
          Back to login
        </Link>
        <p style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "#6B7280" }}>
          Didn't get it?{" "}
          <button type="button" className="df-link" onClick={() => setSentFor(null)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
            Try again
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "700", color: "#111827" }}>Forgot your password?</h2>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.6 }}>
          Enter the email or username you sign in with and we'll email you a link to choose a new one.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldWrap label="Email or Username" error={errors.identifier?.message}>
          <IconInput
            icon={FiMail}
            type="text"
            placeholder="you@school.ac.ke or username"
            autoComplete="username"
            error={errors.identifier}
            {...register("identifier")}
          />
        </FieldWrap>

        <button type="submit" className="df-btn-primary" disabled={submitting} style={{ marginTop: "22px" }}>
          {submitting ? "Sending..." : "Email me a reset link"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "22px", fontSize: "13px", color: "#6B7280" }}>
        Remembered it? <Link to="/login" className="df-link">Back to login</Link>
      </p>
    </>
  );
}
