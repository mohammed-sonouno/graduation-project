import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { getEvents, eventImageUrl } from '../api';

const CAROUSEL_MAX = 6;

function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function EventCard({ event }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:ring-offset-2"
      style={{ textDecoration: 'none' }}
    >
      <div className="relative overflow-hidden">
        <div className="aspect-[2/1] w-full bg-slate-100">
          <img
            src={eventImageUrl(event.image)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            onError={(e) => { e.target.onerror = null; e.target.src = '/manage-events-hero.png'; }}
          />
          <div
            className="hidden h-full w-full items-center justify-center bg-slate-100"
            aria-hidden
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {event.date}
        </p>
        <h3 className="text-base font-semibold leading-snug text-slate-800 transition-colors group-hover:text-[#00356b]">
          {event.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-slate-500">
          {event.description}
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-slate-400">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-xs text-slate-500">{event.location}</span>
        </div>
      </div>
    </Link>
  );
}

export default function EventsCarousel() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    getEvents()
      .then((list) => {
        const raw = Array.isArray(list) ? list : [];
        const mapped = raw.slice(0, CAROUSEL_MAX).map((e) => ({
          id: e.id,
          title: e.title || '',
          date: formatEventDate(e.startDate),
          time: e.startTime || '',
          location: e.location || '',
          description: e.description || '',
          image: e.image || 'event1.jpg',
        }));
        setEvents(mapped);
      })
      .catch(() => setEvents([]));
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: events.length > 1,
      align: 'start',
      duration: 25,
      skipSnaps: false,
    },
    [
      Autoplay({
        delay: 2000,
        stopOnMouseEnter: true,
        stopOnInteraction: true,
        playOnInit: true,
      }),
    ]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    return () => emblaApi.off('select', onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => emblaApi?.plugins()?.autoplay?.stop()}
      onMouseLeave={() => emblaApi?.plugins()?.autoplay?.play()}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div
          className="flex touch-pan-y gap-4"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className="embla__slide min-w-0 flex-[0_0_100%] sm:flex-[0_0_calc((100%-1rem)/2)] lg:flex-[0_0_calc((100%-2rem)/3)]"
            >
              <EventCard event={event} />
            </div>
          ))}
        </div>
      </div>

      {/* Arrow controls — outside viewport to avoid drag conflicts */}
      <button
        type="button"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 -translate-x-1 items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:-translate-x-2"
        aria-label="Previous events"
      >
        <svg
          className="h-4 w-4 text-slate-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={scrollNext}
        disabled={!canScrollNext}
        className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm transition-all hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:translate-x-2"
        aria-label="Next events"
      >
        <svg
          className="h-4 w-4 text-slate-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Pagination dots */}
      <div
        className="mt-6 flex flex-wrap justify-center gap-1.5"
        role="tablist"
        aria-label="Event carousel pagination"
      >
        {events.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-label={`Go to event ${index + 1}`}
            aria-selected={selectedIndex === index}
            onClick={() => scrollTo(index)}
            className={`h-2 w-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 ${
              selectedIndex === index
                ? 'scale-110 bg-[#00356b]'
                : 'bg-slate-200 hover:bg-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
