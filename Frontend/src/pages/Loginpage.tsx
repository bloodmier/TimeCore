import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export const Loginpage = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const result = await login(email, password);

    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }

    navigate("/account");
  };

  return (
    <main
      className="min-h-[80vh] flex items-center justify-center bg-background"
      aria-labelledby="login-heading"
    >
      <section className="w-full max-w-md border rounded-xl p-8 shadow-sm bg-card">
        <h1
          id="login-heading"
          className="text-2xl font-semibold mb-6 text-center"
        >
          TimeCore Login
        </h1>

        {error && (
          <div
            className="mb-4 text-sm text-red-600 border border-red-300 rounded p-2"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded px-3 py-2 text-sm font-medium bg-blue-600 text-white disabled:opacity-60"
            aria-busy={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <button
          className="w-full rounded px-3 py-2 text-sm font-medium bg-violet-600 text-white disabled:opacity-60 mt-2"
          type="button"
          onClick={() => navigate("/create-account")}
        >
          Create account
        </button>

        <Link
          to="/forgot-password"
          className="text-sm text-primary hover:underline block text-center mt-3"
        >
          Forgot your password?
        </Link>
      </section>
    </main>
  );
};
