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
        <h1 className="text-3xl font-extrabold mb-2 text-slate-900">
          Welcome to Student Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Track your CELTS skill bands and access your CELTS Proficiency Tests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 flex flex-col justify-between rounded-2xl shadow-md bg-white border border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-linear-to-br from-orange-300 to-rose-300 text-white">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                CELTS Proficiency Test
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Attempt full IELTS-style Reading, Listening, Writing and
                Speaking tests curated by your faculty.
              </p>

              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <p>
                  <span className="font-semibold text-slate-700">Assigned Tests: </span>
                  {testsLoading
                    ? "Loading..."
                    : totalAssignedTests > 0
                    ? totalAssignedTests
                    : "No active tests assigned yet."}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Format: </span>
                  Timed sections with auto-graded Reading & Listening and AI-evaluated Writing & Speaking.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Link href="/student/test">
              <Button size="sm" className="rounded-full bg-slate-800 hover:bg-slate-900">
                Go to test
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between rounded-2xl shadow-md bg-white border border-slate-100">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-sky-100 text-sky-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Overall Band Summary
              </p>

              {statsLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your bands...
                </div>
              ) : statsError ? (
                <p className="mt-4 text-sm text-rose-600">{statsError}</p>
              ) : stats ? (
                <>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-slate-900">
                      {fmtBand(stats.overallBand)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Overall band
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 space-y-1">
                    <p>
                      <span className="font-semibold text-slate-700">Reading: </span>
                      {fmtBand(stats.readingBand)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Listening: </span>
                      {fmtBand(stats.listeningBand)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Writing: </span>
                      {fmtBand(stats.writingBand)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-700">Speaking: </span>
                      {fmtBand(stats.speakingBand)}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
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
        <Card className="p-4 rounded-2xl shadow-md bg-white border border-slate-100">
          <p className="text-xs text-slate-400 uppercase mb-2">
            Band by Skill
          </p>
          <div className="h-64">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading chart...
              </div>
            ) : !stats || barData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No data yet. Complete at least one test to see your chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="skill" tick={{ fill: "#64748b" }} />
                  <YAxis domain={[0, 9]} tick={{ fill: "#64748b" }} />
                  <Tooltip />
                  <Bar dataKey="band" radius={[4, 4, 0, 0]} fill="#60a5fa" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Radar chart */}
        <Card className="p-4 rounded-2xl shadow-md bg-white border border-slate-100">
          <p className="text-xs text-slate-400 uppercase mb-2">
            Skill Balance
          </p>
          <div className="h-64">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading chart...
              </div>
            ) : !stats || radarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
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
                    fill="rgba(59,130,246,0.35)"
                    stroke="rgba(59,130,246,0.9)"
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
