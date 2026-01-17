"use client";

import { useRef, useCallback, useEffect, useState } from "react";

export interface Article {
  title: string;
  url: string;
  snippet: string;
}

type ChatClient = Awaited<ReturnType<typeof import("@botpress/chat").Client.connect>>;

export function useBot() {
  const clientRef = useRef<ChatClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const search = useCallback(async (query: string): Promise<Article[]> => {
    if (typeof window === "undefined") {
      throw new Error("Cannot run on server");
    }

    const webhookId = process.env.NEXT_PUBLIC_BOTPRESS_WEBHOOK_ID;
    if (!webhookId) {
      throw new Error("NEXT_PUBLIC_BOTPRESS_WEBHOOK_ID is not configured");
    }

    const chat = await import("@botpress/chat");

    if (!clientRef.current) {
      clientRef.current = await chat.Client.connect({ webhookId });
    }

    const { conversation } = await clientRef.current.createConversation({});

    await clientRef.current.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: query,
      },
    });

    // Poll for bot response
    const maxAttempts = 30;
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const { messages } = await clientRef.current.listMessages({
        conversationId: conversation.id,
      });

      // Look for a message that contains JSON array (the articles)
      for (const msg of messages) {
        const payload = msg.payload as { type?: string; text?: string };

        if (payload?.type === "text" && payload?.text) {
          const text = payload.text.trim();

          // Skip "Searching..." message
          if (text === "Searching...") continue;

          // Try to parse as JSON array
          if (text.startsWith("[")) {
            try {
              const articles = JSON.parse(text) as Article[];
              if (Array.isArray(articles) && articles.length > 0) {
                return articles;
              }
            } catch {
              // Not valid JSON, continue
            }
          }
        }
      }
    }

    throw new Error("Timeout waiting for bot response");
  }, []);

  return { search, isReady };
}
