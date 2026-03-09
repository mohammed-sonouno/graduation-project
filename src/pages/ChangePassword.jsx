import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../api";
import { useAuth } from "../context/AuthContext";
import { validatePassword, getPasswordRules } from "../../config/rules.js";

function ChangePassword() {
  const navigate = useNavigate();
  const { user, loading, setUserAndToken } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user === null) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  const currentUser = user;

  if (currentUser == null) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gray-100 px-4 py-12">
        <p className="text-slate-600">Redirecting to sign in…</p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword || !confirm) { setError("All fields are required."); return; }
    if (newPassword !== confirm) { setError("New passwords do not match."); return; }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) { setError(`New password: ${pwdCheck.errors.join(", ")}.`); return; }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to change password."); return; }
      const updated = data.user ? { ...currentUser, ...data.user } : { ...currentUser, must_change_password: false };
      setUserAndToken(updated);
      if (updated.must_complete_profile) {
        navigate("/complete-profile", { replace: true });
      } else if (updated.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch { setError("Failed to change password."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gray-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-lg bg-amber-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Change Your Password</h1>
          <p className="text-gray-500 text-sm text-center mb-8">You must set a new password before continuing.</p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Your student number" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters, upper, lower, number, special" minLength={8} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <ul className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                {getPasswordRules().map((rule) => {
                  const errors = validatePassword(newPassword).errors;
                  const met = !errors.includes(rule);
                  return (
                    <li key={rule} className={met ? "text-green-600" : ""}>
                      {met ? "✓ " : "○ "}{rule}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {submitting ? "Changing…" : "Set New Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
