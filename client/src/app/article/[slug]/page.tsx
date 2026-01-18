"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useBot, FullArticle } from "@/hooks/useBot";
import { InlineChat } from "@/components/InlineChat";

// Parse content and extract question markers
interface ContentPart {
  type: "text" | "question";
  content: string;
  id?: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /\{\{Q:([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;
  let questionIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }

    // Add the question
    parts.push({
      type: "question",
      content: match[1],
      id: `q-${questionIndex++}`,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return parts;
}

export default function ArticlePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const title = searchParams.get("title");
  const { getArticle, getStoredArticle, askArticleQuestion } = useBot();

  const [article, setArticle] = useState<FullArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which question is currently expanded
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Prevent double execution in React Strict Mode
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    const loadArticle = async () => {
      try {
        const maybeId = parseInt(slug, 10);
        const isStoredArticle = !isNaN(maybeId) && !title;

        if (isStoredArticle) {
          const fullArticle = await getStoredArticle(maybeId);
          setArticle(fullArticle);
        } else if (title) {
          const fullArticle = await getArticle(title);
          setArticle(fullArticle);
        } else {
          setError("No article specified");
        }
      } catch (err) {
        console.error("[ArticlePage] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to load article");
      } finally {
        setIsLoading(false);
      }
    };

    loadArticle();
  }, [slug, title]);

  const handleSendMessage = useCallback(async (question: string): Promise<string> => {
    if (!article) throw new Error("No article loaded");
    // Remove markers from content before sending to bot
    const cleanContent = article.content.replace(/\{\{Q:([^}]+)\}\}/g, '$1');
    return askArticleQuestion(article.title, cleanContent, question);
  }, [article, askArticleQuestion]);

  const handleQuestionClick = (questionId: string) => {
    setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
  };

  // Render article content with inline questions
  const renderArticleContent = () => {
    if (!article) return null;

    const paragraphs = article.content.split("\n\n").filter(p => p.trim());

    return paragraphs.map((paragraph, pIndex) => {
      const parts = parseContent(paragraph);

      return (
        <div key={`p-${pIndex}`} className="mb-6">
          <p className="text-lg leading-relaxed text-[var(--foreground)]">
            {parts.map((part, partIndex) => {
              if (part.type === "text") {
                return <span key={partIndex}>{part.content}</span>;
              }

              const questionId = `${pIndex}-${part.id}`;
              const isExpanded = expandedQuestionId === questionId;

              return (
                <span
                  key={partIndex}
                  onClick={() => handleQuestionClick(questionId)}
                  className={`
                    cursor-pointer transition-all duration-200
                    border-b-2 border-[#FFC017]
                    ${isExpanded
                      ? "bg-[#FFC017]/30 px-1 rounded"
                      : "hover:bg-[#FFC017]/20 hover:px-1 hover:rounded"
                    }
                  `}
                  title="Click to explore this topic"
                >
                  {part.content}
                </span>
              );
            })}
          </p>

          {/* Render inline chat if a question in this paragraph is expanded */}
          {parts.map((part) => {
            if (part.type !== "question") return null;
            const questionId = `${pIndex}-${part.id}`;
            if (expandedQuestionId !== questionId) return null;

            return (
              <InlineChat
                key={`chat-${questionId}`}
                phrase={part.content}
                articleTitle={article.title}
                articleContent={article.content}
                onSendMessage={handleSendMessage}
                onClose={() => setExpandedQuestionId(null)}
              />
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--border)] py-4">
        <div className="max-w-3xl mx-auto px-6">
          <button
            onClick={() => router.back()}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {isLoading && (
          <div className="text-[var(--muted)]">
            {title ? "Generating article..." : "Loading article..."}
          </div>
        )}

        {error && (
          <p className="text-red-600">{error}</p>
        )}

        {article && (
          <article>
            <h1 className="text-4xl font-bold mb-8 leading-tight">
              {article.title}
            </h1>
            <div className="prose prose-lg max-w-none">
              {renderArticleContent()}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
