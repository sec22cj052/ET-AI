import { useState, useRef, useEffect } from 'react';

interface Citation {
  index: number;
  document_id: string;
  filename: string;
  page: number;
  storage_url: string;
  type?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: string;
  streaming?: boolean;
}

const SUGGESTED = ['Safety Protocols', 'Fault Code Lookup', 'Seal Replacement Interval', 'Torque Specifications'];

export default function Copilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [activeConfidence, setActiveConfidence] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput('');
    setLoading(true);
    setActiveCitations([]);
    setActiveConfidence('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: question }]);

    // Add placeholder AI message
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/query/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, session_id: null }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let citations: Citation[] = [];
      let confidence = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;

          try {
            const event = JSON.parse(raw);
            if (event.type === 'meta') {
              citations = event.data.citations || [];
              confidence = event.data.confidence || '';
              setActiveCitations(citations);
              setActiveConfidence(confidence);
            } else if (event.type === 'content') {
              accumulatedText += event.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: accumulatedText,
                  citations,
                  confidence,
                  streaming: true,
                };
                return updated;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Finalize
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: accumulatedText || '(No response)',
          citations,
          confidence,
          streaming: false,
        };
        return updated;
      });
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '❌ Error: Could not connect to backend. Make sure the backend is running on port 8000.',
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'bg-lime-100 text-lime-900 border border-lime-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-900 border border-yellow-200';
      case 'Low': return 'bg-red-100 text-red-900 border border-red-200';
      default: return 'bg-surface-container text-on-surface-variant';
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Message Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
              <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <h2 className="text-headline-lg font-headline-lg text-on-surface">Expert Knowledge Copilot</h2>
              <p className="text-body-md text-on-surface-variant max-w-md">Ask technical questions and get AI-powered answers grounded in your ingested documents.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            msg.role === 'user' ? (
              <div key={idx} className="flex flex-col items-end message-appear">
                <div className="max-w-2xl bg-surface-container-high text-on-surface px-4 py-3 rounded-xl rounded-tr-none shadow-sm">
                  <p className="text-body-md">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div key={idx} className="flex flex-col items-start message-appear">
                <div className="max-w-3xl bg-white border border-slate-100 p-5 rounded-xl rounded-tl-none shadow-sm w-full">
                  {/* Meta bar */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      {msg.confidence && (
                        <span className={`px-2 py-0.5 text-label-sm rounded-sm ${getConfidenceBadge(msg.confidence)}`}>
                          Confidence: {msg.confidence}
                        </span>
                      )}
                      {msg.citations && msg.citations.length > 0 && (
                        <span className="text-label-sm text-outline flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">link</span>
                          {msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>

                  {/* Content */}
                  <div className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                    {msg.streaming && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse rounded-sm" />}
                  </div>

                  {/* Action row */}
                  {!msg.streaming && (
                    <div className="mt-4 flex gap-2">
                      <button
                        className="px-3 py-1 text-label-sm border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1 rounded-sm"
                        onClick={() => navigator.clipboard.writeText(msg.content)}
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-center gap-2 text-on-surface-variant text-label-md">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
              Thinking...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-5 bg-white border-t border-outline-variant">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute left-4 top-4 text-outline group-focus-within:text-primary transition-colors">
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <textarea
              ref={textareaRef}
              className="w-full pl-12 pr-16 py-4 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none text-body-md [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              placeholder="Ask a technical question..."
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="absolute right-4 bottom-3 flex items-center gap-2">
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="p-2 bg-primary text-on-primary rounded-lg shadow-md hover:bg-primary-container transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>

          {/* Suggested chips */}
          <div className="max-w-4xl mx-auto mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-label-sm text-outline">Suggested:</span>
            {SUGGESTED.map(s => (
              <button
                key={s}
                className="text-label-sm px-2 py-0.5 border border-slate-200 rounded-sm hover:border-primary hover:text-primary transition-colors"
                onClick={() => sendMessage(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Citations Sidebar */}
      <aside className="w-[300px] bg-white border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-headline-md font-headline-md text-on-surface">Citations</h3>
          <span className="px-2 py-0.5 bg-surface-container text-primary text-label-md rounded-sm">
            {activeCitations.length} Source{activeCitations.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {activeCitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 py-8">
              <span className="material-symbols-outlined text-3xl">article</span>
              <p className="text-label-md text-center">Source documents will appear here after you ask a question.</p>
            </div>
          ) : activeCitations.map((c) => (
            <a
              key={c.index}
              href={c.type === 'tacit_knowledge' ? '#' : `${c.storage_url}#page=${c.page}`}
              target={c.type === 'tacit_knowledge' ? undefined : "_blank"}
              rel={c.type === 'tacit_knowledge' ? undefined : "noopener noreferrer"}
              className="group flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:border-primary transition-all cursor-pointer block"
            >
              {c.type === 'tacit_knowledge' ? (
                <div className="bg-blue-50 text-blue-600 p-2 rounded flex-shrink-0">
                  <span className="material-symbols-outlined">forum</span>
                </div>
              ) : (
                <div className="bg-red-50 text-red-600 p-2 rounded flex-shrink-0">
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-label-md text-on-surface truncate">[{c.index}] {c.filename}</p>
                {c.type !== 'tacit_knowledge' && (
                  <p className="text-label-sm text-outline mt-0.5">Page {c.page}</p>
                )}
              </div>
              {c.type !== 'tacit_knowledge' && (
                <span className="material-symbols-outlined text-outline text-sm group-hover:text-primary flex-shrink-0">open_in_new</span>
              )}
            </a>
          ))}

          {/* Semantic Context */}
          {activeCitations.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-label-md uppercase text-outline mb-2">Confidence Level</h4>
              <span className={`px-3 py-1 text-label-md rounded-sm ${
                activeConfidence === 'High' ? 'bg-lime-100 text-lime-900 border border-lime-200' :
                activeConfidence === 'Medium' ? 'bg-yellow-100 text-yellow-900 border border-yellow-200' :
                'bg-red-100 text-red-900 border border-red-200'
              }`}>
                {activeConfidence || 'Unknown'}
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
