import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isStudent } from "../utils/permissions";
import {
  getAdminEvents,
  getColleges,
  getCommunities,
  getEventAnalytics,
  getEventFeedback,
} from "../api";

/* ─── tiny helpers ─────────────────────────────────────────── */
function StarRow({ value = 0, size = 13 }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 14 14"
          fill={i < Math.round(value) ? "#eab308" : "none"}
          stroke={i < Math.round(value) ? "#eab308" : "#cbd5e1"}
          strokeWidth="1.2"
        >
          <polygon points="7,1 8.8,5.4 13.5,5.9 10,9.1 11,13.7 7,11.3 3,13.7 4,9.1 0.5,5.9 5.2,5.4" />
        </svg>
      ))}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "blue", badge, progress, stars }) {
  const accentMap = {
    blue:   { card: "bg-white border-slate-200", value: "text-[#0b2d52]", badge: "bg-blue-50 text-blue-700", progress: "bg-[#2563eb]" },
    green:  { card: "bg-emerald-50/60 border-emerald-200", value: "text-emerald-800", badge: "bg-emerald-100 text-emerald-700", progress: "bg-[#2f6f56]" },
    red:    { card: "bg-rose-50/60 border-rose-200", value: "text-rose-800", badge: "bg-rose-100 text-rose-700", progress: "bg-[#d33b42]" },
    amber:  { card: "bg-amber-50/60 border-amber-200", value: "text-amber-800", badge: "bg-amber-100 text-amber-700", progress: "bg-[#d9b44a]" },
    gray:   { card: "bg-white border-slate-200", value: "text-[#0b2d52]", badge: "bg-slate-100 text-slate-600", progress: "bg-slate-400" },
  };
  const cfg = accentMap[accent] || accentMap.gray;
  const normalizedValue = String(value ?? "—");
  const isLongValue = normalizedValue.length > 12 || normalizedValue.includes(" ");
  return (
    <div className={`rounded-2xl border shadow-sm ${cfg.card} px-5 py-4 min-h-[126px] flex flex-col justify-between`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-2">
        <p className={`${isLongValue ? "text-[1.7rem] md:text-[1.95rem] leading-tight max-w-[11ch]" : "text-[2rem] md:text-[2.15rem] leading-none"} font-semibold ${cfg.value}`}>
          {normalizedValue}
        </p>
        {stars ? <div className="mt-2">{stars}</div> : null}
        {progress != null ? (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${cfg.progress}`}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs text-slate-400 leading-snug">{sub || ""}</p>
        {badge ? (
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap ${cfg.badge}`}>
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function KeywordPanel({ title, tone, items, emptyText }) {
  const cfg =
    tone === "negative"
      ? {
          card: "border-rose-100 bg-rose-50/35",
          bar: "bg-rose-400",
          title: "text-[#2a2d44]",
          chip: "border-rose-200 bg-white text-slate-700",
          count: "bg-rose-50 text-rose-600",
        }
      : {
          card: "border-blue-100 bg-blue-50/35",
          bar: "bg-emerald-400",
          title: "text-[#2a2d44]",
          chip: "border-blue-100 bg-white text-slate-700",
          count: "bg-blue-50 text-blue-600",
        };

  return (
    <div className={`rounded-2xl border px-6 py-5 shadow-sm ${cfg.card}`}>
      <div className="flex items-center gap-3 mb-5">
        <span className={`h-6 w-1.5 rounded-full ${cfg.bar}`} />
        <h3
          className={`text-2xl font-semibold leading-tight ${cfg.title}`}
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {title}
        </h3>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {items.map((k) => (
            <span
              key={`${tone}-${k.word}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${cfg.chip}`}
            >
              <span className="truncate max-w-[180px]">{k.word}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.count}`}>
                {k.count}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function StatusPill({ tone = "neutral", children }) {
  const tones = {
    positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    neutral: "bg-yellow-50 text-yellow-700 border-yellow-200",
    negative: "bg-red-50 text-red-700 border-red-200",
    info: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone] || tones.info}`}>
      {children}
    </span>
  );
}

function RatingBar({ star, count, totalCount }) {
  const colors = { 5: "bg-[#173b63]", 4: "bg-[#355b85]", 3: "bg-[#5d7fa3]", 2: "bg-[#87a2bc]", 1: "bg-[#b3c2d2]" };
  const exactPercent = totalCount > 0 ? (count / totalCount) * 100 : 0;
  const w = `${Math.max(0, Math.min(100, exactPercent))}%`;
  const percent = totalCount > 0 ? Math.round(exactPercent) : 0;
  return (
    <div className="grid grid-cols-[58px_1fr_82px] items-center gap-4">
      <span className="text-sm font-medium text-slate-600 shrink-0">{star} Star</span>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-3 rounded-full ${colors[star]} transition-all duration-500`} style={{ width: w }} />
      </div>
      <span className="text-right text-sm font-semibold text-slate-700 shrink-0">
        {count} <span className="text-slate-400 font-medium">({percent}%)</span>
      </span>
    </div>
  );
}

function DonutChart({
  positive = 0,
  neutral = 0,
  negative = 0,
  positiveCount = 0,
  neutralCount = 0,
  negativeCount = 0,
}) {
  const palette = {
    positive: "#5b8a74",
    neutral: "#c4a460",
    negative: "#b87474",
  };
  const dominant = Math.max(positive, neutral, negative);
  const dominantKey =
    dominant === positive ? "positive" : dominant === negative ? "negative" : "neutral";
  const labelMap = {
    positive: "Mostly Positive",
    neutral: "Mostly Neutral",
    negative: "Mostly Negative",
  };
  const insightMap = {
    positive: "Most participants shared positive impressions, with only limited critical feedback.",
    neutral: "Most participants gave neutral feedback, with limited negative responses.",
    negative: "Negative feedback is more noticeable, suggesting clear room for improvement.",
  };
  const total = Math.max(positive + neutral + negative, 1);
  const c1 = positive;
  const c2 = positive + neutral;
  const p1 = (c1 / total) * 100;
  const p2 = (c2 / total) * 100;
  const legendItems = [
    { key: "positive", label: "Positive", percent: positive, count: positiveCount },
    { key: "neutral", label: "Neutral", percent: neutral, count: neutralCount },
    { key: "negative", label: "Negative", percent: negative, count: negativeCount },
  ];
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex justify-center">
        <div
          className="relative h-48 w-48 rounded-full sm:h-52 sm:w-52"
          style={{
            background: `conic-gradient(${palette.positive} 0 ${p1}%, ${palette.neutral} ${p1}% ${p2}%, ${palette.negative} ${p2}% 100%)`,
          }}
        >
          <div className="absolute inset-[14px] rounded-full border border-slate-100 bg-white flex flex-col items-center justify-center text-center shadow-[inset_0_1px_4px_rgba(15,23,42,0.04)]">
            <span className="text-[2.45rem] font-semibold leading-none text-[#12355b]">{dominant}%</span>
            <span className="mt-2 text-sm font-medium text-slate-600">
              {labelMap[dominantKey]}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6 w-full space-y-2.5">
        {legendItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette[item.key] }} />
              {item.label}
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {item.percent}% <span className="text-slate-400 font-medium">({item.count})</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-relaxed text-slate-500">
        {insightMap[dominantKey]}
      </p>
    </div>
  );
}

function AnalyticsCard({ title, subtitle, children, className = "", bodyClassName = "" }) {
  return (
    <div className={`h-full rounded-[26px] border border-slate-200 bg-white shadow-sm px-7 py-5 flex flex-col ${className}`}>
      <div className="mb-5">
        <p className="text-lg font-semibold text-[#12355b]">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */
function Dashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [events, setEvents]                     = useState([]);
  const [colleges, setColleges]                 = useState([]);
  const [communities, setCommunities]           = useState([]);
  const [selectedCollegeId, setSelectedCollegeId]     = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [selectedEventId, setSelectedEventId]   = useState(null);
  const [search, setSearch]                     = useState("");
  const [analytics, setAnalytics]               = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError]     = useState("");
  const [feedback, setFeedback]                 = useState([]);
  const [feedbackLoading, setFeedbackLoading]   = useState(false);
  const [feedbackError, setFeedbackError]       = useState("");
  const [showAllFeedback, setShowAllFeedback]   = useState(false);

  /* auth guard */
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (isStudent(user)) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  /* load colleges */
  useEffect(() => {
    getColleges()
      .then((l) => setColleges(Array.isArray(l) ? l : []))
      .catch(() => setColleges([]));
  }, []);

  /* load communities */
  useEffect(() => {
    (selectedCollegeId ? getCommunities(selectedCollegeId) : getCommunities())
      .then((l) => setCommunities(Array.isArray(l) ? l : []))
      .catch(() => setCommunities([]));
  }, [selectedCollegeId]);

  /* load events */
  useEffect(() => {
    if (loading || !user) return;
    getAdminEvents(false, { pastOnly: true })
      .then((l) => {
        const approved = (Array.isArray(l) ? l : []).filter((e) => e.status === "approved");
        setEvents(approved);
        if (!selectedEventId && approved.length > 0) setSelectedEventId(approved[0].id);
      })
      .catch(() => setEvents([]));
  }, [loading, user, selectedEventId]);

  /* derived */
  const selectedCollegeName = useMemo(() => {
    if (!selectedCollegeId) return null;
    return colleges.find((x) => String(x.id) === String(selectedCollegeId))?.name ?? null;
  }, [colleges, selectedCollegeId]);

  const communityOptions = useMemo(() => {
    const byId = new Map();
    (communities || []).forEach((c) => {
      if (c?.id != null && !byId.has(String(c.id))) byId.set(String(c.id), c);
    });
    return Array.from(byId.values());
  }, [communities]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (selectedCollegeId && selectedCollegeName && (ev.collegeName || "").trim() !== selectedCollegeName) return false;
      if (selectedCommunityId && String(ev.communityId) !== String(selectedCommunityId)) return false;
      if (q && ![ev.title, ev.description, ev.category].filter(Boolean).some((s) => String(s).toLowerCase().includes(q))) return false;
      return true;
    });
  }, [events, selectedCollegeId, selectedCollegeName, selectedCommunityId, search]);

  const selectedEvent = filteredEvents.find((e) => e.id === selectedEventId) || filteredEvents[0] || null;

  /* reset community if not in list */
  useEffect(() => {
    if (selectedCommunityId && !communityOptions.some((c) => String(c.id) === String(selectedCommunityId)))
      setSelectedCommunityId("");
  }, [selectedCollegeId, communityOptions, selectedCommunityId]);

  /* reset event if not in filtered list */
  useEffect(() => {
    if (!selectedEventId || !selectedEvent) return;
    if (!filteredEvents.some((e) => e.id === selectedEventId))
      setSelectedEventId(filteredEvents[0]?.id ?? null);
  }, [filteredEvents, selectedEventId, selectedEvent]);

  /* load analytics */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedEvent?.id) { setAnalytics(null); setAnalyticsError(""); setAnalyticsLoading(false); return; }
      setAnalyticsLoading(true); setAnalyticsError("");
      try {
        const data = await getEventAnalytics(selectedEvent.id);
        if (!cancelled) setAnalytics(data);
      } catch (err) {
        if (!cancelled) { setAnalytics(null); setAnalyticsError(err?.message || "Unable to load analytics."); }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedEvent]);

  /* load feedback */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedEvent?.id) { setFeedback([]); setFeedbackError(""); setFeedbackLoading(false); return; }
      setFeedbackLoading(true); setFeedbackError("");
      try {
        const list = await getEventFeedback(selectedEvent.id);
        if (!cancelled) setFeedback(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) { setFeedback([]); setFeedbackError(err?.message || "Unable to load feedback."); }
      } finally {
        if (!cancelled) setFeedbackLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedEvent]);

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const maxRating = useMemo(() => {
    if (!analytics?.ratingDistribution) return 1;
    return Math.max(...[5, 4, 3, 2, 1].map((s) => analytics.ratingDistribution[s] ?? 0), 1);
  }, [analytics]);
  const hasActiveFilters = !!selectedCollegeId || !!selectedCommunityId || !!search.trim();
  const registrationsCount = Number(analytics?.registrationsCount) || 0;
  const totalReviews = Number(analytics?.reviewsCount) || 0;
  const responseRate =
    registrationsCount > 0 ? Math.round((totalReviews / registrationsCount) * 100) : 0;
  const sentimentScore = analytics?.sentiment?.positive?.percent ?? 0;
  const positiveKeywords = Array.isArray(analytics?.topPositiveKeywords) ? analytics.topPositiveKeywords : [];
  const negativeKeywords = Array.isArray(analytics?.topNegativeKeywords) ? analytics.topNegativeKeywords : [];

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-900">

      {/* ── breadcrumb ── */}
      <div className="px-6 lg:px-10 pt-8">
        <div className="max-w-screen-2xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-slate-600" aria-label="Breadcrumb">
            <Link to="/admin" className="text-slate-500 hover:text-[#00356b] hover:underline transition">
              Admin Portal
            </Link>
            <span className="text-slate-300" aria-hidden>›</span>
            <span className="font-medium text-slate-700">Dashboard</span>
          </nav>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8 md:py-10">

        {/* ── page header ── */}
        <div className="mb-8 grid grid-cols-1 xl:grid-cols-[1.35fr_320px] gap-5 items-start">
          <div className="max-w-3xl">
            <h1
              className="text-3xl md:text-[2.9rem] font-semibold text-[#1a2747] leading-tight"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Event Performance Analysis
            </h1>
            <p className="mt-2 max-w-2xl text-sm italic text-slate-500">
              Analytical insights based on student feedback
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Event Name
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  analytics?.performanceLabel === "Good"
                    ? "bg-emerald-50 text-emerald-700"
                    : analytics?.performanceLabel === "Needs Improvement"
                    ? "bg-rose-50 text-rose-700"
                    : analytics?.performanceLabel === "Okay"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {analytics?.performanceLabel || "No Data"}
              </span>
            </div>
            <p className="mt-3 text-lg font-semibold text-[#1a2747] leading-snug">
              {selectedEvent?.title || "Select an event"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {selectedEvent?.startDate ? formatDate(selectedEvent.startDate) : "No date available"}
            </p>
            {selectedEvent && (
              <p className="mt-1 text-xs text-slate-400">
                {selectedEvent.communityName || "Community"} {selectedEvent.collegeName ? `• ${selectedEvent.collegeName}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* ── filter toolbar ── */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5 mb-10">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-[#12355b]">Filters</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedCollegeId("");
                setSelectedCommunityId("");
                setSearch("");
              }}
              disabled={!hasActiveFilters}
              className={`h-10 text-sm rounded-full px-4 transition-colors ${
                hasActiveFilters
                  ? "bg-[#0b2d52] text-white border border-[#0b2d52] hover:bg-[#123d67]"
                  : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              }`}
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">College</label>
              <select
                value={selectedCollegeId}
                onChange={(e) => setSelectedCollegeId(e.target.value)}
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
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">Community</label>
              <select
                value={selectedCommunityId}
                onChange={(e) => setSelectedCommunityId(e.target.value)}
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
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">Search</label>
              <input
                type="search"
                placeholder="Event title or keyword"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2 block">Event Selector</label>
              {filteredEvents.length === 0 ? (
                <div className="h-11 flex items-center px-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                  No events found
                </div>
              ) : (
                <select
                  value={selectedEventId ?? ""}
                  onChange={(e) => setSelectedEventId(e.target.value || null)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                >
                  {filteredEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}{ev.startDate ? ` — ${formatDate(ev.startDate)}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* ── analytics section ── */}
        <div className="space-y-8">
          {analyticsLoading && (
            <p className="text-sm text-slate-500 py-8 text-center">Loading analytics…</p>
          )}

          {!analyticsLoading && analyticsError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{analyticsError}</div>
          )}

          {!analyticsLoading && !analyticsError && !selectedEvent && (
            <p className="text-sm text-slate-500">Select an event above to view its performance analytics.</p>
          )}

          {!analyticsLoading && !analyticsError && selectedEvent && analytics && analytics.reviewsCount === 0 && (
            <p className="text-sm text-slate-500">No feedback yet. Analytics will appear after attendees submit reviews.</p>
          )}

          {!analyticsLoading && !analyticsError && selectedEvent && analytics && analytics.reviewsCount > 0 && (
            <div className="space-y-8">

              {/* KPI row */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  label="Average Rating"
                  value={`${analytics.averageRating?.toFixed(1) ?? "0.0"}/5.0`}
                  sub=""
                  badge={`${analytics.kpi?.score ?? 0}/100`}
                  stars={<StarRow value={analytics.averageRating} size={12} />}
                  accent="amber"
                />
                <KpiCard
                  label="Performance Level"
                  value={analytics.performanceLabel || "No Data"}
                  sub="Based on the overall feedback sentiment"
                  accent={
                    analytics.performanceLabel === "Good"
                      ? "green"
                      : analytics.performanceLabel === "Needs Improvement"
                      ? "red"
                      : analytics.performanceLabel === "Okay"
                      ? "amber"
                      : "gray"
                  }
                />
                <KpiCard
                  label="Sentiment Score"
                  value={`${sentimentScore}%`}
                  sub="Positive sentiment from feedback text"
                  progress={sentimentScore}
                  accent="blue"
                />
                <KpiCard
                  label="Response Rate"
                  value={`${responseRate}%`}
                  sub={registrationsCount > 0 ? `Based on ${registrationsCount.toLocaleString()} registered attendees` : "No registrations available"}
                  accent={responseRate >= 60 ? "green" : responseRate >= 35 ? "amber" : "red"}
                />
              </div>

              {/* Rating distribution + Sentiment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AnalyticsCard
                  title="Rating Distribution"
                  subtitle="Breakdown of submitted ratings across all review levels."
                  bodyClassName="flex h-full flex-col"
                >
                  <div className="flex-1 flex flex-col justify-evenly gap-3">
                    {[5, 4, 3, 2, 1].map((s) => (
                      <RatingBar
                        key={s}
                        star={s}
                        count={analytics.ratingDistribution?.[s] ?? 0}
                        totalCount={totalReviews}
                      />
                    ))}
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50/85 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Average Rating</p>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-2xl font-semibold text-[#12355b]">
                            {analytics.averageRating?.toFixed(2)}
                          </span>
                          <StarRow value={analytics.averageRating} size={14} />
                        </div>
                      </div>
                      <div className="text-sm text-slate-500">
                        Based on <span className="font-semibold text-slate-700">{totalReviews}</span> review{totalReviews === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </AnalyticsCard>

                <AnalyticsCard
                  title="Sentiment Mix"
                  subtitle="Balance of positive, neutral, and negative feedback from review text."
                  bodyClassName="flex h-full flex-col"
                >
                  <DonutChart
                    positive={analytics.sentiment?.positive?.percent ?? 0}
                    neutral={analytics.sentiment?.neutral?.percent ?? 0}
                    negative={analytics.sentiment?.negative?.percent ?? 0}
                    positiveCount={analytics.sentiment?.positive?.count ?? 0}
                    neutralCount={analytics.sentiment?.neutral?.count ?? 0}
                    negativeCount={analytics.sentiment?.negative?.count ?? 0}
                  />
                </AnalyticsCard>
              </div>

              {/* Keywords */}
              {(positiveKeywords.length > 0 || negativeKeywords.length > 0) && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <KeywordPanel
                    title="Common Positive Keywords"
                    tone="positive"
                    items={positiveKeywords}
                    emptyText="No positive keywords available yet."
                  />
                  <KeywordPanel
                    title="Areas for Improvement"
                    tone="negative"
                    items={negativeKeywords}
                    emptyText="No improvement keywords available yet."
                  />
                </div>
              )}

              {/* Feedback list */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-6">
                <div className="mb-5">
                  <p className="text-sm font-semibold text-[#0b2d52]">Feedback</p>
                </div>

                {feedbackLoading && <p className="text-sm text-slate-500">Loading feedback…</p>}
                {!feedbackLoading && feedbackError && <p className="text-sm text-red-600">{feedbackError}</p>}
                {!feedbackLoading && !feedbackError && feedback.length === 0 && (
                  <p className="text-sm text-slate-500">No feedback yet.</p>
                )}

                {!feedbackLoading && !feedbackError && feedback.length > 0 && (
                  <div>
                    <ul className="space-y-4">
                      {(showAllFeedback ? feedback : feedback.slice(0, 3)).map((fb) => {
                        const sent = String(fb.sentiment || "").toLowerCase();
                        const sentTone =
                          sent === "positive" ? "positive" : sent === "negative" ? "negative" : "neutral";
                        const initials = "Attendee".split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
                        return (
                          <li key={fb.id} className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-5 hover:shadow-md transition-shadow">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-500">
                              {initials || "A"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">Attendee</p>
                                  <div className="mt-1">
                                    <StarRow value={Number(fb.rating || 0)} size={13} />
                                  </div>
                                </div>
                                <StatusPill tone={sentTone}>
                                  {sent ? sent.charAt(0).toUpperCase() + sent.slice(1) : "Neutral"}
                                </StatusPill>
                              </div>
                              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                                {fb.comment || "No comment text"}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {feedback.length > 0 && (
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAllFeedback((v) => !v)}
                          className="text-xs font-medium text-[#00356b] hover:underline"
                        >
                          {showAllFeedback ? "Show less" : `View all (${feedback.length})`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;