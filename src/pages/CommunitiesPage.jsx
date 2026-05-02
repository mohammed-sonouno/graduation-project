import { useState, useMemo, useEffect } from 'react';
import { useCommunities } from '../components/useCommunities';
import CommunityCard from '../components/CommunityCard';
import { useAuth } from '../context/AuthContext';
import {
  createCommunityRequest,
  createCommunityDirect,
  getColleges,
  getMajors,
  uploadEventImage,
} from '../lib/api';
import { buildCanonicalCollegeOptions, canonicalCollegeNamesFallback } from '../canonicalCollege';

function isMyCommunity(c) {
  if (c?.is_community_request) {
    return c.request_status === 'pending' || c.request_status === 'rejected';
  }
  return c?.membership_status === 'owner' || c?.membership_status === 'member';
}

export default function CommunitiesPage() {
  const [showModal, setShowModal]     = useState(false);
  const [myCommunitiesOnly, setMyCommunitiesOnly] = useState(false);
  const [collegeOptions, setCollegeOptions] = useState(canonicalCollegeNamesFallback);

  useEffect(() => {
    Promise.all([getColleges(), getMajors()])
      .then(([list, majors]) => {
        const opts = buildCanonicalCollegeOptions(
          Array.isArray(list) ? list : [],
          Array.isArray(majors) ? majors : []
        );
        if (opts.length > 0) setCollegeOptions(opts.map((o) => o.name));
        else setCollegeOptions(canonicalCollegeNamesFallback());
      })
      .catch(() => setCollegeOptions(canonicalCollegeNamesFallback()));
  }, []);

  const {
    communities, loading, error,
    filters, hasMore,
    updateFilter, loadMore, requestJoin, refresh, dismissRequest,
  } = useCommunities();

  const visibleCommunities = useMemo(
    () => (myCommunitiesOnly ? communities.filter(isMyCommunity) : communities),
    [communities, myCommunitiesOnly]
  );

  const clearFilters = () => {
    updateFilter('college', '');
  };

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-3xl mx-auto mb-6">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4">
              Communities
            </h1>
            <p className="text-slate-600 leading-relaxed">
              Discover student communities, filter by college, and request to join the groups that match your academic interests.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-8 pb-20">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <label htmlFor="community-college-filter" className="sr-only">Filter by college</label>
              <select
                id="community-college-filter"
                value={filters.college}
                onChange={(e) => updateFilter('college', e.target.value)}
                className="h-11 w-full sm:w-[220px] rounded-full border border-slate-200 bg-white px-4 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] appearance-none"
              >
                <option value="">All Colleges</option>
                {collegeOptions.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <button
              type="button"
              onClick={() => setMyCommunitiesOnly((v) => !v)}
              aria-pressed={myCommunitiesOnly}
              className={`h-11 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border text-sm font-semibold px-5 transition-all duration-150 whitespace-nowrap ${
                myCommunitiesOnly
                  ? 'border-[#00356b] bg-[#00356b] text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My communities
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="h-11 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#00356b] text-white text-sm font-semibold px-5 hover:bg-[#002a54] active:scale-95 transition-all duration-150 whitespace-nowrap shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Request Community
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
            <span>{error}</span>
            <button
              onClick={clearFilters}
              className="border border-red-300 rounded-lg px-3 py-1 text-xs hover:bg-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!error && (
          <>
            {loading && communities.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-72 rounded-2xl bg-slate-200 animate-pulse" />
                ))}
              </div>
            ) : visibleCommunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                  </svg>
                </div>
                <p className="text-slate-600 font-medium mb-1">
                  {myCommunitiesOnly && communities.length > 0
                    ? 'No communities in your list yet'
                    : 'No communities found'}
                </p>
                <p className="text-sm text-slate-400 mb-5 max-w-sm">
                  {myCommunitiesOnly && communities.length > 0
                    ? "You are not a member of any community matching this view. Try turning off “My communities” or join a group from the full list."
                    : "Try another college filter, or add communities from the “Request Community” action. If this environment has no data yet, an admin can run: node server/seed-ieee.js"}
                </p>
                {myCommunitiesOnly ? (
                  <button
                    type="button"
                    onClick={() => setMyCommunitiesOnly(false)}
                    className="border border-slate-200 bg-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Show all communities
                  </button>
                ) : (
                  <button
                    onClick={clearFilters}
                    className="border border-slate-200 bg-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleCommunities.map((c) => (
                  <CommunityCard
                    key={c.is_community_request ? `rq-${c.request_id}` : c.id}
                    community={c}
                    onJoin={requestJoin}
                    onDismissRequest={c.is_community_request ? dismissRequest : undefined}
                  />
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMore}
                  className="border border-slate-200 bg-white rounded-xl px-8 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Load More
                </button>
              </div>
            )}

            {loading && communities.length > 0 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading...</p>
              </div>
            )}
          </>
        )}
      </section>

      {showModal && (
        <RequestCommunityModal
          collegeOptions={collegeOptions}
          onClose={() => setShowModal(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}

function RequestCommunityModal({ onClose, onCreated, collegeOptions: collegePills }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [form, setForm]                 = useState({ name: '', description: '', colleges: [] });
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading]           = useState(false);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState('');

  const toggleCollege = (col) => {
    setForm((p) => ({
      ...p,
      colleges: p.colleges.includes(col)
        ? p.colleges.filter((c) => c !== col)
        : [...p.colleges, col],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) {
      setError('Please fill in the name and description.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let image_url = '';
      if (imageFile) {
        const uploaded = await uploadEventImage(imageFile);
        image_url = uploaded.filename || uploaded.url || '';
      }
      const payload = { ...form, image_url };
      if (isAdmin) {
        await createCommunityDirect(payload);
      } else {
        await createCommunityRequest(payload);
      }
      setSuccess(true);
      if (isAdmin) onCreated?.();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {isAdmin ? 'Community Created!' : 'Request Submitted!'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {isAdmin
                ? 'The community is now available in the list.'
                : 'Your request has been submitted. The administration will review it shortly.'}
            </p>
            <button
              onClick={onClose}
              className="bg-[#00356b] text-white rounded-xl px-8 py-2.5 text-sm font-medium hover:bg-[#002a54] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {isAdmin ? 'Create Community' : 'Request a Community'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdmin ? 'Directly create a new community' : 'Submit a request to create a new community'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Community Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] transition-all"
                  placeholder="e.g. Web Developers Community"
                  value={form.name}
                  maxLength={150}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] resize-none transition-all"
                  placeholder="Describe the purpose of this community..."
                  value={form.description}
                  rows={4}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Colleges</label>
                <div className="flex flex-col gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-800 pb-2 border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={form.colleges.length === 0}
                      onChange={() => setForm((p) => ({ ...p, colleges: [] }))}
                      className="accent-[#00356b] w-4 h-4"
                    />
                    All Colleges
                  </label>
                  {(collegePills && collegePills.length > 0 ? collegePills : canonicalCollegeNamesFallback()).map((col) => (
                    <label key={col} className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.colleges.includes(col)}
                        onChange={() => toggleCollege(col)}
                        className="accent-[#00356b] w-4 h-4"
                      />
                      {col}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Community Image <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                  className="w-full text-sm text-slate-600 border border-slate-200 rounded-xl px-4 py-2 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#00356b] file:text-white hover:file:bg-[#002a54] cursor-pointer focus:outline-none"
                />
                {imagePreview && (
                  <div className="relative mt-2">
                    <img src={imagePreview} alt="preview" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(''); }}
                      className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center border border-slate-200 text-slate-500 hover:text-red-500 shadow-sm transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-600">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#00356b] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#002a54] disabled:opacity-50 transition-all"
                >
                  {loading
                    ? 'Submitting...'
                    : isAdmin
                      ? 'Create Community'
                      : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
