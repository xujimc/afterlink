"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface InlineChatProps {
  phrase: string;
  articleTitle: string;
  articleContent: string;
  onSendMessage: (question: string, history: ConversationMessage[]) => Promise<string>;
  onClose: () => void;
}

export function InlineChat({
  phrase,
  articleTitle,
  articleContent,
  onSendMessage,
  onClose,
}: InlineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send the reader's question directly
  useEffect(() => {
    if (!initialSentRef.current) {
      initialSentRef.current = true;
      // The phrase IS the question, send it directly
      handleSendMessage(phrase);
    }
  }, [phrase]);

  const handleSendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    // Build conversation history from current messages (before adding new one)
    const history: ConversationMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await onSendMessage(question, history);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I couldn't process your question. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <div style={{ margin: "1.5rem 0" }} className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden shadow-sm">
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem" }} className="flex items-center justify-between bg-white border-b border-gray-200">
        <div style={{ gap: "0.5rem" }} className="flex items-center">
          <div style={{ width: "0.5rem", height: "0.5rem" }} className="bg-[#FFC017] rounded-full" />
          <span style={{ fontSize: "1rem" }} className="font-medium text-gray-700">
            Your question
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg style={{ width: "1.5rem", height: "1.5rem" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div style={{ maxHeight: "28rem", padding: "1.25rem", gap: "1rem" }} className="overflow-y-auto flex flex-col">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              style={{ padding: "1rem 1.25rem", borderRadius: "1rem" }}
              className={`max-w-[85%] ${
                message.role === "user"
                  ? "bg-[#FFC017]/30 text-gray-900"
                  : "bg-white text-gray-900 border border-gray-200"
              }`}
            >
              <p style={{ fontSize: "1.125rem", lineHeight: "1.75" }} className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div style={{ padding: "1rem 1.25rem", borderRadius: "1rem" }} className="bg-white border border-gray-200">
              <div style={{ gap: "0.25rem" }} className="flex">
                <div style={{ width: "0.5rem", height: "0.5rem" }} className="bg-gray-400 rounded-full animate-bounce" />
                <div style={{ width: "0.5rem", height: "0.5rem", animationDelay: "150ms" }} className="bg-gray-400 rounded-full animate-bounce" />
                <div style={{ width: "0.5rem", height: "0.5rem", animationDelay: "300ms" }} className="bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: "1rem 1.25rem" }} className="bg-white border-t border-gray-200">
        <div style={{ gap: "0.75rem" }} className="flex">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a follow-up question..."
            disabled={isLoading}
            style={{ padding: "0.75rem 1.25rem", fontSize: "1rem", borderRadius: "2rem" }}
            className="flex-1 border border-gray-200 focus:outline-none focus:border-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", borderRadius: "2rem" }}
            className="bg-[#FFC017] text-gray-900 hover:bg-[#FFD54F] transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
