"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Users,
  Layers,
  AlertCircle,
  RefreshCcw,
  Search,
} from "lucide-react";
import api from "@/lib/api";

type NullableNumber = number | null | undefined;

interface StatsSummary {
  totalStudentsInBatches: number;
  totalStudentsWithAnyTest: number;
  totalBatches: number;
  overallAvgBand: NullableNumber;
  readingAvg: NullableNumber;
  listeningAvg: NullableNumber;
  writingAvg: NullableNumber;
  speakingAvg: NullableNumber;
}

interface BatchStats {
  _id: string;
  name: string;
  totalStudentsInBatch: number;
  studentsWithAnyTest: number;
  studentsWithReading: number;
  studentsWithListening: number;
  studentsWithWriting: number;
  studentsWithSpeaking: number;

  averageBand: NullableNumber;
  readingBand: NullableNumber;
  listeningBand: NullableNumber;
  writingBand: NullableNumber;
  speakingBand: NullableNumber;
}

interface StudentStatsRow {
  _id: string;
  studentId?: string;
  name: string;
  email: string;
  systemId: string;
  batchName?: string | null;

  readingBand: NullableNumber;
  listeningBand: NullableNumber;
  writingBand: NullableNumber;
  speakingBand: NullableNumber;
  overallBand: NullableNumber;
}

interface FacultyStatsResponse {
  summary?: Partial<StatsSummary>;
  batches?: BatchStats[];
  students?: StudentStatsRow[];
}

// ---- Helpers ----
function formatBand(b: NullableNumber): string {
  if (b === null || b === undefined || Number.isNaN(b)) return "—";
  const num = Number(b);
  return num.toFixed(1);
}

function bandBadgeClass(b: NullableNumber): string {
  if (b === null || b === undefined || Number.isNaN(b)) {
    return "bg-muted text-muted-foreground";
  }
  const val = Number(b);
  if (val >= 7.5) return "bg-emerald-100 text-emerald-800";
  if (val >= 6.5) return "bg-sky-100 text-sky-800";
  if (val >= 5.5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export function FacultyStats() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<StatsSummary>({
    totalStudentsInBatches: 0,
    totalStudentsWithAnyTest: 0,
    totalBatches: 0,
    overallAvgBand: null,
    readingAvg: null,
    listeningAvg: null,
    writingAvg: null,
    speakingAvg: null,
  });

  const [batches, setBatches] = useState<BatchStats[]>([]);
  const [students, setStudents] = useState<StudentStatsRow[]>([]);

  const [selectedBatchId, setSelectedBatchId] = useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // ---- Fetch stats ----
  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/faculty/stats");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load stats");
        setLoading(false);
        return;
      }

      const data: FacultyStatsResponse = res.data || {};
      const s = data.summary || {};

      setSummary({
        totalStudentsInBatches: s.totalStudentsInBatches ?? 0,
        totalStudentsWithAnyTest: s.totalStudentsWithAnyTest ?? 0,
        totalBatches: s.totalBatches ?? (data.batches?.length || 0),
        overallAvgBand: s.overallAvgBand ?? null,
        readingAvg: s.readingAvg ?? null,
        listeningAvg: s.listeningAvg ?? null,
        writingAvg: s.writingAvg ?? null,
        speakingAvg: s.speakingAvg ?? null,
      });

      setBatches(Array.isArray(data.batches) ? data.batches : []);
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  // ---- Filter students by batch + search ----
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedBatchId !== "all") {
        const batch = batches.find((b) => b._id === selectedBatchId);
        if (batch && s.batchName && s.batchName !== batch.name) {
          return false;
        }
      }

      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(t) ||
        s.systemId.toLowerCase().includes(t) ||
        s.email.toLowerCase().includes(t)
      );
    });
  }, [students, batches, selectedBatchId, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Batch Analytics
          </h1>
          <p className="text-muted-foreground text-sm">
            View IELTS band performance, batch coverage, and student attempts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
        >
          <RefreshCcw className="w-4 h-4 mr-1" />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-3 flex items-center gap-2 border-red-300 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {/* Top summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Students in batches */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Students in your batches
            </p>
            <p className="text-2xl font-bold mt-1">
              {summary.totalStudentsInBatches ?? 0}
            </p>
          </div>
          <Users className="w-6 h-6 text-muted-foreground" />
        </Card>

        {/* Students who have given any test */}
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Students with any test
            </p>
            <p className="text-2xl font-bold mt-1">
              {summary.totalStudentsWithAnyTest ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Coverage:{" "}
              {summary.totalStudentsInBatches
                ? Math.round(
                  ((summary.totalStudentsWithAnyTest || 0) * 100) / summary.totalStudentsInBatches
                ) : 0}
              %
            </p>
          </div>
          <BarChart3 className="w-6 h-6 text-muted-foreground" />
        </Card>

        {/* Overall avg band */}
        <Card className="p-4 flex flex-col">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Overall Avg Band
          </p>
          <div className="mt-2 inline-flex items-center">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${bandBadgeClass(
                summary.overallAvgBand
              )}`}
            >
              {formatBand(summary.overallAvgBand)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Across all skills and students with attempts.
          </p>
        </Card>

        {/* Per-skill averages */}
        <Card className="p-4 text-xs space-y-1">
          <p className="uppercase tracking-wide text-muted-foreground">
            Per-skill Averages
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full ${bandBadgeClass(summary.readingAvg)}`} >
              R: {formatBand(summary.readingAvg)}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${bandBadgeClass(summary.listeningAvg)}`} >
              L: {formatBand(summary.listeningAvg)}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${bandBadgeClass(summary.writingAvg)}`} >
              W: {formatBand(summary.writingAvg)}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${bandBadgeClass(summary.speakingAvg)}`} >
              S: {formatBand(summary.speakingAvg)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Average band for students who attempted each skill.
          </p>
        </Card>
      </div>

      {/* Batch table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Batch-wise Performance & Coverage
          </h2>
          <p className="text-xs text-muted-foreground">
            Click a batch row to filter the student table below.
          </p>
        </div>

        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No batch stats available yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Batch</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Total students
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Any test
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Reading</th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Listening
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Writing
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Speaking
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    Overall Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b._id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelectedBatchId(b._id)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{b.name}</div>
                    </td>
                    <td className="px-3 py-2">
                      {b.totalStudentsInBatch ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium">
                        {b.studentsWithAnyTest ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {b.totalStudentsInBatch
                          ? Math.round(
                            ((b.studentsWithAnyTest || 0) * 100) /
                            b.totalStudentsInBatch
                          )
                          : 0}
                        % coverage
                      </div>
                    </td>

                    {/* Reading */}
                    <td className="px-3 py-2">
                      <div className="text-sm">
                        {b.studentsWithReading ?? 0}/
                        {b.totalStudentsInBatch ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Avg {formatBand(b.readingBand)}
                      </div>
                    </td>

                    {/* Listening */}
                    <td className="px-3 py-2">
                      <div className="text-sm">
                        {b.studentsWithListening ?? 0}/
                        {b.totalStudentsInBatch ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Avg {formatBand(b.listeningBand)}
                      </div>
                    </td>

                    {/* Writing */}
                    <td className="px-3 py-2">
                      <div className="text-sm">
                        {b.studentsWithWriting ?? 0}/
                        {b.totalStudentsInBatch ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Avg {formatBand(b.writingBand)}
                      </div>
                    </td>

                    {/* Speaking */}
                    <td className="px-3 py-2">
                      <div className="text-sm">
                        {b.studentsWithSpeaking ?? 0}/
                        {b.totalStudentsInBatch ?? 0}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Avg {formatBand(b.speakingBand)}
                      </div>
                    </td>

                    {/* Overall Average */}
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${bandBadgeClass(
                          b.averageBand
                        )}`}
                      >
                        {formatBand(b.averageBand)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Students table */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Student-wise Bands
            </h2>
            <p className="text-xs text-muted-foreground">
              Filter by batch and search by name / ID / email.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={selectedBatchId}
              onChange={(e) =>
                setSelectedBatchId(
                  (e.target.value || "all") as string | "all"
                )
              }
            >
              <option value="all">All batches</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No students found for the selected filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
                    Student
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Batch</th>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">Overall</th>
                  <th className="px-3 py-2 text-left font-semibold">R</th>
                  <th className="px-3 py-2 text-left font-semibold">L</th>
                  <th className="px-3 py-2 text-left font-semibold">W</th>
                  <th className="px-3 py-2 text-left font-semibold">S</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr
                    key={s._id}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.email}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.batchName || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{s.systemId}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bandBadgeClass(
                          s.overallBand
                        )}`}
                      >
                        {formatBand(s.overallBand)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatBand(s.readingBand)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatBand(s.listeningBand)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatBand(s.writingBand)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatBand(s.speakingBand)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
