import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  apiUrl,
  getCommunity,
  getCommunityMembers,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  updateCommunity,
  eventImageUrl,
} from '../lib/api';

function displayName(user) {
  if (!user) return '';
  if (user.role === 'admin') return 'Admin';
  const fn = (user.first_name || '').trim();
  const ln = (user.last_name || '').trim();
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (user.name && String(user.name).trim()) return String(user.name).trim();
  return '';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const EMOJI_LIST = ['😊', '👍', '❤️', '🎉', '🙏', '👋', '😂', '🔥', '✅', '💡'];

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

function getInitials(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  if (!s) return '?';
  return s.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function isLikelyAdminSender({ mine, currentUser, senderMember, senderName }) {
  if (mine && currentUser?.role === 'admin') return true;
  if (senderMember?.role === 'admin') return true;
  const n = typeof senderName === 'string' ? senderName.toLowerCase().trim() : '';
  return n === 'admin' || n.includes('admin@');
}

export default function CommunityChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [community, setCommunity]       = useState(null);
  const [members, setMembers]           = useState([]);
  const [messages, setMessages]         = useState([]);
  const [nextCursor, setNextCursor]     = useState(null);
  const [loadingMeta, setLoadingMeta]   = useState(true);
  const [loadingMsgs, setLoadingMsgs]   = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [metaError, setMetaError]       = useState('');
  const [msgError, setMsgError]         = useState('');
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [togglingChat, setTogglingChat] = useState(false);
  const [showEmoji, setShowEmoji]       = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const textareaRef = useRef(null);
  const listRef     = useRef(null);
  const emojiRef    = useRef(null);

  const isOwner = useMemo(() => {
    if (!community || !user) return false;
    return Number(community.owner_id) === Number(user.id);
  }, [community, user]);

  const isMember = useMemo(() => {
    if (!community || !user) return false;
    if (user.role === 'admin') return true;
    const st = community.membership_status;
    return st === 'member' || st === 'owner';
  }, [community, user]);

  const chatEnabled = community?.chat_enabled !== false;
  const canUseChat  = chatEnabled || isOwner;
  const membersById = useMemo(() => {
    const map = new Map();
    for (const m of members) map.set(Number(m.id), m);
    return map;
  }, [members]);

  // When chat is OPEN: all members can send. When CLOSED: only owner.
  const canSend = chatEnabled ? isMember : isOwner;

  const loadOlder = useCallback(async () => {
    if (!canUseChat || loadingOlder || !nextCursor) return;
    const el = listRef.current;
    const prevH = el?.scrollHeight ?? 0;
    const prevT = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    setMsgError('');
    try {
      const data = await getChatMessages(id, nextCursor, 50);
      const older = data.messages || [];
      setMessages((prev) => [...older, ...prev]);
      setNextCursor(data.next_cursor ?? null);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = el.scrollHeight - prevH + prevT;
      });
    } catch (err) {
      setMsgError(err.message || 'Failed to load messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [id, canUseChat, loadingOlder, nextCursor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      setMetaError('');
      try {
        const [comm, mems] = await Promise.all([getCommunity(id), getCommunityMembers(id)]);
        if (cancelled) return;
        setCommunity(comm);
        setMembers(Array.isArray(mems) ? mems : []);
      } catch (err) {
        if (!cancelled) setMetaError(err.message || 'Failed to load community');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (loadingMeta || !community) return;
    if (!isMember) {
      setLoadingMsgs(false);
      setMsgError('You must be a member to access this chat');
      return;
    }
    if (!canUseChat) {
      setMessages([]);
      setNextCursor(null);
      setLoadingMsgs(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMsgs(true);
      setMsgError('');
      try {
        const data = await getChatMessages(id, null, 50);
        if (cancelled) return;
        setMessages(data.messages || []);
        setNextCursor(data.next_cursor ?? null);
      } catch (err) {
        if (!cancelled) setMsgError(err.message || 'Failed to load messages');
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, loadingMeta, community, isMember, canUseChat, isOwner, chatEnabled]);

  useEffect(() => {
    if (loadingMsgs || !canUseChat) return;
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [loadingMsgs, canUseChat, id]);

  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false);
      }
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest('[data-msg-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const onListScroll = () => {
    const el = listRef.current;
    if (!el || loadingOlder || !nextCursor || !canUseChat) return;
    if (el.scrollTop < 72) void loadOlder();
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 72)}px`;
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !canSend) return;
    setSending(true);
    setMsgError('');
    try {
      const created = await sendChatMessage(id, text);
      const bubble = {
        id: created.id,
        content: created.content,
        created_at: created.created_at,
        sender_id: user?.id,
        sender_name: displayName(user),
        is_deleted: false,
      };
      setMessages((prev) => [...prev, bubble]);
      setInput('');
      requestAnimationFrame(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (err) {
      setMsgError(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDelete = async (messageId) => {
    try {
      await deleteChatMessage(id, messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, content: null, sender_name: null }
            : m
        )
      );
    } catch (err) {
      setMsgError(err.message || 'Failed to delete');
    }
  };

  const handleHideMessage = (messageId) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, is_hidden_local: true, hidden_reason: 'moderator' }
          : m
      )
    );
    if (editingMessageId === messageId) cancelEditingMessage();
  };

  const startEditingMessage = (messageId, currentContent) => {
    setOpenActionMenuId(null);
    setEditingMessageId(messageId);
    setEditingValue(currentContent || '');
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingValue('');
  };

  const saveEditedMessage = () => {
    if (editingMessageId == null) return;
    const nextValue = editingValue.trim();
    if (!nextValue) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === editingMessageId ? { ...m, content: nextValue } : m))
    );
    cancelEditingMessage();
  };

  const toggleChat = async () => {
    if (!isOwner || togglingChat || !community) return;
    const next = !community.chat_enabled;
    setTogglingChat(true);
    setMsgError('');
    try {
      await updateCommunity(id, { chat_enabled: next });
      setCommunity((c) => ({ ...c, chat_enabled: next }));
      if (next) {
        setLoadingMsgs(true);
        try {
          const data = await getChatMessages(id, null, 50);
          setMessages(data.messages || []);
          setNextCursor(data.next_cursor ?? null);
        } finally {
          setLoadingMsgs(false);
        }
      }
    } catch (err) {
      setMsgError(err.message || 'Failed to update setting');
    } finally {
      setTogglingChat(false);
    }
  };

  const appendEmoji = (emoji) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const next  = input.slice(0, start) + emoji + input.slice(end);
      setInput(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setInput((prev) => prev + emoji);
    }
    setShowEmoji(false);
  };

  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (metaError || !community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-800 font-semibold mb-1">Something went wrong</p>
          <p className="text-sm text-gray-500 mb-5">{metaError || 'Community not found'}</p>
          <button
            type="button"
            onClick={() => navigate(`/communities/${id}`)}
            className="w-full bg-gray-900 text-white text-sm font-medium rounded-xl px-4 py-2.5 hover:bg-gray-700 transition-colors"
          >
            Back to Community
          </button>
        </div>
      </div>
    );
  }

  const initials = community.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const owner    = members.find((m) => m.is_owner);

  return (
    <div className="flex bg-[#f2f7ff] overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Left Sidebar ── */}
      <aside className="w-64 xl:w-72 shrink-0 bg-[#f8fbff] border-r border-[#dbe7f5] flex flex-col overflow-hidden h-full">

        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/communities/${id}`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors group mb-4"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
              {community.image_url
                ? <img src={eventImageUrl(community.image_url)} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-slate-500">{initials}</span>
              }
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm truncate leading-snug">{community.name}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Chat Controls</p>
            <button
              type="button"
              disabled={togglingChat}
              onClick={() => void toggleChat()}
              className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all duration-150 disabled:opacity-50
                ${community.chat_enabled
                  ? 'bg-[#e8f2ff] text-[#234f80] border border-[#c9ddf6] hover:bg-[#dbeaff]'
                  : 'bg-[#eef3fb] text-[#5b6f87] border border-[#d4e0ef] hover:bg-[#e5edf9]'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {community.chat_enabled
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  }
                </svg>
                {community.chat_enabled ? 'Close Chat' : 'Open Chat'}
              </span>
              <span className={`w-8 h-4 rounded-full relative flex-shrink-0 transition-colors ${community.chat_enabled ? 'bg-[#6ea4da]' : 'bg-[#b8c7d9]'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${community.chat_enabled ? 'right-0.5' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        )}

        {owner && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Owner</p>
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-violet-50 border border-violet-100">
                  {getProfileImageUrl(getMemberImage(owner)) ? (
                <img
                  src={getProfileImageUrl(getMemberImage(owner))}
                      alt={owner.name || 'Owner'}
                  className="w-7 h-7 rounded-full object-cover border border-violet-200 flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-violet-200 text-violet-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(owner.name || 'Owner')}
                </div>
              )}
              <div className="min-w-0">
                    <p className="text-xs font-semibold text-violet-900 truncate">{owner.name || 'Owner'}</p>
                <p className="text-[10px] text-violet-500">Community Owner</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Members</p>
          <ul className="space-y-0.5">
            {members.filter((m) => !m.is_owner).map((m) => {
              const mImage = getProfileImageUrl(getMemberImage(m));
              return (
                <li key={m.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  {mImage ? (
                    <img
                      src={mImage}
                      alt={m.name || 'Member'}
                      className="relative w-7 h-7 rounded-full object-cover border border-[#d3dfef] flex-shrink-0"
                    />
                  ) : (
                    <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(m.name || 'Member')}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 truncate flex-1">{m.name || 'Member'}</span>
                </li>
              );
            })}
            {members.filter((m) => !m.is_owner).length === 0 && (
              <li className="text-xs text-gray-400 px-2 py-2">No other members yet</li>
            )}
          </ul>
        </div>
      </aside>

      {/* ── Chat Area ── */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Top bar */}
        <div className="shrink-0 bg-[#f6faff] border-b border-[#dbe7f5] px-5 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
            {community.image_url
              ? <img src={eventImageUrl(community.image_url)} alt="" className="h-full w-full object-cover" />
              : <span className="text-xs font-bold text-slate-500">{initials}</span>
            }
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#183b63] truncate">{community.name} — Chat</h2>
            <p className="text-xs text-[#637d99]">{chatEnabled ? 'Chat is open' : 'Chat is closed by owner'}</p>
          </div>
          {!chatEnabled && (
            <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Closed
            </span>
          )}
        </div>

        {/* Not a member */}
        {!isMember ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Members Only</p>
            <p className="text-xs text-gray-400">{msgError || 'You must be a member to access this chat'}</p>
          </div>
        ) : (
          <>
            {/* Messages — flex-1 + overflow-y-auto keeps input at bottom */}
            <div
              ref={listRef}
              onScroll={onListScroll}
              className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#eef5ff]"
            >
              {loadingMsgs && canUseChat ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400 font-medium">Loading messages...</p>
                </div>
              ) : !canUseChat ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-2">
                    <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Chat is currently closed</p>
                  <p className="text-xs text-gray-400">Only the community owner can reopen the chat</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-2">
                    <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No messages yet</p>
                  <p className="text-xs text-gray-400">
                    {canSend ? 'Start the conversation' : 'Waiting for a message'}
                  </p>
                </div>
              ) : (
                <>
                  {loadingOlder && (
                    <div className="flex justify-center py-2">
                      <span className="text-xs text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                        Loading older messages...
                      </span>
                    </div>
                  )}
                  {messages.map((m) => {
                    const mine      = Number(m.sender_id) === Number(user?.id);
                    const deleted   = m.is_deleted;
                    const hidden    = Boolean(m.is_hidden_local) || deleted;
                    const isPrivileged = isOwner || user?.role === 'admin';
                    const canManageOwn = !hidden && mine;
                    const canEditOwn = canManageOwn;
                    const canDeleteOwn = canManageOwn;
                    const canHideOthers = !hidden && !mine && isPrivileged;
                    const canShowActionMenu = canEditOwn || canDeleteOwn || canHideOthers;
                    const senderMember = membersById.get(Number(m.sender_id));
                    const senderImage = getProfileImageUrl(getMemberImage(senderMember));
                    const baseName = mine
                      ? displayName(user)
                      : (senderMember?.name || (typeof m.sender_name === 'string' && !m.sender_name.includes('@') ? m.sender_name : '') || 'Member');
                    const adminSender = isLikelyAdminSender({
                      mine,
                      currentUser: user,
                      senderMember,
                      senderName: baseName,
                    });
                    const senderName = adminSender ? 'Admin' : baseName;
                    const isEditingThis = editingMessageId === m.id && canEditOwn;

                    return (
                      <div key={m.id} className={`flex flex-col gap-1 group ${mine ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-end gap-2 max-w-[90%] ${mine ? 'flex-row-reverse' : ''}`}>
                          {senderImage ? (
                            <img
                              src={senderImage}
                              alt={senderName}
                              className="w-8 h-8 rounded-full object-cover border border-[#d2dfef] flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 border
                                ${adminSender
                                  ? 'bg-[#e8eef8] text-[#2e4f79] border-[#c4d5ec]'
                                  : 'bg-[#dbe8f7] text-[#3a5c84] border-[#c7d8ee]'
                                }`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a7 7 0 0114 0" />
                              </svg>
                            </div>
                          )}
                          <div className="relative">
                            {!hidden && (
                              <div className={`flex items-center gap-1.5 mb-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                                <span className={`text-[11px] font-semibold ${mine ? 'text-[#3d5f87]' : 'text-[#4f6f92]'}`}>
                                  {senderName}
                                </span>
                                {adminSender && (
                                  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded-full border ${
                                    mine
                                      ? 'bg-[#edf5ff] text-[#385f8a] border-[#c8dbf5]'
                                      : 'bg-[#eef3fb] text-[#4a6687] border-[#d4e0ef]'
                                  }`}>
                                    Admin
                                  </span>
                                )}
                              </div>
                            )}
                            {isEditingThis ? (
                              <div className="w-[260px] max-w-[70vw] rounded-2xl border border-[#c5d8f1] bg-white shadow-sm p-2.5">
                                <textarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  rows={3}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      cancelEditingMessage();
                                    }
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                      e.preventDefault();
                                      saveEditedMessage();
                                    }
                                  }}
                                  className="w-full resize-none rounded-xl border border-[#d1deee] bg-[#f4f9ff] px-3 py-2 text-sm text-[#1f4268] placeholder:text-[#7f95ad] focus:outline-none focus:ring-2 focus:ring-[#b7d0ea] focus:border-[#a5c3e2]"
                                />
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={cancelEditingMessage}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#d2dfef] text-[#5e7692] hover:bg-[#f1f6fd] transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditedMessage}
                                    disabled={!editingValue.trim()}
                                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#3f6e9c] text-white hover:bg-[#335c84] disabled:opacity-40 transition-colors"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`w-full px-4 py-2.5 text-sm leading-relaxed break-words overflow-wrap-anywhere
                                ${hidden
                                    ? 'bg-[#edf2f9] text-[#6f7f92] italic rounded-2xl border border-[#d8e2ef]'
                                    : mine
                                      ? 'bg-[#dcecff] text-[#11385f] rounded-2xl rounded-br-sm border border-[#c5ddfb] shadow-sm'
                                      : 'bg-white text-[#244468] rounded-2xl rounded-bl-sm border border-[#d6e2f2] shadow-sm'
                                  }`}
                                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                              >
                              {hidden ? (
                                <span className="text-xs">delete message</span>
                                ) : (
                                  <p className="whitespace-pre-wrap">{m.content}</p>
                                )}
                              </div>
                            )}
                          </div>
                          {canShowActionMenu && (
                            <div
                              className={`relative shrink-0 ${mine ? 'order-first' : 'order-last'}`}
                              data-msg-menu
                            >
                              <button
                                type="button"
                                title="Message options"
                                onClick={() => setOpenActionMenuId((prev) => (prev === m.id ? null : m.id))}
                                className="opacity-0 group-hover:opacity-100 transition-all duration-150 w-7 h-7 rounded-full bg-white border border-[#d3dfef] shadow-sm text-[#5c7592] hover:text-[#36597e] hover:bg-[#edf4ff] flex items-center justify-center"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <circle cx="12" cy="5" r="1.8" />
                                  <circle cx="12" cy="12" r="1.8" />
                                  <circle cx="12" cy="19" r="1.8" />
                                </svg>
                              </button>
                              {openActionMenuId === m.id && (
                                <div
                                  className={`absolute bottom-9 min-w-[140px] overflow-hidden rounded-xl border border-[#d2dfef] bg-white shadow-lg z-20 ${mine ? 'right-0' : 'left-0'}`}
                                >
                                  {canEditOwn || canDeleteOwn ? (
                                    <>
                                      {canEditOwn && (
                                        <button
                                          type="button"
                                          onClick={() => startEditingMessage(m.id, m.content)}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-[#355b83] hover:bg-[#eef5ff] transition-colors"
                                        >
                                          Edit message
                                        </button>
                                      )}
                                      {canDeleteOwn && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionMenuId(null);
                                            void handleDelete(m.id);
                                          }}
                                          className={`w-full text-left px-3 py-2 text-xs font-medium text-[#b54848] hover:bg-[#fff1f1] transition-colors ${
                                            canEditOwn ? 'border-t border-[#edf1f6]' : ''
                                          }`}
                                        >
                                          Delete message
                                        </button>
                                      )}
                                    </>
                                  ) : canHideOthers ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleHideMessage(m.id);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-[#355b83] hover:bg-[#eef5ff] transition-colors"
                                    >
                                      Hide message
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {!deleted && (
                          <span className={`text-[10px] text-gray-400 px-1 ${mine ? 'text-right' : 'text-left'}`}>
                            {formatTime(m.created_at)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {msgError && isMember && (
              <div className="shrink-0 mx-5 mb-2 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-center text-xs text-red-600 font-medium">
                {msgError}
              </div>
            )}

            {/* Fixed input bar */}
            <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3">
              {!canSend ? (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {chatEnabled
                    ? 'You need to be a member to send messages'
                    : 'Chat is closed — only the owner can send messages'}
                </div>
              ) : (
                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    disabled={sending}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a message... (Enter to send)"
                  className="flex-1 resize-none rounded-xl border border-[#d1deee] bg-[#f4f9ff] px-4 py-2.5 text-sm text-[#1f4268] placeholder:text-[#7f95ad] focus:outline-none focus:ring-2 focus:ring-[#b7d0ea] focus:border-[#a5c3e2] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                  />

                  <div className="relative shrink-0" ref={emojiRef}>
                    <button
                      type="button"
                      onClick={() => setShowEmoji((v) => !v)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#d1deee] bg-[#f4f9ff] text-[#67809a] hover:bg-[#e9f2fe] hover:text-[#365d84] transition-all"
                      title="Emoji"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-12 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 grid grid-cols-5 gap-1 z-20 min-w-[160px]">
                        {EMOJI_LIST.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); appendEmoji(emoji); }}
                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={sending || !input.trim()}
                    onClick={() => void handleSend()}
                    className="shrink-0 flex items-center gap-2 rounded-xl bg-[#3f6e9c] text-white px-4 py-2.5 text-sm font-medium hover:bg-[#335c84] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">{sending ? '' : 'Send'}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
