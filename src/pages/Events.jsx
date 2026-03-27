import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isDean, isSupervisor, isCommunityLeader, isStudent } from '../utils/permissions';
import { getEvents, getColleges, getCommunities, eventImageUrl } from '../api';

const HERO_BG = '/events-hero.png';
/** Max events shown before "Show more" */
const INITIAL_EVENTS_COUNT = 6;

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s7-7.75 7-13a7 7 0 10-14 0c0 5.25 7 13 7 13z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9a2.5 2.5 0 110 5 2.5 2.5 0 010-5z" />
    </svg>
  );
}

function EventCard({ event }) {
  if (!event || event.id == null) return null;
  const isPast = event.status === 'past';
  const title = event.title ?? '';
  const image = event.image ?? '/event1.jpg';
  const communityName = event.communityName ?? event.organizer ?? '';
  const date = event.date ?? '';
  const endDate = event.endDate ?? '';
  const dateDisplay = endDate && endDate !== date ? `${date} – ${endDate}` : date;
  const time = event.time ?? '';
  const endTime = event.endTime ?? '';
  const timeDisplay = endTime ? `${time} – ${endTime}` : time;
  const location = event.location ?? '';
  const description = event.description ?? '';

  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        <img
          src={eventImageUrl(image)}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${isPast ? 'grayscale' : ''}`}
          onError={(e) => { e.target.onerror = null; e.target.src = '/manage-events-hero.png'; }}
        />
        <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            University Event
          </span>
        </div>
        {communityName && (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#00356b] backdrop-blur">
            {communityName}
          </span>
        )}
      </div>

      <div className="flex h-full flex-col p-5">
        <h3 className="font-serif text-lg font-semibold leading-snug text-slate-900">
          {title}
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-slate-500" />
            <span>{dateDisplay}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-slate-500" />
            <span>{timeDisplay}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconPin className="h-4 w-4 text-slate-500" />
            <span className="line-clamp-1">{location}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-3">
          {description}
        </p>

        <div className="mt-5">
          <Link
            to={`/events/${event.id}`}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#00356b] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
            aria-label={`${isPast ? 'View archive' : 'View details'}: ${title}`}
          >
            {isPast ? 'View Archive' : 'View Details'}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Build a sortable datetime from date + time strings (ms for newest-first sort). */
function eventSortKey(startDate, startTime) {
  if (!startDate) return 0;
  const timePart = (startTime || '').trim() || '00:00';
  const combined = startDate.includes('T') ? startDate : `${startDate}T${timePart}`;
  const d = new Date(combined);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** True if event end datetime has passed (used for Past vs Upcoming). */
function isEventEndPast(endDate, endTime) {
  if (!endDate) return false;
  const timePart = (endTime || '').trim() || '23:59';
  const combined = endDate.includes('T') ? endDate : `${endDate}T${timePart}`;
  const end = new Date(combined);
  return !isNaN(end.getTime()) && end.getTime() < Date.now();
}

function mapEventFromApi(e) {
  if (!e || e.id == null) return null;
  const start = e.startDate ? new Date(e.startDate) : null;
  const end = e.endDate ? new Date(e.endDate) : null;
  const dateStr = start && !isNaN(start.getTime())
    ? start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const endDateStr = end && !isNaN(end.getTime())
    ? end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const communityName = (e.communityName ?? e.clubName ?? '').trim();
  const endPast = isEventEndPast(e.endDate, e.endTime);
  const displayStatus = endPast ? 'past' : 'upcoming';
  return {
    id: e.id,
    title: e.title ?? '',
    description: e.description ?? '',
    category: e.category ?? 'Event',
    date: dateStr,
    endDate: endDateStr,
    time: e.startTime ?? '',
    endTime: e.endTime ?? '',
    location: e.location ?? '',
    image: e.image ?? 'event1.jpg',
    status: displayStatus,
    featured: Boolean(e.featured),
    sortKey: eventSortKey(e.startDate, e.startTime),
    createdAt: e.createdAt ?? null,
    price: e.price,
    priceMember: e.priceMember,
    communityName,
    collegeName: (e.collegeName ?? '').trim(),
    organizer: (communityName || e.clubName) ?? '',
  };
}

function Events() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [eventsFromApi, setEventsFromApi] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [collegesFromApi, setCollegesFromApi] = useState([]);
  const [communitiesFromApi, setCommunitiesFromApi] = useState([]);

  useEffect(() => {
    getEvents()
      .then((list) => {
        const raw = Array.isArray(list) ? list : [];
        const mapped = raw.filter(Boolean).map(mapEventFromApi).filter(Boolean);
        setEventsFromApi(mapped);
      })
      .catch(() => setEventsFromApi([]))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    getColleges()
      .then((list) => setCollegesFromApi(Array.isArray(list) ? list : []))
      .catch(() => setCollegesFromApi([]));
  }, []);

  useEffect(() => {
    getCommunities()
      .then((list) => setCommunitiesFromApi(Array.isArray(list) ? list : []))
      .catch(() => setCommunitiesFromApi([]));
  }, []);

  const allEvents = useMemo(() => {
    const list = eventsFromApi.filter(Boolean);
    list.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
    });
    return list;
  }, [eventsFromApi]);

  const featured = useMemo(() => {
    const withFeatured = allEvents.find((e) => e && e.featured);
    if (withFeatured) return withFeatured;
    const firstUpcoming = allEvents.find((e) => e && e.status === 'upcoming');
    return firstUpcoming ?? allEvents[0] ?? null;
  }, [allEvents]);
  const [tab, setTab] = useState('all');
  const [college, setCollege] = useState('All Colleges');
  const [community, setCommunity] = useState('All Communities');
  const [showMore, setShowMore] = useState(false);
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const fromLogin = Boolean(location.state?.fromLogin) && !dismissWelcome;
  const showWelcomeMessage = fromLogin || welcomeExiting;

  const eventColleges = useMemo(() => {
    const names = (collegesFromApi || []).map((c) => (c && c.name) ?? '').filter(Boolean);
    return ['All Colleges', ...Array.from(new Set(names)).sort()];
  }, [collegesFromApi]);

  const selectedCollegeId = useMemo(() => {
    if (college === 'All Colleges') return null;
    const c = (collegesFromApi || []).find((x) => (x && x.name) === college);
    return c && c.id != null ? c.id : null;
  }, [college, collegesFromApi]);

  const communitiesForFilter = useMemo(() => {
    const list = (communitiesFromApi || []).filter(Boolean);
    if (selectedCollegeId == null) return list;
    return list.filter((c) => Number(c.collegeId) === Number(selectedCollegeId));
  }, [communitiesFromApi, selectedCollegeId]);

  const eventCommunityOptions = useMemo(() => {
    const all = { id: 'all-communities', name: 'All Communities' };
    const byId = communitiesForFilter.filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i
    );
    const byName = byId.filter(
      (c, i, arr) => arr.findIndex((x) => (x.name || '') === (c.name || '')) === i
    );
    return [all, ...byName];
  }, [communitiesForFilter]);

  const eventCommunities = useMemo(
    () => eventCommunityOptions.map((o) => o.name),
    [eventCommunityOptions]
  );

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
    if (!fromLogin) return;
    const timer = setTimeout(startWelcomeExit, 3000);
    return () => clearTimeout(timer);
  }, [fromLogin]);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (!e || e.id == null) return false;
      const matchTab = tab === 'all' ? true : (e.status || 'upcoming') === tab;
      const matchCollege = college === 'All Colleges' ? true : (e.collegeName || '') === college;
      const matchCommunity = community === 'All Communities' ? true : ((e.communityName ?? e.organizer) || '') === community;
      return matchTab && matchCollege && matchCommunity;
    });
  }, [allEvents, tab, college, community]);

  const visibleEvents = showMore ? filtered : filtered.slice(0, INITIAL_EVENTS_COUNT);
  const hasMore = filtered.length > INITIAL_EVENTS_COUNT;

  useEffect(() => {
    setShowMore(false);
  }, [tab, college, community]);

  useEffect(() => {
    if (community === 'All Communities') return;
    if (!eventCommunities.includes(community)) setCommunity('All Communities');
  }, [college, selectedCollegeId, eventCommunities, community]);

  if (loading || eventsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3] px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
          <h1 className="text-xl font-semibold text-slate-900">Sign in required</h1>
          <p className="mt-2 text-slate-600">You must log in first to view events.</p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-full bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const welcomeText = isAdmin(user) ? 'Welcome, Admin' : isDean(user) ? 'Welcome, Dean' : isSupervisor(user) ? 'Welcome, Supervisor' : isCommunityLeader(user) ? 'Welcome, Community Leader' : isStudent(user) ? 'Welcome, Student' : `Welcome, ${user?.name || user?.email || 'User'}`;

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
            .welcome-enter { animation: welcomeSlideDown 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-exit { animation: welcomeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
            .welcome-academic { font-family: 'Libre Baskerville', Georgia, serif; }
          `}</style>
          <div className="fixed top-0 left-0 right-0 z-50 overflow-hidden pointer-events-none">
            <div
              className={`max-w-7xl mx-auto px-6 lg:px-10 pt-4 pb-2 pointer-events-auto ${welcomeExiting ? 'welcome-exit' : 'welcome-enter'}`}
              onAnimationEnd={handleWelcomeAnimationEnd}
            >
              <div className="welcome-academic flex items-center justify-between gap-6 rounded-lg border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(0,53,107,0.08)] overflow-hidden">
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
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0b2d52]">
        <div
          className="absolute inset-0 opacity-85"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
            filter: 'brightness(1.08) contrast(1.1) saturate(1.06)',
          }}
          aria-hidden
        />
        {/* Subtle left-to-right overlay: stronger on left for text, transparent on right for image clarity */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(11,45,82,0.78) 0%, rgba(11,45,82,0.46) 38%, rgba(11,45,82,0.16) 68%, rgba(11,45,82,0) 100%)',
          }}
          aria-hidden
        />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-16 md:pt-20 pb-10">
          <h1 className="font-serif text-4xl md:text-5xl font-semibold leading-tight text-white max-w-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
            University Events
            <span className="block">&amp; Symposia</span>
          </h1>

          {/* Featured strip — only when we have a featured/first event */}
          {featured && featured.id != null && (
            <div className="mt-8 max-w-4xl rounded-2xl border border-white/20 bg-white/7 ">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/80">
                    Featured Event
                  </p>
                  <h2 className="mt-1 font-serif text-xl md:text-2xl font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
                    {featured.title ?? 'Event'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/85">
                    <span className="inline-flex items-center gap-2">
                      <IconCalendar className="h-4 w-4" />
                      {featured.endDate && featured.endDate !== featured.date
                        ? `${featured.date ?? ''} – ${featured.endDate}`
                        : (featured.date ?? '')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      {featured.endTime ? `${featured.time ?? ''} – ${featured.endTime}` : (featured.time ?? '')}
                    </span>
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <IconPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{featured.location ?? ''}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/events/${featured.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#00356b] shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    aria-label={`Register now: ${featured.title ?? 'Event'}`}
                  >
                    Register Now →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 ${
                tab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 ${
                tab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setTab('past')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 ${
                tab === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past Events
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500" htmlFor="event-college">
                College
              </label>
              <select
                id="event-college"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                className="h-[38px] min-w-[200px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 transition-[border-color,box-shadow] focus:border-[#00356b] focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
              >
                {eventColleges.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500" htmlFor="event-community">
                Community
              </label>
              <select
                id="event-community"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                className="h-[38px] min-w-[200px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 transition-[border-color,box-shadow] focus:border-[#00356b] focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
              >
                {eventCommunityOptions.map((opt) => (
                  <option key={opt.id} value={opt.name}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleEvents.map((event) => (event && event.id != null ? <EventCard key={event.id} event={event} /> : null))}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-sm font-semibold text-[#00356b] hover:underline"
            >
              {showMore ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="mt-16 text-center rounded-xl border border-slate-200 bg-white p-12 text-slate-600">
            {allEvents.length === 0
              ? 'No events yet. Check back later or explore other sections.'
              : 'No events match your filters.'}
          </div>
        )}
      </section>
    </div>
  );
}

export default Events;
