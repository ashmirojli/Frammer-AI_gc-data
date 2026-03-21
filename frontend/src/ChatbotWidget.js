import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart2,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Check,
  Database,
  Expand,
  History,
  Lightbulb,
  Minimize2,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table as TableIcon,
  Terminal,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

const CHAT_API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:8000';

const CHART_COLORS = [
  '#ff6b6b', '#2ed573', '#1e90ff', '#ffa502', '#a29bfe',
  '#fd79a8', '#00cec9', '#e17055', '#6c5ce7', '#55efc4',
];

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Welcome to Frammer AI Analytics. I can help you query your database using natural language. What would you like to explore today?',
  suggestions: [
    'Which channel has the most uploads?',
    'Show me the top 5 videos by views',
    'What is the average duration of our videos?',
  ],
};

const SCHEMA_TABLES = [
  { table: 'fact_user_summary', columns: ['uploaded_count', 'created_count', 'published_count', 'user_id'] },
  { table: 'fact_monthly', columns: ['total_uploaded', 'total_created', 'total_published', 'month_id'] },
  { table: 'fact_channel_publishing', columns: ['published_count', 'published_duration', 'channel_id', 'platform_id'] },
  { table: 'fact_video', columns: ['video_id', 'headline', 'source', 'published', 'type', 'user_id', 'platform_id'] },
  { table: 'dim_user', columns: ['user_id', 'user_name'] },
  { table: 'dim_channel', columns: ['channel_id', 'channel_name'] },
  { table: 'dim_platform', columns: ['platform_id', 'platform_name'] },
  { table: 'dim_month', columns: ['month_id', 'month_name', 'year', 'quarter'] },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chatbot-chart-tooltip">
      <p className="chatbot-chart-tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="chatbot-chart-tooltip-row">
          <span className="chatbot-chart-tooltip-dot" style={{ background: entry.color }} />
          <span className="chatbot-chart-tooltip-name">{entry.name}:</span>
          <span className="chatbot-chart-tooltip-value">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function QueryResults({ chartData }) {
  const [view, setView] = useState('chart');
  const [expanded, setExpanded] = useState(false);

  if (!chartData?.rows?.length) return null;

  const { labels, values, value_label, columns, rows } = chartData;
  const hasChartData = labels?.length > 1 && values?.length > 1;
  const effectiveView = hasChartData ? view : 'table';

  const chartTransform = hasChartData
    ? labels.map((label, i) => ({
        name: String(label).length > 15 ? String(label).substring(0, 15) + '\u2026' : String(label),
        fullName: String(label),
        [value_label || 'value']: values[i],
      }))
    : [];

  const maxValue = hasChartData ? Math.max(...values) : 0;

  return (
    <div className="chatbot-results-block">
      <button type="button" className="chatbot-results-header" onClick={() => setExpanded(!expanded)}>
        <div className="chatbot-results-header-left">
          <Database size={14} />
          <span>Query Results</span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="chatbot-results-body">
          <div className="chatbot-results-controls">
            <span className="chatbot-results-row-count">
              Query Results ({rows.length} rows)
            </span>
            {hasChartData && (
              <div className="chatbot-results-toggle">
                <button
                  type="button"
                  className={view === 'table' ? 'active' : ''}
                  onClick={() => setView('table')}
                >
                  <TableIcon size={14} /> Table
                </button>
                <button
                  type="button"
                  className={view === 'chart' ? 'active' : ''}
                  onClick={() => setView('chart')}
                >
                  <BarChart2 size={14} /> Chart
                </button>
              </div>
            )}
          </div>

          {effectiveView === 'chart' && hasChartData ? (
            <div className="chatbot-chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartTransform} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#ffffff50"
                    fontSize={13}
                    fontWeight={500}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    angle={labels.length > 6 ? -35 : 0}
                    textAnchor={labels.length > 6 ? 'end' : 'middle'}
                    height={labels.length > 6 ? 70 : 40}
                    interval={0}
                  />
                  <YAxis
                    stroke="#ffffff40"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={(v) => {
                      if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                      if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
                      return `${v}`;
                    }}
                    domain={[0, Math.ceil(maxValue * 1.15)]}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff08' }} />
                  <Bar
                    dataKey={value_label || 'value'}
                    name={value_label ? value_label.replace(/_/g, ' ') : 'Value'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                    animationDuration={800}
                  >
                    {chartTransform.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="chatbot-chart-legend">
                {chartTransform.map((item, idx) => (
                  <div key={idx} className="chatbot-chart-legend-item">
                    <span className="chatbot-chart-legend-dot" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    <span>{item.fullName}: <strong>{values[idx]?.toLocaleString()}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chatbot-table-wrap custom-scrollbar">
              <table>
                <thead>
                  <tr>
                    {columns.map((col, i) => (
                      <th key={i}>{col.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {columns.map((col, cIdx) => {
                        const val = row[col];
                        const isNum = typeof val === 'number';
                        return (
                          <td key={cIdx} className={isNum ? 'num' : ''}>
                            {val != null ? (isNum ? val.toLocaleString() : String(val)) : <em>null</em>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 50 && (
                <div className="chatbot-table-cap">Showing top 50 rows only.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnitTesterEval({ pipelineMeta }) {
  const scores = pipelineMeta?.candidate_scores || [];
  if (!scores.length || !scores.some((s) => s.score > 0)) return null;

  const byStrategy = new Map();
  scores.forEach((s) => {
    const existing = byStrategy.get(s.strategy);
    if (!existing || s.score > existing.score) byStrategy.set(s.strategy, s);
  });
  const unique = Array.from(byStrategy.values());

  return (
    <div className="chatbot-unit-tester">
      <div className="chatbot-ut-header">
        <ShieldCheck size={16} />
        <strong>Unit Tester Evaluation</strong>
      </div>
      <div className="chatbot-ut-pills">
        {unique.map((s, i) => (
          <div
            key={i}
            className={`chatbot-ut-pill${pipelineMeta.winning_strategy === s.strategy ? ' winner' : ''}`}
          >
            <span className="chatbot-ut-strategy">{s.strategy}</span>
            <span className="chatbot-ut-score">Score: {s.score} ({s.dry_run_ok ? 'Pass' : 'Fail'})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerfCost({ pipelineMeta }) {
  if (!pipelineMeta?.total_latency_ms || pipelineMeta.total_latency_ms <= 0) return null;

  const execMs = pipelineMeta.node_latencies?.executor || 0;
  const genMs = Math.max(0, pipelineMeta.total_latency_ms - execMs);

  return (
    <div className="chatbot-perf-section">
      <div className="chatbot-perf-header">
        <Terminal size={16} />
        <strong>Query Performance &amp; Cost</strong>
      </div>
      <div className="chatbot-perf-grid">
        <div className="chatbot-perf-card">
          <div className="chatbot-perf-label">Query Gen Time</div>
          <div className="chatbot-perf-value">{Math.round(genMs)} ms</div>
        </div>
        <div className="chatbot-perf-card">
          <div className="chatbot-perf-label">Execution Time</div>
          <div className="chatbot-perf-value">{Math.round(execMs)} ms</div>
        </div>
        <div className="chatbot-perf-card">
          <div className="chatbot-perf-label">Tokens Used</div>
          <div className="chatbot-perf-value">{(pipelineMeta.total_tokens || 0).toLocaleString()}</div>
        </div>
        <div className="chatbot-perf-card">
          <div className="chatbot-perf-label">Cost (USD)</div>
          <div className="chatbot-perf-value">${(pipelineMeta.total_cost || 0).toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onSuggestionClick }) {
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySql = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (message.role === 'user') {
    return (
      <div className="chatbot-message user">
        <div className="chatbot-bubble">{message.text}</div>
      </div>
    );
  }

  return (
    <div className="chatbot-message assistant">
      <div className="chatbot-bubble">
        {message.text && <div className="chatbot-answer-text">{message.text}</div>}

        {/* Generated SQL */}
        {message.sql && (
          <div className="chatbot-sql-block">
            <button
              type="button"
              className="chatbot-sql-toggle"
              onClick={() => setSqlExpanded(!sqlExpanded)}
            >
              <Terminal size={12} />
              <span>Generated SQL</span>
              {message.pipelineMeta?.tables_used?.length > 0 && (
                <span className="chatbot-sql-tables">
                  Tables: {message.pipelineMeta.tables_used.join(', ')}
                </span>
              )}
              <span className="chatbot-sql-badge">SQLite</span>
              {sqlExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {sqlExpanded && (
              <div className="chatbot-sql-code">
                <button type="button" className="chatbot-copy-btn" onClick={copySql}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <pre><code>{message.sql}</code></pre>
              </div>
            )}
          </div>
        )}

        {/* Query Results (Table / Chart) */}
        {message.chartData && <QueryResults chartData={message.chartData} />}

        {/* Key Insights */}
        {message.insights?.length > 0 && (
          <div className="chatbot-insights-block">
            <div className="chatbot-insights-header">
              <Lightbulb size={14} />
              <strong>Key Insights</strong>
            </div>
            <ul>
              {message.insights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Unit Tester Evaluation */}
        <UnitTesterEval pipelineMeta={message.pipelineMeta} />

        {/* Query Performance & Cost */}
        <PerfCost pipelineMeta={message.pipelineMeta} />

        {/* Follow-up suggestions */}
        {message.suggestions?.length > 0 && (
          <div className="chatbot-follow-ups">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="chatbot-prompt-chip"
                onClick={() => onSuggestionClick?.(s)}
              >
                <Code2 size={12} />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [history, setHistory] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('history');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [latencyMs, setLatencyMs] = useState(null);
  const miniRef = useRef(null);
  const fullRef = useRef(null);
  const sessionIdRef = useRef(null);

  const scrollToBottom = () => {
    const el = isFullscreen ? fullRef.current : miniRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isFullscreen, isProcessing, activeStep]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullscreen]);

  const canSend = useMemo(() => input.trim().length > 0 && !isProcessing, [input, isProcessing]);

  const sendMessage = async (rawText) => {
    const text = rawText.trim();
    if (!text || isProcessing) return;

    const userMessage = { id: `${Date.now()}-user`, role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setHistory((prev) => [text, ...prev.filter((h) => h !== text)].slice(0, 20));
    setInput('');
    setIsOpen(true);
    setIsProcessing(true);
    setCompletedSteps([]);
    setActiveStep('Initializing Pipeline...');
    setLatencyMs(null);

    try {
      const body = { question: text };
      if (sessionIdRef.current) body.session_id = sessionIdRef.current;

      const response = await fetch(`${CHAT_API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.trim().startsWith('data: ')) continue;
            try {
              const dataStr = part.replace(/^data:\s*/, '').trim();
              const data = JSON.parse(dataStr);

              if (data.type === 'node') {
                setActiveStep((prev) => {
                  if (prev && prev !== 'Initializing Pipeline...') {
                    setCompletedSteps((cs) => [...cs, prev]);
                  }
                  return `Running: ${data.name}`;
                });
              } else if (data.type === 'final') {
                const d = data.data || {};
                if (data.session_id) sessionIdRef.current = data.session_id;

                const chartRaw = d.chart_data || {};
                const hasChart = Object.keys(chartRaw).length > 0 &&
                  chartRaw.rows && chartRaw.rows.length > 0;

                const aiMsg = {
                  id: `${Date.now()}-ai`,
                  role: 'assistant',
                  text: d.answer || 'No answer available.',
                  sql: d.sql || null,
                  chartData: hasChart ? chartRaw : null,
                  insights: (d.insights || []).filter(
                    (i) => !i.toLowerCase().includes('no data returned')
                  ),
                  suggestions: d.follow_ups || [],
                  pipelineMeta: d.pipeline_meta || null,
                };
                setMessages((prev) => [...prev, aiMsg]);
                setLatencyMs(d.pipeline_meta?.total_latency_ms || null);
                setActiveStep(null);
              }
            } catch (_) {
              /* skip malformed SSE chunks */
            }
          }
        }
      }
    } catch (err) {
      console.error('Chatbot API error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: 'assistant',
          text: 'Sorry, I could not connect to the backend. Please ensure the backend server is running on port 8000.',
        },
      ]);
      setActiveStep(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
    setIsOpen(false);
    setIsFullscreen(false);
    sessionIdRef.current = null;
  };

  const renderProcessing = () => {
    if (!isProcessing) return null;
    return (
      <div className="chatbot-message assistant">
        <div className="chatbot-bubble chatbot-processing">
          <div className="chatbot-processing-header">
            <Activity size={16} className="chatbot-pulse" />
            <span>{activeStep || 'Finalizing...'}</span>
          </div>
          <div className="chatbot-progress-bar">
            <div className="chatbot-progress-shimmer" />
          </div>
          {completedSteps.length > 0 && (
            <div className="chatbot-completed-steps">
              {completedSteps.map((step, i) => (
                <div key={i} className="chatbot-step-done">
                  <CheckCircle2 size={10} />
                  <span>{step.replace('Running: ', '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMessages = () => (
    <>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onSuggestionClick={sendMessage} />
      ))}
      {renderProcessing()}
    </>
  );

  const renderInputRow = (className = 'chatbot-input-row') => (
    <form className={className} onSubmit={onSubmit}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask anything about your data..."
        disabled={isProcessing}
      />
      <button type="submit" disabled={!canSend} aria-label="Send message">
        <Send size={16} />
      </button>
    </form>
  );

  return (
    <div className="chatbot-widget-shell">
      {isOpen && !isFullscreen && (
        <section className="chatbot-panel" aria-label="Chatbot panel">
          <header className="chatbot-panel-header">
            <div className="chatbot-panel-title">
              <div className="chatbot-panel-icon"><Sparkles size={16} /></div>
              <div>
                <strong>Frammer AI Chat</strong>
                <p>NL-to-SQL assistant</p>
              </div>
            </div>
            <div className="chatbot-panel-actions">
              <button type="button" className="chatbot-icon-button" onClick={() => setIsFullscreen(true)} aria-label="Open chatbot in fullscreen"><Expand size={16} /></button>
              <button type="button" className="chatbot-icon-button" onClick={() => setIsOpen(false)} aria-label="Minimize chatbot"><Minimize2 size={16} /></button>
              <button type="button" className="chatbot-icon-button" onClick={resetChat} aria-label="Close chatbot"><X size={16} /></button>
            </div>
          </header>
          <div className="chatbot-messages custom-scrollbar" ref={miniRef}>
            {renderMessages()}
          </div>
          {renderInputRow()}
        </section>
      )}

      {isOpen && isFullscreen && (
        <section className="chatbot-fullscreen" aria-label="Fullscreen chatbot">
          <aside className="chatbot-fullscreen-sidebar">
            <div className="chatbot-fullscreen-brand">
              <div className="chatbot-fullscreen-brand-icon"><Database size={18} /></div>
              <div><strong>Frammer AI</strong><p>Analytics assistant</p></div>
            </div>
            <div className="chatbot-fullscreen-tabs">
              <button type="button" className={sidebarTab === 'history' ? 'active' : ''} onClick={() => setSidebarTab('history')}><History size={14} /> History</button>
              <button type="button" className={sidebarTab === 'schema' ? 'active' : ''} onClick={() => setSidebarTab('schema')}><Database size={14} /> Schema</button>
            </div>
            <div className="chatbot-fullscreen-sidebar-content custom-scrollbar">
              {sidebarTab === 'history' ? (
                <div className="chatbot-history-list">
                  <div className="chatbot-sidebar-search"><Search size={14} /><input type="text" readOnly placeholder="Search history..." /></div>
                  {history.length === 0 ? (
                    <p className="chatbot-sidebar-empty">No history yet in this session.</p>
                  ) : history.map((item, idx) => (
                    <button key={idx} type="button" className="chatbot-history-item" onClick={() => sendMessage(item)} title={item}><Search size={12} /><span>{item}</span></button>
                  ))}
                </div>
              ) : (
                <div className="chatbot-schema-list">
                  {SCHEMA_TABLES.map((s) => (
                    <div key={s.table} className="chatbot-schema-card">
                      <div className="chatbot-schema-title"><TableIcon size={14} /><span>{s.table}</span></div>
                      <div className="chatbot-schema-columns">{s.columns.map((c) => <span key={c}>{c}</span>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="chatbot-fullscreen-main">
            <header className="chatbot-fullscreen-topbar">
              <div className="chatbot-fullscreen-title"><Sparkles size={16} /><span>Frammer AI Chat Workspace</span></div>
              <div className="chatbot-fullscreen-actions">
                <button type="button" className="chatbot-icon-button" onClick={() => setIsFullscreen(false)} aria-label="Exit fullscreen"><Minimize2 size={16} /></button>
                <button type="button" className="chatbot-icon-button" onClick={resetChat} aria-label="Close"><X size={16} /></button>
              </div>
            </header>
            <div className="chatbot-fullscreen-querybar">{renderInputRow('chatbot-fullscreen-input')}</div>
            <div className="chatbot-fullscreen-messages custom-scrollbar" ref={fullRef}>
              {renderMessages()}
            </div>
            <footer className="chatbot-fullscreen-footer">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="chatbot-health-dot" /> Pipeline: Healthy
              </span>
              {latencyMs && <span>Last query: {Math.round(latencyMs)}ms</span>}
              <span>Warehouse: SQLite (frammer.db)</span>
            </footer>
          </main>
        </section>
      )}

      <button
        type="button"
        className="chatbot-fab"
        onClick={() => { setIsOpen((p) => !p || isFullscreen); setIsFullscreen(false); }}
        aria-label="Open chatbot"
      >
        <Bot size={22} />
      </button>
    </div>
  );
}
