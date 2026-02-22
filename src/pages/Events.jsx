import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENTS, EVENT_CATEGORIES, EVENT_ORGANIZERS } from '../data/events';
import { getApprovedManagedEvents } from '../data/managedEvents';

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
  const isPast = event.status === 'past';

  return (
    <article className="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        <img
          src={event.image}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            const fallback = e.target.nextElementSibling;
            if (fallback) fallback.classList.remove('hidden');
          }}
        />
        <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            University Event
          </span>
        </div>
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#00356b] backdrop-blur">
          {event.category}
        </span>
      </div>

      <div className="flex h-full flex-col p-5">
        <h3 className="font-serif text-lg font-semibold leading-snug text-slate-900">
          {event.title}
        </h3>

        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-slate-500" />
            <span>{event.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-slate-500" />
            <span>{event.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <IconPin className="h-4 w-4 text-slate-500" />
            <span className="line-clamp-1">{event.location}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-3">
          {event.description}
        </p>

        <div className="mt-5">
          <Link
            to={`/events/${event.id}`}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#00356b] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
            aria-label={`${isPast ? 'View archive' : 'View details'}: ${event.title}`}
          >
            {isPast ? 'View Archive' : 'View Details'}
          </Link>
        </div>
      </div>
    </article>
  );
}

function Events() {
  const allEvents = useMemo(() => [...EVENTS, ...getApprovedManagedEvents()], []);
  const featured = allEvents.find((e) => e.featured) || allEvents[0];
  const [tab, setTab] = useState('all'); // all | upcoming | past
  const [category, setCategory] = useState('All Categories');
  const [organizer, setOrganizer] = useState('All Organizers');
  const [showMore, setShowMore] = useState(false);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      const matchTab = tab === 'all' ? true : e.status === tab;
      const matchCategory = category === 'All Categories' ? true : (e.category || '') === category;
      const matchOrganizer = organizer === 'All Organizers' ? true : (e.organizer || '') === organizer;
      return matchTab && matchCategory && matchOrganizer;
    });
  }, [tab, category, organizer]);

  const visibleEvents = showMore ? filtered : filtered.slice(0, INITIAL_EVENTS_COUNT);
  const hasMore = filtered.length > INITIAL_EVENTS_COUNT;

  useEffect(() => {
    setShowMore(false);
  }, [tab, category, organizer]);

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
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

          {/* Featured strip */}
          <div className="mt-8 max-w-4xl rounded-2xl border border-white/20 bg-white/7 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/80">
                  Featured Event
                </p>
                <h2 className="mt-1 font-serif text-xl md:text-2xl font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
                  {featured.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/85">
                  <span className="inline-flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    {featured.date}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <IconClock className="h-4 w-4" />
                    {featured.time}
                  </span>
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <IconPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{featured.location}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to={`/events/${featured.id}`}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#00356b] shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label={`Register now: ${featured.title}`}
                >
                  Register Now →
                </Link>
              </div>
            </div>
          </div>
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

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600" htmlFor="event-category">
              Category
            </label>
            <select
              id="event-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="text-sm text-slate-600" htmlFor="event-organizer">
              Organizer
            </label>
            <select
              id="event-organizer"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
            >
              {EVENT_ORGANIZERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
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
          <div className="mt-16 text-center text-slate-600">
            No events match your filters.
          </div>
        )}
      </section>
    </div>
  );
}

export default Events;
