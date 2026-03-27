import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/permissions';
import { scrollToTop } from '../utils/scroll';
import { getEvent, registerForEvent, setEventFeatured, eventImageUrl, getEventReviews, submitEventReview } from '../api';
import { REVIEW_MAX_CHARS } from '../../config/rules.js';

const REVIEWS_SECTION_ID = 'event-reviews';
const FEEDBACK_DISPLAYED_ON_PAGE = 2;

function IconCalendar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s7-7.75 7-13a7 7 0 10-14 0c0 5.25 7 13 7 13z" />
    </svg>
  );
}

function IconStar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// Reusable, accessible star rating with keyboard (arrows, enter/space) and hover preview
const RatingStars = React.forwardRef(function RatingStars(
  { value, onChange, readonly, hoverValue, onHoverChange, id, 'aria-label': ariaLabel },
  ref
) {
  const displayValue = hoverValue != null ? hoverValue : value;
  const groupRef = useRef(null);
  const setRef = useCallback(
    (el) => {
      groupRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (readonly) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(Math.min(5, value + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(Math.max(1, value - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Already set by click; no-op or confirm
      }
    },
    [readonly, value, onChange]
  );

  return (
    <div
      ref={setRef}
      role={readonly ? 'img' : 'group'}
      aria-label={readonly ? `Rating: ${value} out of 5 stars` : ariaLabel || 'Star rating'}
      tabIndex={readonly ? undefined : 0}
      onKeyDown={handleKeyDown}
      className="inline-flex gap-0.5 outline-none rounded"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          onMouseEnter={() => !readonly && onHoverChange && onHoverChange(star)}
          onMouseLeave={() => !readonly && onHoverChange && onHoverChange(null)}
          className={`p-0.5 rounded focus:outline-none transition-opacity ${!readonly ? 'hover:opacity-90' : ''}`}
          aria-label={readonly ? undefined : `Rate ${star} out of 5 stars`}
          aria-pressed={!readonly ? value >= star : undefined}
        >
          <svg
            className="w-6 h-6 transition-colors"
            fill={star <= displayValue ? '#00356b' : '#e2e8f0'}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
});

function EventHero({ event, isPast, scrollToReviewsId }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[#0b2d52]">
      <div className="absolute inset-0">
        <img
          src={eventImageUrl(event.image)}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover opacity-90 ${isPast ? 'grayscale' : ''}`}
          onError={(e) => { e.target.onerror = null; e.target.src = '/manage-events-hero.png'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b2d52]/85 via-[#0b2d52]/50 to-[#0b2d52]/30" aria-hidden />
      </div>
      <div className="relative max-w-6xl mx-auto px-6 lg:px-10 pt-12 pb-10">
        {isPast && (
          <span className="inline-flex rounded-full bg-slate-800/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur">
            Event concluded
          </span>
        )}
        <h1 className="mt-6 font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-tight max-w-3xl">
          {event.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-white/90 text-sm">
          <span className="inline-flex items-center gap-2">
            <IconCalendar className="h-5 w-5 flex-shrink-0" aria-hidden />
            {event.endDate && event.endDate !== event.date ? `${event.date} – ${event.endDate}` : (event.date || '')}
          </span>
          {(event.time || event.endTime) && (
            <span className="inline-flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {event.endTime ? `${event.time || ''} – ${event.endTime}` : (event.time || '')}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <IconPin className="h-5 w-5 flex-shrink-0" aria-hidden />
            <span className="truncate max-w-[280px]">{event.location}</span>
          </span>
        </div>
        {scrollToReviewsId && (
          <a
            href={`#${scrollToReviewsId}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white underline underline-offset-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#0b2d52] rounded"
          >
            Scroll to reviews
          </a>
        )}
      </div>
    </section>
  );
}

function ReviewForm({
  rating,
  setRating,
  reviewText,
  setReviewText,
  onSubmit,
  submitted,
  successMessage,
  errors,
  textareaRef,
  ratingRef,
}) {
  const [hoverValue, setHoverValue] = useState(null);
  const count = reviewText.length;
  const canSubmit = rating >= 1 && reviewText.trim().length > 0 && count <= REVIEW_MAX_CHARS;

  if (submitted && successMessage) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      >
        {successMessage}
      </div>
    );
  }

  if (submitted) {
    return <p className="text-slate-600 py-4">Thank you for submitting your review.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 transition-opacity duration-200">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2" id="rating-label">
          Your rating
        </p>
        <RatingStars
          ref={ratingRef}
          value={rating}
          onChange={setRating}
          readonly={false}
          hoverValue={hoverValue}
          onHoverChange={setHoverValue}
          aria-label="Select your rating from 1 to 5 stars"
        />
        <p className="mt-1.5 text-xs text-slate-500">Select a rating</p>
        {errors.rating && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.rating}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="review-details" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Review details
        </label>
        <textarea
          ref={textareaRef}
          id="review-details"
          value={reviewText}
          onChange={(e) => {
            const v = e.target.value;
            if (v.length <= REVIEW_MAX_CHARS) setReviewText(v);
          }}
          placeholder="Share your experience at the event..."
          rows={4}
          maxLength={REVIEW_MAX_CHARS}
          aria-describedby="review-char-count review-error"
          aria-invalid={!!errors.review}
          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition-colors ${
            errors.review ? 'border-red-400' : 'border-slate-200'
          }`}
        />
        <div className="mt-1 flex justify-between">
          <span id="review-char-count" className="text-xs text-slate-500">
            {count}/{REVIEW_MAX_CHARS}
          </span>
        </div>
        {errors.review && (
          <p id="review-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.review}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-xl bg-[#00356b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        aria-label="Submit your feedback"
      >
        Submit Feedback
      </button>
    </form>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-full bg-[#00356b] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0"
          aria-hidden
        >
          {review.initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{review.name}</p>
          <div className="mt-1">
            <RatingStars value={review.rating} readonly aria-label={`Rated ${review.rating} out of 5`} />
          </div>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{review.comment}</p>
        </div>
      </div>
    </article>
  );
}

function ReviewsSidebar({
  displayedReviews,
  totalCount,
  ratingSummary,
  sectionId,
}) {
  const hasReviews = totalCount > 0;
  const isEmpty = displayedReviews.length === 0;

  return (
    <aside
      id={sectionId}
      className="lg:sticky lg:top-24 lg:self-start space-y-5 transition-all duration-200"
      aria-label="Attendee reviews"
    >
      {hasReviews && ratingSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900" aria-label={`Average rating ${ratingSummary.average} out of 5`}>
              {ratingSummary.average.toFixed(1)}
            </span>
            <span className="text-slate-500">/5</span>
            <span className="text-sm text-slate-500">({ratingSummary.total} reviews)</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const pct = ratingSummary.total ? (ratingSummary.distribution[star] / ratingSummary.total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-slate-600">{star}★</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00356b] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                      role="presentation"
                    />
                  </div>
                  <span className="w-10 text-slate-500 text-right">{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-slate-900">
        Attendee feedback {hasReviews && `(${totalCount})`}
      </h2>

      <div className="space-y-4">
        {isEmpty && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            <p>No reviews yet. Be the first to review.</p>
          </div>
        )}
        {!isEmpty && displayedReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {hasReviews && totalCount > FEEDBACK_DISPLAYED_ON_PAGE && (
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm font-semibold text-[#00356b] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 rounded"
        >
          View all feedback
        </Link>
      )}
    </aside>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f6f3] animate-pulse">
      <div className="h-64 md:h-80 bg-slate-200" />
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-6 w-32 bg-slate-200 rounded" />
            <div className="h-20 bg-slate-200 rounded-xl" />
            <div className="h-6 w-40 bg-slate-200 rounded" />
            <div className="h-24 bg-slate-200 rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-24 bg-slate-200 rounded-xl" />
            <div className="h-32 bg-slate-200 rounded-xl" />
            <div className="h-32 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[60vh] bg-[#f7f6f3] flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          Event not found
        </h1>
        <p className="mt-2 text-slate-600">
          The event you are looking for may have been moved or removed.
        </p>
        <Link
          to="/events"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-[#00356b] px-6 py-3 text-white font-semibold hover:bg-[#002a54] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2"
        >
          ← Back to Events
        </Link>
      </div>
    </div>
  );
}

function EventDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [regAssociationMember, setRegAssociationMember] = useState('non-member');
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regErrors, setRegErrors] = useState({});
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredMessage, setFeaturedMessage] = useState(null);
  const textareaRef = useRef(null);
  const ratingRef = useRef(null);

  const [eventRaw, setEventRaw] = useState(null);

  const loadEvent = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getEvent(id)
      .then((e) => {
        if (!e) return setEventRaw(null);
        const start = e.startDate ? new Date(e.startDate) : null;
        const end = e.endDate ? new Date(e.endDate) : null;
        const dateStr = start && !isNaN(start.getTime())
          ? start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : '';
        const endDateStr = end && !isNaN(end.getTime())
          ? end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : '';
        const endTimePart = (e.endTime || '').trim() || '23:59';
        const endMs = e.endDate ? new Date(e.endDate.includes('T') ? e.endDate : `${e.endDate}T${endTimePart}`).getTime() : 0;
        const isEndPast = e.endDate && !isNaN(endMs) && endMs < Date.now();
        const displayStatus = isEndPast ? 'past' : (e.status === 'approved' ? 'upcoming' : (e.status || 'upcoming'));
        setEventRaw({
          id: e.id,
          title: e.title,
          description: e.description || '',
          category: e.category || 'Event',
          date: dateStr,
          endDate: endDateStr,
          time: e.startTime || '',
          endTime: e.endTime || '',
          location: e.location || '',
          image: e.image || '/event1.jpg',
          status: displayStatus,
          featured: Boolean(e.featured),
          price: e.price,
          priceMember: e.priceMember,
          seatsRemaining: e.seatsRemaining ?? e.availableSeats ?? 45,
          totalCapacity: e.totalCapacity ?? e.availableSeats ?? 200,
          customSections: e.customSections || [],
          myRegistration: e.myRegistration || null,
          forAllColleges: e.forAllColleges,
          targetCollegeNames: e.targetCollegeNames,
          targetAllMajors: e.targetAllMajors,
          targetMajorNames: e.targetMajorNames,
          communityName: e.communityName,
          collegeName: e.collegeName,
        });
      })
      .catch(() => setEventRaw(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!eventRaw?.id || eventRaw?.status !== 'past') return;
    getEventReviews(eventRaw.id)
      .then((list) => {
        const items = Array.isArray(list) ? list : [];
        setReviews(items.map((r) => ({
          id: r.id,
          name: r.name || 'Attendee',
          initials: (r.name || 'A').slice(0, 2).toUpperCase(),
          rating: r.rating,
          comment: r.comment || '',
          createdAt: r.createdAt,
        })));
      })
      .catch(() => setReviews([]));
  }, [eventRaw?.id, eventRaw?.status]);

  const event = eventRaw;
  const isPast = event?.status === 'past';

  /** Event description from database for Overview section. */
  const overviewDescription = useMemo(() => {
    const d = (event?.description ?? event?.about ?? '').trim();
    return d || '';
  }, [event?.description, event?.about]);

  const myReg = event?.myRegistration;
  const regStatus = myReg?.status;
  const isAdminUser = isAdmin(user);
  const hasApprovedRegistration = regStatus === 'approved';
  const canSubmitReview = !!user && isPast && (isAdminUser || hasApprovedRegistration);

  const ratingSummary = useMemo(() => {
    if (!reviews.length) return null;
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });
    return {
      average: sum / total,
      total,
      distribution,
    };
  }, [reviews]);

  const displayedReviews = useMemo(() => {
    const sorted = [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sorted.slice(0, FEEDBACK_DISPLAYED_ON_PAGE);
  }, [reviews]);

  const handleSubmitReview = (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (rating < 1) nextErrors.rating = 'Please select a rating.';
    if (reviewText.trim().length === 0) nextErrors.review = 'Comment is required';
    if (reviewText.length > REVIEW_MAX_CHARS) nextErrors.review = `Review must be no more than ${REVIEW_MAX_CHARS} characters.`;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.rating) ratingRef.current?.focus();
      else if (nextErrors.review) textareaRef.current?.focus();
      return;
    }

    setErrors({});
    if (!event?.id) return;
    submitEventReview(event.id, { rating, comment: reviewText.trim() })
      .then((saved) => {
        setReviews((prev) => [{
          id: saved.id,
          name: 'You',
          initials: 'Y',
          rating: saved.rating,
          comment: saved.comment || '',
          createdAt: saved.createdAt,
        }, ...prev]);
        setRating(0);
        setReviewText('');
        setSubmitted(true);
        setSuccessMessage('Thank you for submitting your feedback.');
        scrollToTop();
      })
      .catch((err) => {
        setErrors({ submit: err?.data?.error || 'Failed to submit feedback. Try again.' });
      });
  };

  const handleSetFeatured = () => {
    const eventId = event?.id;
    if (eventId == null || eventId === '' || featuredLoading) {
      if (eventId == null || eventId === '') {
        console.error('Set as Featured Event: event.id is missing', { event });
      }
      return;
    }
    setFeaturedMessage(null);
    setFeaturedLoading(true);
    setEventFeatured(eventId)
      .then(() => {
        setFeaturedMessage('This event is now the featured event on the Events page.');
        loadEvent();
      })
      .catch((err) => setFeaturedMessage(err?.data?.error || 'Failed to set featured event.'))
      .finally(() => setFeaturedLoading(false));
  };

  if (loading) return <LoadingSkeleton />;
  if (!event) return <NotFound />;

  if (isPast) {
    return (
      <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
        <EventHero event={event} isPast={true} scrollToReviewsId={REVIEWS_SECTION_ID} />

        <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-6">
          <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
            <Link to="/events" className="hover:text-[#00356b] hover:underline">
              Events
            </Link>
            <span className="mx-2 text-slate-300" aria-hidden>›</span>
            <span className="text-slate-800 font-medium">{event.title}</span>
          </nav>
          {isAdmin(user) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {event?.featured ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800">
                  <IconStar className="h-5 w-5" />
                  Featured Event
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSetFeatured}
                  disabled={featuredLoading || !event?.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconStar className="h-5 w-5" />
                  {featuredLoading ? 'Setting Featured...' : 'Set as Featured Event'}
                </button>
              )}
              {featuredMessage && (
                <span className={`text-sm ${featuredMessage.startsWith('This event') ? 'text-emerald-600' : 'text-red-600'}`}>{featuredMessage}</span>
              )}
            </div>
          )}
        </div>

        <section className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 border-b-2 border-[#00356b] pb-2 w-fit">
                  Overview
                </h2>
                <div className="mt-4 space-y-4 text-slate-600 leading-relaxed">
                  {overviewDescription ? (
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{overviewDescription}</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Feedback &amp; Rating
                </h2>
                {canSubmitReview ? (
                  <ReviewForm
                    rating={rating}
                    setRating={setRating}
                    reviewText={reviewText}
                    setReviewText={setReviewText}
                    onSubmit={handleSubmitReview}
                    submitted={submitted}
                    successMessage={successMessage}
                    errors={errors}
                    textareaRef={textareaRef}
                    ratingRef={ratingRef}
                  />
                ) : user ? (
                  <p className="text-slate-600">
                    Feedback can be submitted only by attendees with an approved registration after the event has ended.
                  </p>
                ) : (
                  <p className="text-slate-600">
                    <Link to="/login" className="text-[#00356b] font-medium hover:underline">Sign in</Link>
                    {' '}to leave feedback and a star rating for this event.
                  </p>
                )}
              </div>
            </div>

            <ReviewsSidebar
              displayedReviews={displayedReviews}
              totalCount={reviews.length}
              ratingSummary={ratingSummary}
              sectionId={REVIEWS_SECTION_ID}
            />
          </div>
        </section>
      </div>
    );
  }

  /* Upcoming event – same pattern as past: hero, breadcrumb, 2 columns */
  const seatsRemaining = event.seatsRemaining ?? 45;
  const totalCapacity = event.totalCapacity ?? 200;
  const seatsFilled = event.seatsFilled ?? (totalCapacity > 0 ? Math.max(0, totalCapacity - seatsRemaining) : 0);
  const seatsPercent = totalCapacity > 0 ? (seatsFilled / totalCapacity) * 100 : 0;
  const eventPrice = event.price != null ? event.price : 'Free';
  const eventPriceMember = event.priceMember != null ? event.priceMember : eventPrice;
  const formatPrice = (p) => (typeof p === 'number' ? `${p} NIS` : p);

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegErrors({});
    setRegSubmitted(true);
    if (!user || !event) return;
    try {
      await registerForEvent({
        eventId: event.id,
        associationMember: regAssociationMember,
      });
      loadEvent();
      scrollToTop();
    } catch (err) {
      console.warn('Registration failed', err);
      setRegSubmitted(false);
      setRegErrors({ submit: err.data?.error || 'Registration failed. Try again.' });
    }
  };

  const isPending = regStatus === 'pending' || regStatus === 'pending_payment';
  const isApproved = regStatus === 'approved';
  const isRejected = regStatus === 'rejected';
  const isFull = (event?.totalCapacity != null && event.totalCapacity > 0) && (event?.seatsRemaining != null && event.seatsRemaining <= 0);
  const canRegister = !isPending && !isApproved && !isFull && user;

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      {/* Hero – same style as past event */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0b2d52]">
        <div className="absolute inset-0">
          <img
            src={eventImageUrl(event.image)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90"
            onError={(e) => { e.target.onerror = null; e.target.src = '/manage-events-hero.png'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b2d52]/85 via-[#0b2d52]/50 to-[#0b2d52]/30" aria-hidden />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 pt-12 pb-10">
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-tight max-w-3xl">
            {event.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-white/90 text-sm">
            <span className="inline-flex items-center gap-2">
              <IconCalendar className="h-5 w-5 flex-shrink-0" aria-hidden />
              {event.endDate && event.endDate !== event.date ? `${event.date} – ${event.endDate}` : (event.date || '')}
            </span>
            <span className="inline-flex items-center gap-2">
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {event.endTime ? `${event.time || ''} – ${event.endTime}` : (event.time || '')}
            </span>
            <span className="inline-flex items-center gap-2">
              <IconPin className="h-5 w-5 flex-shrink-0" aria-hidden />
              <span className="truncate max-w-[280px]">{event.location}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Breadcrumb + admin featured action */}
      <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-6">
        <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
          <Link to="/events" className="hover:text-[#00356b] hover:underline">
            Events
          </Link>
          <span className="mx-2 text-slate-300" aria-hidden>›</span>
          <span className="text-slate-800 font-medium">{event.title}</span>
        </nav>
        {isAdmin(user) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {event?.featured ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800">
                <IconStar className="h-5 w-5" />
                Featured Event
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSetFeatured}
                disabled={featuredLoading || !event?.id}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconStar className="h-5 w-5" />
                {featuredLoading ? 'Setting Featured...' : 'Set as Featured Event'}
              </button>
            )}
            {featuredMessage && (
              <span className={`text-sm ${featuredMessage.startsWith('This event') ? 'text-emerald-600' : 'text-red-600'}`}>{featuredMessage}</span>
            )}
          </div>
        )}
      </div>

      {/* Two columns – same grid as past event */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <div>
              <h2 className="text-xl font-semibold text-slate-900 border-b-2 border-[#00356b] pb-2 w-fit">
                Overview
              </h2>
              <div className="mt-4 space-y-4">
                {overviewDescription ? (
                  <p className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{overviewDescription}</p>
                ) : null}
              </div>
            </div>

            {/* Event details card – price, association members, status, and extra sections in one white block */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 border-b-2 border-[#00356b] pb-2 w-fit">
                Event details
              </h2>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Price</dt>
                  <dd className="mt-1 text-base font-semibold text-[#00356b]">{formatPrice(eventPrice)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Association members</dt>
                  <dd className="mt-1 text-base font-semibold text-[#00356b]">{formatPrice(eventPriceMember)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current status</dt>
                  <dd className="mt-1 text-base font-semibold text-[#00356b]">{seatsRemaining} seats remaining</dd>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00356b] rounded-full transition-all duration-300"
                        style={{ width: `${seatsPercent}%` }}
                        role="presentation"
                      />
                    </div>
                    <span className="text-sm text-slate-500 whitespace-nowrap">{totalCapacity} total capacity</span>
                  </div>
                </div>
                {(event.communityName || event.collegeName) && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Community & college</dt>
                    <dd className="mt-1 text-base text-slate-600">
                      {[event.communityName, event.collegeName].filter(Boolean).join(' · ')}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Who can join</dt>
                  <dd className="mt-1 text-base text-slate-600">
                    {event.forAllColleges !== false
                      ? 'All students (any college and major)'
                      : [
                          event.targetCollegeNames?.length
                            ? `Colleges: ${event.targetCollegeNames.join(', ')}`
                            : 'Specific colleges',
                          event.targetAllMajors !== false
                            ? ' · All majors'
                            : (event.targetMajorNames?.length ? ` · Majors: ${event.targetMajorNames.join(', ')}` : ' · Specific majors'),
                        ].filter(Boolean).join('')}
                  </dd>
                </div>
                {/* Extra sections (from Manage Events) – same style as Price, no new white card */}
                {Array.isArray(event.customSections) && event.customSections.map((sec) => (
                  <div key={sec.id || sec.sectionTitle}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{sec.sectionTitle || 'Section'}</dt>
                    <dd className="mt-1 text-base text-slate-600 leading-relaxed whitespace-pre-wrap">{sec.content || ''}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Reserve Your Seat – same card style as past event sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Reserve your seat</h2>
              <p className="text-sm text-slate-600 mb-5">Join us at {event.location}</p>
              {isApproved ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">You are registered</p>
                  <p className="mt-0.5">Your registration for this event is confirmed.</p>
                </div>
              ) : isPending || regSubmitted ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Pending approval</p>
                  <p className="mt-0.5">Your request is waiting for approval from the community leader. You will be notified when it is decided.</p>
                </div>
              ) : isFull ? (
                <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold">Registration closed</p>
                  <p className="mt-0.5">This event is full. You can still view the details but registration is no longer available.</p>
                </div>
              ) : !user ? (
                <p className="text-sm text-slate-600">Sign in to register for this event.</p>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <p className="text-sm text-slate-600">Your name, email, and student info will be taken from your profile.</p>
                  <div>
                    <span className="block text-sm font-semibold text-slate-700 mb-2">Are you an association member?</span>
                    <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Association member">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reg-association"
                          value="member"
                          checked={regAssociationMember === 'member'}
                          onChange={(e) => setRegAssociationMember(e.target.value)}
                          className="w-4 h-4 text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                        />
                        <span className="text-sm text-slate-700">Yes</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reg-association"
                          value="non-member"
                          checked={regAssociationMember === 'non-member'}
                          onChange={(e) => setRegAssociationMember(e.target.value)}
                          className="w-4 h-4 text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                        />
                        <span className="text-sm text-slate-700">No</span>
                      </label>
                    </div>
                  </div>
                  {regErrors.submit && (
                    <p className="text-sm text-red-600" role="alert">{regErrors.submit}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#00356b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 transition-colors"
                  >
                    Register for event
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default EventDetails;
