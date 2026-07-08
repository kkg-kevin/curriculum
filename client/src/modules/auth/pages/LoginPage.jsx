import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { loginSchema } from "../schemas/auth.schema";

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: "600",
  color: "#374151",
  marginBottom: "6px",
};

const errorStyle = {
  fontSize: "12px",
  color: "#DC2626",
  marginTop: "4px",
};

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
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async ({ email, password }) => {
    setSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error(err.message || "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div style={{ marginBottom: "18px" }}>
        <label style={labelStyle} htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" style={inputStyle} {...register("email")} />
        {errors.email && <p style={errorStyle}>{errors.email.message}</p>}
      </div>

      <div style={{ marginBottom: "22px" }}>
        <label style={labelStyle} htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" style={inputStyle} {...register("password")} />
        {errors.password && <p style={errorStyle}>{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: "100%",
          padding: "12px 20px",
          backgroundColor: submitting ? "#fef3d0" : "#feb139",
          color: "#25476a",
          border: "none",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: "700",
          fontFamily: "Inter, sans-serif",
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
