import Link from 'next/link';
import { fetchBlog, detectQuestions } from '@/app/lib/utils';
import ClientBlogContent from './ClientBlogContent';

interface BlogPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const blogData = await fetchBlog(slug);

  if (!blogData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-semibold text-black mb-4">
          Article not found
        </h1>
        <Link
          href="/search"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Back to search
        </Link>
      </div>
    );
  }

  const questions = detectQuestions(blogData.content);

  return (
    <ClientBlogContent
      blog={blogData}
      questions={questions}
    />
  );
}
