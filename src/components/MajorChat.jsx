import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postChat } from '../api';

function ChatMessage({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-[#00356b] text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-700 rounded-bl-sm'
        }`}
      >
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function SuggestionsRow({ suggestions, onSelect, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function textLooksArabic(s) {
  return /[\u0600-\u06FF]/.test(String(s || ''));
}

/**
 * @param {{ majorId: string, major: { name?: string, chat?: { greetingEn?: string, greetingAr?: string, suggestedEn?: string[], suggestedAr?: string[] } } }} props
 */
export default function MajorChat({ majorId, major }) {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [error, setError] = useState('');
  const [uiLocale, setUiLocale] = useState('en');
  const scrollContainerRef = useRef(null);

  const majorName = major?.name || '';

  const makeWelcomeMessage = (username, majorName) => {
    const safeName = username || 'User';
    const safeMajor = majorName || 'this programme';
    return `Welcome ${safeName}! I am your academic advisor for ${safeMajor}. Ask me about anything related to this programme — admission requirements, difficulty, career opportunities, or how it compares with other options.`;
  };

  const greeting = useMemo(() => {
    const c = major?.chat;
    const en = (c?.greetingEn && String(c.greetingEn).trim()) || '';
    const ar = (c?.greetingAr && String(c.greetingAr).trim()) || '';
    if (uiLocale === 'ar') {
      if (ar) return ar;
      return majorName
        ? `أهلاً! أنا مساعدك لتخصص ${majorName}. اسألني أي سؤال عن هذا التخصص.`
        : 'أهلاً! اسألني أي سؤال عن هذا التخصص.';
    }
    if (en) return en;
    return majorName
      ? `Hello! I'm your advisor for ${majorName}. Ask me anything about this major.`
      : 'Hello! Ask me anything about this major.';
  }, [major?.chat, majorName, uiLocale]);

  const suggestedQuestions = useMemo(() => {
    const c = major?.chat;
    const en = Array.isArray(c?.suggestedEn) ? c.suggestedEn.map((x) => String(x).trim()).filter(Boolean) : [];
    const ar = Array.isArray(c?.suggestedAr) ? c.suggestedAr.map((x) => String(x).trim()).filter(Boolean) : [];
    const defaultEn = [
      'Is this major difficult?',
      'What careers does this major lead to?',
      'Is this major suitable for me?',
      'What is the admission average?'
    ];
    const defaultAr = [
      'هل هذا التخصص صعب؟',
      'شو الوظائف اللي بتطلع منه؟',
      'هل هالتخصص مناسب لي؟',
      'شو معدل القبول؟'
    ];
    if (uiLocale === 'ar') {
      if (ar.length) return ar;
      return defaultAr;
    }
    if (en.length) return en;
    return defaultEn;
  }, [major?.chat, uiLocale]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!messages.length && user) {
      const welcomeText = makeWelcomeMessage(user?.name, majorName);
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'ai',
          content: welcomeText,
          createdAt: new Date()
        }
      ]);
      if (!textLooksArabic(welcomeText)) {
        setUiLocale('en');
      }
    }
  }, [majorId, majorName, messages.length, user]);

  const sendMessage = async (textOrEvent) => {
    const text = typeof textOrEvent === 'string' ? textOrEvent.trim() : inputValue.trim();
    if (!text || !user) return;

    if (textLooksArabic(text)) setUiLocale('ar');
    else if (/[A-Za-z]{3,}/.test(text)) setUiLocale('en');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError('');
    setIsTyping(true);

    try {
      const data = await postChat({
        message: text,
        conversationId: conversationId ?? undefined,
        majorId,
      });
      if (data?.conversationId != null) {
        setConversationId(data.conversationId);
      }
      const replyText =
        typeof data?.reply === 'string' && data.reply.length > 0
          ? data.reply
          : 'No reply was returned. If this persists, the assistant may not have data for that question yet.';
      if (textLooksArabic(replyText)) setUiLocale('ar');
      else if (/[A-Za-z]{3,}/.test(replyText)) setUiLocale('en');
      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: replyText,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (e) {
      const msg =
        e?.status === 401
          ? 'Please sign in to use the assistant.'
          : e?.message || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestionClick = (question) => {
    sendMessage(question);
  };

  const isEmpty = !inputValue.trim();
  const chatDisabled = authLoading || !user || isTyping;

  return (
    <section className="border border-slate-200 rounded-lg shadow-sm bg-white p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00356b]/10 text-[#00356b]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
        <h3 className="text-lg font-semibold text-[#0b2d52]">
          Ask about this major
        </h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        The greeting and chips above come from the adviser copy stored for this programme in your university database.
        Replies use the same data source (English unless you write in Arabic).
      </p>

      {!authLoading && !user ? (
        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          <Link to="/login" className="font-semibold text-[#00356b] hover:underline">Sign in</Link>
          {' '}to ask questions. Replies are personalized and saved to your account.
        </div>
      ) : null}

      <div className="bg-slate-50 rounded-lg p-4 mb-4 max-w-xl">
        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
          {greeting}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 mb-3" role="alert">
          {error}
        </p>
      ) : null}

      {messages.length > 0 && (
        <div
          ref={scrollContainerRef}
          className="flex flex-col gap-3 mb-4 max-h-64 overflow-y-auto overflow-x-hidden"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-500 rounded-lg rounded-bl-sm px-4 py-2.5 text-sm italic">
                Advisor is typing…
              </div>
            </div>
          )}
        </div>
      )}

      <SuggestionsRow
        suggestions={suggestedQuestions}
        onSelect={handleSuggestionClick}
        disabled={chatDisabled}
      />

      <form onSubmit={handleSubmit} className="flex gap-2 mt-5">
        <input
          type="text"
          placeholder={user ? 'Type your question (English or Arabic)…' : 'Sign in to ask a question…'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={chatDisabled}
          className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b] disabled:bg-slate-50 disabled:text-slate-400"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={isEmpty || chatDisabled}
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#00356b] text-white flex items-center justify-center shadow-sm hover:bg-[#002a54] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00356b] disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-[#00356b]/40 focus:ring-offset-2 transition-all duration-200"
          aria-label="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9 2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </section>
  );
}
