'use client';

import { useState } from 'react';
import Link from 'next/link';
import MarkdownRenderer from '@/app/components/MarkdownRenderer';
import QuestionChat from '@/app/components/QuestionChat';

interface ClientBlogContentProps {
  blog: any;
  questions: any[];
}

export default function ClientBlogContent({
  blog,
  questions,
}: ClientBlogContentProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white px-4 sm:px-8">
      <header className="border-b border-gray-200 sticky top-0 bg-white z-10 w-full -mx-4 sm:-mx-8 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto py-4 flex items-center justify-between">
          <Link href="/search" className="text-2xl font-serif font-bold text-black">
            Afterlink
          </Link>
          <button
            onClick={() => window.history.back()}
            className="text-gray-600 hover:text-black"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="w-full">
        <div className="max-w-3xl mx-auto py-16">
        <article>
          <div className="mb-10">
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full mb-6">
              {blog.category}
            </span>
            <h1 className="text-4xl font-serif font-bold text-black mb-6">
              {blog.title}
            </h1>
            <div className="flex items-center gap-4 text-gray-600 text-sm">
              <span>{blog.author}</span>
              <span>•</span>
              <span>{blog.date}</span>
              <span>•</span>
              <span>{blog.readTime}</span>
            </div>
          </div>

          <div className="prose prose-sm max-w-none my-16">
            <MarkdownRenderer
              content={blog.content}
              questions={questions}
              onQuestionClick={setSelectedQuestion}
            />
          </div>
        </article>

        {questions.length > 0 && (
          <aside className="mt-16 pt-12 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-black mb-6">
              Questions in this article
            </h3>
            <div className="space-y-2">
              {questions.map((question) => (
                <button
                  key={question.index}
                  onClick={() => setSelectedQuestion(question.text)}
                  className="block w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-gray-700 hover:text-black text-sm"
                >
                  {question.text}
                </button>
              ))}
            </div>
          </aside>
        )}
        </div>
      </main>

      {selectedQuestion && (
        <QuestionChat
          question={selectedQuestion}
          onClose={() => setSelectedQuestion(null)}
        />
      )}

      <footer className="border-t border-gray-200 mt-12 w-full -mx-4 sm:-mx-8 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto py-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2026 Afterlink. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
