import { useState, useRef, useEffect } from 'react';

function generateMockReply(userText, majorName) {
  const lower = userText.toLowerCase();
  const shortName = majorName.replace(/\s*\([^)]*\)\s*$/, '').trim() || majorName;

  if (lower.includes('difficult') || lower.includes('hard') || lower.includes('easy')) {
    return `${shortName} balances theory and practice. With consistent effort and interest in the subject, most students do well. Office hours and study groups help a lot.`;
  }
  if (lower.includes('career') || lower.includes('job') || lower.includes('work')) {
    return `Graduates in ${shortName} often work as analysts, consultants, developers, or in IT and business roles. Internships and projects during your degree will strengthen your profile.`;
  }
  if (lower.includes('business') || lower.includes('technology') || lower.includes('tech')) {
    return `${shortName} sits at the intersection of business and technology. You’ll learn both how systems work and how they support organizational goals.`;
  }
  if (lower.includes('suitable') || lower.includes('right for me') || lower.includes('fit')) {
    return `If you enjoy problem-solving, working with systems or data, and connecting technology to real needs, ${shortName} could be a good fit. Talking to current students or advisors can help you decide.`;
  }
  return `Thanks for your question about ${shortName}. The program covers both foundational concepts and practical skills. For more specific details, you can check the curriculum or reach out to the department.`;
}

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

function SuggestionsRow({ suggestions, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 transition-colors"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'Is this major difficult?',
  'What careers does this major lead to?',
  'Is this major more business or technology?',
  'Is this major suitable for me?',
];

export default function MajorChat({ majorName, majorShortName }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = (textOrEvent) => {
    const text = typeof textOrEvent === 'string'
      ? textOrEvent.trim()
      : inputValue.trim();
    if (!text) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    setIsTyping(true);
    const timer = setTimeout(() => {
      const reply = generateMockReply(text, majorName);
      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: reply,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 600);

    return () => clearTimeout(timer);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestionClick = (question) => {
    sendMessage(question);
  };

  const isEmpty = !inputValue.trim();

  return (
    <section className="border border-slate-200 rounded-lg shadow-sm bg-white p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00356b]/10 text-[#00356b]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </span>
        <h3 className="text-lg font-semibold text-[#0b2d52]">
          Ask about this Major
        </h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">Your AI assistant for academic guidance.</p>

      <div className="bg-slate-50 rounded-lg p-4 mb-4 max-w-xl">
        <p className="text-slate-600 text-sm leading-relaxed">
          Hello! I can help with questions about {majorShortName}. Ask me about career paths, course difficulty, or if this major is right for you.
        </p>
      </div>

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
                AI is typing…
              </div>
            </div>
          )}
        </div>
      )}

      <SuggestionsRow suggestions={SUGGESTED_QUESTIONS} onSelect={handleSuggestionClick} />

      <form onSubmit={handleSubmit} className="flex gap-2 mt-5">
        <input
          type="text"
          placeholder="Type your question here..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 min-w-0 text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00356b]/20 focus:border-[#00356b]"
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={isEmpty}
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
