"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBot, Article } from "@/hooks/useBot";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Article[] | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { search, clearArticles } = useBot();
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { articles, debug } = await search(query);
      setResults(articles);
      setDebugInfo(debug || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
      setDebugInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArticleClick = (article: Article) => {
    if (article.id) {
      // Stored article - fetch by ID
      router.push(`/article/${article.id}`);
    } else {
      // New suggestion - generate on demand
      const slug = encodeURIComponent(article.title.toLowerCase().replace(/\s+/g, "-"));
      router.push(`/article/${slug}?title=${encodeURIComponent(article.title)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--border)] py-4">
        <div className="max-w-3xl mx-auto px-6 flex justify-between items-center">
          <h1 className="text-xl font-semibold tracking-tight">Afterlink</h1>
          <button
            onClick={async () => {
              const result = await clearArticles();
              alert(result.message || (result.success ? "Cleared!" : "Failed"));
              setResults(null);
              setDebugInfo(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear DB
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSearch} className="mb-12">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-[var(--border)] rounded-sm text-base focus:outline-none focus:border-[var(--foreground)] transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-[var(--foreground)] text-white rounded-sm text-base hover:bg-black transition-colors disabled:opacity-50"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {error && (
          <p className="text-red-600 mb-8">{error}</p>
        )}

        {debugInfo && (
          <div className="mb-8 p-4 bg-gray-100 rounded text-sm font-mono">
            <div className="font-bold mb-2">DEBUG INFO:</div>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-8">
            {results.map((result, index) => (
              <article
                key={result.id || index}
                className="group cursor-pointer"
                onClick={() => handleArticleClick(result)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold group-hover:underline">
                    {result.title}
                  </h2>
                  {result.id && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      saved
                    </span>
                  )}
                </div>
                <p className="text-[var(--muted)] leading-relaxed">
                  {result.snippet}
                </p>
              </article>
            ))}
          </div>
        )}

        {results && results.length === 0 && (
          <p className="text-[var(--muted)]">No results found.</p>
        )}
      </main>
    </div>
  );
}
