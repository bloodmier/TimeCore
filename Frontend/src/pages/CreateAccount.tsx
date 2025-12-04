import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { TenantService } from "../services/tenantService";
import { UserService } from "../services/userService";

export const CreateAccount = () => {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<{ id: number; name: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const data = await TenantService.getTenants();
        setTenants(data);
      } catch (err) {
        setError("Failed to load companies");
      } finally {
        setLoadingTenants(false);
      }
    };

    fetchTenants();
  }, []);

  useEffect(() => {
    if (!message) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      navigate("/login");
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [message, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage("");

    if (!tenantId) {
      setError("Please select a company");
      return;
    }

    setSubmitting(true);

    try {
      const res = await UserService.register({
        name,
        email,
        password,
        tenantId,
      });

      setName("");
      setEmail("");
      setPassword("");
      setTenantId(null);

      setMessage(res.message ?? "Account created successfully.");
      setCountdown(3);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="create-account-page flex justify-center items-start md:items-center md:min-h-[85vh] bg-background"
      aria-labelledby="create-account-heading"
    >
      <section className="w-full max-w-lg bg-card border rounded-xl p-8 shadow-sm">
        <h1
          id="create-account-heading"
          className="text-2xl font-semibold mb-6 text-center"
        >
          Create your TimeCore account
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

        {message && (
          <div
            className="mb-4 text-sm text-emerald-700 border border-emerald-300 rounded p-2 bg-emerald-50"
            role="status"
            aria-live="polite"
          >
            {message}{" "}
            {countdown !== null && countdown >= 0
              ? `Redirecting to login in ${countdown}...`
              : null}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm mb-1" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email
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
              autoComplete="new-password"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="tenant">
              Company
            </label>

            {loadingTenants ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <select
                id="tenant"
                required
                className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
                value={tenantId ?? ""}
                onChange={(e) => setTenantId(Number(e.target.value))}
              >
                <option value="" disabled>
                  Select a company...
                </option>

                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !!message}
            className={`w-full rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60 ${
              message ? "bg-emerald-600" : "bg-blue-600"
            }`}
          >
            {message
              ? `Account created! Redirecting (${countdown})`
              : submitting
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-4 w-full text-sm text-blue-700 dark:text-blue-300 hover:underline text-center block"
        >
          Already have an account? Log in
        </Link>
      </section>
    </main>
  );
};
