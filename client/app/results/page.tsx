'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchSearchResults, filterResults } from '@/app/lib/utils';

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('query') || '';
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      const allResults = await fetchSearchResults();
      const filtered = filterResults(allResults, query);
      setResults(filtered);
      setIsLoading(false);
    };

    loadResults();
  }, [query]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/search" className="text-2xl font-serif font-bold text-black">
            Afterlink
          </Link>
          <p className="text-gray-600">
            Search results for{' '}
            <span className="font-semibold text-black">"{query}"</span>
          </p>
        </div>
      </header>

      {/* Results Section */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading results...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-black mb-2">
              No results found
            </h2>
            <p className="text-gray-600 mb-6">
              Try searching for something different
            </p>
            <Link
              href="/search"
              className="inline-block px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              Back to Search
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-gray-600">
                About {results.length} result{results.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="space-y-8">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/blog/${result.slug}`}
                  className="block group"
                >
                  <article className="pb-8 border-b border-gray-200 hover:border-gray-400 transition-colors">
                    {/* Category Badge */}
                    <div className="mb-2">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                        {result.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-semibold text-black group-hover:text-gray-600 transition-colors mb-3">
                      {result.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-lg text-gray-700 mb-4 line-clamp-2">
                      {result.excerpt}
                    </p>

                    {/* Meta Information */}
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">
                        {result.author}
                      </span>
                      <span>•</span>
                      <span>{result.date}</span>
                      <span>•</span>
                      <span>{result.readTime}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2026 Afterlink. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
