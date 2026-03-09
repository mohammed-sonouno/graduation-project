import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { apiUrl, verifyLoginCode, verifyGoogleNewCode, getColleges, getMajors } from '../api';
import { useAuth } from '../context/AuthContext';
import { isEmailAllowed, getEmailRuleMessage, validatePassword, getPasswordRules, getAllowedDomains } from '../../config/rules.js';

function GoogleGIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GoogleSignInButton({ onSuccess, onError, disabled }) {
  const login = useGoogleLogin({
    onSuccess,
    onError,
    flow: 'implicit',
    scope: 'email profile openid',
  });
  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled}
      className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3 text-slate-800 font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:ring-offset-2 disabled:opacity-70"
    >
      <GoogleGIcon />
      <span>Continue with Google</span>
    </button>
  );
}

function Register() {
  const navigate = useNavigate();
  const { setUserAndToken, logout } = useAuth();
  const rawClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const hasGoogleClientId = Boolean(rawClientId && rawClientId !== 'your-google-client-id.apps.googleusercontent.com');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'code' (after Google)
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [googleTempToken, setGoogleTempToken] = useState('');
  const [googleNewUser, setGoogleNewUser] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [collegeId, setCollegeId] = useState('');
  const [major, setMajor] = useState('');

  useEffect(() => {
    getColleges().then(setColleges).catch(() => setColleges([]));
  }, []);
  useEffect(() => {
    if (!collegeId) {
      setMajors([]);
      setMajor('');
      return;
    }
    getMajors(collegeId).then(setMajors).catch(() => setMajors([]));
    setMajor('');
  }, [collegeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!isEmailAllowed(email)) {
      setError(getEmailRuleMessage() || 'Please use a valid university email.');
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      setError(`Password: ${pwdCheck.errors.join(', ')}.`);
      return;
    }
    const collegeName = collegeId ? colleges.find((c) => String(c.id) === String(collegeId))?.name : '';
    if (!collegeName || !major.trim()) {
      setError('Please select your college and academic program (major).');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          college: collegeName,
          major: major.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }
      if (data.user) {
        setUserAndToken(data.user);
        setMessage('Account created! Complete your profile…');
        setTimeout(() => {
          if (data.user.must_complete_profile) {
            navigate('/complete-profile', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }, 800);
      } else {
        setError(data.error || 'Registration succeeded but invalid response. Please log in.');
      }
    } catch {
      setError('Cannot connect to server. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setGoogleError('');
    setLoading(false);
    setGoogleLoading(true);
    try {
      const accessToken = response.access_token;
      const credential = response.credential;
      if (!accessToken && !credential) {
        setGoogleError('Google did not return sign-in data. Please try again.');
        return;
      }
      const body = credential ? { credential } : { access_token: accessToken };
      const res = await fetch(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGoogleError(data.error || 'Sign-in failed. Please try again.');
        return;
      }
      // Both existing and new users: backend sent 6-digit code. Show code step.
      if (data && data.needsCode && data.email) {
        setEmail(data.email);
        setStep('code');
        setCode('');
        setGoogleError('');
        if (data.devCode) setDevCode(data.devCode);
        if (data.newUser && data.tempToken) {
          setGoogleNewUser(true);
          setGoogleTempToken(data.tempToken);
        } else {
          setGoogleNewUser(false);
          setGoogleTempToken('');
        }
        return;
      }
      setGoogleError(
        data?.error ||
          'Invalid response from server. Please try again. Use a university Google account (@stu.najah.edu or @najah.edu) and ensure the backend is running.'
      );
    } catch (err) {
      setGoogleError(
        err?.message === 'Failed to fetch'
          ? 'Cannot connect to server. Make sure the backend is running (npm run server).'
          : 'Sign-in failed. Please try again.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google sign-in was cancelled or failed. Please try again.');
    setGoogleLoading(false);
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setGoogleError('');
    const codeDigits = code.replace(/\D/g, '').slice(0, 6);
    if (codeDigits.length !== 6) {
      setGoogleError('Please enter the 6-digit code from your email.');
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
          setGoogleTempToken('');
          navigate(`/complete-profile?sessionId=${encodeURIComponent(data.sessionId)}`, { replace: true, state: { pendingRegistration: true } });
        } else {
          setGoogleError('Invalid response. Please try again.');
        }
        return;
      }
      const data = await verifyLoginCode(emailNorm, codeDigits, rememberMe);
      if (data.user) {
        setUserAndToken(data.user);
        setMessage('Welcome back!');
        setTimeout(() => navigate('/', { replace: true }), 500);
      } else {
        setGoogleError('Invalid response. Please try again.');
      }
    } catch (err) {
      setGoogleError(err.message || 'Invalid or expired code. Sign in with Google again to get a new code.');
    } finally {
      setFormLoading(false);
    }
  };

  const layeredBg = {
    background: `linear-gradient(158deg,
      #ffffff 0%,
      #f7f4f4 38%,
      #f0eded 38%,
      #f6f6f6 58%,
      #efefef 58%,
      #efefef 78%,
      #e8e8e8 78%,
      #e8e8e8 100%
    )`,
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12" style={layeredBg}>
      <div className="max-w-md w-full mx-auto px-6 relative">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md p-8 md:p-10">
          <h1 className="mt-2 text-center text-2xl md:text-3xl font-bold text-[#0b2d52] leading-tight font-serif">
            Create account
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600 leading-relaxed">
            {step === 'code' ? 'Enter the 6-digit code we sent to your email.' : 'Register for the Najah platform. Use your university email.'}
          </p>
          {step === 'code' ? (
          <form onSubmit={handleVerifyCode} className="mt-8 space-y-5">
            <p className="text-sm text-slate-600">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
            </p>
            <div>
              <label htmlFor="reg-code" className="block text-sm font-semibold text-slate-700 mb-1.5">6-digit code</label>
              <input
                id="reg-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 text-center text-lg tracking-[0.4em] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              />
            </div>
            {!googleNewUser && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-slate-300 text-[#00356b] focus:ring-[#00356b]/20" />
                <span className="text-sm font-medium text-slate-700">Remember me</span>
              </label>
            )}
            {googleNewUser && <p className="text-sm text-slate-600">After verifying, you&apos;ll complete your profile.</p>}
            {googleError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{googleError}</div>
            )}
            <button
              type="submit"
              disabled={formLoading || code.replace(/\D/g, '').length !== 6}
              className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70"
            >
              {formLoading ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('form'); setGoogleError(''); setDevCode(''); setGoogleTempToken(''); setGoogleNewUser(false); }}
              className="w-full text-sm font-medium text-[#00356b] hover:underline"
            >
              Use a different email
            </button>
          </form>
          ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. student@stu.najah.edu"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, upper, lower, number, special"
                minLength={8}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              />
              <ul className="mt-1.5 text-xs text-slate-500 space-y-0.5">
                {getPasswordRules().map((rule) => {
                  const errors = validatePassword(password).errors;
                  const met = !errors.includes(rule);
                  return (
                    <li key={rule} className={met ? 'text-green-600' : ''}>
                      {met ? '✓ ' : '○ '}{rule}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <label htmlFor="reg-college" className="block text-sm font-semibold text-slate-700 mb-1.5">
                College <span className="text-red-600">*</span>
              </label>
              <select
                id="reg-college"
                required
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
              >
                <option value="">Select college…</option>
                {colleges.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reg-major" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Academic program (major) <span className="text-red-600">*</span>
              </label>
              <select
                id="reg-major"
                required
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                disabled={!collegeId}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select program…</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || googleLoading || !email.trim() || !isEmailAllowed(email.trim().toLowerCase()) || !password || !validatePassword(password).valid || !collegeId || !major.trim()}
              className="w-full inline-flex items-center justify-center rounded-xl bg-[#00356b] px-6 py-3 text-white font-semibold shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
            {hasGoogleClientId && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-3 text-slate-500">Or</span>
                  </div>
                </div>
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  disabled={loading || googleLoading}
                />
                {getAllowedDomains().length > 0 && (
                  <p className="mt-2 text-center text-xs text-slate-500">
                    Only {getAllowedDomains().join(' or ')} Google accounts can register.
                  </p>
                )}
              </>
            )}
            {googleLoading && (
              <p className="text-center text-sm text-slate-600">Completing sign-in…</p>
            )}
            {googleError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {googleError}
              </div>
            )}
          </form>
          )}
          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#00356b] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
