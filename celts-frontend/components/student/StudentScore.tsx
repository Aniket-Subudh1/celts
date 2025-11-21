"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  BarChart3,
  BookOpen,
  Headphones,
  Pen,
  Mic,
} from "lucide-react";
import api from "@/lib/api";

type NullableNumber = number | null | undefined;

interface StudentStatsDoc {
  _id?: string;
  student?: string;
  name?: string;
  email?: string;
  systemId?: string;
  batch?: string | null;
  batchName?: string | null;

  readingBand?: NullableNumber;
  listeningBand?: NullableNumber;
  writingBand?: NullableNumber;
  speakingBand?: NullableNumber;
  overallBand?: NullableNumber;

  // AI examiner summaries
  writingExaminerSummary?: string;
  speakingExaminerSummary?: string; 
}

function formatBand(b: NullableNumber): string {
  if (b == null || Number.isNaN(b)) return "Not attempted";
  return Number(b).toFixed(1);
}

function bandBadgeClass(b: NullableNumber): string {
  if (b == null || Number.isNaN(b))
    return "bg-muted text-muted-foreground";
  const v = Number(b);
  if (v >= 7.5) return "bg-emerald-100 text-emerald-800";
  if (v >= 6.5) return "bg-sky-100 text-sky-800";
  if (v >= 5.5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export function StudentScore() {
  const [stats, setStats] = useState<StudentStatsDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/student/stats");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load your scores");
        setStats(null);
        setLoading(false);
        return;
      }

      const data: StudentStatsDoc | null = res.data ?? null;
      setStats(data);
    } catch (err: any) {
      console.error("[StudentScore] fetch error:", err);
      setError(err?.message || "Network error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const hasAnyScores = useMemo(() => {
    if (!stats) return false;
    return (
      stats.readingBand != null ||
      stats.listeningBand != null ||
      stats.writingBand != null ||
      stats.speakingBand != null
    );
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">
          Loading your scores...
        </span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchStats}>
          Retry
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          <h2 className="text-lg font-semibold">My IELTS Progress</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          You haven't completed any scored tests yet. Once you finish
          Reading, Listening, Writing or Speaking tests, your band scores
          will appear here.
        </p>
        <Button size="sm" variant="outline" onClick={fetchStats}>
          Refresh
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-lg md:text-xl font-semibold">
                My IELTS Progress
              </h2>
            </div>

            <p className="text-xs md:text-sm text-muted-foreground">
              View your latest band scores across Reading, Listening,
              Writing, and Speaking.
            </p>

            {stats.batchName && (
              <p className="text-xs text-muted-foreground mt-1">
                Batch:{" "}
                <span className="font-medium">{stats.batchName}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Overall Band
              </p>
              <div className="mt-1 inline-flex items-center">
                <span
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold ${bandBadgeClass(
                    stats.overallBand
                  )}`}
                >
                  {formatBand(stats.overallBand)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Name:{" "}
              <span className="font-medium">
                {stats.name || "Student"}
              </span>
            </p>
            {stats.systemId && (
              <p className="text-xs text-muted-foreground">
                ID: <span className="font-medium">{stats.systemId}</span>
              </p>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchStats}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Refreshing...
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </Card>

      {/* Square Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Reading", value: stats.readingBand, icon: BookOpen },
          { label: "Listening", value: stats.listeningBand, icon: Headphones },
          { label: "Writing", value: stats.writingBand, icon: Pen },
          { label: "Speaking", value: stats.speakingBand, icon: Mic },
        ].map((item, i) => (
          <Card
            key={i}
            className="p-4 aspect-square flex flex-col items-center justify-center text-center shadow-sm"
          >
            <div className="flex flex-col items-center gap-3">
              <item.icon className="w-6 h-6 text-primary" />

              <p className="text-xl font-semibold">{item.label}</p>

              <span
                className={`text-3xl font-bold mt-1 px-5 py-1.5 rounded-xl ${bandBadgeClass(
                  item.value
                )}`}
              >
                {formatBand(item.value)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Writing Examiner Summary */}
      {stats.writingExaminerSummary && (
        <Card className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Writing – Examiner Summary
          </p>
          <p className="text-sm leading-relaxed">
            {stats.writingExaminerSummary}
          </p>
        </Card>
      )}

      {/* Speaking Examiner Summary – NEW */}
      {stats.speakingExaminerSummary && (
        <Card className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Speaking – Examiner Summary
          </p>
          <p className="text-sm leading-relaxed">
            {stats.speakingExaminerSummary}
          </p>
        </Card>
      )}

      {!hasAnyScores && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Your profile is set up, but no band scores have been recorded
            yet. Complete a test to see your progress here.
          </p>
        </Card>
      )}
    </div>
  );
}
