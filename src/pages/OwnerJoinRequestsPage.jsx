import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJoinRequests, reviewJoinRequest } from '../lib/api';

function Skeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <div className="h-8 w-40 bg-gray-200 rounded-lg animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((k) => (
          <div key={k} className="border border-gray-100 rounded-2xl p-4 flex gap-4 animate-pulse">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-16 bg-gray-200 rounded-xl" />
              <div className="h-9 w-16 bg-gray-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function getInitials(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return '?';
  return n.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function statusMeta(status) {
  if (status === 'approved') {
    return {
      label: 'Approved',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Rejected',
      cls: 'bg-red-50 text-red-700 border-red-200',
    };
  }
  return {
    label: 'Pending',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

export default function OwnerJoinRequestsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [fadingId, setFadingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const data = await getJoinRequests(id, 'pending');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err.message || 'Failed to load requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const finishRemove = (requestId) => {
    setRows((prev) => prev.filter((r) => r.id !== requestId));
    setFadingId(null);
    setBusyId(null);
  };

  const handleReview = async (requestId, status) => {
    if (busyId) return;
    setActionError('');
    setBusyId(requestId);
    setFadingId(requestId);
    try {
      await reviewJoinRequest(id, requestId, status);
      window.setTimeout(() => finishRemove(requestId), 320);
    } catch (err) {
      setFadingId(null);
      setBusyId(null);
      setActionError(err.message || 'Action failed');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50/80"><Skeleton /></div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/communities/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0b2d52] mb-6 transition-colors"
        >
          ← Back to Community
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 mb-5">
          <h1 className="text-2xl font-semibold text-[#0b2d52]">Join Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Manage pending community join requests in a clean, academic layout</p>
        </div>

        {fetchError && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
            <span>{fetchError}</span>
            <button
              type="button"
              onClick={load}
              className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {actionError}
          </div>
        )}

        {rows.length === 0 && !fetchError ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            <p className="text-base font-medium">No join requests yet</p>
            <p className="text-sm mt-1">New requests will appear here once submitted</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
              <div className="col-span-6">Applicant</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-3 text-left">Actions</div>
            </div>

            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const st = statusMeta(r.status || 'pending');
                return (
                  <li
                    key={r.id}
                    className={`px-4 md:px-5 py-4 transition-all duration-300 ${
                      fadingId === r.id ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-6 flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#d7e6f8] to-[#b8d2ef] text-[#0b2d52] font-semibold text-sm flex items-center justify-center border border-[#c6daef] shrink-0">
                          {getInitials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm md:text-[15px] font-semibold text-slate-900 truncate">{r.name || '—'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.created_at)}</p>
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>

                      <div className="md:col-span-3 flex items-center gap-2 md:justify-end">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReview(r.id, 'approved')}
                          className="flex-1 md:flex-none rounded-xl bg-[#0b2d52] px-4 py-2 text-sm font-medium text-white hover:bg-[#11437a] disabled:opacity-50 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleReview(r.id, 'rejected')}
                          className="flex-1 md:flex-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
