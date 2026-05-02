import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import EventsCarousel from '../components/EventsCarousel';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';

const FALLBACK_HERO = 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1920&q=80&auto=format&fit=crop';
const CTA_SECTION_BG = '/cta-white-coat-ceremony.png';
const SLIDER_IMAGES = [
  { src: '/hero-slider-5.png', alt: 'White coat ceremony' },
  { src: '/hero-slider-6.png', alt: 'An-Najah campus' },
  { src: '/hero-slider-3.png', alt: 'Campus life' },
  { src: '/hero-slider-4.png', alt: 'An-Najah campus' },
];

/** Home page design tokens — one visual language (Navy + Libre Baskerville) */
const SERIF = { fontFamily: "'Libre Baskerville', Georgia, serif" };
const S = {
  max: 'max-w-screen-xl mx-auto px-6 lg:px-8',
  y: 'py-20',
  yCta: 'py-20 lg:py-24',
  divider: 'border-b border-slate-100',
  kicker: 'text-xs font-semibold uppercase tracking-widest text-[#00356b] mb-3',
  kickerTight: 'text-xs font-semibold uppercase tracking-widest text-[#00356b] mb-2',
  kickerOnDark: 'text-xs font-semibold uppercase tracking-widest text-white/70 mb-3',
  h2: 'text-3xl md:text-4xl font-bold text-[#0b2d52] leading-tight',
  h2OnDark: 'text-3xl md:text-4xl font-bold text-white leading-tight',
  lead: 'mt-4 text-slate-500 max-w-xl mx-auto leading-relaxed',
  leadMd: 'mt-4 text-slate-500 max-w-md mx-auto leading-relaxed',
  leadLeft: 'mt-4 text-slate-500 max-w-xl leading-relaxed',
  subOnDark: 'mt-4 text-lg text-white/85 max-w-xl mx-auto leading-relaxed',
  btnNavy: [
    'inline-flex items-center justify-center gap-2',
    'bg-[#00356b] text-white text-sm font-semibold',
    'px-7 py-3.5 rounded-xl shadow-sm',
    'hover:bg-[#002a54] hover:shadow-md hover:-translate-y-0.5',
    'transition-all duration-300',
  ].join(' '),
  btnNavyOnDark: [
    'inline-flex items-center justify-center gap-2',
    'bg-white text-[#00356b] text-sm font-bold',
    'px-7 py-3.5 rounded-xl shadow-lg',
    'hover:bg-blue-50 hover:shadow-xl hover:-translate-y-0.5',
    'transition-all duration-300',
  ].join(' '),
  btnGhostOnDark: [
    'inline-flex items-center justify-center gap-2',
    'bg-white/10 text-white text-sm font-semibold',
    'px-7 py-3.5 rounded-xl border border-white/30',
    'hover:bg-white/20 transition-all duration-300',
  ].join(' '),
  btnTextArrow: 'inline-flex items-center gap-2 text-sm font-semibold text-[#00356b] border border-[#00356b]/25 hover:border-[#00356b] hover:bg-[#00356b]/5 px-4 py-2.5 rounded-xl transition-all duration-200',
  card: 'group block bg-white border border-slate-200 rounded-2xl p-7 card-lift shadow-sm',
};

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function FadeIn({ children, delay = 0, className = '' }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    title: 'Explore Majors',
    desc: 'Browse all academic programs across every faculty. Find the major that aligns with your goals and ambitions.',
    color: 'bg-blue-50 text-blue-700',
    border: 'hover:border-blue-200',
    link: '/majors',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Manage Events',
    desc: 'Stay updated on campus activities. Register for workshops, seminars, and cultural events all in one place.',
    color: 'bg-emerald-50 text-emerald-700',
    border: 'hover:border-emerald-200',
    link: '/events',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
    title: 'Join Communities',
    desc: 'Connect with peers who share your interests. Join active student communities and collaborate beyond the classroom.',
    color: 'bg-violet-50 text-violet-700',
    border: 'hover:border-violet-200',
    link: '/communities',
  },
];

const FEATURE_SECTIONS = [
  {
    tag: 'Academic Programs',
    heading: 'Find Your Perfect Major',
    desc: 'Explore a wide range of undergraduate and postgraduate programs offered across all faculties. Each major is designed to prepare you for a meaningful career.',
    bullets: ['Browse by faculty or field of study', 'Detailed curriculum and requirements', 'Connect with advisors and alumni', 'Compare programs side by side'],
    cta: 'Explore Majors',
    link: '/majors',
    bg: 'bg-white',
    accent: 'text-blue-700 bg-blue-50',
    gradFrom: 'from-blue-600',
    gradTo: 'to-blue-800',
    icon: (
      <svg className="w-16 h-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    stat: '50+',
    statLabel: 'Academic Programs',
    reverse: false,
  },
  {
    tag: 'Campus Life',
    heading: 'Never Miss an Event',
    desc: 'From academic seminars to cultural celebrations, our events platform keeps you connected to everything happening on campus.',
    bullets: ['Real-time event notifications', 'Easy one-click registration', 'Filter by category and date', 'Track your events in your profile'],
    cta: 'View All Events',
    link: '/events',
    bg: 'bg-slate-50',
    accent: 'text-emerald-700 bg-emerald-50',
    gradFrom: 'from-emerald-600',
    gradTo: 'to-teal-700',
    icon: (
      <svg className="w-16 h-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    stat: '120+',
    statLabel: 'Annual Events',
    reverse: true,
  },
  {
    tag: 'Student Communities',
    heading: 'Belong to Something Bigger',
    desc: 'Communities at An-Najah connect students with shared interests, from academic clubs to cultural groups. Find your place and make an impact.',
    bullets: ['Join or request your own community', 'Real-time group chat', 'Shared events and announcements', 'Build lasting connections'],
    cta: 'Browse Communities',
    link: '/communities',
    bg: 'bg-white',
    accent: 'text-violet-700 bg-violet-50',
    gradFrom: 'from-violet-600',
    gradTo: 'to-purple-800',
    icon: (
      <svg className="w-16 h-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
      </svg>
    ),
    stat: '40+',
    statLabel: 'Active Communities',
    reverse: false,
  },
];

function HeroSection({ user }) {
  const [active, setActive] = useState(0);
  const [prev, setPrev]     = useState(null);
  const timerRef            = useRef(null);
  const n                   = SLIDER_IMAGES.length;

  const advance = (idx) => {
    setPrev(active);
    setActive(idx);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => advance((active + 1) % n), 3000);
    return () => clearInterval(timerRef.current);
  }, [active, n]);

  return (
    <section className="bg-white border-b border-gray-100">
      <style>{`
        @keyframes heroTextUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes imgZoom {
          from { transform: scale(1); }
          to   { transform: scale(1.06); }
        }
        .ht   { animation: heroTextUp 0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .ht-1 { animation-delay: 0.05s; }
        .ht-2 { animation-delay: 0.13s; }
        .ht-3 { animation-delay: 0.21s; }
        .ht-4 { animation-delay: 0.29s; }
        .img-zoom-active { animation: imgZoom 3.5s ease-out forwards; }
        @media (min-width: 1024px) { .hero-img-wrap { height: 540px !important; } }
      `}</style>

      <div className="mx-auto grid max-w-screen-xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:px-14 lg:py-16">

        {/* ── Left: content ── */}
        <div className="flex flex-col justify-center order-2 lg:order-1">

          <p className="ht ht-1 mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: '#00356b' }}>
            <span className="h-px w-5 flex-shrink-0" style={{ background: '#00356b' }} />
            An-Najah National University
          </p>

          <h1 className="ht ht-2 mb-5 text-gray-900"
            style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.4rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', ...SERIF }}>
            Empowering Your
            <br />
            <span className="relative inline-block pb-1" style={{ color: '#00356b' }}>
              Academic Journey
              <span className="absolute left-0 bottom-0 rounded-full"
                style={{ height: '3px', width: '100%', background: 'linear-gradient(to right, #00356b, #4a9eff)' }}
                aria-hidden />
            </span>
          </h1>

          <p className="ht ht-3 mb-8 text-gray-500 leading-relaxed"
            style={{ fontSize: '1.02rem', maxWidth: '26rem', fontWeight: 400 }}>
            Discover world-class programs, engage with campus events, and connect with a thriving student community.
          </p>

          <div className="ht ht-4 flex flex-wrap items-center gap-3 mb-9">
            <Link to={user ? '/communities' : '/login'}
              className="inline-flex items-center gap-2 rounded-lg px-7 py-3.5 text-sm font-semibold text-white no-underline transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#00356b' }}>
              Get Started
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/majors"
              className="inline-flex items-center gap-2 rounded-lg border px-7 py-3.5 text-sm font-semibold no-underline transition-all duration-200 hover:bg-gray-50 active:scale-[0.98]"
              style={{ borderColor: '#d1d5db', color: '#1f2937' }}>
              Explore Faculties
            </Link>
          </div>

          <div className="ht ht-4 grid grid-cols-3 gap-5 border-t border-gray-200 pt-6">
            {[
              { value: '22,000+', label: 'Students' },
              { value: '120+',    label: 'Programs'  },
              { value: '50+',     label: 'Communities' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold" style={{ color: '#00356b', ...SERIF }}>{value}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: carousel ── */}
        <div className="order-1 lg:order-2 flex flex-col items-center gap-4">
          <div
            className="hero-img-wrap relative w-full overflow-hidden rounded-2xl shadow-md bg-gray-100"
            style={{ height: '360px' }}
          >
            {SLIDER_IMAGES.map((img, i) => (
              <div
                key={img.src}
                className="absolute inset-0 overflow-hidden"
                style={{
                  opacity: i === active ? 1 : 0,
                  transition: 'opacity 0.65s ease-in-out',
                  zIndex: i === active ? 2 : (i === prev ? 1 : 0),
                }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  onError={(e) => { e.currentTarget.src = FALLBACK_HERO; }}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className={i === active ? 'img-zoom-active' : ''}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center',
                    display: 'block', transformOrigin: 'center center',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {SLIDER_IMAGES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { clearInterval(timerRef.current); advance(i); }}
                aria-label={`Slide ${i + 1}`}
                style={{
                  width: i === active ? '20px' : '7px',
                  height: '7px',
                  borderRadius: i === active ? '4px' : '50%',
                  border: 'none', padding: 0, cursor: 'pointer',
                  background: i === active ? '#00356b' : '#d1d5db',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Create Your Account',
    desc: 'Sign up with your university email to access all platform features tailored to your role.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  },
  {
    title: 'Explore the Platform',
    desc: 'Browse academic majors, discover upcoming events, and find communities that interest you.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  },
  {
    title: 'Engage & Grow',
    desc: 'Register for events, join communities, and stay connected throughout your academic journey.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
];

function Home() {
  const location = useLocation();
  const { user } = useAuth();
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);

  const fromLogin = Boolean(location.state?.fromLogin) && !dismissWelcome;
  const isStudentUser = user && !isAdmin(user);
  const showWelcomeMessage = (fromLogin && isStudentUser) || welcomeExiting;
  const welcomeExitingActive = welcomeExiting;

  const startWelcomeExit = () => { if (welcomeExiting) return; setWelcomeExiting(true); };
  const handleWelcomeAnimationEnd = (e) => {
    if (e.animationName === 'welcomeSlideUp') { setDismissWelcome(true); setWelcomeExiting(false); }
  };

  useEffect(() => {
    if (!fromLogin || !isStudentUser) return;
    const timer = setTimeout(startWelcomeExit, 3000);
    return () => clearTimeout(timer);
  }, [fromLogin, isStudentUser]);

  const welcomeText = user ? `Welcome back, ${user.name || user.email || 'Student'}` : 'Welcome';

  return (
    <div className="bg-white text-gray-900 overflow-x-hidden min-h-0">
      <style>{`
        @keyframes welcomeSlideDown { from{transform:translateY(-100%);opacity:0;}to{transform:translateY(0);opacity:1;} }
        @keyframes welcomeSlideUp { from{transform:translateY(0);opacity:1;}to{transform:translateY(-100%);opacity:0;} }
        .welcome-enter-home { animation:welcomeSlideDown 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }
        .welcome-exit-home { animation:welcomeSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
        .welcome-academic-home { font-family: 'Libre Baskerville', Georgia, serif; }
        .card-lift { transition:transform 0.3s ease,box-shadow 0.3s ease; }
        .card-lift:hover { transform:translateY(-5px); box-shadow:0 24px 48px rgba(0,0,0,0.12); }
        .hero-text-shadow { text-shadow:0 1px 2px rgba(15, 23, 42, 0.06); }
      `}</style>

      {/* Welcome toast (after student login) */}
      {showWelcomeMessage && (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none overflow-hidden">
          <div
            className={`max-w-7xl mx-auto px-6 lg:px-10 pt-4 pb-2 pointer-events-auto ${welcomeExitingActive ? 'welcome-exit-home' : 'welcome-enter-home'}`}
            onAnimationEnd={handleWelcomeAnimationEnd}
          >
            <div className="welcome-academic-home flex items-center justify-between gap-4 sm:gap-6 rounded-lg border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(0,53,107,0.08)] overflow-hidden">
              <div className="flex items-center gap-4 min-w-0 flex-1 py-3.5 sm:py-4 pl-5 pr-2 border-l-4 border-[#00356b]">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00356b]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
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
                className="flex-shrink-0 mr-3 sm:mr-4 text-slate-400 hover:text-slate-600 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <HeroSection user={user} />

      {/* ── PLATFORM OVERVIEW ── */}
      <section className={`bg-white ${S.y} ${S.divider}`}>
        <div className={S.max}>
          <FadeIn className="text-center mb-14">
            <p className={S.kicker}>What We Offer</p>
            <h2 className={S.h2} style={SERIF}>
              One Platform, Endless Possibilities
            </h2>
            <p className={S.lead}>
              Everything you need to thrive at An-Najah — designed to simplify your academic and campus life.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, title, desc, color, border, link }, i) => (
              <FadeIn key={title} delay={i * 120}>
                <Link
                  to={link}
                  className={`${S.card} ${border}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${color}`}>
                    {icon}
                  </div>
                  <h3
                    className="text-base font-bold text-slate-900 mb-2 group-hover:text-[#00356b] transition-colors"
                    style={SERIF}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">{desc}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#00356b] group-hover:gap-3 transition-all duration-200">
                    Learn more
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENTS CAROUSEL ── */}
      <section className={`bg-slate-50 ${S.y} ${S.divider}`}>
        <div className={S.max}>
          <FadeIn>
            <div className="flex items-end justify-between border-b border-slate-200 pb-6 mb-10">
              <div>
                <p className={S.kickerTight}>University Calendar</p>
                <h2 className={S.h2} style={SERIF}>
                  Upcoming Events
                </h2>
              </div>
              <Link
                to="/events"
                className={`hidden sm:inline-flex ${S.btnTextArrow}`}
                style={{ textDecoration: 'none' }}
              >
                View All Events
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </FadeIn>
          <EventsCarousel />
          <div className="sm:hidden mt-8 text-center">
            <Link
              to="/events"
              className={S.btnTextArrow}
              style={{ textDecoration: 'none' }}
            >
              View All Events
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE SECTIONS ── */}
      {FEATURE_SECTIONS.map(({ tag, heading, desc, bullets, cta, link, bg, accent, gradFrom, gradTo, icon, stat, statLabel, reverse }) => (
        <section key={heading} className={`${bg} ${S.y} ${S.divider}`}>
          <div className={S.max}>
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-14 xl:gap-20 items-center`}>

              {/* Text column */}
              <FadeIn className={reverse ? 'lg:order-2' : 'lg:order-1'}>
                <span className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full mb-5 ${accent}`}>
                  {tag}
                </span>
                <h2
                  className={`${S.h2} mb-5`}
                  style={SERIF}
                >
                  {heading}
                </h2>
                <p className="text-slate-500 leading-relaxed mb-7 text-[15px] sm:text-base">{desc}</p>
                <ul className="space-y-3 mb-9">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00356b]/10 flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#00356b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  to={link}
                  className={S.btnNavy}
                  style={{ textDecoration: 'none' }}
                >
                  {cta}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </FadeIn>

              {/* Visual column */}
              <FadeIn delay={160} className={reverse ? 'lg:order-1' : 'lg:order-2'}>
                <div className="relative">
                  {/* Main visual card */}
                  <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${gradFrom} ${gradTo} shadow-2xl`} style={{ minHeight: '340px' }}>
                    {/* Decorative grid */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} aria-hidden />
                    {/* Large decorative circle */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" aria-hidden />
                    <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/10" aria-hidden />
                    {/* Center icon */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      {icon}
                      <div className="text-center">
                        <p
                          className="text-5xl font-bold text-white hero-text-shadow"
                          style={SERIF}
                        >
                          {stat}
                        </p>
                        <p className="text-white/70 text-sm font-medium mt-1 uppercase tracking-wider">{statLabel}</p>
                      </div>
                    </div>
                  </div>

                  {/* Floating accent card */}
                  <div className="absolute -bottom-5 -right-5 bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Available Now</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Free for all students</p>
                    </div>
                  </div>

                  {/* Decorative background squares */}
                  <div className="absolute -top-4 -left-4 w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 -z-10" aria-hidden />
                </div>
              </FadeIn>
            </div>
          </div>
        </section>
      ))}

      {/* ── HOW IT WORKS ── */}
      <section className={`bg-slate-50 ${S.y} ${S.divider}`}>
        <div className={S.max}>
          <FadeIn className="text-center mb-14">
            <p className={S.kicker}>Getting Started</p>
            <h2 className={S.h2} style={SERIF}>
              How It Works
            </h2>
            <p className={S.leadMd}>
              Join thousands of students using the platform to enhance their university experience.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connector */}
            <div className="hidden md:block absolute top-[52px] left-[calc(16.66%+28px)] right-[calc(16.66%+28px)] h-px bg-gradient-to-r from-transparent via-[#00356b]/15 to-transparent pointer-events-none" />

            {STEPS.map(({ title, desc, icon }, i) => (
              <FadeIn key={title} delay={i * 130}>
                <div className="relative flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm card-lift">
                  <div className="relative mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-[#00356b] flex items-center justify-center text-white shadow-md">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        {icon}
                      </svg>
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-[#00356b] text-[#00356b] text-[10px] font-black flex items-center justify-center shadow-sm">
                      {i + 1}
                    </span>
                  </div>
                  <h3
                    className="text-base font-bold text-slate-900 mb-2"
                    style={SERIF}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className={`relative bg-[#00356b] ${S.yCta} overflow-hidden`}>
        {/* Background image overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={CTA_SECTION_BG}
            alt=""
            className="h-full w-full object-cover object-[center_32%] sm:object-center"
            aria-hidden
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_HERO;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#001a2e]/90 via-[#00356b]/72 to-[#00356b]/55" />
        </div>
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className={`relative z-10 ${S.max} text-center`}>
          <FadeIn>
            <p className={S.kickerOnDark}>Join Today</p>
            <h2
              className={`${S.h2OnDark} mb-6 mx-auto max-w-2xl hero-text-shadow`}
              style={SERIF}
            >
              Start Your Academic Journey at An-Najah
            </h2>
            <p className={`${S.subOnDark} mb-10`}>
              Create your account today and unlock access to majors, events, and communities tailored for the An-Najah community.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                to="/login"
                className={S.btnNavyOnDark}
                style={{ textDecoration: 'none' }}
              >
                Create Free Account
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                to="/majors"
                className={S.btnGhostOnDark}
                style={{ textDecoration: 'none' }}
              >
                Browse Programs
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}

export default Home;
