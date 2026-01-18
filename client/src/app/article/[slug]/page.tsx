"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useBot, FullArticle } from "@/hooks/useBot";

export default function ArticlePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const title = searchParams.get("title");
  const { getArticle, getStoredArticle } = useBot();

  const [article, setArticle] = useState<FullArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              {article.content.split("\n\n").map((paragraph, index) => (
                <p key={index} className="text-lg leading-relaxed mb-6 text-[var(--foreground)]">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
