"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useBot, FullArticle } from "@/hooks/useBot";

export default function ArticlePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const title = searchParams.get("title") || "";
  const { getArticle } = useBot();

  const [article, setArticle] = useState<FullArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!title) {
      setError("No article title provided");
      setIsLoading(false);
      return;
    }

    const loadArticle = async () => {
      try {
        console.log("[ArticlePage] Fetching article:", title);
        const fullArticle = await getArticle(title);
        console.log("[ArticlePage] Received article:", fullArticle);
        setArticle(fullArticle);
      } catch (err) {
        console.error("[ArticlePage] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to load article");
      } finally {
        setIsLoading(false);
      }
    };

    loadArticle();
  }, [title]); // removed getArticle to prevent re-fetching

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
          <div className="text-[var(--muted)]">Generating article...</div>
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
