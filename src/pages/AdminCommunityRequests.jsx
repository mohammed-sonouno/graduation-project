import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCommunityRequests, reviewCommunityRequest } from '../lib/api';

const TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function AdminCommunityRequests() {
  const [tab, setTab]           = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [acting, setActing]     = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setExpanded(null);
      try {
        const data = await getCommunityRequests(tab);
        setRequests(data);
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [tab]);

  const review = async (id, status) => {
    setActing(id);
    try {
      await reviewCommunityRequest(id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setExpanded(null);
    } catch (err) {
      alert(err.message || 'Something went wrong');
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <nav className="text-sm" aria-label="Breadcrumb">
            <Link to="/admin" className="text-slate-500 hover:text-slate-700 transition-colors">
              Admin Portal
            </Link>
            <span className="mx-2 text-slate-400" aria-hidden>&gt;</span>
            <span className="font-semibold text-[#00356b]">Community Requests</span>
          </nav>
        </div>
      </section>

      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4">
              Community Requests
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Review pending requests and decide whether to approve or reject each community submission.
            </p>
          </div>
          <p className="text-center text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{requests.length}</span> request{requests.length !== 1 ? 's' : ''} in this tab
          </p>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8 pb-20">
      <div className="max-w-5xl mx-auto">

      {/* Tab buttons */}
      <div className="flex flex-wrap gap-3 mb-8 justify-center">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition-all
              ${tab === t.key
                ? 'bg-[#00356b] text-white border-[#00356b] shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#00356b]/40 hover:text-[#00356b]'}`}
          >
            {t.label}
            {tab === t.key && !loading && (
              <span className="ml-2 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-base text-slate-500">No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} requests</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              isExpanded={expanded === req.id}
              onToggle={() => setExpanded(expanded === req.id ? null : req.id)}
              onApprove={() => review(req.id, 'approved')}
              onReject={() => review(req.id, 'rejected')}
              acting={acting === req.id}
              showActions={tab === 'pending'}
            />
          ))}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

/* ─── RequestRow ─────────────────────────────────────────────────────────── */
function RequestRow({ request, isExpanded, onToggle, onApprove, onReject, acting, showActions }) {
  const date = new Date(request.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all
                     ${isExpanded ? 'border-[#00356b]/30' : 'border-slate-200'}`}>

      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#00356b]/10 text-[#00356b] text-sm font-semibold
                          flex items-center justify-center flex-shrink-0">
            {request.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{request.name}</p>
            <p className="text-xs text-slate-500">{request.requester_name} · {date}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex flex-wrap gap-1">
            {request.colleges?.slice(0, 2).map((col) => (
              <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {col}
              </span>
            ))}
          </div>
          <span className="text-slate-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <div className="pt-4 flex flex-col gap-4">

            {/* Description */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>
            </div>

            {/* Colleges */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Target Colleges</p>
              <div className="flex flex-wrap gap-2">
                {request.colleges?.map((col) => (
                  <span key={col} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Image */}
            {request.image_url && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Image</p>
                <img src={request.image_url} alt={request.name}
                     className="w-32 h-20 object-cover rounded-xl border border-slate-200" />
              </div>
            )}

            {/* Requester */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-medium
                              flex items-center justify-center">
                {request.requester_name?.[0] || '?'}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-800">{request.requester_name}</p>
                <p className="text-xs text-slate-500">{request.requester_email}</p>
              </div>
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onReject}
                  disabled={acting}
                  className="flex-1 border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-medium
                             hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={onApprove}
                  disabled={acting}
                  className="flex-1 bg-[#00356b] text-white rounded-xl py-2.5 text-sm font-medium
                             hover:bg-[#002a54] transition-colors disabled:opacity-50"
                >
                  {acting ? 'Processing...' : 'Approve and Create Community'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}