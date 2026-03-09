import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCommunities, getColleges, createCommunity, updateCommunity, getAdminUsers } from '../api';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isDean, isSupervisor, isCommunityLeader } from '../utils/permissions';

function Communities() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [communities, setCommunities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [error, setError] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCollegeId, setCreateCollegeId] = useState('');
  const [createLeaderId, setCreateLeaderId] = useState('');
  const [leaderOptions, setLeaderOptions] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const admin = isAdmin(user);
  const dean = isDean(user);
  const supervisor = isSupervisor(user);
  const communityLeader = isCommunityLeader(user);
  const canAccess = admin || dean || supervisor || communityLeader;

  useEffect(() => {
    if (loading) return;
    if (!user || !canAccess) {
      navigate('/login', { replace: true });
      return;
    }
    const collegeId = dean && user.college_id != null ? user.college_id : null;
    setLoadingList(true);
    getCommunities(communityLeader ? null : collegeId)
      .then((list) => setCommunities(Array.isArray(list) ? list : []))
      .catch(() => setCommunities([]))
      .finally(() => setLoadingList(false));
  }, [user, loading, canAccess, navigate, dean, communityLeader, user?.college_id]);

  useEffect(() => {
    if (admin) {
      getColleges()
        .then((list) => setColleges(Array.isArray(list) ? list : []))
        .catch(() => setColleges([]));
    }
  }, [admin]);

  useEffect(() => {
    if (admin && showCreate) {
      Promise.all([getAdminUsers('supervisor'), getAdminUsers('community_leader')])
        .then(([sup, lead]) => {
          const merged = [...(Array.isArray(sup) ? sup : []), ...(Array.isArray(lead) ? lead : [])];
          setLeaderOptions(merged);
        })
        .catch(() => setLeaderOptions([]));
    }
  }, [admin, showCreate]);

  const canEditCommunity = (c) =>
    admin ||
    (dean && user?.college_id != null && Number(c.collegeId) === Number(user.college_id)) ||
    (communityLeader && user?.community_id != null && Number(c.id) === Number(user.community_id));

  const handleStartEdit = (c) => {
    setEditingId(c.id);
    setEditName(c.name || '');
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setEditError('');
    const name = editName.trim();
    if (!name) {
      setEditError('Name is required.');
      return;
    }
    setEditLoading(true);
    try {
      const updated = await updateCommunity(editingId, { name });
      setCommunities((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, name: updated.name, collegeName: updated.collegeName ?? c.collegeName } : c))
      );
      handleCancelEdit();
    } catch (err) {
      setEditError(err?.data?.error || err?.message || 'Failed to update community.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!createName.trim()) {
      setError('Community name is required.');
      return;
    }
    if (createCollegeId === '' || createCollegeId == null) {
      setError('Please select a college.');
      return;
    }
    if (createLeaderId === '' || createLeaderId == null) {
      setError('Please select a supervisor. Each community must have a supervisor.');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await createCommunity({
        name: createName.trim(),
        collegeId: Number(createCollegeId),
        leaderId: Number(createLeaderId),
      });
      setCreateName('');
      setCreateCollegeId('');
      setCreateLeaderId('');
      setShowCreate(false);
      setLoadingList(true);
      getCommunities()
        .then((list) => setCommunities(Array.isArray(list) ? list : []))
        .catch(() => {})
        .finally(() => setLoadingList(false));
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Failed to create community.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3]">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <section className="bg-[#f7f6f3] pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h1
              className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-[#0b2d52] leading-tight tracking-tight mb-4"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Communities
            </h1>
            <p className="text-slate-600 leading-relaxed">
              {admin
                ? 'Each community is connected with one college. View all and create new ones below.'
                : dean
                  ? "Edit only communities of your college. Each community is linked to one college."
                  : communityLeader
                    ? 'Edit only the community you lead.'
                    : 'Your assigned community.'}
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-10 py-8">
        {admin && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#00356b] bg-[#00356b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#002a54] focus:outline-none focus:ring-2 focus:ring-[#00356b]/30 focus:ring-offset-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showCreate ? 'Cancel' : 'Add community'}
            </button>
          </div>
        )}

        {showCreate && admin && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 mb-8 border-l-4 border-l-[#00356b]">
            <h2 className="text-lg font-semibold text-[#0b2d52] mb-4" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              New community
            </h2>
            <p className="text-sm text-slate-600 mb-4">Each community belongs to one college and must have a supervisor (or community leader).</p>
            <form onSubmit={handleCreate} className="space-y-4 max-w-md">
              <div>
                <label htmlFor="community-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="community-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Computer Science Community"
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                />
              </div>
              <div>
                <label htmlFor="community-college" className="block text-sm font-medium text-slate-700 mb-1">
                  College <span className="text-red-500">*</span>
                </label>
                <select
                  id="community-college"
                  value={createCollegeId}
                  onChange={(e) => setCreateCollegeId(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                >
                  <option value="">Select a college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="community-leader" className="block text-sm font-medium text-slate-700 mb-1">
                  Leader (email) <span className="text-red-500">*</span>
                </label>
                <select
                  id="community-leader"
                  value={createLeaderId}
                  onChange={(e) => setCreateLeaderId(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                >
                  <option value="">Select a supervisor or community leader by email</option>
                  {leaderOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}{u.communityName ? ` (currently: ${u.communityName})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">The leader is identified by their account email. Each community must have one. If they already lead a community, they will be moved to this one.</p>
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={createLoading}
                className="rounded-lg bg-[#00356b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#002a54] disabled:opacity-70"
              >
                {createLoading ? 'Creating…' : 'Create community'}
              </button>
            </form>
          </div>
        )}

        {loadingList ? (
          <p className="text-slate-500 py-8">Loading communities…</p>
        ) : communities.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-8 text-center">
            <p className="text-slate-600">No communities found.</p>
            {dean && <p className="mt-2 text-sm text-slate-500">Communities are created by admins and linked to your college.</p>}
          </div>
        ) : (
          <div className="space-y-8">
            {(() => {
              const byCollege = communities.reduce((acc, c) => {
                const key = c.collegeId != null ? c.collegeId : (c.collegeName || 'Other');
                if (!acc[key]) acc[key] = { collegeName: c.collegeName || 'Unknown college', items: [] };
                acc[key].items.push(c);
                return acc;
              }, {});
              const groups = Object.entries(byCollege).sort((a, b) => (a[1].collegeName || '').localeCompare(b[1].collegeName || ''));
              return groups.map(([key, { collegeName, items }]) => (
                <div key={key}>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                    {collegeName}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="group block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-[#00356b]/40 hover:shadow-md"
                      >
                        {editingId === c.id ? (
                          <form onSubmit={handleSaveEdit} className="space-y-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
                              placeholder="Community name"
                              autoFocus
                            />
                            {editError && <p className="text-xs text-red-600">{editError}</p>}
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={editLoading}
                                className="rounded-lg bg-[#00356b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002a54] disabled:opacity-70"
                              >
                                {editLoading ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#00356b]/10 flex items-center justify-center text-[#00356b] group-hover:bg-[#00356b]/15 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.8}
                                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m3-7h3m-3 3h3m-6 0h.01M12 16h.01M12 8h.01M16 16h.01M8 16h.01M12 12v.01"
                                  />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-[#0b2d52] group-hover:text-[#00356b]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                                  {c.name}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">College: {c.collegeName || '—'}</p>
                                {c.leaderEmail && (
                                  <p className="mt-0.5 text-xs text-slate-500">Leader: {c.leaderName || c.leaderEmail}</p>
                                )}
                              </div>
                              {canEditCommunity(c) && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(c)}
                                  className="flex-shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-[#00356b]/30 hover:text-[#00356b] focus:outline-none focus:ring-2 focus:ring-[#00356b]/20"
                                  aria-label="Edit community"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

export default Communities;
