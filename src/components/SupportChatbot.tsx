import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { UserProfile, SupportCategory, SupportContext } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { Config } from '@/services/Config';
import { api } from '@/services/api.service';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const SupportChatbot: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { supportContext, setSupportContext, supportOpen, setSupportOpen } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [category, setCategory] = useState<SupportCategory | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const ticketFired = useRef(false);

  const hasApiKey = !!Config.apiKey?.trim();

  // Reset ticket state when chat opens/closes
  useEffect(() => {
    if (!supportOpen) {
      ticketFired.current = false;
    }
  }, [supportOpen]);

  // Initial welcome message
  useEffect(() => {
    if (supportOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `Hello ${user.name}! I'm the BicaDrive Support Assistant. Please select a category below to start.`
        }
      ]);
    }
  }, [supportOpen, user.name, messages.length]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, supportOpen]);

  const buildSystemPrompt = (u: UserProfile, ctx: SupportContext | null, cat: SupportCategory) => {
    let prompt = `You are a helpful support assistant for BicaDrive, a luxury ride-hailing app in Nigeria.
You help drivers and car owners with inquiries and complaints.
User: ${u.name} | Role: ${u.role} | Category: ${cat}`;

    if (ctx?.tripId)
      prompt += `\nTrip ID: ${ctx.tripId}`;
    if (ctx?.tripStatus)
      prompt += ` | Trip Status: ${ctx.tripStatus}`;
    if (ctx?.paymentStatus)
      prompt += ` | Payment Status: ${ctx.paymentStatus}`;
    if (ctx?.driverEarnings !== undefined)
      prompt += ` | Driver Earnings: ₦${ctx.driverEarnings.toLocaleString()}`;
    if (ctx?.totalFare !== undefined)
      prompt += ` | Total Fare: ₦${ctx.totalFare.toLocaleString()}`;
    if (ctx?.monnifyTxRef)
      prompt += ` | Tx Ref: ${ctx.monnifyTxRef}`;
    if (ctx?.recentFailureContext)
      prompt += `\nRecent failure context: ${ctx.recentFailureContext}`;

    prompt += `\nSupport opened at: ${ctx?.openedAt ?? new Date().toISOString()}`;
    prompt += `\nBe polite, concise, and helpful. Do not invent policies. Assure the user their issue is being logged.`;
    return prompt;
  };

  // Initialize chat session
  useEffect(() => {
    if (!supportOpen || !category || !hasApiKey) return;
    
    setChatError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: Config.apiKey! });
      const systemInstruction = buildSystemPrompt(user, supportContext, category);

      chatRef.current = null; // Teardown previous
      chatRef.current = ai.chats.create({
        model: "gemini-1.5-flash",
        config: {
          systemInstruction: systemInstruction,
        },
      });
    } catch (error) {
      console.error("Failed to initialize Gemini chat:", error);
      setChatError("Failed to initialize");
    }

    return () => {
      chatRef.current = null;
    };
  }, [user, supportOpen, supportContext, category, hasApiKey]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || chatError || !category) return;

    const text = inputText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text
    };

    // Fire-and-forget ticket on first message
    if (!ticketFired.current) {
      ticketFired.current = true;
      api.createSupportTicket({
        category,
        firstMessage: text,
        openedAt: supportContext?.openedAt ?? new Date().toISOString(),
        tripId: supportContext?.tripId,
        paymentStatus: supportContext?.paymentStatus,
        recentFailureContext: supportContext?.recentFailureContext,
      }).catch(e => console.warn('Support ticket submission failed:', e));
    }

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      if (chatRef.current) {
        const response: GenerateContentResponse = await chatRef.current.sendMessage({ message: text });
        const modelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response.text || "I'm sorry, I couldn't process that."
        };
        setMessages(prev => [...prev, modelMessage]);
      } else {
        throw new Error("Chat not initialized");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "I'm having trouble connecting to my brain right now. Please use the escalation buttons below for immediate help."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSupportOpen(false);
    setCategory(null);
    ticketFired.current = false;
    setSupportContext(null);
    setMessages([]);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setSupportOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 ${supportOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <span className="material-symbols-outlined text-3xl">chat</span>
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-0 right-0 z-50 w-full h-[90vh] sm:h-[600px] sm:max-w-md bg-white dark:bg-surface-dark sm:rounded-t-3xl shadow-2xl flex flex-col border-t sm:border border-slate-200 dark:border-slate-800 transition-all duration-300 origin-bottom-right ${supportOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white sm:rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-white/20 rounded-2xl flex items-center justify-center">
               <span className="material-symbols-outlined">support_agent</span>
            </div>
            <div>
               <h3 className="font-black text-lg uppercase tracking-tight italic">Bica Support</h3>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Always at your service</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Escalation Footer (Always Visible) */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-slate-800">
          <a href="tel:+2349038987333" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-colors">
            <span className="material-symbols-outlined text-primary text-xl">call</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Call</span>
          </a>
          <a href="https://wa.me/2349038987333" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-colors">
            <span className="material-symbols-outlined text-emerald-500 text-xl">chat_bubble</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp</span>
          </a>
          <a href="mailto:support@bicadriver.com" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 transition-colors">
            <span className="material-symbols-outlined text-amber-500 text-xl">mail</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email</span>
          </a>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50 dark:bg-background-dark relative">
          {category === null ? (
            <div className="flex-1 flex flex-col justify-center gap-6 animate-fade-in">
               <div className="text-center">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase italic">What do you need help with?</h4>
               </div>
               <div className="grid grid-cols-1 gap-3">
                  {(['PAYMENT_ISSUE', 'TRIP_PROBLEM', 'DRIVER_OWNER_COMPLAINT', 'TECHNICAL_ISSUE', 'OTHER'] as SupportCategory[]).map((cat) => {
                    const labels: Record<SupportCategory, string> = {
                      PAYMENT_ISSUE: 'Payment Issue',
                      TRIP_PROBLEM: 'Trip Problem',
                      DRIVER_OWNER_COMPLAINT: 'Driver / Owner Complaint',
                      TECHNICAL_ISSUE: 'Technical Issue',
                      OTHER: 'Other'
                    };
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className="w-full p-5 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-center font-black text-slate-900 dark:text-white uppercase tracking-widest text-[11px] hover:border-primary transition-all active:scale-95 shadow-sm"
                      >
                        {labels[cat]}
                      </button>
                    );
                  })}
               </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-white rounded-tr-sm' 
                        : 'bg-white dark:bg-surface-dark text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 px-5 py-4 rounded-3xl rounded-tl-sm flex items-center gap-2 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {category !== null && (
          <div className="p-4 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800">
            {!hasApiKey ? (
              <div className="text-center py-4 text-xs font-bold text-slate-500 uppercase tracking-widest italic">
                Live chat is unavailable. Please use the options below.
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="How can we help?"
                  className="flex-1 bg-slate-100 dark:bg-background-dark border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  disabled={isLoading || chatError !== null}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading || chatError !== null}
                  className="size-14 flex items-center justify-center bg-primary text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
                >
                  <span className="material-symbols-outlined text-2xl">send</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SupportChatbot;
