import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginWithPassword } from "../api";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../utils/permissions";

function AdminLogin() {
  const navigate = useNavigate();
  const { setUserAndToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithPassword(email, password);
      const user = data.user;
      if (user) {
        setUserAndToken(user);
        if (isAdmin(user)) {
          navigate("/admin", { replace: true, state: { fromLogin: true } });
        } else {
          setError("This account is not an administrator.");
        }
      } else {
        setError("Invalid response. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] relative" style={layeredBg}>
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-12 relative">
        <div className="w-full max-w-md mx-auto">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md p-8 md:p-10">
            <div className="flex flex-col items-center mb-6">
              <div className="h-14 w-14 rounded-full overflow-hidden bg-white flex items-center justify-center shadow-md ring-2 ring-[#0b2d52]/10 flex-shrink-0">
                <span className="text-xl font-bold text-[#0b2d52]" aria-hidden="true">N</span>
              </div>
              <div
                className="mt-3 w-12 h-0.5 bg-amber-700/40 rounded-full"
                aria-hidden="true"
              />
            </div>
            <h1 className="mt-2 text-center text-2xl md:text-3xl font-bold text-[#0b2d52] leading-tight font-serif">
              Admin Login
            </h1>
            <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
              Sign in with your administrator email and password.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@najah.edu"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70"
              >
                {loading ? "Signing in…" : "Login"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              <Link
                to="/login"
                className="font-semibold text-[#00356b] hover:underline"
              >
                Back to Student Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
