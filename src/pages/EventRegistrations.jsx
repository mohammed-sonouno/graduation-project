import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isCommunityLeader } from '../utils/permissions';
import { scrollToTop } from '../utils/scroll';
import {
  getCommunityEventRegistrations,
  getAdminEventRegistrations,
  getColleges,
  getCommunities,
  markRegistrationPaid,
  approveRegistration,
  rejectRegistration,
} from '../api';

const STATUS_LABELS = {
  pending_payment: 'Pending approval',
  pending: 'Pending approval',
  paid: 'Paid (awaiting approval)',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_STYLES = {
  pending_payment: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
};

/** Format date string to e.g. "March 17, 2026". */
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : String(dateStr);
}

/** Format time string (e.g. "19:55", "02:00") to e.g. "7:55 PM". */
function formatEventTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return trimmed;
  const hour = parseInt(match[1], 10);
  const min = match[2];
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${min} ${ampm}`;
}

/** One-line date/time for event header (start – end when both). */
function formatEventDateTimes(date, time, endDate, endTime) {
  const dateStr = formatEventDate(date);
  const timeStr = formatEventTime(time);
  const startPart = [dateStr, timeStr].filter(Boolean).join(' · ');
  if (!startPart) return '';
  const endDateStr = formatEventDate(endDate);
  const endTimeStr = formatEventTime(endTime);
  if (endDateStr || endTimeStr) {
    const endPart = endDateStr && endDateStr !== dateStr
      ? [endDateStr, endTimeStr].filter(Boolean).join(' · ')
      : endTimeStr;
    return endPart ? `${startPart} – ${endPart}` : startPart;
  }
  return startPart;
}

export default function EventRegistrations() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [filterCollegeId, setFilterCollegeId] = useState('');
  const [filterCommunityId, setFilterCommunityId] = useState('');
  const [colleges, setColleges] = useState([]);
  const [communities, setCommunities] = useState([]);

  const admin = isAdmin(user);
  const accessAllowed = admin || isCommunityLeader(user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (!accessAllowed) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, accessAllowed, navigate]);

  const load = useCallback(() => {
    if (!accessAllowed) return;
    setError('');
    if (admin) {
      getAdminEventRegistrations({
        collegeId: filterCollegeId || undefined,
        communityId: filterCommunityId || undefined,
      })
        .then((list) => setRegistrations(Array.isArray(list) ? list : []))
        .catch((e) => {
          setError(e?.data?.error || 'Failed to load registrations');
          setRegistrations([]);
        });
    } else {
      getCommunityEventRegistrations()
        .then((list) => setRegistrations(Array.isArray(list) ? list : []))
        .catch((e) => {
          setError(e?.data?.error || 'Failed to load registrations');
          setRegistrations([]);
        });
    }
  }, [accessAllowed, admin, filterCollegeId, filterCommunityId]);

  useEffect(() => {
    if (accessAllowed) load();
  }, [accessAllowed, load]);

  useEffect(() => {
    if (!admin) return;
    getColleges().then((list) => setColleges(Array.isArray(list) ? list : [])).catch(() => setColleges([]));
    getCommunities().then((list) => setCommunities(Array.isArray(list) ? list : [])).catch(() => setCommunities([]));
  }, [admin]);

  const communityOptions = useMemo(() => {
    const list = (communities || []).filter(Boolean);
    const byCollege = filterCollegeId
      ? list.filter((c) => String(c.collegeId) === String(filterCollegeId))
      : list;
    return byCollege.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  }, [communities, filterCollegeId]);

  useEffect(() => {
    if (!filterCommunityId) return;
    const allowed = communityOptions.some((c) => String(c.id) === String(filterCommunityId));
    if (!allowed) setFilterCommunityId('');
  }, [filterCollegeId, communityOptions, filterCommunityId]);

  const handleMarkPaid = (id) => {
    setActionLoading(id);
    markRegistrationPaid(id)
      .then(() => { load(); scrollToTop(); })
      .catch((e) => setError(e?.data?.error || 'Failed to mark as paid'))
      .finally(() => setActionLoading(null));
  };

  const handleApprove = (id) => {
    setActionLoading(id);
    approveRegistration(id)
      .then(() => { load(); scrollToTop(); })
      .catch((e) => setError(e?.data?.error || 'Failed to approve'))
      .finally(() => setActionLoading(null));
  };

  const handleReject = (id) => {
    if (!window.confirm('Reject this registration?')) return;
    setActionLoading(id);
    rejectRegistration(id)
      .then(() => { load(); scrollToTop(); })
      .catch((e) => setError(e?.data?.error || 'Failed to reject'))
      .finally(() => setActionLoading(null));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user || !accessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Redirecting…</p>
      </div>
    );
  }

  const byEvent = registrations.reduce((acc, r) => {
    const key = r.eventId || 'unknown';
    if (!acc[key]) acc[key] = {
      title: r.title,
      communityName: r.communityName,
      date: r.date,
      time: r.time,
      endDate: r.endDate,
      endTime: r.endTime,
      availableSeats: r.availableSeats,
      rows: [],
    };
    acc[key].rows.push(r);
    return acc;
  }, {});

  const approvedCount = (eventId) =>
    (registrations.filter((r) => r.eventId === eventId && r.status === 'approved').length);

  /** Newest-first: created_at DESC, then id DESC. */
  const sortRegistrationsByNewest = (rows) =>
    [...rows].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id != null && a.id != null) ? Number(b.id) - Number(a.id) : 0;
    });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className="bg-[#0b2d52] border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-semibold text-white">Event registrations</h1>
          <p className="mt-1 text-white/80 text-sm">
            Students submit registration requests. You approve or reject each request. Approved registrations count toward the event capacity.
          </p>
        </div>
      </section>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {admin && (colleges.length > 0 || communities.length > 0) && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Filter by</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[180px]">
                <label htmlFor="reg-filter-college" className="block text-xs font-medium text-slate-600 mb-1">College</label>
                <select
                  id="reg-filter-college"
                  value={filterCollegeId}
                  onChange={(e) => setFilterCollegeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                >
                  <option value="">All colleges</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[180px]">
                <label htmlFor="reg-filter-community" className="block text-xs font-medium text-slate-600 mb-1">Community</label>
                <select
                  id="reg-filter-community"
                  value={filterCommunityId}
                  onChange={(e) => setFilterCommunityId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                >
                  <option value="">All communities</option>
                  {communityOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}{c.collegeName ? ` (${c.collegeName})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        {Object.keys(byEvent).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            {admin ? 'No event registrations match the selected filters.' : 'No event registrations for your community yet.'}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byEvent).map(([eventId, { title, communityName, date, time, endDate, endTime, availableSeats, rows }]) => {
              const approved = approvedCount(eventId);
              const capacity = availableSeats != null ? Number(availableSeats) : 0;
              const isFull = capacity > 0 && approved >= capacity;
              const dateTimeLine = formatEventDateTimes(date, time, endDate, endTime);
              return (
                <div key={eventId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900">{title || eventId}</h2>
                      {isFull && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Event full
                        </span>
                      )}
                    </div>
                    {communityName && (
                      <p className="text-sm text-slate-600 mt-0.5">Community: {communityName}</p>
                    )}
                    <p className="text-sm text-slate-500 mt-0.5">
                      {dateTimeLine}
                      {capacity > 0 && (dateTimeLine ? ` · ${approved} / ${capacity} spots filled` : `${approved} / ${capacity} spots filled`)}
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {sortRegistrationsByNewest(rows).map((r) => {
                      const statusLabel = STATUS_LABELS[r.status] || r.status;
                      const statusStyle = STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-700';
                      const canMarkPaid = (r.status === 'pending_payment') && actionLoading !== r.id;
                      const canApprove = (r.status === 'paid' || r.status === 'pending' || r.status === 'pending_payment') && !isFull && actionLoading !== r.id;
                      const canReject = r.status !== 'approved' && r.status !== 'rejected' && actionLoading !== r.id;
                      return (
                        <li key={r.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-900">{r.name || r.studentEmail || '—'}</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              College: {r.college || '—'} · Major: {r.major || '—'}
                            </p>
                            {r.studentEmail && r.name && (
                              <p className="text-xs text-slate-500 mt-0.5">{r.studentEmail}</p>
                            )}
                            <span className={`inline-block mt-1.5 rounded px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>
                              {statusLabel}
                            </span>
                            {r.paidAt && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Paid: {new Date(r.paidAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {canMarkPaid && (
                              <button
                                type="button"
                                onClick={() => handleMarkPaid(r.id)}
                                disabled={actionLoading === r.id}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {actionLoading === r.id ? '…' : 'Mark as paid'}
                              </button>
                            )}
                            {canApprove && (
                              <button
                                type="button"
                                onClick={() => handleApprove(r.id)}
                                disabled={actionLoading === r.id}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {actionLoading === r.id ? '…' : 'Approve'}
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                onClick={() => handleReject(r.id)}
                                disabled={actionLoading === r.id}
                                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {actionLoading === r.id ? '…' : 'Reject'}
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-sm text-slate-500">
          {admin ? (
            <Link to="/admin" className="text-[#00356b] hover:underline">Back to Admin Portal</Link>
          ) : (
            <Link to="/profile" className="text-[#00356b] hover:underline">Back to Profile</Link>
          )}
        </p>
      </div>
    </div>
  );
}
