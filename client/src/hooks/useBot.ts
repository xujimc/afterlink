"use client";

import { useRef, useCallback, useEffect, useState } from "react";

export interface Article {
  id?: number; // Present if stored article, absent if new suggestion
  title: string;
  snippet: string;
}

export interface FullArticle {
  id: number;
  title: string;
  content: string; // Contains {{Q:phrase}} markers for inline questions
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type ChatClient = Awaited<ReturnType<typeof import("@botpress/chat").Client.connect>>;

// Generate or retrieve persistent user ID
function getUserId(): string {
  if (typeof window === "undefined") return "server";

  let userId = localStorage.getItem("afterlink_user_id");
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem("afterlink_user_id", userId);
  }
  return userId;
}

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

      for (const msg of messages) {
        if (msg.id === userMessageId) continue;

        const payload = msg.payload as { type?: string; text?: string };

        if (payload?.type === "text" && payload?.text) {
          const text = payload.text.trim();

          if (skipTexts.includes(text)) continue;
          if (text.startsWith("SEARCH:") || text.startsWith("ARTICLE:") || text.startsWith("GET_ARTICLE:")) continue;

          if (text.length > 10) {
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

    try {
      const parsed = JSON.parse(response) as { id: number; content: string };
      return {
        id: parsed.id,
        title,
        content: parsed.content,
      };
    } catch {
      // Fallback: response might be plain text
      return {
        id: 0,
        title,
        content: response,
      };
    }
  }, [getClient, waitForBotResponse]);

  const getStoredArticle = useCallback(async (id: number): Promise<FullArticle> => {
    const client = await getClient();
    const { conversation } = await client.createConversation({});

    const { message } = await client.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: `GET_ARTICLE: ${id}`,
      },
    });

    const response = await waitForBotResponse(client, conversation.id, message.id, []);

    try {
      const parsed = JSON.parse(response) as { id: number; title: string; content: string; error?: string };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      return {
        id: parsed.id,
        title: parsed.title,
        content: parsed.content,
      };
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Failed to parse article");
    }
  }, [getClient, waitForBotResponse]);

  const askArticleQuestion = useCallback(async (
    articleTitle: string,
    articleContent: string,
    question: string,
    conversationHistory: ConversationMessage[]
  ): Promise<string> => {
    const client = await getClient();
    const { conversation } = await client.createConversation({});

    const userId = getUserId();
    const isFirstMessage = conversationHistory.length === 0;

    const payload = JSON.stringify({
      articleTitle,
      articleContent,
      question,
      conversationHistory,
      userId,
      isFirstMessage,
    });

    const { message } = await client.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: `ARTICLE_QUESTION: ${payload}`,
      },
    });

    const response = await waitForBotResponse(client, conversation.id, message.id, []);

    try {
      const parsed = JSON.parse(response) as { response?: string; error?: string };
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      return parsed.response || "Sorry, I couldn't generate a response.";
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Failed to get response");
    }
  }, [getClient, waitForBotResponse]);

  const clearArticles = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const client = await getClient();
    const { conversation } = await client.createConversation({});

    const { message } = await client.createMessage({
      conversationId: conversation.id,
      payload: {
        type: "text",
        text: "CLEAR_ARTICLES",
      },
    });

    const response = await waitForBotResponse(client, conversation.id, message.id, []);

    try {
      return JSON.parse(response);
    } catch {
      return { success: false, message: "Failed to parse response" };
    }
  }, [getClient, waitForBotResponse]);

  return { search, getArticle, getStoredArticle, askArticleQuestion, clearArticles, isReady };
}
