"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Layers,
  AlertCircle,
  Search,
  BookOpen,
  Headphones,
  Pen,
  Mic,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";
import { getTotalPages } from "@/utils/pagination";

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
  _id: string; // StudentStats document id
  studentId?: string; // actual User id if backend exposes it
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

// Detailed stats for a single student (faculty view of StudentStats)
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
  writingExaminerSummary?: string | null;
  speakingExaminerSummary?: string | null;
  // optional overrideDetails etc if backend returns them – not used here
  overrideDetails?: any;
}

type SkillKey = "reading" | "listening" | "writing" | "speaking";

interface SkillSubmissionSummary {
  skill: SkillKey;
  submissionId?: string;
  testId?: string | null;
  testTitle?: string | null;
  status: string;

  totalMarks: number;
  maxMarks: number;

  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;

  correctCount: number;
  incorrectCount: number;

  bandScore: NullableNumber;
  createdAt?: string | null;
}

type SubmissionSummaryResponse = Partial<Record<SkillKey, SkillSubmissionSummary>>;

function formatBand(b: NullableNumber): string {
  if (b == null || Number.isNaN(b)) return "—";
  return Number(b).toFixed(1);
}

function bandBadgeClass(b: NullableNumber): string {
  if (b == null || Number.isNaN(b)) return "bg-muted text-muted-foreground";
  const v = Number(b);
  if (v >= 7.5) return "bg-emerald-100 text-emerald-800";
  if (v >= 6.5) return "bg-sky-100 text-sky-800";
  if (v >= 5.5) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export function StudentReport() {
  const pagination = usePagination({
    initialPage: 1,
    initialLimit: 10,
  });
  const totalPages = Math.max(
    Math.ceil(pagination.total / pagination.limit),
    1
  );

  const [gotoPage, setGotoPage] = useState("");

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

  // Selected student & their detailed report
  const [selectedStudent, setSelectedStudent] = useState<StudentStatsRow | null>(
    null
  );
  const [studentStats, setStudentStats] = useState<StudentStatsDoc | null>(null);
  const [studentSummary, setStudentSummary] =
    useState<SubmissionSummaryResponse>({});
  const [studentDetailsLoading, setStudentDetailsLoading] = useState(false);
  const [studentDetailsError, setStudentDetailsError] = useState<string | null>(
    null
  );

  const [selectedSkill, setSelectedSkill] = useState<SkillKey | null>(null);

  function handleGotoPage() {
  const pageNum = Number(gotoPage);

  if (Number.isNaN(pageNum)) return;

  const clamped = Math.min(
    Math.max(pageNum, 1),
    totalPages
  );

  pagination.setPage(clamped);
  setGotoPage("");
}

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/faculty/stats");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load faculty stats");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pagination.reset();
  }, [searchTerm, selectedBatchId]);


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


  const paginatedStudents = useMemo(() => {
    pagination.setTotal(filteredStudents.length);

    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;

    return filteredStudents.slice(start, end);
  }, [
    filteredStudents,
    pagination.page,
    pagination.limit,
  ]);



  // Fetch full report for a selected student
  async function loadStudentReport(student: StudentStatsRow) {
    setSelectedStudent(student);
    setStudentDetailsLoading(true);
    setStudentDetailsError(null);
    setStudentStats(null);
    setStudentSummary({});
    setSelectedSkill(null);

    try {
      const statsRes = await api.apiGet(`/faculty/students/${student._id}/stats`);
      const summaryRes = await api.apiGet(
        `/faculty/students/${student._id}/submissions/summary`
      );

      if (!statsRes.ok) {
        throw new Error(statsRes.error?.message || "Failed to load student stats");
      }
      if (!summaryRes.ok) {
        throw new Error(
          summaryRes.error?.message || "Failed to load student test summary"
        );
      }

      const statsData: StudentStatsDoc | null = statsRes.data ?? null;
      const summaryData: SubmissionSummaryResponse = summaryRes.data ?? {};

      setStudentStats(statsData);
      setStudentSummary(summaryData);

      // Auto-select first available skill with data
      const skillOrder: SkillKey[] = [
        "reading",
        "listening",
        "writing",
        "speaking",
      ];
      const firstSkill =
        skillOrder.find((k) => {
          const band =
            (statsData &&
              (statsData[`${k}Band` as keyof StudentStatsDoc] as NullableNumber)) ??
            summaryData[k]?.bandScore;
          return band != null && !Number.isNaN(band);
        }) || skillOrder.find((k) => summaryData[k]);
      setSelectedSkill(firstSkill || null);
    } catch (err: any) {
      setStudentDetailsError(err?.message || "Failed to load student report");
    } finally {
      setStudentDetailsLoading(false);
    }
  }

  const selectedSummary: SkillSubmissionSummary | undefined =
    selectedSkill && studentSummary
      ? studentSummary[selectedSkill]
      : undefined;

  const effectiveStats = studentStats || (selectedStudent && {
    name: selectedStudent.name,
    email: selectedStudent.email,
    systemId: selectedStudent.systemId,
    batchName: selectedStudent.batchName,
    readingBand: selectedStudent.readingBand,
    listeningBand: selectedStudent.listeningBand,
    writingBand: selectedStudent.writingBand,
    speakingBand: selectedStudent.speakingBand,
    overallBand: selectedStudent.overallBand,
  });

  const isReadingOrListening =
    selectedSkill === "reading" || selectedSkill === "listening";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Student Reports
          </h1>
          <p className="text-muted-foreground text-sm">
            View detailed report cards per student to identify strengths and gaps.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-3 flex items-center gap-2 border-red-300 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {/* Batches & Students + Student Report stacked vertically */}
      <div className="space-y-6">
        {/* Batches & student list */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Batches & Students
            </h2>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading students...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
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
                    <th className="px-3 py-2 text-left font-semibold">
                      Overall
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      R
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      L
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      W
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      S
                    </th>
                    <th className="px-3 py-2 text-left font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s) => (
                    <tr
                      key={s._id}
                      className={`border-b last:border-0 hover:bg-muted/40 ${selectedStudent?._id === s._id ? "bg-muted/60" : ""
                        }`}
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
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => loadStudentReport(s)}
                        >
                          View Report
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>





          {/* Pagination footer */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

  {/* Page info */}
  <div className="text-sm text-muted-foreground">
    Page{" "}
    <span className="font-semibold text-foreground">
      {pagination.page}
    </span>{" "}
    of{" "}
    <span className="font-semibold text-foreground">
      {totalPages}
    </span>{" "}
    • Total students:{" "}
    <span className="font-semibold text-foreground">
      {pagination.total}
    </span>
  </div>

  {/* Controls */}
  <div className="flex items-center gap-2 flex-wrap">

    {/* Previous */}
    <Button
      size="sm"
      variant="outline"
      disabled={!pagination.hasPrev}
      onClick={pagination.prevPage}
    >
      Previous
    </Button>

    {/* Next */}
    <Button
      size="sm"
      variant="outline"
      disabled={!pagination.hasNext}
      onClick={pagination.nextPage}
    >
      Next
    </Button>

    {/* Go to page */}
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">
        Go to
      </span>
      <Input
        type="number"
        min={1}
        max={totalPages}
        value={gotoPage}
        onChange={(e) => setGotoPage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGotoPage();
        }}
        className="h-8 w-20 text-sm"
        placeholder="Page"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleGotoPage}
        disabled={!gotoPage}
      >
        Go
      </Button>
    </div>
  </div>
</div>




        </Card>

        {/* Selected student's report card */}
        <Card className="p-4 space-y-4">
          {!selectedStudent ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
              <BarChart3 className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Select a student from the list to view their full report card.
              </p>
            </div>
          ) : (
            <>
              {/* Header for selected student */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Student Report
                  </p>
                  <h2 className="text-xl font-semibold">
                    {effectiveStats?.name || selectedStudent.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID:{" "}
                    <span className="font-medium">
                      {effectiveStats?.systemId || selectedStudent.systemId}
                    </span>
                    {effectiveStats?.batchName && (
                      <>
                        {" "}
                        • Batch:{" "}
                        <span className="font-medium">
                          {effectiveStats.batchName}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Overall Band
                  </p>
                  <span
                    className={`mt-2 inline-block px-4 py-1 rounded-full text-base font-semibold ${bandBadgeClass(
                      effectiveStats?.overallBand
                    )}`}
                  >
                    {formatBand(effectiveStats?.overallBand)}
                  </span>
                </div>
              </div>

              {/* Skill cards (interactive) */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  {
                    key: "reading" as SkillKey,
                    label: "Reading",
                    icon: BookOpen,
                    band: effectiveStats?.readingBand ?? studentSummary.reading?.bandScore,
                  },
                  {
                    key: "listening" as SkillKey,
                    label: "Listening",
                    icon: Headphones,
                    band:
                      effectiveStats?.listeningBand ??
                      studentSummary.listening?.bandScore,
                  },
                  {
                    key: "writing" as SkillKey,
                    label: "Writing",
                    icon: Pen,
                    band:
                      effectiveStats?.writingBand ?? studentSummary.writing?.bandScore,
                  },
                  {
                    key: "speaking" as SkillKey,
                    label: "Speaking",
                    icon: Mic,
                    band:
                      effectiveStats?.speakingBand ??
                      studentSummary.speaking?.bandScore,
                  },
                ] as {
                  key: SkillKey;
                  label: string;
                  icon: any;
                  band: NullableNumber;
                }[]).map(({ key, label, icon: Icon, band }) => {
                  const isActive = selectedSkill === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedSkill(key)}
                      className={`relative group text-left focus:outline-none ${isActive ? "ring-2 ring-primary ring-offset-2 rounded-xl" : ""
                        }`}
                    >
                      <Card
                        className={`w-full py-4 px-3 flex flex-col items-center justify-center text-center border-slate-200 shadow-sm rounded-xl transition-transform ${isActive ? "bg-primary/5 scale-[1.02]" : "hover:scale-[1.01]"
                          }`}
                      >
                        <Icon className="w-5 h-5 text-primary mb-1.5" />
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        <span
                          className={`mt-1 text-xl font-bold px-4 py-1 rounded-xl ${bandBadgeClass(
                            band
                          )}`}
                        >
                          {formatBand(band)}
                        </span>
                      </Card>
                    </button>
                  );
                })}
              </div>

              {/* Detailed panel for selected skill */}
              <div className="mt-2">
                {studentDetailsLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading report details...</span>
                  </div>
                )}

                {studentDetailsError && (
                  <p className="text-sm text-red-600 mb-2">
                    {studentDetailsError}
                  </p>
                )}

                {selectedSkill && selectedSummary && (
                  <Card className="p-4 border-slate-200 shadow-sm rounded-xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {selectedSummary.skill.charAt(0).toUpperCase() +
                            selectedSummary.skill.slice(1)}{" "}
                          – Latest Test
                        </p>
                        {selectedSummary.testTitle && (
                          <p className="text-sm text-slate-700 mt-1">
                            Test:{" "}
                            <span className="font-medium">
                              {selectedSummary.testTitle}
                            </span>
                          </p>
                        )}
                        {selectedSummary.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Attempted on:{" "}
                            {new Date(
                              selectedSummary.createdAt
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Band Score
                        </p>
                        <span
                          className={`inline-block mt-1 px-4 py-1 rounded-full text-base font-semibold ${bandBadgeClass(
                            selectedSummary.bandScore
                          )}`}
                        >
                          {formatBand(selectedSummary.bandScore)}
                        </span>
                      </div>
                    </div>

                    {isReadingOrListening ? (
                      // Reading / Listening → full MCQ-style stats
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Total Questions</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedSummary.totalQuestions}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Attempted</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedSummary.attemptedCount}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Unattempted</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedSummary.unattemptedCount}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Correct</p>
                          <p className="text-lg font-semibold text-emerald-700">
                            {selectedSummary.correctCount}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Incorrect</p>
                          <p className="text-lg font-semibold text-rose-700">
                            {selectedSummary.incorrectCount}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">Marks Scored</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedSummary.totalMarks} / {selectedSummary.maxMarks}
                          </p>
                        </div>
                      </div>
                    ) : (
                      // Writing / Speaking → only Question counts + Examiner summary
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">
                              Total Questions
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {selectedSummary.totalQuestions}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">Attempted</p>
                            <p className="text-lg font-semibold text-slate-900">
                              {selectedSummary.attemptedCount}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">
                              Unattempted
                            </p>
                            <p className="text-lg font-semibold text-slate-900">
                              {selectedSummary.unattemptedCount}
                            </p>
                          </div>
                        </div>

                        {selectedSkill === "writing" &&
                          effectiveStats?.writingExaminerSummary && (
                            <div className="mt-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                Writing – Examiner Summary
                              </p>
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {effectiveStats.writingExaminerSummary}
                              </p>
                            </div>
                          )}

                        {selectedSkill === "speaking" &&
                          effectiveStats?.speakingExaminerSummary && (
                            <div className="mt-2">
                              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                Speaking – Examiner Summary
                              </p>
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {effectiveStats.speakingExaminerSummary}
                              </p>
                            </div>
                          )}
                      </>
                    )}
                  </Card>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
