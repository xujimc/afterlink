'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchSearchResults } from '@/app/lib/utils';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [trendingBlogs, setTrendingBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTrendingBlogs = async () => {
      const results = await fetchSearchResults();
      // Get top 3 as trending
      setTrendingBlogs(results.slice(0, 3));
      setIsLoading(false);
    };

    loadTrendingBlogs();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/results?query=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link href="/" className="text-2xl font-serif font-bold text-black">
            Afterlink
          </Link>
        </div>
      </header>

      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 pt-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-serif font-bold text-black mb-4">
              Discover Stories
            </h1>
            <p className="text-lg text-gray-600">
              Search millions of articles, insights, and ideas
            </p>
          </div>

          <form onSubmit={handleSearch} className="mb-12">
            <div className="relative">
              <input
                type="text"
                placeholder="Search blogs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-6 py-4 pr-12 text-lg border border-gray-300 rounded-full focus:outline-none focus:border-gray-600 focus:ring-0"
              />
              <button
                type="submit"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </form>

          {!isLoading && trendingBlogs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-black mb-6">
                Trending Now
              </h2>
              <div className="space-y-6">
                {trendingBlogs.map((blog) => (
                  <Link
                    key={blog.id}
                    href={`/blog/${blog.slug}`}
                    className="block group"
                  >
                    <div className="pb-6 border-b border-gray-200 hover:border-gray-400 transition-colors">
                      <h3 className="text-xl font-semibold text-black group-hover:text-gray-600 transition-colors mb-2">
                        {blog.title}
                      </h3>
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {blog.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{blog.author}</span>
                        <span>•</span>
                        <span>{blog.readTime}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
