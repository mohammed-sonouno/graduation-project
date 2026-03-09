import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isCommunityLeader } from '../utils/permissions';
import {
  getCommunityEventRegistrations,
  markRegistrationPaid,
  approveRegistration,
  rejectRegistration,
} from '../api';

const STATUS_LABELS = {
  pending_payment: 'Pending payment',
  pending: 'Pending payment',
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

export default function EventRegistrations() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const accessAllowed = isAdmin(user) || isCommunityLeader(user);

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [user, loading, navigate]);

  const load = () => {
    if (!accessAllowed) return;
    setError('');
    getCommunityEventRegistrations()
      .then((list) => setRegistrations(Array.isArray(list) ? list : []))
      .catch((e) => {
        setError(e?.data?.error || 'Failed to load registrations');
        setRegistrations([]);
      });
  };

  useEffect(() => {
    if (accessAllowed) load();
  }, [user, accessAllowed]);

  const handleMarkPaid = (id) => {
    setActionLoading(id);
    markRegistrationPaid(id)
      .then(() => load())
      .catch((e) => setError(e?.data?.error || 'Failed to mark as paid'))
      .finally(() => setActionLoading(null));
  };

  const handleApprove = (id) => {
    setActionLoading(id);
    approveRegistration(id)
      .then(() => load())
      .catch((e) => setError(e?.data?.error || 'Failed to approve'))
      .finally(() => setActionLoading(null));
  };

  const handleReject = (id) => {
    if (!window.confirm('Reject this registration?')) return;
    setActionLoading(id);
    rejectRegistration(id)
      .then(() => load())
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

  if (!accessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
          <h1 className="text-xl font-semibold text-slate-900">Access restricted</h1>
          <p className="mt-2 text-slate-600">Only community leaders and supervisors can manage event registrations.</p>
          <Link to="/profile" className="mt-6 inline-block rounded-full bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002a54]">
            Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  const byEvent = registrations.reduce((acc, r) => {
    const key = r.eventId || 'unknown';
    if (!acc[key]) acc[key] = { title: r.title, date: r.date, time: r.time, availableSeats: r.availableSeats, rows: [] };
    acc[key].rows.push(r);
    return acc;
  }, {});

  const approvedCount = (eventId) =>
    (registrations.filter((r) => r.eventId === eventId && r.status === 'approved').length);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className="bg-[#0b2d52] border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-semibold text-white">Event registrations</h1>
          <p className="mt-1 text-white/80 text-sm">
            Students request to join → pending payment → after they pay, mark as paid → approve (first paid, first approved until event is full).
          </p>
        </div>
      </section>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        {Object.keys(byEvent).length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No event registrations for your community yet.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(byEvent).map(([eventId, { title, date, time, availableSeats, rows }]) => {
              const approved = approvedCount(eventId);
              const capacity = availableSeats != null ? Number(availableSeats) : 0;
              const isFull = capacity > 0 && approved >= capacity;
              return (
                <div key={eventId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="font-semibold text-slate-900">{title || eventId}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {date}
                      {time ? ` · ${time}` : ''}
                      {capacity > 0 && ` · ${approved} / ${capacity} spots filled`}
                    </p>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const statusLabel = STATUS_LABELS[r.status] || r.status;
                      const statusStyle = STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-700';
                      const canMarkPaid = (r.status === 'pending_payment' || r.status === 'pending') && actionLoading !== r.id;
                      const canApprove = (r.status === 'paid' || r.status === 'pending') && !isFull && actionLoading !== r.id;
                      const canReject = r.status !== 'approved' && r.status !== 'rejected' && actionLoading !== r.id;
                      return (
                        <li key={r.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{r.studentEmail || r.name || '—'}</p>
                            <p className="text-xs text-slate-500">
                              {[r.college, r.major].filter(Boolean).join(' · ') || '—'}
                            </p>
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
          <Link to="/profile" className="text-[#00356b] hover:underline">Back to Profile</Link>
        </p>
      </div>
    </div>
  );
}
