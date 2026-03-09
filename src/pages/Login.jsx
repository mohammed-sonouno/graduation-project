import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { apiUrl, requestLoginCode, verifyLoginCode, verifyGoogleNewCode } from "../api";
import { useAuth } from "../context/AuthContext";
import { isEmailAllowed, getEmailRuleMessage, getAllowedDomains } from "../../config/rules.js";
import { isAdmin, isDean, isSupervisor, isCommunityLeader, isStudent } from "../utils/permissions";

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
    scope: "email profile openid",
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

function Login() {
  const navigate = useNavigate();
  const { setUserAndToken, logout } = useAuth();
  const rawClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleClientId = Boolean(rawClientId && rawClientId !== 'your-google-client-id.apps.googleusercontent.com');
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [devCode, setDevCode] = useState("");
  // After Google: new user flow stores tempToken until code is verified, then go to Complete Profile
  const [googleTempToken, setGoogleTempToken] = useState("");
  const [googleNewUser, setGoogleNewUser] = useState(false);

  const handleEmailBlur = () => {
    if (!email.trim()) {
      setEmailError("");
      return;
    }
    setEmailError(isEmailAllowed(email) ? "" : getEmailRuleMessage());
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!isEmailAllowed(email)) {
      setEmailError(getEmailRuleMessage());
      return;
    }
    setEmailError("");
    setFormLoading(true);
    const emailNorm = email.trim().toLowerCase();
    try {
      const data = await requestLoginCode(emailNorm);
      setStep("code");
      setCode("");
      if (data.devCode) setDevCode(data.devCode);
    } catch (err) {
      setLoginError(err.message || "Could not send code. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoginError("");
    const codeDigits = code.replace(/\D/g, "").slice(0, 6);
    if (codeDigits.length !== 6) {
      setLoginError("Please enter the 6-digit code from your email.");
      return;
    }
    setFormLoading(true);
    const emailNorm = email.trim().toLowerCase();
    try {
      if (googleNewUser && googleTempToken) {
        const data = await verifyGoogleNewCode(emailNorm, codeDigits, googleTempToken);
        if (data.verified && data.sessionId) {
          logout();
          setGoogleNewUser(false);
          setGoogleTempToken("");
          navigate(`/complete-profile?sessionId=${encodeURIComponent(data.sessionId)}`, { replace: true, state: { pendingRegistration: true } });
        } else {
          setLoginError("Invalid response. Please try again.");
        }
        return;
      }
      const data = await verifyLoginCode(emailNorm, codeDigits, rememberMe);
      const user = data.user;
      if (user) {
        setUserAndToken(user);
        const loginState = { replace: true, state: { fromLogin: true } };
        setTimeout(() => {
          if (user.must_complete_profile) {
            navigate("/complete-profile", loginState);
          } else if (isAdmin(user)) {
            navigate("/admin", loginState);
          } else if (isDean(user) || isSupervisor(user) || isCommunityLeader(user)) {
            navigate("/communities", loginState);
          } else if (isStudent(user)) {
            navigate("/profile", loginState);
          } else {
            navigate("/events", loginState);
          }
        }, 0);
      } else {
        setLoginError("Invalid response. Please try again.");
      }
    } catch (err) {
      setLoginError(err.message || "Invalid or expired code. Request a new code.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      const accessToken = response.access_token;
      const credential = response.credential;
      if (!accessToken && !credential) {
        setGoogleError("Google did not return sign-in data. Please try again.");
        return;
      }
      const body = credential
        ? { credential }
        : { access_token: accessToken };
      const res = await fetch(apiUrl("/api/auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGoogleError(data.error || "Sign-in failed. Please try again.");
        return;
      }
      // Both existing and new users: backend sent 6-digit code to email. Show code step.
      if (data && data.needsCode && data.email) {
        setEmail(data.email);
        setStep("code");
        setCode("");
        setLoginError("");
        if (data.devCode) setDevCode(data.devCode);
        if (data.newUser && data.tempToken) {
          setGoogleNewUser(true);
          setGoogleTempToken(data.tempToken);
        } else {
          setGoogleNewUser(false);
          setGoogleTempToken("");
        }
        return;
      }
      setGoogleError(
        data?.error ||
          "Invalid response from server. Please try again. Use a university Google account (@stu.najah.edu or @najah.edu) and ensure the backend is running."
      );
    } catch (err) {
      setGoogleError(
        err?.message === "Failed to fetch"
          ? "Cannot connect to server. Make sure the backend is running (npm run server)."
          : "Sign-in failed. Please try again."
      );
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
              <div className="h-14 w-14 rounded-full overflow-hidden bg-white flex items-center justify-center shadow-md ring-2 ring-[#0b2d52]/10 flex-shrink-0">
                <img src="/main-logo.png" alt="Main Logo - An-Najah" className="h-full w-full object-contain p-1" />
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
              Enter your university email to receive a 6-digit code, then sign in.
            </p>

            {step === "email" ? (
              <form className="mt-8 space-y-5" onSubmit={handleRequestCode}>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
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
                      emailError ? "border-red-500 focus:ring-red-500/30" : "border-slate-200"
                    }`}
                    aria-invalid={!!emailError}
                  />
                  {emailError && <p className="mt-1.5 text-sm text-red-600">{emailError}</p>}
                  {!emailError && getAllowedDomains().length > 0 && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Allowed: <span className="font-medium">{getAllowedDomains().join(", ")}</span>
                    </p>
                  )}
                </div>
                {loginError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={formLoading || !email.trim() || !isEmailAllowed(email.trim().toLowerCase())}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70"
                >
                  {formLoading ? "Sending code…" : "Send login code"}
                </button>
              </form>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={handleVerifyCode}>
                <p className="text-sm text-slate-600">
                  We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
                </p>
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    6-digit code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 text-center text-lg tracking-[0.4em] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  />
                </div>
                {!googleNewUser && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#00356b] focus:ring-[#00356b]/20"
                  />
                  <span className="text-sm font-medium text-slate-700">Remember me</span>
                </label>
                )}
                {googleNewUser && (
                  <p className="text-sm text-slate-600">After verifying, you&apos;ll complete your profile.</p>
                )}
                {loginError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {loginError}
                  </div>
                )}
                {devCode && (
                  <p className="text-xs text-slate-500">Dev code: {devCode}</p>
                )}
                <button
                  type="submit"
                  disabled={formLoading || code.replace(/\D/g, "").length !== 6}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70"
                >
                  {formLoading ? "Verifying…" : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setLoginError(""); setDevCode(""); setGoogleTempToken(""); setGoogleNewUser(false); }}
                  className="w-full text-sm font-medium text-[#00356b] hover:underline"
                >
                  Use a different email
                </button>
              </form>
            )}

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
              {getAllowedDomains().length > 0 && (
                <p className="text-center text-xs text-slate-500">
                  Only {getAllowedDomains().join(" or ")} Google accounts are allowed.
                </p>
              )}
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
