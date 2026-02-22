import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";

function GoogleGIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GoogleSignInButton({ onSuccess, onError, disabled }) {
  const login = useGoogleLogin({
    onSuccess,
    onError,
    flow: "implicit",
  });
  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3 text-slate-800 font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:ring-offset-2 disabled:opacity-70"
    >
      <GoogleGIcon />
      <span>Sign in with Google</span>
    </button>
  );
}

const ALLOWED_DOMAINS = ["@stu.najah.edu", "@najah.edu"];

function isValidNajahEmail(email) {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_DOMAINS.some((d) => normalized.endsWith(d.toLowerCase()));
}

function Login() {
  const navigate = useNavigate();
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleEmailBlur = () => {
    if (!email.trim()) {
      setEmailError("");
      return;
    }
    setEmailError(
      isValidNajahEmail(email)
        ? ""
        : "Please use an email ending with @stu.najah.edu or @najah.edu",
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!isValidNajahEmail(email)) {
      setEmailError(
        "Please use an email ending with @stu.najah.edu or @najah.edu",
      );
      return;
    }
    setEmailError("");
    if (!password.trim()) {
      setLoginError("Please enter your password.");
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Sign-in failed. Please try again.");
        return;
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user.role === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch {
      setLoginError("Sign-in failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      const body = response.credential
        ? { credential: response.credential }
        : { access_token: response.access_token };
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setGoogleError(data.error || "Sign-in failed. Please try again.");
        return;
      }
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        if (data.user.role === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch {
      setGoogleError("Sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleError("Google sign-in was cancelled or failed. Please try again.");
    setGoogleLoading(false);
  };

  const layeredBg = {
    background: `linear-gradient(158deg,
      #ffffff 0%,
rgb(247, 244, 244) 38%,
rgb(240, 237, 237) 38%,
      #f6f6f6 58%,
      #efefef 58%,
      #efefef 78%,
      #e8e8e8 78%,
      #e8e8e8 100%
    )`,
  };

  return (
    <div className="min-h-[calc(100vh-200px)] relative" style={layeredBg}>
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-12 relative">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md p-8 md:p-10">
            <div className="flex flex-col items-center mb-6">
              <div className="h-14 w-14 rounded-full bg-[#00356b] text-white flex items-center justify-center shadow-md ring-2 ring-[#0b2d52]/10">
                <span className="text-xl font-bold tracking-tight">N</span>
              </div>
              <div
                className="mt-3 w-12 h-0.5 bg-amber-700/40 rounded-full"
                aria-hidden="true"
              />
            </div>
            <h1 className="mt-2 text-center text-2xl md:text-3xl font-bold text-[#0b2d52] leading-tight">
              Sign in to Najah
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
              Use your university email to access your dashboard securely.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={handleEmailBlur}
                  placeholder="e.g. student@stu.najah.edu"
                  className={`w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] ${
                    emailError
                      ? "border-red-500 focus:ring-red-500/30"
                      : "border-slate-200"
                  }`}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
                {emailError && (
                  <p id="email-error" className="mt-1.5 text-sm text-red-600">
                    {emailError}
                  </p>
                )}
                {!emailError && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Allowed: <span className="font-medium">@stu.najah.edu</span>
                    , <span className="font-medium">@najah.edu</span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-[#00356b] hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={formLoading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70"
              >
                {formLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-center">
                {hasGoogleClientId ? (
                  <GoogleSignInButton
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    disabled={googleLoading}
                  />
                ) : (
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                    Google sign-in isn’t configured. Set{" "}
                    <span className="font-semibold">VITE_GOOGLE_CLIENT_ID</span>{" "}
                    in <span className="font-semibold">.env</span>, then restart
                    the dev server.
                  </div>
                )}
              </div>
              {googleLoading && (
                <p className="text-sm text-slate-500 text-center">
                  Signing you in…
                </p>
              )}
              <p className="text-center text-xs text-slate-500">
                Only @stu.najah.edu or @najah.edu Google accounts are allowed.
              </p>
              {googleError && (
                <p className="text-sm text-red-600 text-center">
                  {googleError}
                </p>
              )}
            </div>

            <p className="mt-8 text-center text-sm text-slate-600">
              Don’t have access yet?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#00356b] hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
