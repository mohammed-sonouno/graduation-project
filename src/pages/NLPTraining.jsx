import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin } from "../utils/permissions";
import { apiUrl, getColleges, getCommunities, getMajors } from "../lib/api";
import { buildCanonicalCollegeOptions } from "../canonicalCollege";

const SERIF = "'Libre Baskerville', Georgia, serif";

async function apiFetch(path, opts = {}) {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText || "Request failed");
  return data;
}

function fmtDate(d) {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? String(d)
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SENTIMENT_OPTIONS = [
  {
    value: "positive",
    label: "Positive",
    active: "bg-[#00356b] text-white border-[#00356b]",
    idle: "bg-white text-[#00356b] border-[#00356b]/35 hover:bg-[#00356b]/5 hover:border-[#00356b]/55",
    dot: "bg-emerald-500",
  },
  {
    value: "neutral",
    label: "Neutral",
    active: "bg-[#0b2d52] text-white border-[#0b2d52]",
    idle: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400",
    dot: "bg-slate-400",
  },
  {
    value: "negative",
    label: "Negative",
    active: "bg-[#7f1d1d] text-white border-[#7f1d1d]",
    idle: "bg-white text-rose-900 border-rose-200 hover:bg-rose-50 hover:border-rose-300",
    dot: "bg-rose-500",
  },
];

function formatSentimentLabel(value) {
  if (!value) return "—";
  const opt = SENTIMENT_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

function ReviewCard({ review, onOverride, saving }) {
  const activeSentiment = review.override_sentiment || null;
  const commentText = review.comment_text || review.comment || "";

  return (
    <article
      className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-opacity ${
        saving ? "opacity-60 pointer-events-none" : ""
      } ${review.nlp_flag_for_review && !activeSentiment ? "border-amber-200/90" : "border-slate-200"}`}
    >
      <div
        className={`px-5 py-3 border-b text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
          review.nlp_flag_for_review && !activeSentiment
            ? "bg-amber-50/80 border-amber-100 text-amber-900"
            : activeSentiment && !review.used_for_training
            ? "bg-[#00356b]/5 border-slate-100 text-[#00356b]"
            : "bg-slate-50/80 border-slate-100 text-slate-500"
        }`}
      >
        <span className="uppercase tracking-[0.14em] text-[10px]">
          {review.nlp_flag_for_review && !activeSentiment
            ? "Flagged for review"
            : activeSentiment && !review.used_for_training
            ? "Queued for training"
            : activeSentiment
            ? "Label confirmed"
            : "Awaiting label"}
        </span>
        {review.sentiment && (
          <span className="text-[11px] font-normal text-slate-500">
            Model: <span className="font-semibold text-slate-600">{formatSentimentLabel(review.sentiment)}</span>
          </span>
        )}
      </div>

      <div className="p-5 border-l-4 border-[#00356b]/25">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">
          Student comment
        </p>
        <blockquote className="text-base leading-relaxed text-slate-800 text-left" dir="auto">
          {commentText.trim() ? (
            commentText
          ) : (
            <span className="text-slate-400 text-sm">No comment text provided.</span>
          )}
        </blockquote>

        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          {review.student_name && (
            <span className="text-sm font-medium text-[#0b2d52]">{review.student_name}</span>
          )}
          {review.major_name && (
            <span className="rounded-full bg-[#00356b]/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00356b]">
              {review.major_name}
            </span>
          )}
          {review.college_name && !review.major_name && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
              {review.college_name}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-3">
          Correct sentiment label
        </p>
        <div className="flex flex-wrap gap-2">
          {SENTIMENT_OPTIONS.map((btn) => {
            const isActive = activeSentiment === btn.value;
            return (
              <button
                key={btn.value}
                type="button"
                disabled={saving}
                onClick={() => onOverride(review.id, btn.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#00356b]/25 disabled:cursor-wait ${
                  isActive ? btn.active : btn.idle
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-white/90" : btn.dot}`} aria-hidden />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>
        {activeSentiment && activeSentiment !== review.sentiment && (
          <p className="mt-3 text-[11px] text-slate-500">
            Admin override recorded. This correction will be included in the next training run.
          </p>
        )}
      </div>
    </article>
  );
}

export default function NLPTraining() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [stats, setStats] = useState({ totalPending: 0, pending_training: 0 });
  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState(null);
  const [trainError, setTrainError] = useState(null);

  const [savingId, setSavingId] = useState(null);
  const [patchError, setPatchError] = useState(null);

  const totalPending = stats.totalPending ?? stats.pending_training ?? 0;
  const isAdminUser = Boolean(user && isAdmin(user));

  const hasActiveFilters = Boolean(selectedCollegeId || selectedCommunityId || search.trim());

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin(user)) {
      navigate("/admin", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isAdminUser) return;
    Promise.all([getColleges(), getMajors()])
      .then(([list, majors]) => {
        setColleges(buildCanonicalCollegeOptions(Array.isArray(list) ? list : [], Array.isArray(majors) ? majors : []));
      })
      .catch(() => setColleges([]));
  }, [isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) return;
    const params = { kind: "association", limit: 200 };
    if (selectedCollegeId) {
      const name = colleges.find((c) => String(c.id) === String(selectedCollegeId))?.name;
      if (name) params.college = name;
    }
    getCommunities(params)
      .then((list) => setCommunities(Array.isArray(list) ? list : []))
      .catch(() => setCommunities([]));
  }, [isAdminUser, selectedCollegeId, colleges]);

  const communityOptions = useMemo(() => {
    const byId = new Map();
    (communities || []).forEach((c) => {
      if (c?.id != null && !byId.has(String(c.id))) byId.set(String(c.id), c);
    });
    return Array.from(byId.values());
  }, [communities]);

  useEffect(() => {
    if (
      selectedCommunityId &&
      !communityOptions.some((c) => String(c.id) === String(selectedCommunityId))
    ) {
      setSelectedCommunityId("");
    }
  }, [selectedCollegeId, communityOptions, selectedCommunityId]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/admin/nlp/stats");
      setStats({
        totalPending: data.totalPending ?? data.pending_training ?? 0,
        pending_training: data.pending_training ?? 0,
      });
    } catch {
      setStats({ totalPending: 0, pending_training: 0 });
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    if (!isAdminUser) return;
    setLoadingEvents(true);
    setEventsError(null);
    try {
      const q = new URLSearchParams();
      if (searchDebounced) q.set("search", searchDebounced);
      if (selectedCollegeId) q.set("college_id", selectedCollegeId);
      if (selectedCommunityId) q.set("community_id", selectedCommunityId);
      const data = await apiFetch(`/api/admin/nlp/events?${q}`);
      const list = data.events ?? [];
      setEvents(list);
      setSelectedEventId((prev) => {
        if (prev && list.some((e) => String(e.id) === String(prev))) return prev;
        return list[0]?.id ? String(list[0].id) : "";
      });
    } catch (e) {
      setEvents([]);
      setSelectedEventId("");
      setEventsError(e.message || "Failed to load events");
    }
    setLoadingEvents(false);
  }, [isAdminUser, searchDebounced, selectedCollegeId, selectedCommunityId]);

  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)) ?? null,
    [events, selectedEventId]
  );

  const fetchReviews = useCallback(async () => {
    if (!selectedEventId) {
      setReviews([]);
      return;
    }
    setLoadingReviews(true);
    try {
      const q = new URLSearchParams({ event_id: selectedEventId, filter: "all" });
      const data = await apiFetch(`/api/admin/nlp/reviews?${q}`);
      setReviews(data.reviews ?? []);
    } catch {
      setReviews([]);
    }
    setLoadingReviews(false);
  }, [selectedEventId]);

  useEffect(() => {
    if (isAdminUser) fetchStats();
  }, [isAdminUser, fetchStats]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleOverride = async (reviewId, sentiment) => {
    setPatchError(null);
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, override_sentiment: sentiment, used_for_training: false } : r
      )
    );

    setSavingId(reviewId);
    try {
      const data = await apiFetch("/api/admin/nlp/override", {
        method: "POST",
        body: JSON.stringify({ reviewId, sentiment }),
      });
      if (data.updatedReview) {
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? { ...r, ...data.updatedReview } : r))
        );
      }
      fetchStats();
      fetchEvents();
    } catch (e) {
      setPatchError(e.message);
      fetchReviews();
    }
    setSavingId(null);
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainMessage(null);
    setTrainError(null);
    try {
      const result = await apiFetch("/api/admin/nlp/train", { method: "POST" });
      setTrainMessage(
        `Training completed successfully. ${result.samples_used ?? result.samples_received ?? "—"} sample(s) incorporated into the model.`
      );
      fetchStats();
      fetchEvents();
      fetchReviews();
    } catch (e) {
      setTrainError(e.message);
    }
    setTraining(false);
  };

  const handleCollegeChange = (value) => {
    setSelectedCollegeId(value);
    setSelectedCommunityId("");
    setSelectedEventId("");
  };

  const handleCommunityChange = (value) => {
    setSelectedCommunityId(value);
    setSelectedEventId("");
  };

  const resetFilters = () => {
    setSelectedCollegeId("");
    setSelectedCommunityId("");
    setSearch("");
    setSelectedEventId("");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!isAdminUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <nav className="text-sm" aria-label="Breadcrumb">
            <Link to="/admin" className="text-slate-500 hover:text-slate-700 transition-colors">
              Admin Portal
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden>
              &gt;
            </span>
            <span className="font-semibold text-[#00356b]">NLP Sentiment Training</span>
          </nav>
        </div>
      </section>

      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 mb-3">
              Admin Portal · Machine Learning
            </p>
            <h1
              className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4"
              style={{ fontFamily: SERIF }}
            >
              NLP Sentiment Training
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Review student feedback, assign sentiment labels for model training, and refine classification accuracy
              across university events.
            </p>
            <p className="mt-4 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{totalPending}</span> correction
              {totalPending !== 1 ? "s" : ""} queued for training
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 mb-8">
          <button
            type="button"
            onClick={handleTrain}
            disabled={training || totalPending < 1}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00356b] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title={
              totalPending < 1
                ? "Assign at least one sentiment label to enable training"
                : "Run NLP training on queued corrections"
            }
          >
            {training ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                Training in progress…
              </>
            ) : totalPending >= 1 ? (
              `Train model (${totalPending})`
            ) : (
              "Train model"
            )}
          </button>
          <p className="text-center sm:text-left text-xs text-slate-500 max-w-xs">
            {totalPending >= 1
              ? "Ready when one or more labels are queued."
              : "Select a sentiment on any review to queue training."}
          </p>
        </div>

        {(trainMessage || trainError) && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
              trainError
                ? "border-red-200/90 bg-red-50 text-red-800"
                : "border-emerald-200/90 bg-emerald-50/80 text-emerald-900"
            }`}
            role="status"
          >
            {trainError ? (
              <svg className="w-5 h-5 shrink-0 mt-0.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="leading-relaxed">{trainError || trainMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-[#12355b]" style={{ fontFamily: SERIF }}>
                  Event filters
                </h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className={`h-9 text-sm rounded-full px-4 transition-colors ${
                    hasActiveFilters
                      ? "bg-[#0b2d52] text-white border border-[#0b2d52] hover:bg-[#123d67]"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  }`}
                >
                  Reset filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nlp-college" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">
                    College
                  </label>
                  <select
                    id="nlp-college"
                    value={selectedCollegeId}
                    onChange={(e) => handleCollegeChange(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  >
                    <option value="">All Colleges</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="nlp-community" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">
                    Community
                  </label>
                  <select
                    id="nlp-community"
                    value={selectedCommunityId}
                    onChange={(e) => handleCommunityChange(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                  >
                    <option value="">All Communities</option>
                    {communityOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="nlp-search" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">
                    Search
                  </label>
                  <input
                    id="nlp-search"
                    type="search"
                    placeholder="Event title or keyword"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label htmlFor="nlp-event" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">
                    Event
                  </label>
                  {loadingEvents ? (
                    <div className="h-11 flex items-center px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
                      <span className="inline-block w-4 h-4 border-2 border-[#00356b]/30 border-t-[#00356b] rounded-full animate-spin mr-2" />
                      Loading events…
                    </div>
                  ) : eventsError ? (
                    <div className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {eventsError}
                    </div>
                  ) : events.length === 0 ? (
                    <div className="h-11 flex items-center px-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                      No events match filters
                    </div>
                  ) : (
                    <select
                      id="nlp-event"
                      value={selectedEventId}
                      onChange={(e) => {
                        setSelectedEventId(e.target.value);
                        setPatchError(null);
                      }}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                    >
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title}
                          {ev.start_date ? ` — ${fmtDate(ev.start_date)}` : ""}
                          {ev.review_count != null ? ` (${ev.review_count} reviews)` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <section aria-label="Review annotations">
              {!selectedEventId || !selectedEvent ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center py-20 px-6 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#00356b]/8 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-[#00356b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-[#0b2d52] mb-2" style={{ fontFamily: SERIF }}>
                    Select an event
                  </h2>
                  <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                    Use the filters above to locate an event, then assign sentiment labels to each student review below.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-[#12355b] uppercase tracking-[0.12em]" style={{ fontFamily: SERIF }}>
                      Student reviews
                    </h2>
                    <span className="text-xs text-slate-500">
                      {loadingReviews ? "Loading…" : `${reviews.length} review${reviews.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>

                  {patchError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      {patchError}
                    </div>
                  )}

                  {loadingReviews ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-36 rounded-xl border border-slate-200 bg-white animate-pulse" />
                      ))}
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
                      <p className="text-sm text-slate-500">No reviews recorded for this event.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          onOverride={handleOverride}
                          saving={savingId === review.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Selected event
              </p>
              <p className="mt-3 text-base font-semibold text-[#0b2d52] leading-snug" style={{ fontFamily: SERIF }}>
                {selectedEvent?.title || "—"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {selectedEvent?.start_date ? fmtDate(selectedEvent.start_date) : "Date not available"}
              </p>
              {selectedEvent && (
                <dl className="mt-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-4">
                  {selectedEvent.community_name && (
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-slate-400">Community</dt>
                      <dd className="text-slate-700 text-right">{selectedEvent.community_name}</dd>
                    </div>
                  )}
                  {selectedEvent.college_name && (
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-slate-400">College</dt>
                      <dd className="text-slate-700 text-right">{selectedEvent.college_name}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt className="font-medium text-slate-400">Reviews</dt>
                    <dd className="text-slate-700 font-semibold tabular-nums">{selectedEvent.review_count ?? 0}</dd>
                  </div>
                  {selectedEvent.flagged_count > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-slate-400">Flagged</dt>
                      <dd className="text-amber-700 font-semibold tabular-nums">{selectedEvent.flagged_count}</dd>
                    </div>
                  )}
                  {selectedEvent.pending_corrections > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="font-medium text-slate-400">Pending</dt>
                      <dd className="text-[#00356b] font-semibold tabular-nums">{selectedEvent.pending_corrections}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#00356b]/[0.03] px-5 py-4 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-[#00356b] mb-2 uppercase tracking-[0.14em] text-[10px]">
                Workflow
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-600">
                <li>Filter and select an event.</li>
                <li>Read each comment and assign Positive, Neutral, or Negative.</li>
                <li>Run Train model when corrections are queued.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
