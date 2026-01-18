"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBot, UserInsight } from "@/hooks/useBot";

interface ScoreBreakdown {
  fit: { points: number; max: number; detail: string };
  budget: { points: number; max: number; detail: string };
  need: { points: number; max: number; detail: string };
  urgency: { points: number; max: number; detail: string };
  engagement: { points: number; max: number; detail: string };
}

interface LeadScore {
  oduserId: string;
  score: number;
  reason: string;
  breakdown: ScoreBreakdown;
}

export default function BusinessDashboard() {
  const [insights, setInsights] = useState<UserInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [icpDescription, setIcpDescription] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [leadScores, setLeadScores] = useState<LeadScore[]>([]);
  const { getInsights, matchICP, isReady } = useBot();
  const router = useRouter();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadInsights();
  }, [isReady]);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const data = await getInsights();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMatchICP = async () => {
    if (!icpDescription.trim() || insights.length === 0) return;

    setIsMatching(true);
    setLeadScores([]);

    try {
      // Prepare leads for matching (one per user)
      const leadsToMatch = insights.map((i) => ({
        oduserId: i.oduserId,
        insight: i.insight,
      }));

      const scores = await matchICP(icpDescription, leadsToMatch);
      setLeadScores(scores);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to match ICP");
    } finally {
      setIsMatching(false);
    }
  };

  // Get score for a user
  const getScoreForUser = (userId: string): LeadScore | undefined => {
    return leadScores.find((s) => s.oduserId === userId);
  };

  // Sort insights by score if we have scores
  const sortedInsights = leadScores.length > 0
    ? [...insights].sort((a, b) => {
        const scoreA = getScoreForUser(a.oduserId)?.score ?? -1;
        const scoreB = getScoreForUser(b.oduserId)?.score ?? -1;
        return scoreB - scoreA;
      })
    : insights;

  // Group insights by user (using sorted order)
  const insightsByUser = sortedInsights.reduce((acc, insight) => {
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

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-yellow-600 bg-yellow-50";
    if (score >= 40) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
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
          <span className="text-sm text-[var(--muted)]">
            {insights.length} leads
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* ICP Matching Section */}
        <div className="mb-8 p-6 border border-[var(--border)] rounded-lg bg-gray-50">
          <h2 className="text-lg font-medium mb-3">Match Leads to ICP</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Describe your Ideal Customer Profile and we'll score each lead based on how well they match.
          </p>
          <textarea
            value={icpDescription}
            onChange={(e) => setIcpDescription(e.target.value)}
            placeholder="e.g., Young professionals aged 25-35 with disposable income $500+/month, interested in health and wellness, looking to invest in quality products..."
            className="w-full p-3 border border-[var(--border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--foreground)]"
            rows={3}
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleMatchICP}
              disabled={isMatching || !icpDescription.trim() || insights.length === 0}
              className="px-4 py-2 bg-[var(--foreground)] text-white rounded-lg text-sm hover:bg-black transition-colors disabled:opacity-50"
            >
              {isMatching ? "Matching..." : "Match Leads"}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="text-[var(--muted)]">Loading leads...</div>
        )}

        {error && (
          <p className="text-red-600 mb-8">{error}</p>
        )}

        {!isLoading && insights.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] text-lg">No leads collected yet.</p>
            <p className="text-[var(--muted)] text-sm mt-2">
              Leads will appear here when users interact with article questions.
            </p>
          </div>
        )}

        {!isLoading && insights.length > 0 && (
          <div className="space-y-4">
            {Object.entries(insightsByUser).map(([userId, userInsights]) => {
              const score = getScoreForUser(userId);
              const firstInsight = userInsights[0];

              return (
                <div key={userId} className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {score && (
                          <span className={`px-2 py-1 rounded text-sm font-bold ${getScoreColor(score.score)}`}>
                            {score.score}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getThemeColor(firstInsight.category)}`}>
                          {firstInsight.category}
                        </span>
                        {firstInsight.userName ? (
                          <span className="font-medium text-[var(--foreground)]">{firstInsight.userName}</span>
                        ) : (
                          <span className="text-[var(--muted)] font-mono text-xs">{userId.substring(0, 20)}...</span>
                        )}
                        {(firstInsight.userEmail || firstInsight.userPhone) && (
                          <span className="text-sm text-[var(--muted)]">
                            {firstInsight.userEmail || firstInsight.userPhone}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(firstInsight.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-[var(--foreground)]">{firstInsight.insight}</p>
                    {score && (
                      <>
                        <p className="text-sm text-[var(--muted)] mt-2 italic">
                          {score.reason}
                        </p>
                        {/* Score Breakdown */}
                        {score.breakdown && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-2">Score Breakdown</p>
                          <div className="grid grid-cols-5 gap-2">
                            {Object.entries(score.breakdown).map(([key, value]) => (
                              <div key={key} className="text-center">
                                <div className="text-xs text-gray-400 capitalize mb-1">{key}</div>
                                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`absolute left-0 top-0 h-full rounded-full ${
                                      value.points / value.max >= 0.8
                                        ? "bg-green-400"
                                        : value.points / value.max >= 0.5
                                        ? "bg-yellow-400"
                                        : "bg-red-400"
                                    }`}
                                    style={{ width: `${(value.points / value.max) * 100}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {value.points}/{value.max}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        )}
                      </>
                    )}
                    <p className="text-xs text-[var(--muted)] mt-3">
                      Article: <span className="font-medium">{firstInsight.articleTitle}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
