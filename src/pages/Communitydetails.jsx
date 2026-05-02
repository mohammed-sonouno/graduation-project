import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  apiUrl,
  getCommunity,
  getCommunityMembers,
  updateCommunity,
  removeCommunityMember,
  requestJoinCommunity,
  deleteCommunity,
  eventImageUrl,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

function getProfileImageUrl(raw) {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return null;
  if (v.startsWith('data:') || v.startsWith('http')) return v;
  if (v.startsWith('/uploads/')) return apiUrl(v);
  if (v.startsWith('/')) return apiUrl(v);
  return apiUrl(`/uploads/${v.split('/').pop()}`);
}

function getMemberImage(member) {
  if (!member || typeof member !== 'object') return null;
  return (
    member.picture ||
    member.profile_picture ||
    member.profileImage ||
    member.avatar ||
    member.avatar_url ||
    member.image_url ||
    member.image ||
    member.photo ||
    null
  );
}

export default function CommunityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [community, setCommunity] = useState(null);
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [joining, setJoining]     = useState(false);
  const [joinMsg, setJoinMsg]     = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [comm, mems] = await Promise.all([
          getCommunity(id),
          getCommunityMembers(id),
        ]);
        setCommunity(comm);
        setMembers(mems);
      } catch {
        setError('Failed to load community');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleJoin = async () => {
    setJoining(true);
    setJoinMsg('');
    try {
      await requestJoinCommunity(id);
      setCommunity((p) => ({ ...p, membership_status: 'pending' }));
      setJoinMsg('Request sent. Waiting for owner approval.');
    } catch (err) {
      setJoinMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this community? This cannot be undone.')) return;
    try {
      await deleteCommunity(id);
      navigate('/communities');
    } catch (err) {
      alert(err.message || 'Failed to delete community');
    }
  };

  if (loading) return <Skeleton />;

  if (error) return (
    <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center px-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-800 font-semibold mb-1">Failed to load</p>
        <p className="text-sm text-slate-500 mb-5">{error}</p>
        <button
          onClick={() => navigate('/communities')}
          className="w-full bg-[#00356b] text-white text-sm font-medium rounded-xl px-4 py-2.5 hover:bg-[#002a54] transition-colors"
        >
          Back to Communities
        </button>
      </div>
    </div>
  );

  const status      = community.membership_status || 'none';
  const isOwner     = status === 'owner';
  const isAdminUser = user?.role === 'admin';
  const isMember    = status === 'member' || isOwner;
  const initials    = community.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
      <section className="bg-[#f7f6f3] pt-6 pb-2">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <nav className="text-sm" aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => navigate('/communities')}
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              Communities
            </button>
            <span className="mx-2 text-slate-400" aria-hidden>&gt;</span>
            <span className="font-semibold text-[#00356b]">{community.name}</span>
          </nav>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 pb-20">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
          {/* Hero Banner */}
          <div className="relative h-64 md:h-80 overflow-hidden bg-[#0b2d52]">
            {community.image_url ? (
              <>
                <img
                  src={eventImageUrl(community.image_url)}
                  alt={community.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b2d52]/90 via-[#0b2d52]/50 to-[#0b2d52]/10" aria-hidden />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0b2d52] to-[#1e3a5f]">
                <span className="absolute inset-0 flex items-center justify-center text-8xl font-bold text-white/10 tracking-widest select-none">{initials}</span>
              </div>
            )}

            {/* Hero content overlaid on banner */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-12">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2 drop-shadow-sm">
                    {community.name}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm text-white/80">
                      <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {community.owner_name}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="flex items-center gap-1.5 text-sm text-white/80">
                      <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                      </svg>
                      {community.member_count} {community.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>

                {/* Status / Action badge on banner */}
                <div className="shrink-0">
                  {user?.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/30 px-3 py-1.5 rounded-full">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      Admin
                    </span>
                  ) : status === 'owner' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-violet-500/80 backdrop-blur-sm text-white border border-violet-400/50 px-3 py-1.5 rounded-full">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      Owner
                    </span>
                  ) : status === 'member' ? (
                    <span className="inline-flex items-center text-xs font-semibold bg-[#eaf6ee]/90 backdrop-blur-sm text-[#2f6f47] border border-[#cfe6d8] px-3 py-1.5 rounded-full">
                      Member
                    </span>
                  ) : status === 'pending' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/80 backdrop-blur-sm text-white border border-amber-400/50 px-3 py-1.5 rounded-full">
                      Pending Approval
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Below-banner actions */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-wrap gap-1.5">
                {community.colleges?.length > 0 && community.colleges.map((col) => (
                  <span key={col} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {col}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {status === 'none' && user?.role !== 'admin' && (
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="inline-flex items-center gap-2 bg-[#00356b] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#002a54] active:scale-95 transition-all duration-150 disabled:opacity-50 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      {joining ? 'Sending...' : 'Request to Join'}
                    </button>
                    {joinMsg && <p className="text-xs text-slate-500 text-right leading-relaxed max-w-[220px]">{joinMsg}</p>}
                  </div>
                )}
                {(isOwner || isAdminUser) && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="inline-flex items-center gap-1.5 text-xs text-red-500 border border-red-200 rounded-xl px-3 py-2 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Community
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          <div className="md:col-span-2 flex flex-col gap-5">

            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">About</h2>
              {community.description ? (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{community.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}
            </section>

            {(isMember || user?.role === 'admin') && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-900">Community Chat</h2>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border
                    ${community.chat_enabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                    {community.chat_enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/communities/${id}/chat`)}
                  className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all duration-150 group"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Open Chat
                  </span>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </section>
            )}

            {isOwner && (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Owner Controls</h2>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => navigate(`/communities/${id}/join-requests`)}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all duration-150 group"
                  >
                    <span className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Join Requests
                    </span>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <ChatToggle
                    community={community}
                    onToggle={(val) => setCommunity((p) => ({ ...p, chat_enabled: val }))}
                  />
                </div>
              </section>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-fit">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Members</h2>
              <p className="text-xs text-slate-400 mt-0.5">{members.length} {members.length === 1 ? 'member' : 'members'} total</p>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
                  <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                  </svg>
                </div>
                <p className="text-xs text-slate-400">No members yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isCurrentOwner={isOwner}
                    communityId={id}
                    onRemove={(uid) => setMembers((prev) => prev.filter((x) => x.id !== uid))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatToggle({ community, onToggle }) {
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      await updateCommunity(community.id, { chat_enabled: !community.chat_enabled });
      onToggle(!community.chat_enabled);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-150 disabled:opacity-50
        ${community.chat_enabled
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
        }`}
    >
      <span className="flex items-center gap-2.5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {community.chat_enabled
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          }
        </svg>
        {community.chat_enabled ? 'Chat Enabled' : 'Enable Chat'}
      </span>
      <span className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${community.chat_enabled ? 'bg-emerald-400' : 'bg-gray-300'}`}>
        <span className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${community.chat_enabled ? 'right-1' : 'left-1'}`} />
      </span>
    </button>
  );
}

function MemberRow({ member, isCurrentOwner, communityId, onRemove }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.name} from this community?`)) return;
    setRemoving(true);
    try {
      await removeCommunityMember(communityId, member.id);
      onRemove(member.id);
    } finally {
      setRemoving(false);
    }
  };

  const initials = member.name?.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const profileImage = getProfileImageUrl(getMemberImage(member));

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group">
      {profileImage ? (
        <img
          src={profileImage}
          alt={member.name || member.email || 'Member'}
          className={`relative w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-offset-1
            ${member.is_owner ? 'ring-violet-200' : 'ring-slate-100'}`}
        />
      ) : (
        <div className={`relative w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-offset-1
          ${member.is_owner
            ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white ring-violet-200'
            : 'bg-gradient-to-br from-slate-400 to-slate-600 text-white ring-slate-100'
          }`}>
          {initials}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 truncate font-medium leading-snug">{member.name}</p>
        {member.is_owner && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full mt-0.5">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            Owner
          </span>
        )}
      </div>
      {isCurrentOwner && !member.is_owner && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="opacity-0 group-hover:opacity-100 text-[11px] font-medium text-red-400 hover:text-red-600 flex-shrink-0 disabled:opacity-50 transition-all duration-150 border border-red-100 hover:border-red-200 rounded-lg px-2 py-0.5"
        >
          {removing ? '...' : 'Remove'}
        </button>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded-lg mb-7" />
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6 shadow-sm">
          <div className="h-52 bg-slate-100" />
          <div className="p-6 space-y-3">
            <div className="h-6 w-2/5 bg-slate-200 rounded-lg" />
            <div className="h-4 w-1/3 bg-slate-100 rounded-lg" />
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-24 bg-slate-100 rounded-full" />
              <div className="h-6 w-24 bg-slate-100 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-5">
            <div className="h-36 bg-white border border-slate-200 rounded-2xl shadow-sm" />
            <div className="h-24 bg-white border border-slate-200 rounded-2xl shadow-sm" />
          </div>
          <div className="h-64 bg-white border border-slate-200 rounded-2xl shadow-sm" />
        </div>
      </div>
    </div>
  );
}
