import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import EventsCarousel from '../components/EventsCarousel';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';

const HERO_IMAGE = '/hero-campus.png';

function Home() {
  const location = useLocation();
  const { user } = useAuth();
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);

  const fromLogin = Boolean(location.state?.fromLogin) && !dismissWelcome;
  const isStudent = user && !isAdmin(user);
  const showWelcomeMessage = (fromLogin && isStudent) || welcomeExiting;
  const welcomeExitingActive = welcomeExiting;

  const startWelcomeExit = () => {
    if (welcomeExiting) return;
    setWelcomeExiting(true);
  };

  const handleWelcomeAnimationEnd = (e) => {
    if (e.animationName === 'welcomeSlideUp') {
      setDismissWelcome(true);
      setWelcomeExiting(false);
    }
  };

  useEffect(() => {
    if (!fromLogin || !isStudent) return;
    const timer = setTimeout(startWelcomeExit, 3000);
    return () => clearTimeout(timer);
  }, [fromLogin, isStudent]);

  const welcomeText = user ? `Welcome, ${user.name || user.email || 'Student'}` : 'Welcome';

  return (
    <div className="text-gray-900">
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
            .welcome-enter-home { animation: welcomeSlideDown 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-exit-home { animation: welcomeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-academic-home { font-family: 'Libre Baskerville', Georgia, serif; }
          `}</style>
          <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden pointer-events-none">
            <div
              className={`max-w-7xl mx-auto px-6 lg:px-10 pt-4 pb-2 pointer-events-auto ${welcomeExitingActive ? 'welcome-exit-home' : 'welcome-enter-home'}`}
              onAnimationEnd={handleWelcomeAnimationEnd}
            >
              <div className="welcome-academic-home flex items-center justify-between gap-6 rounded-lg border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(0,53,107,0.08)] overflow-hidden">
                <div className="flex items-center gap-4 min-w-0 flex-1 py-4 pl-5 pr-4 border-l-4 border-[#00356b]">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00356b]/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">An-Najah National University</p>
                    <p className="mt-0.5 text-[#0b2d52] text-lg font-semibold tracking-tight">{welcomeText}</p>
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
      {/* Hero Section — academic, calm */}
      <section className="relative flex h-screen min-h-[400px] w-full items-end">
        <div className="absolute inset-0 z-0">
          <img
            alt="An-Najah National University campus"
            src={HERO_IMAGE}
            className="h-full w-full object-cover"
            style={{ filter: 'brightness(0.97) contrast(1.05)' }}
          />
          {/* Bottom gradient for text area */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(11,45,82,0.08) 0%, rgba(11,45,82,0.25) 40%, rgba(30,50,70,0.6) 100%)',
            }}
            aria-hidden
          />
          {/* Left-to-right dark gradient: stronger on left (text side), transparent on right */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 45%, transparent 75%)',
            }}
            aria-hidden
          />
        </div>

        <div className="relative z-10 w-full max-w-screen-2xl mx-auto px-6 pb-28 md:pb-36 text-left">
          <div className="max-w-2xl">
            <h1
              className="text-white"
              style={{
                fontFamily: "'EB Garamond', serif",
                fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                textShadow: '0 1px 2px rgba(0,0,0,0.25), 0 2px 12px rgba(0,0,0,0.2)',
              }}
            >
              <span className="block font-medium">Empowering Your</span>
              <span className="block font-normal tracking-tight">Academic Journey</span>
            </h1>

            <p
              className="mt-6 max-w-xl text-white/95 leading-[1.6]"
              style={{
                fontFamily: "'EB Garamond', serif",
                fontSize: 'clamp(1rem, 1.4vw, 1.15rem)',
                fontWeight: 400,
                fontStyle: 'italic',
                textShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              A tradition of excellence in the heart of academic discovery, fostering
              the leaders of tomorrow through innovation and heritage.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/majors"
                className="inline-block rounded px-8 py-3 text-[#0b2d52] no-underline transition-all duration-200 hover:opacity-95 shadow-sm"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '18px',
                  fontWeight: 500,
                  background: '#fff',
                }}
              >
                Explore Programs
              </Link>
              <Link
                to="/events"
                className="inline-block rounded border border-white/80 bg-white/5 px-8 py-3 text-white no-underline transition-all duration-200 hover:bg-white/15 backdrop-blur-sm"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  fontSize: '18px',
                  fontWeight: 500,
                }}
              >
                Show All Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Events Section ── */}
      <section style={{ background: '#f5f3ee' }} className="py-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">

          {/* Section header — academic serif */}
          <div className="flex items-end justify-between border-b border-slate-200 pb-6 mb-10">
            <div>
              <p
                className="mb-1 text-slate-500"
                style={{ fontFamily: "'EB Garamond', serif", fontSize: '0.875rem', fontWeight: 400 }}
              >
                University Calendar
              </p>
              <h2
                className="text-[#0b2d52]"
                style={{ fontFamily: "'EB Garamond', serif", fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 600, lineHeight: 1.2 }}
              >
                Upcoming Events
              </h2>
            </div>
            <Link
              to="/events"
              className="hidden sm:inline-flex items-center gap-2 text-[#0b2d52] hover:opacity-80 transition-opacity"
              style={{ fontFamily: "'EB Garamond', serif", fontSize: '0.9375rem', fontWeight: 500 }}
            >
              View All Events
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>

          <EventsCarousel />

          {/* Mobile view all */}
          <div className="sm:hidden mt-8 text-center">
            <Link
              to="/events"
              className="inline-block rounded border border-[#0b2d52] px-8 py-3 text-[#0b2d52] no-underline transition-colors hover:bg-[#0b2d52] hover:text-white"
              style={{ fontFamily: "'EB Garamond', serif", fontSize: '0.9375rem', fontWeight: 500 }}
            >
              View All Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;