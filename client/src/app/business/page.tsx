"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBot, UserInsight } from "@/hooks/useBot";

export default function BusinessDashboard() {
  const [insights, setInsights] = useState<UserInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getInsights, isReady } = useBot();
  const router = useRouter();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadInsights = async () => {
      try {
        const data = await getInsights();
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load insights");
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();
  }, [isReady, getInsights]);

  // Group insights by user
  const insightsByUser = insights.reduce((acc, insight) => {
    if (!acc[insight.oduserId]) {
      acc[insight.oduserId] = [];
    }
    acc[insight.oduserId].push(insight);
    return acc;
  }, {} as Record<string, UserInsight[]>);

  // Get theme color
  const getThemeColor = (theme: string) => {
    const colors: Record<string, string> = {
      food: "bg-orange-100 text-orange-800",
      beauty: "bg-pink-100 text-pink-800",
      fitness: "bg-green-100 text-green-800",
      tech: "bg-blue-100 text-blue-800",
      finance: "bg-emerald-100 text-emerald-800",
      health: "bg-red-100 text-red-800",
      education: "bg-indigo-100 text-indigo-800",
      travel: "bg-cyan-100 text-cyan-800",
      home: "bg-amber-100 text-amber-800",
      fashion: "bg-purple-100 text-purple-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[theme] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--border)] py-4">
        <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold tracking-tight">Business Dashboard</h1>
          </div>
          <div className="text-sm text-[var(--muted)]">
            {insights.length} insights from {Object.keys(insightsByUser).length} users
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="text-[var(--muted)]">Loading insights...</div>
        )}

        {error && (
          <p className="text-red-600 mb-8">{error}</p>
        )}

        {!isLoading && insights.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] text-lg">No customer insights collected yet.</p>
            <p className="text-[var(--muted)] text-sm mt-2">
              Insights will appear here when users interact with article questions.
            </p>
          </div>
        )}

        {!isLoading && insights.length > 0 && (
          <div className="space-y-8">
            {Object.entries(insightsByUser).map(([userId, userInsights]) => (
              <div key={userId} className="border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-[var(--foreground)]">User: </span>
                      <span className="text-[var(--muted)] font-mono text-sm">{userId}</span>
                    </div>
                    <span className="text-sm text-[var(--muted)]">
                      {userInsights.length} insight{userInsights.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[var(--border)]">
                  {userInsights.map((insight) => (
                    <div key={insight.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getThemeColor(insight.category)}`}>
                          {insight.category}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--foreground)]">{insight.insight}</p>
                          <p className="text-xs text-[var(--muted)] mt-1">
                            Article: <span className="font-medium">{insight.articleTitle}</span>
                          </p>
                        </div>
                        <span className="text-xs text-[var(--muted)] whitespace-nowrap">
                          {new Date(insight.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
