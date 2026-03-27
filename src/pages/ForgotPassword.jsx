import { Link } from 'react-router-dom';

/**
 * Sign-in uses a 6-digit code sent to your email (no password). This page redirects users back to login.
 */
export default function ForgotPassword() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center bg-[#f7f6f3] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#00356b]/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#0b2d52] mb-2">Sign in with a code</h1>
        <p className="text-slate-600 text-sm mb-6">
          We use a 6-digit code sent to your university email to sign in. Go to the login page, enter your email, and we&apos;ll send you the code.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-xl bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54]"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}
