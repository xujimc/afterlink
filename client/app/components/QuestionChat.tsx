'use client';

import { useState, useRef, useEffect } from 'react';

interface QuestionChatProps {
  question: string;
  onClose: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
}

export default function QuestionChat({ question, onClose }: QuestionChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: `I'd be happy to help you understand this question: "${question}"\n\nWhat specific aspect would you like me to explain?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (in production, call actual API)
    setTimeout(() => {
      const aiResponses = [
        `That's a great follow-up question! Let me explain that in more detail. The concept here relates to understanding the fundamental principles behind "${question}". In practice, this means considering various factors and perspectives...`,
        `Good point! To clarify: "${question}" is asking us to think about the relationship between multiple concepts. Here's how they typically connect: First, we consider the theoretical foundation, then apply practical examples...`,
        `Excellent question! This relates directly to what we discussed. When we examine "${question}" more closely, we find that there are several key components at play. The most important are...`,
        `That's an insightful observation. Regarding "${question}", the answer depends on context. In most scenarios, we would consider: 1) The theoretical framework, 2) Real-world applications, 3) Edge cases...`,
      ];

      const randomResponse =
        aiResponses[Math.floor(Math.random() * aiResponses.length)];

      const aiMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: randomResponse,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* Chat Modal */}
      <div className="fixed bottom-0 right-0 z-50 w-full sm:w-96 sm:bottom-6 sm:right-6 sm:rounded-lg bg-white shadow-2xl flex flex-col h-[80vh] sm:h-[600px]">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5 flex items-center justify-between">
          <h3 className="font-semibold text-black text-lg">AI Assistant</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs px-4 py-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-lg">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-6 py-5">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a follow-up question..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-600 disabled:bg-gray-100 text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
