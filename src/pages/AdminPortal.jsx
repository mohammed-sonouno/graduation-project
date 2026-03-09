import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../utils/permissions";

function AdminPortal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const showWelcome = Boolean(location.state?.fromLogin) && !dismissWelcome;
  const showWelcomeMessage = showWelcome || welcomeExiting;

  const startWelcomeExit = () => {
    if (welcomeExiting) return;
    setWelcomeExiting(true);
  };

  const handleWelcomeAnimationEnd = (e) => {
    if (e.animationName === "welcomeSlideUp") {
      setDismissWelcome(true);
      setWelcomeExiting(false);
    }
  };

  useEffect(() => {
    if (!showWelcome) return;
    const timer = setTimeout(startWelcomeExit, 3000);
    return () => clearTimeout(timer);
  }, [showWelcome]);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin(user)) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      {showWelcomeMessage && (
        <>
          <style>{`
            @keyframes welcomeSlideDown {
              from { transform: translateY(-100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            @keyframes welcomeSlideUp {
              from { transform: translateY(0); opacity: 1; }
              to { transform: translateY(-100%); opacity: 0; }
            }
            .welcome-enter-admin { animation: welcomeSlideDown 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-exit-admin { animation: welcomeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-academic-admin { font-family: 'Libre Baskerville', Georgia, serif; }
          `}</style>
          <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden pointer-events-none">
            <div
              className={`max-w-4xl mx-auto px-4 pt-4 pb-2 pointer-events-auto ${welcomeExiting ? "welcome-exit-admin" : "welcome-enter-admin"}`}
              onAnimationEnd={handleWelcomeAnimationEnd}
            >
              <div className="welcome-academic-admin flex items-center justify-between gap-6 rounded-lg border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(0,53,107,0.08)] overflow-hidden">
                <div className="flex items-center gap-4 min-w-0 flex-1 py-4 pl-5 pr-4 border-l-4 border-[#00356b]">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00356b]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Admin Portal · An-Najah National University</p>
                    <p className="mt-0.5 text-[#0b2d52] text-lg font-semibold tracking-tight">Welcome, Admin</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startWelcomeExit}
                  className="flex-shrink-0 mr-4 text-slate-400 hover:text-slate-600 p-2 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 rounded-full transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
        </div>
      </section>
      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Admin Portal
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Manage events, approve submissions, assign roles, and view the dashboard.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8">
        {/* Intro card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8 border-l-4 border-l-[#00356b]">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-[#0b2d52]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Welcome, Admin
            </h2>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed">
              You are logged in with the <strong>admin</strong> role. Use the links below to manage events, approve submissions, assign deans and supervisors, and view the dashboard.
            </p>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/manage-events"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Manage Events
                </h3>
                <p className="mt-1 text-sm text-slate-500">Create, edit, and submit events for approval.</p>
              </div>
            </div>
          </Link>

          <Link
            to="/event-approval"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Event Approval
                </h3>
                <p className="mt-1 text-sm text-slate-500">Review and approve pending events.</p>
              </div>
            </div>
          </Link>

          <Link
            to="/event-registrations"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Event registrations
                </h3>
                <p className="mt-1 text-sm text-slate-500">Mark payments and approve student registrations (first paid, first approved).</p>
              </div>
            </div>
          </Link>

          <Link
            to="/dashboard"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Dashboard
                </h3>
                <p className="mt-1 text-sm text-slate-500">View platform dashboard and metrics.</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/assignments"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Assignments
                </h3>
                <p className="mt-1 text-sm text-slate-500">Assign deans to colleges and supervisors to communities.</p>
              </div>
            </div>
          </Link>

          <Link
            to="/communities"
            className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m3-7h3m-3 3h3m-6 0h.01M12 16h.01M12 8h.01M16 16h.01M8 16h.01M12 12v.01" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  Communities
                </h3>
                <p className="mt-1 text-sm text-slate-500">View and manage communities.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminPortal;
