import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthService } from "../services/authService";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset link. Please request a new one.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage("");

    if (!token) {
      setError("Missing reset token. Please request a new link.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await AuthService.resetPassword({
        token,
        password,
      });

      setMessage(res.message ?? "Password has been reset successfully.");
      setCountdown(3);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Failed to reset password. The link may be invalid or expired."
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!message) return;

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    const timeoutId = setTimeout(() => {
      navigate("/account");
    }, 3000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [message, navigate]);

  return (
    <div className="flex justify-center items-start md:items-center md:min-h-[80vh] bg-background">
      <div className="relative w-full max-w-md bg-card border rounded-xl p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Choose a new password
        </h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 border border-red-300 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm mb-1"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm mb-1"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !token || !!message}
            className={`
              w-full rounded px-3 py-2 text-sm font-medium text-white
              ${message ? "bg-emerald-600" : "bg-blue-600"}
              disabled:opacity-60
            `}
          >
            {message
              ? `Password updated! Redirecting (${countdown})`
              : submitting
              ? "Updating password..."
              : "Update password"}
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
