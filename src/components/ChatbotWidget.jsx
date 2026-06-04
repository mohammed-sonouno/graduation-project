import { useState, useRef, useEffect } from 'react';

function ChatMessage({ role, content }) {
  const isUser = role === 'user';
  const isArabic = /[؀-ۿ]/.test(content);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-[#00356b] text-white rounded-br-sm'
            : 'bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function SuggestionsRow({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {suggestions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="text-xs text-[#00356b] bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-3 py-1 transition-colors"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

const DEFAULT_SUGGESTIONS_AR = [
  'شو أقرب فعالية قادمة؟',
  'شو التخصصات في كلية تكنولوجيا المعلومات؟',
  'كيف أنضم لمجتمع؟',
  'شو مواد تخصص MIS؟',
];

const DEFAULT_SUGGESTIONS_EN = [
  'What is the next upcoming event?',
  'What majors are in the IT faculty?',
  'How do I join a community?',
  'What courses are in the MIS major?',
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS_AR);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: clean },
    ]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chatbot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: clean }),
      });
      const data = await res.json().catch(() => ({}));
      const isArabic = /[؀-ۿ]/.test(clean);
      const reply =
        (typeof data?.answer === 'string' && data.answer) ||
        (typeof data?.error === 'string' && data.error) ||
        (isArabic ? 'آسف، صار خطأ. جرب مرة ثانية.' : 'Sorry, something went wrong. Please try again.');

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }

      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'ai', content: reply },
      ]);
    } catch {
      const isArabic = /[؀-ۿ]/.test(clean);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          content: isArabic
            ? 'ما قدرت أوصل للسيرفر. تأكد من الاتصال وجرب مرة ثانية.'
            : 'Could not reach the server. Please try again.',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    void sendMessage(inputValue);
  };

  const isArabicInput = /[؀-ۿ]/.test(inputValue);

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open AI assistant'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#00356b] text-white shadow-xl hover:bg-[#002a54] active:scale-95 transition-all duration-200 flex items-center justify-center"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[380px] max-h-[560px] bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#00356b] text-white flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Najah AI Assistant</p>
              <p className="text-xs text-blue-200 leading-tight">مساعد جامعة النجاح الوطنية</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 min-h-0"
          >
            {messages.length === 0 && (
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-600 shadow-sm border border-slate-100">
                <p dir="rtl" className="mb-1 font-medium text-[#00356b]">
                  أهلاً! أنا مساعد جامعة النجاح.
                </p>
                <p className="text-slate-500 text-xs leading-relaxed" dir="rtl">
                  بقدر أساعدك بالفعاليات، المجتمعات، التخصصات، وكل شي متعلق بالمنصة.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <span className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <SuggestionsRow suggestions={suggestions} onSelect={(q) => void sendMessage(q)} />

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex gap-2 px-3 pb-3 pt-1 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              dir={isArabicInput ? 'rtl' : 'ltr'}
              placeholder="اكتب سؤالك / Type your question"
              className="flex-1 min-w-0 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#00356b] text-white flex items-center justify-center hover:bg-[#002a54] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9 2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
