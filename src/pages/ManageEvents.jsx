import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isCommunityLeader, isSupervisor } from '../utils/permissions';
import { getAdminEvents, createEvent, updateEvent, deleteEvent, getCommunities, getColleges, getMajors } from '../api';
import SmallApprovalStepper from '../components/SmallApprovalStepper';

const HERO_BG = '/manage-events-hero.png';

const STATUS_LABELS = {
  draft: 'DRAFT',
  pending: 'PENDING APPROVAL',
  approved: 'APPROVED',
  'needs_changes': 'NEEDS CHANGES',
  rejected: 'REJECTED',
};

const STATUS_STYLES = {
  draft: 'bg-slate-200 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  needs_changes: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
};

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Not scheduled';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return '--:--';
  return timeStr;
}

function EventCard({ ev, selectedId, setSelectedId, setShowForm, onDelete, events, onShowFeedback }) {
  return (
    <div
      className={`rounded-2xl border overflow-hidden bg-white shadow-sm transition-all duration-200 min-w-0 ${
        selectedId === ev.id ? 'ring-2 ring-[#00356b] border-[#00356b]' : 'border-slate-200 hover:border-slate-300 hover:-translate-y-1 hover:shadow-lg'
      }`}
    >
      <div className="aspect-[4/3] w-full bg-slate-100 relative">
        <img
          src={ev.image || '/event1.jpg'}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[ev.status] || STATUS_STYLES.draft}`}
        >
          {STATUS_LABELS[ev.status] || 'DRAFT'}
        </span>
      </div>
      <div className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {ev.communityName ? `${ev.communityName}${ev.collegeName ? ` · ${ev.collegeName}` : ''}` : (ev.clubName || 'University')}
        </p>
        <h3 className="font-serif text-base font-semibold text-[#0b2d52] mt-0.5 line-clamp-2 leading-snug">{ev.title}</h3>
        <p className="text-sm text-slate-600 mt-1.5">
          {formatDisplayDate(ev.startDate)} | {formatDisplayTime(ev.startTime)}
        </p>
        <SmallApprovalStepper currentStepIndex={ev.approvalStep ?? 0} />
        <div className="mt-3 flex flex-wrap gap-2">
          {ev.status === 'needs_changes' && (
            <>
              <button
                type="button"
                onClick={() => { setSelectedId(ev.id); setShowForm(true); }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#00356b] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
              >
                Fix now
              </button>
              {ev.feedback && (
                <button
                  type="button"
                  onClick={() => onShowFeedback && onShowFeedback(ev)}
                  className="text-xs text-slate-500 self-center underline-offset-2 hover:underline"
                >
                  View feedback (1)
                </button>
              )}
            </>
          )}
          {ev.status === 'draft' && (
            <>
              <button
                type="button"
                onClick={() => { setSelectedId(ev.id); setShowForm(true); }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#00356b] transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
              >
                Continue editing
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this event?')) {
                    onDelete?.(ev);
                    if (selectedId === ev.id) setSelectedId(null);
                  }
                }}
                className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                Delete
              </button>
            </>
          )}
          {ev.status === 'rejected' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Remove this rejected event from the list?')) {
                  onDelete?.(ev);
                  if (selectedId === ev.id) setSelectedId(null);
                }
              }}
              className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ManageEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [feedbackEvent, setFeedbackEvent] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [form, setForm] = useState({
    title: '',
    clubName: '',
    description: '',
    image: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    availableSeats: '',
    price: '',
    priceMember: '',
    communityId: '',
    customSections: [],
    forAllColleges: true,
    targetCollegeIds: [],
    targetAllMajors: true,
    targetMajorIds: [],
  });
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const { user, loading } = useAuth();
  const admin = isAdmin(user);
  const communityLeader = isCommunityLeader(user);
  const isLeader = communityLeader || isSupervisor(user);
  const accessAllowed = admin || isLeader;

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [user, loading, navigate]);

  const loadEvents = useCallback(() => {
    getAdminEvents()
      .then((list) => setEvents(Array.isArray(list) ? list : []))
      .catch(() => setEvents([]));
  }, []);

  const handleDelete = useCallback(
    (ev) => {
      deleteEvent(ev.id)
        .then(() => {
          loadEvents();
          if (selectedId === ev.id) setSelectedId(null);
        })
        .catch((err) => console.warn('Delete failed', err));
    },
    [loadEvents, selectedId]
  );

  useEffect(() => {
    if (accessAllowed) loadEvents();
  }, [user, loadEvents, accessAllowed]);

  useEffect(() => {
    if (accessAllowed) getCommunities().then((list) => setCommunities(Array.isArray(list) ? list : [])).catch(() => setCommunities([]));
  }, [user, accessAllowed]);

  useEffect(() => {
    if (accessAllowed) getColleges().then((list) => setColleges(Array.isArray(list) ? list : [])).catch(() => setColleges([]));
  }, [user, accessAllowed]);

  useEffect(() => {
    if (form.targetCollegeIds.length === 0) {
      setMajors([]);
      return;
    }
    getMajors().then((list) => {
      const all = Array.isArray(list) ? list : [];
      const filtered = all.filter((m) => form.targetCollegeIds.includes(String(m.collegeId)));
      setMajors(filtered);
    }).catch(() => setMajors([]));
  }, [form.targetCollegeIds]);

  useEffect(() => {
    const ev = selectedId ? events.find((e) => e.id === selectedId) : null;
    if (ev) {
      const targetCollegeIds = Array.isArray(ev.targetCollegeIds) ? ev.targetCollegeIds.map((id) => String(id)) : [];
      const targetMajorIds = Array.isArray(ev.targetMajorIds) ? ev.targetMajorIds.map((id) => String(id)) : [];
      setForm({
        title: ev.title || '',
        clubName: ev.clubName || '',
        description: ev.description || '',
        image: ev.image || '',
        startDate: ev.startDate || '',
        startTime: ev.startTime || '',
        endDate: ev.endDate || '',
        endTime: ev.endTime || '',
        location: ev.location || '',
        availableSeats: ev.availableSeats != null ? String(ev.availableSeats) : '',
        price: ev.price != null ? String(ev.price) : '',
        priceMember: ev.priceMember != null ? String(ev.priceMember) : '',
        communityId: ev.communityId != null ? String(ev.communityId) : '',
        customSections: Array.isArray(ev.customSections) ? ev.customSections.map((s) => ({ ...s })) : [],
        forAllColleges: ev.forAllColleges !== false,
        targetCollegeIds,
        targetAllMajors: ev.targetAllMajors !== false,
        targetMajorIds,
      });
    } else {
      setForm({
        title: '',
        clubName: '',
        description: '',
        image: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: '',
        availableSeats: '',
        price: '',
        priceMember: '',
        communityId: '',
        customSections: [],
        forAllColleges: true,
        targetCollegeIds: [],
        targetAllMajors: true,
        targetMajorIds: [],
      });
      setFormErrors({});
    }
  }, [selectedId, events]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3] px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
          <h1 className="text-xl font-semibold text-slate-900">Access restricted</h1>
          <p className="mt-2 text-slate-600">Manage Events is available to administrators and community leaders only.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-full bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const selectedEvent = selectedId ? events.find((e) => e.id === selectedId) : null;
  const eventsToShow = events.filter((e) => e.status !== 'approved');

  const validate = () => {
    const err = {};
    if (!form.title?.trim()) err.title = 'Event title is required';
    if (!form.description?.trim()) err.description = 'Description is required';
    const hasCommunity = (form.communityId !== '' && form.communityId != null) || (isLeader && user?.community_id != null);
    if (!hasCommunity) err.communityId = 'Club / Association is required (each event is connected to a community).';
    if (!form.forAllColleges && (!Array.isArray(form.targetCollegeIds) || form.targetCollegeIds.length === 0)) {
      err.audience = 'Select at least one college when event is for specific colleges.';
    }
    if (!form.forAllColleges && !form.targetAllMajors && (!Array.isArray(form.targetMajorIds) || form.targetMajorIds.length === 0)) {
      err.audience = err.audience || 'Select at least one major when event is for specific majors.';
    }
    if (!form.startDate?.trim()) err.startDate = 'Start date is required';
    if (!form.startTime?.trim()) err.startTime = 'Start time is required';
    if (!form.endDate?.trim()) err.endDate = 'End date is required';
    if (!form.endTime?.trim()) err.endTime = 'End time is required';
    if (!form.location?.trim()) err.location = 'Location is required';
    if (form.availableSeats === '' || form.availableSeats === undefined) err.availableSeats = 'Available seats is required';
    else if (Number(form.availableSeats) < 0) err.availableSeats = 'Must be 0 or more';
    if (form.price === '' || form.price === undefined) err.price = 'Price is required';
    else if (Number(form.price) < 0) err.price = 'Must be 0 or more';
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmitForApproval = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const effectiveCommunityId = form.communityId ? Number(form.communityId) : (isLeader && user?.community_id != null ? Number(user.community_id) : undefined);
    const selectedCommunity = admin && effectiveCommunityId ? communities.find((c) => Number(c.id) === effectiveCommunityId) : null;
    const effectiveClubName = isLeader && user?.communityName ? String(user.communityName).trim() : (selectedCommunity?.name?.trim() || form.clubName?.trim() || 'University');
    const payload = {
      id: selectedEvent?.id || `ev-${Date.now()}`,
      title: form.title.trim(),
      clubName: effectiveClubName,
      description: form.description.trim(),
      communityId: effectiveCommunityId,
      startDate: form.startDate.trim() || null,
      startTime: form.startTime.trim() || null,
      endDate: form.endDate.trim() || null,
      endTime: form.endTime.trim() || null,
      location: form.location.trim(),
      availableSeats: Number(form.availableSeats) || 0,
      price: Number(form.price) || 0,
      priceMember: form.priceMember !== '' ? Number(form.priceMember) : null,
      customSections: (form.customSections || []).map((s) => ({
        id: s.id || `sec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sectionTitle: s.sectionTitle || '',
        content: s.content || '',
      })),
      status: selectedEvent?.status === 'needs_changes' ? 'pending' : 'pending',
      feedback: selectedEvent?.status === 'needs_changes' ? undefined : selectedEvent?.feedback,
      image: (form.image || '').trim() || '/event1.jpg',
      category: selectedEvent?.category || 'Event',
      forAllColleges: form.forAllColleges !== false,
      targetCollegeIds: form.forAllColleges ? [] : (form.targetCollegeIds || []).map(Number).filter((n) => !Number.isNaN(n)),
      targetAllMajors: form.targetAllMajors !== false,
      targetMajorIds: form.targetAllMajors ? [] : (form.targetMajorIds || []).map(Number).filter((n) => !Number.isNaN(n)),
    };
    try {
      if (selectedEvent) {
        await updateEvent(selectedEvent.id, payload);
        setSelectedId(payload.id);
      } else {
        const created = await createEvent(payload);
        setSelectedId(created?.id || payload.id);
      }
      loadEvents();
    } catch (err) {
      console.warn('Save event failed', err);
      setFormErrors({ submit: err.data?.error || 'Failed to save event' });
    }
    setFormErrors((prev) => ({ ...prev, submit: undefined }));
  };

  const handleAddNewEvent = () => {
    setSelectedId(null);
    const defaultCommunityId = isLeader && user?.community_id != null ? String(user.community_id) : '';
    setForm({
      title: '',
      clubName: '',
      description: '',
      image: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      location: '',
      availableSeats: '',
      price: '',
      priceMember: '',
      communityId: defaultCommunityId,
      customSections: [],
      forAllColleges: true,
      targetCollegeIds: [],
      targetAllMajors: true,
      targetMajorIds: [],
    });
    setFormErrors({});
  };

  const handleAddSection = () => {
    setForm((prev) => ({
      ...prev,
      customSections: [...(prev.customSections || []), { id: `sec-${Date.now()}`, sectionTitle: '', content: '' }],
    }));
  };

  const handleSectionChange = (index, field, value) => {
    setForm((prev) => {
      const next = [...(prev.customSections || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, customSections: next };
    });
  };

  const handleRemoveSection = (index) => {
    setForm((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((_, i) => i !== index),
    }));
  };

  const setFormField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      {/* Hero with breadcrumb on picture */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#0b2d52]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage: `url(${HERO_BG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
            filter: 'brightness(0.85) contrast(1.05) saturate(1.1)',
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(11,45,82,0.82) 0%, rgba(11,45,82,0.5) 45%, rgba(11,45,82,0.2) 75%, transparent 100%)',
          }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-6 lg:px-10 pt-6 pb-10">
          {/* Breadcrumb on picture — light text for contrast */}
          <nav className="text-sm mb-6" aria-label="Breadcrumb">
            <Link to="/admin" className="text-white/80 hover:text-white transition-colors">
              Admin Portal
            </Link>
            <span className="mx-2 text-white/60" aria-hidden>&gt;</span>
            <span className="font-semibold text-white">Manage Events</span>
          </nav>
        <div className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-white leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                Club Event Management
              </h1>
              <p className="mt-3 text-white/90 text-sm max-w-xl">
                Oversee, approve, and manage all university club activities.
              </p>
            </div>
            <div className="flex flex-col items-end gap-4 shrink-0 w-full sm:w-auto sm:min-w-[320px] lg:min-w-[360px]">
              <button
                type="button"
                onClick={() => {
                  if (showForm) {
                    setShowForm(false);
                  } else {
                    handleAddNewEvent();
                    setShowForm(true);
                  }
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0b2d52] ${
                  showForm
                    ? 'border-2 border-white/80 bg-white/10 text-white hover:bg-white/20 focus:ring-white/50'
                    : 'bg-white text-[#00356b] shadow-sm hover:bg-slate-50 focus:ring-[#00356b]/30'
                }`}
              >
                {showForm ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close form
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add new event
                  </>
                )}
              </button>
              {showForm && (
              <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-lg p-6 max-h-[85vh] overflow-y-auto">
                <h2 className="font-serif text-xl font-semibold text-slate-900 border-b-2 border-[#00356b] pb-2 w-fit mb-4">
                  {selectedEvent ? 'Edit event' : 'Create / Edit event'}
                </h2>
                <form onSubmit={handleSubmitForApproval} className="space-y-4">
                  <div>
                    <label htmlFor="me-title" className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Event title
                    </label>
                    <input
                      id="me-title"
                      type="text"
                      value={form.title}
                      onChange={(e) => setFormField('title', e.target.value)}
                      placeholder="Enter title"
                      className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] ${formErrors.title ? 'border-red-500' : 'border-slate-200'}`}
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.title}</p>
                    )}
                  </div>
                  <div className={admin ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
                    <div>
                      <label htmlFor="me-desc" className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Description
                      </label>
                      <textarea
                        id="me-desc"
                        rows={3}
                        value={form.description}
                        onChange={(e) => setFormField('description', e.target.value)}
                        placeholder="Describe the event"
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] ${formErrors.description ? 'border-red-500' : 'border-slate-200'}`}
                      />
                      {formErrors.description && (
                        <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.description}</p>
                      )}
                    </div>
                    {admin && (
                      <div>
                        <label htmlFor="me-club" className="block text-sm font-semibold text-slate-700 mb-1.5">
                          Club / Association name <span className="text-red-500">*</span>
                        </label>
                        {communities.length === 0 ? (
                          <p className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
                            No associations available.
                          </p>
                        ) : (
                          <select
                            id="me-club"
                            value={form.communityId}
                            onChange={(e) => setFormField('communityId', e.target.value)}
                            className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] ${formErrors.communityId ? 'border-red-500' : 'border-slate-200'}`}
                          >
                            <option value="">Select association (event is linked to community and its college)</option>
                            {[...communities]
                              .sort((a, b) => (a.collegeName || '').localeCompare(b.collegeName || '') || (a.name || '').localeCompare(b.name || ''))
                              .map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.name}{c.collegeName ? ` (${c.collegeName})` : ''}
                                </option>
                              ))}
                          </select>
                        )}
                        {formErrors.communityId && (
                          <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.communityId}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-800">Who can join?</h3>
                    <p className="text-xs text-slate-600">Choose whether this event is open to all students or only specific colleges and majors.</p>
                    <div>
                      <span className="block text-xs font-medium text-slate-600 mb-2">Colleges</span>
                      <div className="flex flex-wrap gap-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="audience-colleges"
                            checked={form.forAllColleges === true}
                            onChange={() => {
                              setForm((prev) => ({ ...prev, forAllColleges: true, targetCollegeIds: [], targetAllMajors: true, targetMajorIds: [] }));
                              setFormErrors((prev) => ({ ...prev, audience: undefined }));
                            }}
                            className="text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                          />
                          <span className="text-sm text-slate-700">All colleges</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="audience-colleges"
                            checked={form.forAllColleges === false}
                            onChange={() => setFormField('forAllColleges', false)}
                            className="text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                          />
                          <span className="text-sm text-slate-700">Specific colleges</span>
                        </label>
                      </div>
                      {!form.forAllColleges && (
                        <div className="mt-2">
                          <select
                            multiple
                            value={form.targetCollegeIds}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                              setFormField('targetCollegeIds', selected);
                              setFormField('targetAllMajors', true);
                              setFormField('targetMajorIds', []);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px]"
                          >
                            {colleges.map((c) => (
                              <option key={c.id} value={String(c.id)}>{c.name}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple.</p>
                        </div>
                      )}
                    </div>
                    {!form.forAllColleges && form.targetCollegeIds.length > 0 && (
                      <div>
                        <span className="block text-xs font-medium text-slate-600 mb-2">Majors</span>
                        <div className="flex flex-wrap gap-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="audience-majors"
                              checked={form.targetAllMajors === true}
                              onChange={() => setForm((prev) => ({ ...prev, targetAllMajors: true, targetMajorIds: [] }))}
                              className="text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                            />
                            <span className="text-sm text-slate-700">All majors</span>
                          </label>
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="audience-majors"
                              checked={form.targetAllMajors === false}
                              onChange={() => setFormField('targetAllMajors', false)}
                              className="text-[#00356b] border-slate-300 focus:ring-[#00356b]"
                            />
                            <span className="text-sm text-slate-700">Specific majors</span>
                          </label>
                        </div>
                        {!form.targetAllMajors && (
                          <div className="mt-2">
                            <select
                              multiple
                              value={form.targetMajorIds}
                              onChange={(e) => setFormField('targetMajorIds', Array.from(e.target.selectedOptions, (o) => o.value))}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px]"
                            >
                              {majors.map((m) => (
                                <option key={m.id} value={String(m.id)}>{m.name}</option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select multiple.</p>
                          </div>
                        )}
                      </div>
                    )}
                    {formErrors.audience && (
                      <p className="text-sm text-red-600" role="alert">{formErrors.audience}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event photo</label>
                    <input
                      key={selectedId ?? 'new'}
                      id="me-image"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setFormField('image', reader.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                    {form.image ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                        <div className="relative aspect-[16/9] max-h-24 w-full bg-slate-100">
                          <img src={form.image} alt="Event" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-end gap-1.5 p-2">
                            <label className="cursor-pointer rounded bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white">
                              Change
                              <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => setFormField('image', reader.result);
                                reader.readAsDataURL(file);
                              }} />
                            </label>
                            <button type="button" onClick={() => setFormField('image', '')} className="rounded bg-white/95 px-2 py-1 text-xs font-semibold text-red-600 shadow-sm hover:bg-white">Remove</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 py-6 text-sm text-slate-500 hover:border-[#00356b]/40 cursor-pointer">
                        Choose image
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setFormField('image', reader.result);
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="me-start-date" className="block text-sm font-semibold text-slate-700 mb-1">Start date</label>
                      <input id="me-start-date" type="date" value={form.startDate} onChange={(e) => setFormField('startDate', e.target.value)} className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.startDate ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.startDate && <p className="mt-0.5 text-xs text-red-600">{formErrors.startDate}</p>}
                    </div>
                    <div>
                      <label htmlFor="me-start-time" className="block text-sm font-semibold text-slate-700 mb-1">Start time</label>
                      <input id="me-start-time" type="time" value={form.startTime} onChange={(e) => setFormField('startTime', e.target.value)} className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.startTime ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.startTime && <p className="mt-0.5 text-xs text-red-600">{formErrors.startTime}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="me-end-date" className="block text-sm font-semibold text-slate-700 mb-1">End date</label>
                      <input id="me-end-date" type="date" value={form.endDate} onChange={(e) => setFormField('endDate', e.target.value)} className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.endDate ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.endDate && <p className="mt-0.5 text-xs text-red-600">{formErrors.endDate}</p>}
                    </div>
                    <div>
                      <label htmlFor="me-end-time" className="block text-sm font-semibold text-slate-700 mb-1">End time</label>
                      <input id="me-end-time" type="time" value={form.endTime} onChange={(e) => setFormField('endTime', e.target.value)} className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.endTime ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.endTime && <p className="mt-0.5 text-xs text-red-600">{formErrors.endTime}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="me-location" className="block text-sm font-semibold text-slate-700 mb-1">Location</label>
                    <input id="me-location" type="text" value={form.location} onChange={(e) => setFormField('location', e.target.value)} placeholder="Location or link" className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.location ? 'border-red-500' : 'border-slate-200'}`} />
                    {formErrors.location && <p className="mt-0.5 text-xs text-red-600">{formErrors.location}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="me-seats" className="block text-sm font-semibold text-slate-700 mb-1">Seats</label>
                      <input id="me-seats" type="number" min="0" value={form.availableSeats} onChange={(e) => setFormField('availableSeats', e.target.value)} className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.availableSeats ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.availableSeats && <p className="mt-0.5 text-xs text-red-600">{formErrors.availableSeats}</p>}
                    </div>
                    <div>
                      <label htmlFor="me-price" className="block text-sm font-semibold text-slate-700 mb-1">Price</label>
                      <input id="me-price" type="text" value={form.price} onChange={(e) => setFormField('price', e.target.value)} placeholder="NIS or Free" className={`w-full rounded-xl border bg-white px-3 py-2 text-sm ${formErrors.price ? 'border-red-500' : 'border-slate-200'}`} />
                      {formErrors.price && <p className="mt-0.5 text-xs text-red-600">{formErrors.price}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="me-price-member" className="block text-sm font-semibold text-slate-700 mb-1">Member price</label>
                    <input id="me-price-member" type="text" value={form.priceMember} onChange={(e) => setFormField('priceMember', e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">Extra sections</span>
                      <button type="button" onClick={handleAddSection} className="text-sm font-medium text-[#00356b] hover:underline">+ Add section</button>
                    </div>
                    {(form.customSections || []).length === 0 ? (
                      <p className="text-xs text-slate-500">No extra sections.</p>
                    ) : (
                      <ul className="space-y-3">
                        {(form.customSections || []).map((sec, index) => (
                          <li key={sec.id || index} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                            <div className="flex justify-between gap-2 mb-1">
                              <input type="text" value={sec.sectionTitle || ''} onChange={(e) => handleSectionChange(index, 'sectionTitle', e.target.value)} placeholder="Section title" className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
                              <button type="button" onClick={() => handleRemoveSection(index)} className="text-slate-500 hover:text-red-600 text-xs font-medium">Remove</button>
                            </div>
                            <textarea rows={2} value={sec.content || ''} onChange={(e) => handleSectionChange(index, 'content', e.target.value)} placeholder="Content" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button type="submit" className="w-full rounded-xl bg-[#00356b] px-6 py-3 text-sm font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2 transition-colors">
                    Submit for approval
                  </button>
                </form>
              </div>
            )}
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Main: 3-column cards grid */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
        {eventsToShow.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-10 text-center text-slate-500 text-sm">
                No events yet.
              </div>
            )}
            {eventsToShow.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventsToShow.map((ev) => (
                  <EventCard
                    key={ev.id}
                    ev={ev}
                    selectedId={selectedId}
                    setSelectedId={setSelectedId}
                    setShowForm={setShowForm}
                    onDelete={handleDelete}
                    events={events}
                    onShowFeedback={setFeedbackEvent}
                  />
                ))}
              </div>
            )}

      </section>

      {feedbackEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Admin feedback
              </h2>
              <button
                type="button"
                onClick={() => setFeedbackEvent(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close feedback"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">
                For event
              </p>
              <p className="text-sm font-semibold text-slate-900 mb-3">
                {feedbackEvent.title || 'Untitled event'}
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {feedbackEvent.feedback || 'No feedback message provided.'}
              </p>
            </div>
            <div className="px-5 pb-4 pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setFeedbackEvent(null)}
                className="rounded-full bg-[#00356b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageEvents;
