import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { UserProfile } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { Config } from '@/services/Config';

interface SupportChatbotProps {
  user: UserProfile;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const SupportChatbot: React.FC<SupportChatbotProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { addToast } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello ${user.name}! I'm the BicaDrive Support Assistant. How can I help you today?`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Initialize chat session
  useEffect(() => {
    try {
      const apiKey = Config.apiKey;
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: `You are a helpful support assistant for BicaDrive, a luxury ride-hailing app. 
            You help drivers and car owners with inquiries and complaints. 
            The current user is named ${user.name} and their role is ${user.role}.
            Be polite, concise, and helpful. Do not make up false policies, but assure them their issues will be looked into.`,
          },
        });
      }
    } catch (error) {
      console.error("Failed to initialize Gemini chat:", error);
    }
  }, [user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      if (chatRef.current) {
        const response: GenerateContentResponse = await chatRef.current.sendMessage({ message: userMessage.text });
        const modelMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response.text || "I'm sorry, I couldn't process that."
        };
        setMessages(prev => [...prev, modelMessage]);
      } else {
        // Fallback if API key is missing or chat failed to initialize
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: "I'm currently offline. Please contact support via email at support@bicadrive.app."
          }]);
          setIsLoading(false);
        }, 1000);
      }
    } catch (error) {
      console.error("Chat error:", error);
      addToast("We're having a little trouble connecting to support. Please check your internet.", 'warning');
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I encountered an error while trying to respond. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`absolute bottom-6 right-6 z-40 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <span className="material-symbols-outlined text-3xl">chat</span>
      </button>

      {/* Chat Window */}
      <div 
        className={`absolute bottom-0 right-0 z-50 w-full h-[80vh] sm:h-[500px] bg-white dark:bg-surface-dark sm:rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-white sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">support_agent</span>
            <h3 className="font-bold text-lg">Support Chat</h3>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50 dark:bg-background-dark">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-sm' 
                    : 'bg-white dark:bg-input-dark text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-tl-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-input-dark border border-slate-200 dark:border-slate-800 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-surface-dark border-t border-slate-200 dark:border-slate-800 sm:rounded-b-2xl flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-100 dark:bg-input-dark border-none rounded-full px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl ml-1">send</span>
          </button>
        </form>
      </div>
    </>
  );
};

export default SupportChatbot;
