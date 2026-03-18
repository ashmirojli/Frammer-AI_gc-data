import React, { useState } from 'react';
import { Send, Sparkles, DatabaseZap } from 'lucide-react';

interface QueryInputProps {
  onSend: (query: string) => void;
  isProcessing: boolean;
}

export function QueryInput({ onSend, isProcessing }: QueryInputProps) {
  const [query, setQuery] = useState('');

  const handleSend = () => {
    if (query.trim() && !isProcessing) {
      onSend(query);
      setQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-6 z-10 sticky top-0 bg-gradient-to-b from-[#0a0a0a] to-transparent pointer-events-none">
      <div className="relative pointer-events-auto">
        <div className="absolute inset-0 bg-[#ff6b6b]/10 blur-xl rounded-2xl opacity-50" />
        <div className="relative flex items-end bg-[#18181b]/80 backdrop-blur-md border border-[#ff6b6b]/20 rounded-2xl p-2 shadow-2xl">
          <div className="pl-4 pr-2 py-3 flex items-start text-[#ff6b6b]">
            <Sparkles size={20} />
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your data... e.g. 'Which channel has the most uploads?'"
            className="flex-1 max-h-32 min-h-[52px] bg-transparent border-none text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-0 resize-none py-3 text-lg leading-relaxed"
            rows={1}
            style={{ minHeight: '52px' }}
          />
          <div className="pr-2 pb-2 pl-2 flex items-center">
            <button
              onClick={handleSend}
              disabled={!query.trim() || isProcessing}
              className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                query.trim() && !isProcessing
                  ? 'bg-[#ff6b6b] text-white shadow-lg shadow-[#ff6b6b]/20 hover:bg-[#ff5252]'
                  : 'bg-white/5 text-neutral-600 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <DatabaseZap size={18} className="animate-pulse" />
              ) : (
                <Send size={18} className="translate-x-[1px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
