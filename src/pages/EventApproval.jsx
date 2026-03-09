import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isAdmin, isDean, isSupervisor, isCommunityLeader } from "../utils/permissions";
import { getAdminEvents, approveEvent, rejectEvent, updateEvent } from "../api";
import SmallApprovalStepper from "../components/SmallApprovalStepper";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(timeStr) {
  return timeStr || "—";
}

function EventApproval() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [events, setEvents] = useState([]);
  const [pending, setPending] = useState([]);
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const canAccessApproval = isAdmin(user) || isDean(user) || isSupervisor(user) || isCommunityLeader(user);

  useEffect(() => {
    if (loading) return;
    if (!user || !canAccessApproval) {
      navigate("/login", { replace: true });
    }
  }, [user, loading, canAccessApproval, navigate]);

  const loadEvents = useCallback(() => {
    getAdminEvents()
      .then((list) => {
        const all = Array.isArray(list) ? list : [];
        setEvents(all);
        const pendingAll = all.filter((e) => e.status === "pending");
        setPending(pendingAll);
      })
      .catch(() => {
        setEvents([]);
        setPending([]);
      });
  }, []);

  const pendingICanApprove = useMemo(() => {
    if (!user) return [];
    const p = events.filter((e) => e.status === "pending");
    if (isAdmin(user)) return p;
    const step = (e) => (e.approvalStep != null ? Number(e.approvalStep) : 0);
    if (isSupervisor(user) || isCommunityLeader(user)) {
      const myCommunityId = user.community_id != null ? Number(user.community_id) : null;
      return myCommunityId != null ? p.filter((e) => step(e) === 0 && Number(e.communityId) === myCommunityId) : [];
    }
    if (isDean(user)) {
      const myCollegeId = user.college_id != null ? Number(user.college_id) : null;
      return myCollegeId != null ? p.filter((e) => step(e) === 1 && Number(e.collegeId) === myCollegeId) : [];
    }
    return [];
  }, [events, user]);

  useEffect(() => {
    if (canAccessApproval) loadEvents();
  }, [user, loadEvents, canAccessApproval]);

  const handleApprove = (ev) => {
    approveEvent(ev.id).then(() => { loadEvents(); setFeedbackFor(null); }).catch((e) => console.warn(e));
  };

  const handleReject = (ev) => {
    rejectEvent(ev.id, ev.feedback).then(() => { loadEvents(); setFeedbackFor(null); }).catch((e) => console.warn(e));
  };

  const handleRequestChanges = (ev) => {
    if (feedbackFor !== ev.id) {
      setFeedbackFor(ev.id);
      setFeedbackText(ev.feedback || "");
      return;
    }
    updateEvent(ev.id, { ...ev, status: "needs_changes", feedback: feedbackText.trim() || null })
      .then(() => { loadEvents(); setFeedbackFor(null); setFeedbackText(""); })
      .catch((e) => console.warn(e));
  };

  const cancelFeedback = () => {
    setFeedbackFor(null);
    setFeedbackText("");
  };

  if (loading || !user || !canAccessApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      {/* Breadcrumb — Majors > MIS style: light grey links, chevron, dark blue bold current */}
      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <nav className="text-sm" aria-label="Breadcrumb">
            <Link to="/admin" className="text-slate-500 hover:text-slate-700 transition-colors">
              Admin Portal
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden>&gt;</span>
            <span className="font-semibold text-[#00356b]">Event Approval</span>
          </nav>
        </div>
      </section>

      {/* Title block — match Colleges / Majors pattern */}
      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4">
              Event Approval
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Review submitted events and approve, request changes, or reject. Approved events will appear on the public Events page.
            </p>
          </div>
          <p className="text-center text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{pendingICanApprove.length}</span> event{pendingICanApprove.length !== 1 ? "s" : ""} pending your approval
          </p>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8">

        {pendingICanApprove.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>No events pending approval</h2>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              {pending.length === 0
                ? "When event organizers submit events for approval, they will appear here."
                : "No events are currently at your approval step. Other reviewers may need to act first."}
            </p>
            <Link
              to="/manage-events"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#00356b] hover:underline"
            >
              View Manage Events
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <ul className="space-y-6">
            {pendingICanApprove.map((ev) => (
              <li key={ev.id}>
                <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-72 flex-shrink-0 aspect-[4/3] md:aspect-auto md:h-[220px] bg-slate-100">
                      <img
                        src={ev.image || "/event1.jpg"}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                    <div className="flex-1 p-6 flex flex-col">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Club: {ev.clubName || "University"}</p>
                          <h2 className="mt-0.5 text-xl font-semibold text-[#0b2d52] leading-snug" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                            {ev.title}
                          </h2>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                          Pending
                        </span>
                      </div>
                      <p className={`text-sm text-slate-600 ${expandedId === ev.id ? "" : "line-clamp-2"}`}>{ev.description}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedId((id) => (id === ev.id ? null : ev.id))}
                        className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-[#00356b] hover:underline focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 rounded"
                      >
                        {expandedId === ev.id ? "Hide details" : "See details"}
                        <svg className={`w-4 h-4 transition-transform ${expandedId === ev.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {expandedId === ev.id && (
                        <div className="mt-4 p-5 rounded-xl bg-slate-50/80 space-y-4 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 pb-2">All event details (as submitted)</p>
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Event title</p>
                            <p className="text-slate-800">{ev.title || "—"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Description</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{ev.description || "—"}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Event photo</p>
                            {ev.image ? (
                              <img src={ev.image} alt="" className="mt-1 w-full max-w-[280px] aspect-video object-cover rounded-lg" />
                            ) : (
                              <p className="text-slate-500">No image</p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Start date</p>
                              <p className="text-slate-800">{formatDate(ev.startDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Start time</p>
                              <p className="text-slate-800">{formatTime(ev.startTime)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">End date</p>
                              <p className="text-slate-800">{formatDate(ev.endDate)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">End time</p>
                              <p className="text-slate-800">{formatTime(ev.endTime)}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-slate-500 font-semibold mb-1">Location</p>
                            <p className="text-slate-800">{ev.location || "—"}</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Available seats</p>
                              <p className="text-slate-800">{ev.availableSeats != null ? ev.availableSeats : "—"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Price</p>
                              <p className="text-slate-800">{ev.price != null ? ev.price : "—"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Member price</p>
                              <p className="text-slate-800">{ev.priceMember != null ? ev.priceMember : "Optional / —"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Category</p>
                              <p className="text-slate-800">{ev.category || "—"}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 font-semibold mb-1">Club name</p>
                              <p className="text-slate-800">{ev.clubName || "—"}</p>
                            </div>
                          </div>
                          {Array.isArray(ev.customSections) && ev.customSections.length > 0 && (
                            <div className="pt-3">
                              <p className="text-slate-500 font-semibold mb-2">Additional sections</p>
                              <ul className="space-y-3">
                                {ev.customSections.map((sec, idx) => (
                                  <li key={sec.id || idx} className="rounded-lg bg-white p-3">
                                    <p className="text-slate-500 font-semibold text-xs uppercase tracking-wider mb-1">{sec.sectionTitle || "Section"}</p>
                                    <p className="text-slate-700 whitespace-pre-wrap">{sec.content || "—"}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>{formatDate(ev.startDate)} · {formatTime(ev.startTime)}</span>
                        <span>{ev.location || "—"}</span>
                      </div>
                      <div className="mt-4">
                        <SmallApprovalStepper currentStepIndex={ev.approvalStep ?? 0} />
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleApprove(ev)}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/40 focus:ring-offset-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestChanges(ev)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#00356b]/50 bg-white px-5 py-2.5 text-sm font-semibold text-[#00356b] hover:bg-[#00356b]/5 focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          {feedbackFor === ev.id ? "Submit feedback" : "Request changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(ev)}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-red-200 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          Reject
                        </button>
                      </div>
                      {feedbackFor === ev.id && (
                        <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                          <label className="block text-sm font-medium text-slate-700 mb-2">Feedback (optional)</label>
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Describe what needs to be changed..."
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#00356b] focus:outline-none focus:ring-1 focus:ring-[#00356b]"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRequestChanges(ev)}
                              className="rounded-full border-2 border-[#00356b]/50 bg-[#00356b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
                            >
                              Send request
                            </button>
                            <button
                              type="button"
                              onClick={cancelFeedback}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default EventApproval;
