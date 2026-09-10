import { useState, useEffect, useRef } from 'react';
import { useLiveKitChat } from '../hooks/useLiveKitChat';
import { Send, User, Bot } from 'lucide-react'; 

export function ChatWidget() {
  const { messages, sendMessage, isSending } = useLiveKitChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1f2e] rounded-md border border-gray-700/50 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50 bg-[#1a1f2e]/95 backdrop-blur">
        <h2 className="text-white font-medium text-lg">Chat</h2>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
            <Bot size={32} />
            <p className="text-sm">Start a conversation with Jibu</p>
          </div>
        )}
        
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={i}
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[80%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  isUser ? 'bg-primary' : 'bg-gray-600'
                }`}>
                  {isUser ? <User size={14} className="text-white" /> : <span className="text-white font-bold text-xs">J</span>}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400 font-medium">
                            {isUser ? 'You' : 'Jibu'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div
                      className={`px-4 py-2.5 rounded-lg text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-gray-700/80 text-gray-100 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700/50 bg-[#1a1f2e]">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
            <input
              className="w-full bg-gray-800/50 border border-gray-700 text-gray-100 rounded-full px-5 py-3 pr-12 text-sm focus:outline-none focus:border-ring/50 focus:ring-1 focus:ring-ring/50 transition-all placeholder:text-muted-foreground"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="absolute right-2 p-2 bg-primary hover:bg-primary disabled:opacity-50 disabled:hover:bg-primary/90 rounded-full text-white transition-colors"
            >
              <Send size={16} />
            </button>
        </form>
      </div>
    </div>
  );
}
