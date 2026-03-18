import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, User, Code2, ChevronDown, ChevronUp, Lightbulb, Copy, Check, Terminal, ShieldCheck, Database } from 'lucide-react';
import { Visualization } from './Visualization';

export interface MessageProps {
  message: {
    id: string;
    role: 'user' | 'ai';
    content?: string;
    summary?: string;
    sql?: string;
    insights?: string[];
    chartData?: any;
    suggestions?: string[];
    pipelineMeta?: any;
  };
  onSuggestionClick?: (suggestion: string) => void;
}

export function Message({ message, onSuggestionClick }: MessageProps) {
  const [isSqlExpanded, setIsSqlExpanded] = useState(false);
  const [isResultsExpanded, setIsResultsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';

  const copySql = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end px-6 py-4">
        <div className="max-w-5xl w-full flex items-start gap-4 justify-end">
          <div className="bg-[#18181b] border border-white/5 text-neutral-200 px-5 py-3.5 rounded-2xl rounded-tr-sm shadow-sm text-base leading-relaxed">
            {message.content}
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6b6b] to-[#ff4757] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff6b6b]/20 text-white">
            <User size={18} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start px-6 py-6 border-y border-white/5 bg-[#0a0a0a]/30">
      <div className="max-w-5xl w-full flex items-start gap-5 mx-auto">
        <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-white/10 flex items-center justify-center flex-shrink-0 shadow-md text-[#ff6b6b]">
          <Bot size={20} />
        </div>
        
        <div className="flex-1 space-y-5 min-w-0">
          {/* NL Summary */}
          {message.summary && (
            <div className="text-neutral-200 text-base leading-relaxed">
              {message.summary}
            </div>
          )}

          {/* Expandable SQL Block */}
          {message.sql && (
            <div className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => setIsSqlExpanded(!isSqlExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#18181b]/50 hover:bg-[#18181b] transition-colors border-b border-transparent"
              >
                <div className="flex items-center gap-2 text-sm font-mono text-neutral-400">
                  <Terminal size={14} className="text-[#ff6b6b]" />
                  Generated SQL
                </div>
                <div className="flex items-center gap-2">
                  {message.pipelineMeta?.tables_used && message.pipelineMeta.tables_used.length > 0 && (
                    <span className="text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={message.pipelineMeta.tables_used.join(', ')}>
                      Tables: {message.pipelineMeta.tables_used.join(', ')}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500 bg-white/5 px-2 py-0.5 rounded-md">
                    SQLite
                  </span>
                  {isSqlExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
                </div>
              </button>
              
              <AnimatePresence>
                {isSqlExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative border-t border-white/5"
                  >
                    <button
                      onClick={copySql}
                      className="absolute top-3 right-3 p-1.5 bg-[#18181b] hover:bg-[#27272a] rounded-md text-neutral-400 hover:text-white transition-colors border border-white/5"
                      title="Copy SQL"
                    >
                      {copied ? <Check size={14} className="text-[#2ed573]" /> : <Copy size={14} />}
                    </button>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-neutral-300 bg-black/40">
                      <code>{message.sql}</code>
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Expandable Query Results Block */}
          {message.chartData && message.chartData.rows && message.chartData.rows.length > 0 && (
            <div className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden mt-2">
              <button
                onClick={() => setIsResultsExpanded(!isResultsExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#18181b]/50 hover:bg-[#18181b] transition-colors border-b border-transparent"
              >
                <div className="flex items-center gap-2 text-sm font-mono text-neutral-400">
                  <Database size={14} className="text-[#ff6b6b]" />
                  Query Results
                </div>
                {isResultsExpanded ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
              </button>
              
              <AnimatePresence>
                {isResultsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative border-t border-white/5"
                  >
                    <Visualization data={message.chartData} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Key Insights - hide generic "no data" messages */}
          {message.insights && message.insights.length > 0 && message.insights.some(i => !i.toLowerCase().includes('no data returned')) && (
            <div className="bg-[#18181b]/50 border border-[#2ed573]/20 rounded-xl p-5 mt-4 shadow-[0_0_20px_rgba(46,213,115,0.03)]">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={16} className="text-[#2ed573]" />
                <h4 className="font-semibold text-neutral-200 text-sm tracking-wide uppercase">Key Insights</h4>
              </div>
              <ul className="space-y-2">
                {message.insights.filter(i => !i.toLowerCase().includes('no data returned')).map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-base text-neutral-400 leading-relaxed">
                    <span className="text-[#2ed573] mt-1.5 text-[10px] opacity-80">●</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unit Tester Scores — only show when at least one candidate passed */}
          {(() => {
            const scores = message.pipelineMeta?.candidate_scores || [];
            const hasAnyPass = scores.some((s: any) => s.score > 0);
            if (!hasAnyPass || scores.length === 0) return null;
            // Deduplicate by strategy, keep highest score per strategy
            const byStrategy = new Map<string, any>();
            scores.forEach((s: any) => {
              const existing = byStrategy.get(s.strategy);
              if (!existing || s.score > existing.score) byStrategy.set(s.strategy, s);
            });
            const uniqueScores = Array.from(byStrategy.values());
            return (
              <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={16} className="text-[#1e90ff]" />
                  <h4 className="text-sm font-semibold text-neutral-300">Unit Tester Evaluation</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueScores.map((score: any, idx: number) => (
                    <div key={idx} className={`px-3 py-2 rounded-lg border text-xs flex flex-col gap-1 ${message.pipelineMeta.winning_strategy === score.strategy ? 'bg-[#1e90ff]/10 border-[#1e90ff]/30 text-[#1e90ff]' : 'bg-black/30 border-white/5 text-neutral-400'}`}>
                      <span className="font-mono font-medium uppercase">{score.strategy}</span>
                      <span className="opacity-80">Score: {score.score} {score.dry_run_ok ? '(Pass)' : '(Fail)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Telemetry & Performance Metrics */}
          {message.pipelineMeta && message.pipelineMeta.total_latency_ms > 0 && (
            <div className="bg-[#18181b]/50 border border-white/5 rounded-xl p-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Terminal size={16} className="text-[#a29bfe]" />
                <h4 className="text-sm font-semibold text-neutral-300">Query Performance & Cost</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Latency */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Query Gen Time</div>
                  <div className="text-sm font-mono text-neutral-200">
                    {Math.max(0, message.pipelineMeta.total_latency_ms - (message.pipelineMeta.node_latencies?.executor || 0)).toFixed(0)} ms
                  </div>
                </div>
                {/* Execution */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Execution Time</div>
                  <div className="text-sm font-mono text-neutral-200">
                    {(message.pipelineMeta.node_latencies?.executor || 0).toFixed(0)} ms
                  </div>
                </div>
                {/* Tokens */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Tokens Used</div>
                  <div className="text-sm font-mono text-neutral-200">
                    {message.pipelineMeta.total_tokens?.toLocaleString() || 0}
                  </div>
                </div>
                {/* Cost */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Cost (USD)</div>
                  <div className="text-sm font-mono text-neutral-200">
                    ${(message.pipelineMeta.total_cost || 0).toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Smart Follow-ups */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="pt-4 flex flex-wrap gap-2">
              {message.suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-neutral-300 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Code2 size={14} className="text-[#ff6b6b]" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
