"use client";

import { useRef, useCallback, useEffect, useState } from "react";

export interface Article {
  title: string;
  url: string;
  snippet: string;
}

export interface FullArticle {
  title: string;
  content: string;
}

type ChatClient = Awaited<ReturnType<typeof import("@botpress/chat").Client.connect>>;

export function useBot() {
  const clientRef = useRef<ChatClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const getClient = useCallback(async () => {
    if (typeof window === "undefined") {
      throw new Error("Cannot run on server");
    }

    const webhookId = process.env.NEXT_PUBLIC_BOTPRESS_WEBHOOK_ID;
    if (!webhookId) {
      throw new Error("NEXT_PUBLIC_BOTPRESS_WEBHOOK_ID is not configured");
    }

    if (!clientRef.current) {
      const chat = await import("@botpress/chat");
      clientRef.current = await chat.Client.connect({ webhookId });
    }

    return clientRef.current;
  }, []);

  const waitForBotResponse = useCallback(async (
    client: ChatClient,
    conversationId: string,
    userMessageId: string,
    skipTexts: string[] = []
  ): Promise<string> => {
    const maxAttempts = 60;
    const pollInterval = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const { messages } = await client.listMessages({ conversationId });

      console.log(`[useBot] Attempt ${attempt + 1}, messages:`, messages.length);

      for (const msg of messages) {
        // Skip the user's own message
        if (msg.id === userMessageId) continue;

        const payload = msg.payload as { type?: string; text?: string };

        if (payload?.type === "text" && payload?.text) {
          const text = payload.text.trim();

          // Skip specified texts (like "Searching...", "Generating article...")
          if (skipTexts.includes(text)) continue;

          // Skip if it starts with our command prefixes (user messages)
          if (text.startsWith("SEARCH:") || text.startsWith("ARTICLE:")) continue;

          // Return substantial text response
          if (text.length > 20) {
            console.log("[useBot] Found bot response:", text.substring(0, 100) + "...");
            return text;
          }
        }
      }
    }

    throw new Error("Timeout waiting for bot response");
  }, []);

  const search = useCallback(async (query: string): Promise<Article[]> => {
    const client = await getClient();
    const { conversation } = await client.createConversation({});

    const { message } = await client.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: `SEARCH: ${query}`,
      },
    });

    const response = await waitForBotResponse(client, conversation.id, message.id, ["Searching..."]);

    try {
      const articles = JSON.parse(response) as Article[];
      if (Array.isArray(articles)) {
        return articles;
      }
    } catch {
      throw new Error("Failed to parse search results");
    }

    return [];
  }, [getClient, waitForBotResponse]);

  const getArticle = useCallback(async (title: string): Promise<FullArticle> => {
    const client = await getClient();
    const { conversation } = await client.createConversation({});

    const { message } = await client.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: `ARTICLE: ${title}`,
      },
    });

    const response = await waitForBotResponse(client, conversation.id, message.id, ["Generating article..."]);

    return {
      title,
      content: response,
    };
  }, [getClient, waitForBotResponse]);

  return { search, getArticle, isReady };
}
