import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { FiMail, FiLock } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { loginSchema } from "../schemas/auth.schema";
import { FieldWrap, IconInput, PasswordInput } from "../components/AuthFields";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async ({ identifier, password }) => {
    setSubmitting(true);
    try {
      await login(identifier, password);
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message || "Invalid email/username or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "26px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>
          Enter your details to access your dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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

          <FieldWrap label="Password" error={errors.password?.message}>
            <PasswordInput
              icon={FiLock}
              placeholder="Enter password"
              autoComplete="current-password"
              error={errors.password}
              {...register("password")}
            />
          </FieldWrap>

          <Link to="/forgot-password" className="df-link" style={{ alignSelf: "flex-end", fontSize: "12.5px", marginTop: "-6px" }}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="df-btn-primary" disabled={submitting} style={{ marginTop: "22px" }}>
          {submitting ? "Signing in..." : "Login"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "22px", fontSize: "13px", color: "#6B7280" }}>
        Don't have an account? <Link to="/signup" className="df-link">Register</Link>
      </p>
    </>
  );
}
