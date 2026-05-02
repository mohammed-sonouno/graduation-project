import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventImageUrl } from '../lib/api';

const STAFF_ROLES = ['admin', 'dean', 'supervisor'];

function canUserJoin(community, user) {
  if (!user) return false;
  if (STAFF_ROLES.includes(user.role)) return true;
  if (!community.colleges || community.colleges.length === 0) return true;
  const userCollege = user.college || user.collegeName || user.college_name || '';
  if (!userCollege) return true;
  return community.colleges.some(
    (c) => c.toLowerCase().trim() === userCollege.toLowerCase().trim()
  );
}

function restrictionMsg(community) {
  if (!community.colleges || community.colleges.length === 0) return null;
  const list = community.colleges.join(' and ');
  return `This community is only for students in ${list}.`;
}

const STATUS_MAP = {
  owner:   { label: 'Owner',   cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  member:  { label: 'Member',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  request_pending: { label: 'Pending approval', cls: 'bg-amber-100/90 text-amber-900 border-amber-300/80' },
  request_rejected: { label: 'Rejected', cls: 'bg-red-100/90 text-red-800 border-red-300/80' },
};

export default function CommunityCard({ community, onJoin, onDismissRequest }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const isRequest = Boolean(community.is_community_request);
  const reqPending = isRequest && community.request_status === 'pending';
  const reqRejected = isRequest && community.request_status === 'rejected';

  const status   = community.membership_status || 'none';
  const isAdmin  = user?.role === 'admin';
  const allowed  = isRequest ? false : canUserJoin(community, user);
  const warning  = !isRequest && !allowed && status === 'none' ? restrictionMsg(community) : null;
  const initials = (community.name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const isMemberOrOwner = !isRequest && (status === 'member' || status === 'owner');

  const goDetail = () => {
    if (isRequest) return;
    navigate(`/communities/${community.id}`);
  };

  const handleJoin = async (e) => {
    e.stopPropagation();
    if (isRequest || status !== 'none' || joining || !allowed) return;
    setJoining(true);
    try { await onJoin(community.id); } finally { setJoining(false); }
  };

  const handleChat = (e) => {
    e.stopPropagation();
    if (isRequest) return;
    navigate(`/communities/${community.id}/chat`);
  };

  const handleDismiss = async (e) => {
    e.stopPropagation();
    if (!onDismissRequest || !community.request_id || dismissing) return;
    setDismissing(true);
    try {
      await onDismissRequest(community.request_id);
    } finally {
      setDismissing(false);
    }
  };

  const shellClass = isRequest
    ? reqRejected
      ? 'bg-red-50/55 border-red-200/50 shadow-sm'
      : 'bg-amber-50/40 border-amber-200/45 shadow-sm'
    : 'bg-white border-gray-200';

  return (
    <article
      onClick={goDetail}
      className={`group rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
        isRequest ? 'cursor-default' : 'cursor-pointer hover:shadow-md hover:border-gray-300'
      } ${shellClass}`}
    >
      <div
        className={`h-52 flex-shrink-0 relative overflow-hidden ${
          isRequest ? (reqRejected ? 'ring-1 ring-inset ring-red-200/30' : 'ring-1 ring-inset ring-amber-200/30') : ''
        }`}
      >
        {community.image_url ? (
          <img
            src={eventImageUrl(community.image_url)}
            alt={community.name}
            className={`w-full h-full object-cover ${isRequest ? '' : 'group-hover:scale-105 transition-transform duration-300'}
              ${isRequest ? 'grayscale-[0.5] contrast-[.92] opacity-[0.48] mix-blend-multiply' : ''}`}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              isRequest
                ? reqRejected
                  ? 'bg-gradient-to-br from-slate-200/80 to-red-100/50'
                  : 'bg-gradient-to-br from-slate-200/70 to-amber-100/40'
                : 'bg-gradient-to-br from-slate-100 to-slate-200'
            }`}
          >
            <span
              className={`text-4xl font-bold tracking-widest select-none ${
                isRequest ? 'text-slate-500/80' : 'text-slate-400'
              }`}
            >
              {initials}
            </span>
          </div>
        )}
        {isRequest && (
          <div
            className={`absolute inset-0 pointer-events-none ${
              reqRejected ? 'bg-red-200/20' : 'bg-amber-200/20'
            }`}
            aria-hidden
          />
        )}
        <div className="absolute top-3 right-3 left-3 flex flex-wrap justify-end gap-1.5">
          {isRequest && (reqPending || reqRejected) && STATUS_MAP[status] && (
            <span
              className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-sm ${STATUS_MAP[status].cls}`}
            >
              {STATUS_MAP[status].label}
            </span>
          )}
          {isAdmin && !isRequest && (
            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
              Admin
            </span>
          )}
          {!isRequest && !isAdmin && status !== 'none' && STATUS_MAP[status] && (
            <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-sm ${STATUS_MAP[status].cls}`}>
              {STATUS_MAP[status].label}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-5 flex-1">
        <div>
          {isRequest && (
            <p className="text-[11px] font-medium text-slate-500 mb-1.5">
              {reqRejected ? 'Request was not approved' : 'Creation request — not live yet'}
            </p>
          )}
          <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-1 mb-1.5">
            {community.name}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {community.description || 'No description provided.'}
          </p>
        </div>

        {community.colleges?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {community.colleges.slice(0, 2).map((col) => (
              <span key={col} className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-100/90 text-gray-500 border border-gray-200/80">
                {col}
              </span>
            ))}
            {community.colleges.length > 2 && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gray-100/90 text-gray-500 border border-gray-200/80">
                +{community.colleges.length - 2} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 mt-auto border-t border-gray-100/80">
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
            {isRequest ? '—' : `${community.member_count} ${community.member_count === 1 ? 'member' : 'members'}`}
          </span>

          <div className="flex items-center gap-2">
            {!isRequest && (isMemberOrOwner || isAdmin) && (
              <button
                type="button"
                onClick={handleChat}
                title="Open Chat"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:text-gray-800 active:scale-95 transition-all duration-150"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </button>
            )}

            {isRequest && onDismissRequest && (
              <button
                type="button"
                onClick={handleDismiss}
                disabled={dismissing}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-slate-300 bg-white/80 text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 active:scale-95 transition-all"
              >
                {dismissing ? 'Removing…' : 'Remove from list'}
              </button>
            )}

            {!isRequest && !isAdmin && status === 'none' && (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={!allowed || joining}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all duration-150
                    ${allowed
                      ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700 active:scale-95'
                      : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                >
                  {joining ? 'Sending...' : allowed ? 'Request to Join' : 'Closed'}
                </button>
                {warning && <p className="text-[10px] text-amber-600 leading-tight text-right max-w-[130px]">{warning}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
