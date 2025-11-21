"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Loader2, BookOpenCheck, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

type NullableNumber = number | null | undefined;

interface TestSummary {
  _id: string;
  title: string;
  type: string;
  scheduledDate?: string | null;
  status?: string | null;
  timeLimitMinutes?: number | null;
}

interface StudentStats {
  name?: string;
  email?: string;
  systemId?: string;
  batchName?: string | null;
  readingBand?: NullableNumber;
  listeningBand?: NullableNumber;
  writingBand?: NullableNumber;
  speakingBand?: NullableNumber;
  overallBand?: NullableNumber;
}

function fmtBand(b: NullableNumber) {
  if (b == null || Number.isNaN(b)) return "—";
  return Number(b).toFixed(1);
}

export function StudDashboard() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);

  const [stats, setStats] = useState<StudentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  async function fetchTests() {
    setTestsLoading(true);
    try {
      const res = await api.apiGet("/student/tests");
      if (!res.ok) {
        setTests([]);
        setTestsLoading(false);
        return;
      }
      const data = res.data || {};
      setTests(Array.isArray(data.tests) ? data.tests : []);
    } catch (err) {
      setTests([]);
    } finally {
      setTestsLoading(false);
    }
  }

  async function fetchStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await api.apiGet("/student/stats");
      if (!res.ok) {
        setStats(null);
        setStatsError(res.error?.message || "Failed to load stats");
      } else {
        setStats(res.data || null);
      }
    } catch (err: any) {
      setStats(null);
      setStatsError(err?.message || "Network error");
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    fetchTests();
    fetchStats();
  }, []);

  // Build chart data
  const barData =
    stats != null
      ? [
          { skill: "Reading", band: stats.readingBand ?? 0 },
          { skill: "Listening", band: stats.listeningBand ?? 0 },
          { skill: "Writing", band: stats.writingBand ?? 0 },
          { skill: "Speaking", band: stats.speakingBand ?? 0 },
        ]
      : [];

  const radarData = barData;

  const totalAssignedTests = tests.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome to Student Dashboard
        </h1>
        <p className="text-muted-foreground">
          Track your IELTS skill bands and access your CELTS Proficiency Tests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                CELTS Proficiency Test
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Attempt full IELTS-style Reading, Listening, Writing and
                Speaking tests curated by your faculty.
              </p>

              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-semibold">Assigned Tests: </span>
                  {testsLoading
                    ? "Loading..."
                    : totalAssignedTests > 0
                    ? totalAssignedTests
                    : "No active tests assigned yet."}
                </p>
                <p>
                  <span className="font-semibold">Format: </span>
                  Timed sections with auto-graded Reading & Listening and AI-evaluated Writing & Speaking.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Link href="/student/test">
              <Button size="sm">Go to test</Button>
            </Link>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-sky-100 text-sky-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Overall Band Summary
              </p>

              {statsLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your bands...
                </div>
              ) : statsError ? (
                <p className="mt-4 text-sm text-red-600">{statsError}</p>
              ) : stats ? (
                <>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-4xl font-bold">
                      {fmtBand(stats.overallBand)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Overall band
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p>
                      <span className="font-semibold">Reading: </span>
                      {fmtBand(stats.readingBand)}
                    </p>
                    <p>
                      <span className="font-semibold">Listening: </span>
                      {fmtBand(stats.listeningBand)}
                    </p>
                    <p>
                      <span className="font-semibold">Writing: </span>
                      {fmtBand(stats.writingBand)}
                    </p>
                    <p>
                      <span className="font-semibold">Speaking: </span>
                      {fmtBand(stats.speakingBand)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  You don&apos;t have any evaluated tests yet. Once you finish
                  a CELTS Proficiency Test, your band summary will appear here.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Visuals row: Bar chart + Radar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-2">
            Band by Skill
          </p>
          <div className="h-64">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading chart...
              </div>
            ) : !stats || barData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data yet. Complete at least one test to see your chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="skill" />
                  <YAxis domain={[0, 9]} />
                  <Tooltip />
                  <Bar dataKey="band" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Radar chart */}
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-2">
            Skill Balance
          </p>
          <div className="h-64">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading chart...
              </div>
            ) : !stats || radarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data yet. Complete at least one test to see your chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <PolarRadiusAxis domain={[0, 9]} />
                  <Radar
                    dataKey="band"
                    fill="rgba(59,130,246,0.4)"
                    stroke="rgba(59,130,246,0.8)"
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
