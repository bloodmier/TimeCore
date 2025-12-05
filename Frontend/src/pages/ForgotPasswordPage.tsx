import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthService } from "../services/authService";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    setSubmitting(true);

    try {
      const res = await AuthService.forgotPassword({ email });
      setMessage(res.message ?? "If this email exists, a reset link has been sent.");
      setCountdown(4);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };


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
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [message]);

  return (
    <div className="flex justify-center items-start md:items-center md:min-h-[80vh] bg-background">
      <div className="relative w-full max-w-md bg-card border rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6 text-center">Reset your password</h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 border border-red-300 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              required
              className="w-full border rounded px-3 py-2 text-sm "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !!message}
            className={`
              w-full rounded px-3 py-2 text-sm font-medium text-white
              ${message ? "bg-emerald-600" : "bg-blue-600"}
              disabled:opacity-60
            `}
          >
            {message
              ? `Link sent! Redirecting (${countdown})`
              : submitting
              ? "Sending..."
              : "Send reset link"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-4 w-full text-sm text-primary underline"
        >
          Back to login
        </button>
      </div>
    </div>
  );
};
