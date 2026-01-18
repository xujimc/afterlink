'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/search');
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-600">Redirecting to search...</p>
    </div>
  );
}
