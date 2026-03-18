import React, { useState, useRef, useEffect } from "react";
import { QueryInput } from "./QueryInput";
import { Message } from "./Message";
import type { MessageProps } from "./Message";
import { Activity, CheckCircle2 } from "lucide-react";


interface ChatAreaProps {
  onNewHistoryItem?: (item: string) => void;
}

export function ChatArea({ onNewHistoryItem }: ChatAreaProps) {
  const [messages, setMessages] = useState<MessageProps["message"][]>([
    {
      id: "0",
      role: "ai",
      summary: "Welcome to Frammer AI Analytics. I can help you query your YouTube analytics database using natural language. What would you like to explore today?",
      suggestions: [
        "Which channel has the most uploads?",
        "Show me the top 5 videos by views",
        "What is the average duration of our videos?",
      ],
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, activeStep]);

  const handleSend = async (query: string) => {
    const userMsg: MessageProps["message"] = {
      id: Date.now().toString(),
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      setCompletedSteps([]);
      setActiveStep("Initializing Pipeline...");
      setIsProcessing(true);

      const requestBody: any = { question: query };
      if (sessionIdRef.current) {
        requestBody.session_id = sessionIdRef.current;
      }

      const response = await fetch("http://127.0.0.1:8000/chat/stream", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(requestBody),
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || ""; // retain incomplete tail
          
          for (const part of parts) {
            if (part.trim().startsWith('data: ')) {
              try {
                const dataStr = part.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(dataStr);
                
                if (data.type === 'node') {
                  setActiveStep((prev) => {
                    if (prev && prev !== "Initializing Pipeline..." && !completedSteps.includes(prev)) {
                      setCompletedSteps(curr => [...curr, prev]);
                    }
                    return `Running Agent: ${data.name}...`;
                  });
                } else if (data.type === 'final') {
                  const finalData = data.data;
                  
                  if (!sessionIdRef.current && data.session_id) {
                    sessionIdRef.current = data.session_id;
                  }
                  
                  if (onNewHistoryItem) {
                    onNewHistoryItem(query);
                  }

                  const aiMsg: MessageProps["message"] = {
                    id: (Date.now() + 1).toString(),
                    role: "ai",
                    summary: finalData.answer,
                    sql: finalData.sql,
                    chartData: Object.keys(finalData.chart_data || {}).length > 0 ? finalData.chart_data : undefined,
                    insights: finalData.insights || [],
                    suggestions: finalData.follow_ups || [],
                    pipelineMeta: finalData.pipeline_meta,
                  };
                  setMessages((prev) => [...prev, aiMsg]);
                  setActiveStep(null);
                }
              } catch (e) {
                console.error("Error parsing SSE data line", e, part);
              }
            }
          }
        }
      }
    } catch (error) {
       console.error(error);
       setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "ai",
          summary: "Sorry, I encountered an error connecting to the backend. Please ensure the Uvicorn server is running on port 8000."
       }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] relative overflow-hidden pl-4">
      {/* Absolute positioned QueryInput over the scrolling chat */}
      <div className="absolute top-0 left-4 right-0 z-30 pointer-events-none">
        <QueryInput onSend={handleSend} isProcessing={isProcessing} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pt-32 pb-16 relative z-10">
        <div className="flex flex-col w-full mx-auto">
          {messages.map((msg) => (
            <Message key={msg.id} message={msg} onSuggestionClick={handleSend} />
          ))}

          {isProcessing && (
            <div className="flex w-full justify-start px-6 py-8 border-t border-white/5">
              <div className="max-w-5xl w-full mx-auto flex items-start gap-5">
                <div className="w-10 h-10 rounded-xl bg-[#18181b] border border-white/10 flex items-center justify-center flex-shrink-0 shadow-md text-[#ff6b6b] animate-pulse">
                  <Activity size={20} />
                </div>
                <div className="flex flex-col gap-3 w-full max-w-sm mt-1">
                  
                  {/* Active Step Indicator */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm text-neutral-200 font-medium">
                      {activeStep || "Finalizing..."}
                    </span>
                    <div className="h-1.5 w-full bg-[#18181b] rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 h-full bg-gradient-to-r from-transparent via-[#ff6b6b] to-transparent w-1/2"
                        style={{ animation: "shimmer 1.2s infinite linear" }}
                      />
                    </div>
                  </div>

                  {/* Completed Steps Log */}
                  <div className="flex flex-col gap-1 mt-2">
                    {completedSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                        <CheckCircle2 size={12} className="text-[#2ed573]" />
                        <span className="opacity-70">{step.replace("Running Agent: ", "").replace("Initializing Pipeline...", "Init").replace("...", " ✓")}</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer Pipeline Health */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-6 z-20 text-xs">
        <div className="flex items-center gap-4 text-neutral-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ed573] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2ed573]"></span>
            </span>
            Pipeline: Healthy
          </div>
          <span>|</span>
          <span>Latency: ~ms</span>
          <span>|</span>
          <span>Warehouse: SQLite (frammer.db)</span>
        </div>
        <div className="text-neutral-600 font-mono">v2.4.1-beta</div>
      </div>
    </div>
  );
}
