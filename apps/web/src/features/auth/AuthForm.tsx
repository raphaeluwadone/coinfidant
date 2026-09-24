import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mascot } from "../../components/Mascot";
import { ApiError } from "../../lib/api";
import { login, meQuery, signup } from "../../lib/auth";
import "./AuthForm.css";

const ERRORS: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Happens to the best of us.",
  email_taken: "That email already has an account. Try logging in?",
  validation: "Check the fields: passwords need at least 10 characters.",
};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("displayName") ?? "").trim() || undefined;
    setBusy(true);
    setError(null);
    try {
      const { user } = mode === "login" ? await login(email, password) : await signup(email, password, name);
      qc.setQueryData(meQuery.queryKey, user);
      navigate({ to: "/" });
    } catch (err) {
      const code = err instanceof ApiError ? (err.status === 400 ? "validation" : err.code) : "unknown";
      setError(ERRORS[code] ?? "Something went sideways. Try again in a sec.");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <main className="auth">
      <div className="auth__head">
        <Mascot size={64} />
        <h1>{isLogin ? "Welcome back" : "Meet your Coinfidant"}</h1>
        <p>{isLogin ? "Your money missed you. Mostly." : "A budget that talks back, nicely."}</p>
      </div>

      <form className="card auth__form" onSubmit={onSubmit}>
        {!isLogin && (
          <label className="field">
            <span className="label">What should we call you?</span>
            <input name="displayName" autoComplete="nickname" maxLength={40} />
          </label>
        )}
        <label className="field">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={10}
            required
          />
        </label>
        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {isLogin ? "Log in" : "Create account"}
        </button>
      </form>

      <p className="auth__switch">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link to={isLogin ? "/signup" : "/login"}>{isLogin ? "Create an account" : "Log in"}</Link>
      </p>
    </main>
  );
}
