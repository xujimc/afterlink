"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useBot, FullArticle, IntegratedQuestion } from "@/hooks/useBot";
import { ChatPanel } from "@/components/ChatPanel";

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

  // Chat panel state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  // Prevent double execution in React Strict Mode
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Skip if already started (React Strict Mode double-invocation)
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;

    const loadArticle = async () => {
      try {
        // Check if slug is a numeric ID (stored article) or a title slug (new article)
        const maybeId = parseInt(slug, 10);
        const isStoredArticle = !isNaN(maybeId) && !title;

        if (isStoredArticle) {
          console.log("[ArticlePage] Fetching stored article by ID:", maybeId);
          const fullArticle = await getStoredArticle(maybeId);
          setArticle(fullArticle);
        } else if (title) {
          console.log("[ArticlePage] Generating new article:", title);
          const fullArticle = await getArticle(title);
          console.log("[ArticlePage] Received article:", {
            id: fullArticle.id,
            title: fullArticle.title,
            contentLength: fullArticle.content.length,
            questions: fullArticle.questions,
          });
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

  const handleQuestionClick = (question: IntegratedQuestion) => {
    setSelectedQuestion(question.text);
    setIsChatOpen(true);
  };

  const handleSendMessage = useCallback(async (question: string): Promise<string> => {
    if (!article) throw new Error("No article loaded");
    return askArticleQuestion(article.title, article.content, question);
  }, [article, askArticleQuestion]);

  // Render article content with integrated questions
  const renderArticleContent = () => {
    if (!article) return null;

    const paragraphs = article.content.split("\n\n").filter(p => p.trim());
    const questions = article.questions || [];

    // Create a map of questions by their position (after which paragraph)
    const questionsByPosition: Record<number, IntegratedQuestion[]> = {};
    questions.forEach((q) => {
      const pos = q.afterParagraph;
      if (!questionsByPosition[pos]) {
        questionsByPosition[pos] = [];
      }
      questionsByPosition[pos].push(q);
    });

    const elements: React.ReactNode[] = [];

    paragraphs.forEach((paragraph, index) => {
      // Add paragraph
      elements.push(
        <p key={`p-${index}`} className="text-lg leading-relaxed mb-6 text-[var(--foreground)]">
          {paragraph}
        </p>
      );

      // Add questions that should appear after this paragraph (1-indexed)
      const questionsAfter = questionsByPosition[index + 1];
      if (questionsAfter) {
        questionsAfter.forEach((question) => {
          elements.push(
            <div
              key={question.id}
              onClick={() => handleQuestionClick(question)}
              className="my-6 py-3 px-4 border-l-4 border-[#FFC017] bg-[#FFC017]/10 cursor-pointer hover:bg-[#FFC017]/20 transition-colors rounded-r"
            >
              <p className="text-base italic text-gray-700 underline decoration-[#FFC017] decoration-2 underline-offset-2">
                {question.text}
              </p>
              <p className="text-xs text-gray-500 mt-1">Click to explore this question</p>
            </div>
          );
        });
      }
    });

    return elements;
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

      {/* Chat Panel */}
      {article && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          articleTitle={article.title}
          articleContent={article.content}
          initialQuestion={selectedQuestion}
          onSendMessage={handleSendMessage}
        />
      )}
    </div>
  );
}
