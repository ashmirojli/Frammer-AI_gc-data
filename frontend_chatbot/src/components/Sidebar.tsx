import React, { useState } from 'react';
import { Database, History, Search, Table, Columns, ChevronRight, ChevronDown } from 'lucide-react';


const mockSchema = [
  { table: "fact_user_summary", columns: ["uploaded_count", "created_count", "published_count", "uploaded_duration_hh_mm_ss", "created_duration_hh_mm_ss", "published_duration_hh_mm_ss", "user_id"] },
  { table: "fact_user_channel", columns: ["uploaded_count", "created_count", "published_count", "uploaded_duration_hh_mm_ss", "created_duration_hh_mm_ss", "published_duration_hh_mm_ss", "user_id", "channel_id"] },
  { table: "fact_monthly", columns: ["total_uploaded", "total_created", "total_published", "total_uploaded_duration", "total_created_duration", "total_published_duration", "month_id"] },
  { table: "fact_channel_publishing", columns: ["published_count", "published_duration", "channel_id", "platform_id"] },
  { table: "fact_user_monthly", columns: ["uploaded_count", "created_count", "published_count", "uploaded_duration", "created_duration", "published_duration", "user_id", "month_id"] },
  { table: "fact_video", columns: ["headline", "source", "published", "type", "video_id", "published_url", "user_id", "team_id", "platform_id", "inputtype_id"] },
  { table: "dim_channel", columns: ["channel_id", "channel_name"] },
  { table: "dim_user", columns: ["user_id", "user_name"] },
  { table: "dim_platform", columns: ["platform_id", "platform_name"] },
  { table: "dim_month", columns: ["month_id", "month_name", "month_num", "year", "quarter"] }
];

export function Sidebar({ history = [] }: { history?: string[] }) {
  const [activeTab, setActiveTab] = useState<'history' | 'schema'>('schema');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({"fact_video": true});

  const toggleTable = (table: string) => {
    setExpandedTables(prev => ({ ...prev, [table]: !prev[table] }));
  };

  return (
    <aside className="w-80 h-full bg-[#0a0a0a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col flex-shrink-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center border-b border-white/5">
        <div className="flex items-center gap-3 text-[#ff6b6b] font-semibold text-lg tracking-wide">
          <Database size={20} className="text-[#ff6b6b]" />
          <span>Frammer AI</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-4 gap-2">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-[#18181b] text-neutral-100 shadow-sm border border-white/10'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <History size={14} />
            History
          </div>
        </button>
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
            activeTab === 'schema'
              ? 'bg-[#18181b] text-neutral-100 shadow-sm border border-white/10'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Database size={14} />
            Schema
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
        {activeTab === 'history' ? (
          <div className="space-y-1 mt-2">
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search history..."
                className="w-full bg-[#18181b]/50 border border-white/5 rounded-md py-1.5 pl-8 pr-3 text-sm text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-[#ff6b6b]/50 transition-colors"
              />
            </div>
            {history.length === 0 ? (
                <div className="text-neutral-500 text-sm italic px-2">No history yet in this session.</div>
            ) : history.map((query, idx) => (
              <button
                key={idx}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-white/5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors truncate flex items-center gap-3"
                title={query}
              >
                <Search size={12} className="text-neutral-600 flex-shrink-0" />
                <span className="truncate">{query}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {mockSchema.map((schema, idx) => (
              <div key={idx} className="space-y-1">
                <button
                  onClick={() => toggleTable(schema.table)}
                  className="w-full flex items-center justify-between px-2 py-2 hover:bg-white/5 rounded-md transition-colors text-sm text-neutral-300 font-medium"
                >
                  <div className="flex items-center gap-2">
                    <Table size={14} className="text-neutral-500" />
                    {schema.table}
                  </div>
                  {expandedTables[schema.table] ? (
                    <ChevronDown size={14} className="text-neutral-500" />
                  ) : (
                    <ChevronRight size={14} className="text-neutral-500" />
                  )}
                </button>
                {expandedTables[schema.table] && (
                  <div className="pl-6 pr-2 space-y-1 py-1">
                    {schema.columns.map((col, colIdx) => (
                      <div key={colIdx} className="flex items-center gap-2 text-sm text-neutral-500 py-1 px-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors">
                        <Columns size={12} className="text-neutral-700" />
                        {col}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
