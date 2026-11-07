import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, Code, Terminal, ChevronDown } from 'lucide-react';
import type { AppSnapshot, ChatMessage } from '../../shared/types.js';
import { sendChatMessage } from '../lib/api.js';

interface AIAssistantProps {
  snapshot: AppSnapshot;
  onSelectCustomer: (id: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ snapshot, onSelectCustomer }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am the **BritConnect Churn Intelligence AI**. I have instant access to our live customer registry (${snapshot.kpis.activeCustomers.toLocaleString()} active subscribers) and calibrated ML models.\n\nAsk me about any customer by ID (e.g. **${snapshot.activeCustomers[0]?.customerId || 'BCT-000001'}**), high-risk accounts, segment retention strategies, or disparate impact fairness audits.`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const samplePrompts = [
    'Show top accounts with highest MRR at risk',
    `Analyze customer ${snapshot.activeCustomers[0]?.customerId || 'BCT-000001'}`,
    'Summarize customer segments and interventions',
    'What is our demographic disparate impact rating?',
    'Give an executive summary of total MRR at risk',
  ];

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const response = await sendChatMessage(q, messages);
      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `An error occurred processing your query: ${err.message || err}`,
          timestamp: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#C9A227]" />
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
            BritConnect AI Churn Assistant
          </h1>
        </div>
        <p className="mt-1 text-xs text-[#64746B] max-w-3xl">
          Conversational agent backed by deterministic database tool queries. Executes read-only queries against the live in-memory snapshot and applies Gemini to summarize telecom interventions.
        </p>

        {/* Prompt chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {samplePrompts.map(prompt => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="rounded-full border border-[#0F3D2E]/25 bg-white px-3 py-1 text-xs font-medium text-[#0F3D2E] shadow-2xs hover:bg-[#FAF6EA] transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex flex-col rounded-xl border border-[#C4BEAD]/40 bg-white shadow-sm overflow-hidden h-[540px]">
        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F3D2E] text-white">
                    <Bot className="h-4 w-4 text-[#E4C766]" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#0F3D2E] text-white'
                      : 'bg-[#FAF6EA] text-[#1B2A22] border border-[#C4BEAD]/30 shadow-2xs'
                  }`}
                >
                  {/* Tool call trace if present */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mb-3 rounded-lg bg-[#1B2A22] p-2 text-[11px] text-[#A8C3A0] font-mono">
                      <div className="flex items-center gap-1.5 text-[#E4C766] font-bold">
                        <Terminal className="h-3 w-3" />
                        <span>Tool Executed: {msg.toolCalls[0].toolName}()</span>
                      </div>
                      <div className="mt-1 text-white/70 overflow-x-auto text-[10px]">
                        Params: {JSON.stringify(msg.toolCalls[0].params)}
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FAF6EA] border border-[#C4BEAD]/40 text-[#0F3D2E]">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#64746B] italic pl-11">
              <Sparkles className="h-4 w-4 animate-spin text-[#C9A227]" />
              <span>Querying snapshot database & reasoning with Gemini...</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[#C4BEAD]/40 bg-[#FAF6EA] p-3">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask anything about customer churn, risk drivers, or query by Customer ID..."
              className="flex-1 rounded-lg border border-[#C4BEAD]/60 bg-white px-3.5 py-2.5 text-xs text-[#1B2A22] placeholder-[#64746B]/60 focus:border-[#0F3D2E] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F3D2E] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1F7A4D] disabled:opacity-50"
            >
              <span>Send</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
