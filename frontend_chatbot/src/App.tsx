import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';

export default function App() {
  const [history, setHistory] = useState<string[]>([]);
  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-neutral-200 overflow-hidden font-sans selection:bg-[#ff6b6b]/30">
      <Sidebar history={history} />
      <main className="flex-1 flex flex-col relative min-w-0">
         <ChatArea onNewHistoryItem={(item) => setHistory(prev => [...prev, item])} />
      </main>
    </div>
  );
}
