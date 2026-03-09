import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { apiUrl, getPendingRegistration } from "../api";
import { useAuth } from "../context/AuthContext";
import { validatePassword, getPasswordRules } from "../../config/rules.js";

function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user: authUser, setUserAndToken } = useAuth();
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [pendingData, setPendingData] = useState(null);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    father_name: "",
    third_name: "",
    family_name: "",
    student_number: "",
    collegeId: "",
    college: "",
    major: "",
    phoneCountryCode: "+970",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const user = authUser;
  const isPendingRegistration = Boolean(pendingData || location.state?.pendingRegistration || searchParams.get("sessionId"));

  // Load pending registration from DB when sessionId is in URL (no sessionStorage)
  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      getPendingRegistration(sessionId)
        .then((data) => {
          if (data?.email) {
            setPendingData(data);
            setPendingSessionId(sessionId);
            const parts = (data.name || "").trim().split(/\s+/).filter(Boolean);
            const [first, father, grandfather, family] = [
              parts[0] ?? "",
              parts[1] ?? "",
              parts[2] ?? "",
              parts.length >= 4 ? parts[3] : parts.length === 3 ? parts[2] : parts.length === 2 ? parts[1] : "",
            ];
            const localPart = (data.email || "").split("@")[0] || "";
            setForm((prev) => ({
              ...prev,
              first_name: first || prev.first_name,
              father_name: father || prev.father_name,
              third_name: grandfather || prev.third_name,
              family_name: family || prev.family_name,
              student_number: localPart || prev.student_number,
            }));
          } else {
            navigate("/login", { replace: true });
          }
        })
        .catch(() => navigate("/login", { replace: true }));
      return;
    }
    if (!user && !sessionId) {
      navigate("/login", { replace: true });
      return;
    }
    if (user && !user.must_complete_profile && !sessionId) {
      navigate("/profile", { replace: true });
      return;
    }
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/).filter(Boolean);
      const [first, father, grandfather, family] = [
        parts[0] ?? "",
        parts[1] ?? "",
        parts[2] ?? "",
        parts.length >= 4 ? parts[3] : parts.length === 3 ? parts[2] : parts.length === 2 ? parts[1] : "",
      ];
      setForm((prev) => ({
        ...prev,
        first_name: first || prev.first_name,
        father_name: father || prev.father_name,
        third_name: grandfather || prev.third_name,
        family_name: family || prev.family_name,
      }));
    }
    if (user?.email) {
      const localPart = user.email.split("@")[0] || "";
      setForm((prev) => ({
        ...prev,
        student_number: prev.student_number || localPart,
      }));
    }
  }, [user, navigate, location.state?.pendingRegistration, searchParams]);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/colleges"), { credentials: "include" }).then((r) => r.json()),
      fetch(apiUrl("/api/majors"), { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([c, m]) => {
        setColleges(Array.isArray(c) ? c : []);
        setMajors(Array.isArray(m) ? m : []);
      })
      .catch(() => {});
  }, []);

  const availableMajors = form.collegeId
    ? majors.filter((m) => String(m.collegeId) === String(form.collegeId)).map((m) => m.name)
    : [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "collegeId") {
        next.major = "";
        next.college = colleges.find((c) => String(c.id) === String(value))?.name ?? "";
      }
      if (name === "phoneNumber") {
        const digits = value.replace(/\D/g, "").slice(0, 9);
        if (digits.length > 0 && digits[0] !== "5") next.phoneNumber = "5" + digits.slice(0, 8);
        else next.phoneNumber = digits;
      }
      return next;
    });
    if (error) setError("");
  };

  // Derive auto-fields from pendingData or user so API always receives them even if form state hasn't updated yet
  const getAutoFieldsFromPending = () => {
    if (!pendingData?.email) return {};
    const student_number = (pendingData.email || "").split("@")[0] || "";
    const parts = (pendingData.name || "").trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    const father = parts[1] ?? "";
    const grandfather = parts[2] ?? "";
    const family = parts.length >= 4 ? parts[3] : parts.length === 3 ? parts[2] : parts.length === 2 ? parts[1] : first;
    // When Google name is missing or unparseable, use student_number so validation and server accept the request
    const first_name = first || family || student_number;
    const family_name = family || first || student_number;
    return { first_name, father_name: father, third_name: grandfather, family_name, student_number };
  };
  const getAutoFieldsFromUser = () => {
    if (!user) return {};
    const parts = (user.name || "").trim().split(/\s+/).filter(Boolean);
    const first = (user.first_name || parts[0]) ?? "";
    const family = (user.last_name || (parts.length >= 2 ? parts[parts.length - 1] : parts[0])) ?? "";
    const student_number = (user.email || "").split("@")[0] || "";
    const father = (user.middle_name ? user.middle_name.trim().split(/\s+/)[0] : parts[1]) ?? "";
    const grandfather = (user.middle_name ? user.middle_name.trim().split(/\s+/)[1] : parts[2]) ?? "";
    const first_name = first || family || student_number;
    const family_name = family || first || student_number;
    return { first_name, father_name: father, third_name: grandfather, family_name, student_number };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const fromPending = pendingData ? getAutoFieldsFromPending() : {};
    const fromUser = !pendingData && user ? getAutoFieldsFromUser() : {};
    let first_name = (form.first_name?.trim() || fromPending.first_name || fromUser.first_name || "").trim();
    let family_name = (form.family_name?.trim() || fromPending.family_name || fromUser.family_name || "").trim();
    let student_number = (form.student_number?.trim() || fromPending.student_number || fromUser.student_number || "").trim();
    // Match server fallback: when we have student_number from Google, use it for missing first/family name so "From your Google account" always satisfies required fields
    if (student_number && (!first_name || !family_name)) {
      if (!first_name) first_name = student_number;
      if (!family_name) family_name = student_number;
    }
    if (!first_name || !family_name || !student_number) {
      setError("First name, family name, and student number are required.");
      return;
    }
    const effectiveCollege = form.college?.trim() || (form.collegeId ? colleges.find((c) => String(c.id) === String(form.collegeId))?.name : "") || "";
    if (!effectiveCollege || !(form.major || "").trim()) {
      setError("College and major are required for every student.");
      return;
    }
    if (!isPendingRegistration) {
      const pwdCheck = validatePassword(form.password);
      if (!pwdCheck.valid) {
        setError(`Password: ${pwdCheck.errors.join(", ")}.`);
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }
    if (form.phoneNumber.trim()) {
      const digits = form.phoneNumber.replace(/\D/g, "");
      if (digits.length !== 9 || digits[0] !== "5") {
        setError("Phone number must be exactly 9 digits starting with 5 (e.g. 512345678).");
        return;
      }
      if (form.phoneCountryCode !== "+970" && form.phoneCountryCode !== "+972") {
        setError("Country code must be +970 or +972.");
        return;
      }
    }
    const fullPhone = form.phoneNumber.trim()
      ? `${form.phoneCountryCode} ${form.phoneNumber.trim()}`
      : "";
    setLoading(true);
    try {
      // Account is created only when user presses "Save and continue" (this submit); not on Google sign-in.
      if (pendingData && pendingSessionId) {
        const father_name = (form.father_name?.trim() || fromPending.father_name || "").trim() || undefined;
        const third_name = (form.third_name?.trim() || fromPending.third_name || "").trim() || undefined;
        const res = await fetch(apiUrl("/api/auth/complete-registration"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sessionId: pendingSessionId,
            email: pendingData.email,
            first_name: first_name || fromPending.first_name,
            father_name,
            third_name,
            family_name: family_name || fromPending.family_name,
            student_number: student_number || fromPending.student_number,
            college: form.college || (form.collegeId ? colleges.find((c) => String(c.id) === String(form.collegeId))?.name : undefined) || undefined,
            major: form.major || undefined,
            phone: fullPhone || undefined,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not create account.");
          return;
        }
        if (data.user) {
          setUserAndToken(data.user);
          navigate("/profile", { replace: true });
        }
      } else {
        const father_name = (form.father_name?.trim() || fromUser.father_name || "").trim() || undefined;
        const third_name = (form.third_name?.trim() || fromUser.third_name || "").trim() || undefined;
        const res = await fetch(apiUrl("/api/auth/complete-profile"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            email: user.email,
            first_name,
            father_name,
            third_name,
            family_name,
            student_number,
            college: form.college || (form.collegeId ? colleges.find((c) => String(c.id) === String(form.collegeId))?.name : undefined) || undefined,
            major: form.major || undefined,
            phone: fullPhone || undefined,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save profile.");
          return;
        }
        if (data.user) {
          setUserAndToken(data.user);
          navigate("/profile", { replace: true });
        }
      }
    } catch {
      setError(isPendingRegistration ? "Could not create account. Please try again." : "Could not save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const showForm = (user && user.must_complete_profile) || pendingData || location.state?.pendingRegistration;
  if (!showForm) {
    if (!user) navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/90 overflow-hidden">
          {/* Header */}
          <div className="bg-[#00356b] px-6 py-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 mb-4">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Complete your profile</h1>
            <p className="mt-2 text-sm text-blue-100">
              You signed in with Google. Fill in your university details to finish.
            </p>
          </div>

          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Read-only: from Google */}
              <section className="rounded-xl bg-slate-50/80 border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00356b]/10">
                    <svg className="h-5 w-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <h2 className="text-sm font-semibold text-slate-800">From your Google account</h2>
                </div>
                <p className="text-xs text-slate-500 mb-4 mt-1">This information comes from your university Google account and cannot be edited.</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500 font-medium">Email</dt>
                    <dd className="mt-0.5 font-medium text-slate-900 break-all">{user?.email ?? pendingData?.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Student number</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{form.student_number || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">First name</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{form.first_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Father&apos;s name</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{form.father_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Grandfather&apos;s name</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{form.third_name || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Family name</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{form.family_name || "—"}</dd>
                  </div>
                </dl>
              </section>

              {/* Editable fields */}
              <div className="space-y-5">
                <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">University details</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">College <span className="text-red-600">*</span></label>
                  <select
                    name="collegeId"
                    required
                    value={form.collegeId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition"
                  >
                    <option value="">Select college…</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Academic program (major) <span className="text-red-600">*</span></label>
                  <select
                    name="major"
                    value={form.major}
                    onChange={handleChange}
                    disabled={!form.collegeId}
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <option value="">Select program…</option>
                    {availableMajors.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone number</label>
                  <div className="flex gap-2">
                    <select
                      name="phoneCountryCode"
                      value={form.phoneCountryCode}
                      onChange={handleChange}
                      className="w-24 shrink-0 px-3 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition"
                    >
                      <option value="+970">+970</option>
                      <option value="+972">+972</option>
                    </select>
                    <input
                      name="phoneNumber"
                      type="tel"
                      inputMode="numeric"
                      value={form.phoneNumber}
                      onChange={handleChange}
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition"
                      placeholder="5xxxxxxxx (9 digits, starts with 5)"
                      maxLength={9}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Choose +970 or +972; number must be exactly 9 digits starting with 5 (e.g. 512345678).</p>
                </div>
              </div>

              {!isPendingRegistration && (
              <div className="space-y-5">
                <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">Set your password</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition"
                    placeholder="At least 8 characters, upper, lower, number, special"
                  />
                  <ul className="mt-2 text-xs text-slate-500 space-y-1">
                    {getPasswordRules().map((rule) => {
                      const errors = validatePassword(form.password).errors;
                      const met = !errors.includes(rule);
                      return (
                        <li key={rule} className={met ? "text-emerald-600" : ""}>
                          {met ? "✓ " : "○ "}{rule}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password <span className="text-red-500">*</span></label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition"
                    placeholder="Repeat your password"
                  />
                </div>
              </div>
              )}

              <button
                type="submit"
                disabled={loading || (isPendingRegistration && !pendingData)}
                className="w-full py-3.5 bg-[#00356b] text-white font-semibold rounded-xl hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-60 transition shadow-sm"
              >
                {loading ? "Saving…" : "Save and continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompleteProfile;
