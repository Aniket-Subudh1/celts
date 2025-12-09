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

interface OverrideInfo {
  skill: "reading" | "listening" | "writing" | "speaking";
  oldBandScore: NullableNumber;
  newBandScore: NullableNumber;
  reason?: string;
  overriddenAt?: string | null;
  facultyName?: string;
  facultySystemId?: string | null;
}

interface OverrideDetails {
  reading?: OverrideInfo;
  listening?: OverrideInfo;
  writing?: OverrideInfo;
  speaking?: OverrideInfo;
}

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
  writingExaminerSummary?: string;
  speakingExaminerSummary?: string;
  overrideDetails?: OverrideDetails;
}

// NEW: skill & summary types
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
  if (b == null || Number.isNaN(b)) return "Not attempted";
  return Number(b).toFixed(1);
}

function bandBadgeClass(b: NullableNumber): string {
  if (b == null || Number.isNaN(b))
    return "bg-slate-100 text-slate-500";
  const v = Number(b);
  if (v >= 7.5) return "bg-emerald-100 text-emerald-700";
  if (v >= 6.5) return "bg-sky-100 text-sky-700";
  if (v >= 5.5) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function formatOverrideDate(dt?: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function StudentScore() {
  const [stats, setStats] = useState<StudentStatsDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NEW: per-skill summary from Submission
  const [summary, setSummary] = useState<SubmissionSummaryResponse>({});
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // NEW: which skill is selected in the UI
  const [selectedSkill, setSelectedSkill] = useState<SkillKey | null>(null);

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
      setError(err?.message || "Network error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  // NEW: fetch latest submissions summary per skill
  async function fetchSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await api.apiGet("/student/submissions/summary");
      if (!res.ok) {
        setSummaryError(
          res.error?.message || "Failed to load your recent test details"
        );
        setSummary({});
        setSummaryLoading(false);
        return;
      }
      const data: SubmissionSummaryResponse = res.data ?? {};
      setSummary(data);

      // Auto-select a skill if none selected yet
      if (!selectedSkill) {
        const order: SkillKey[] = ["reading", "listening", "writing", "speaking"];
        const firstWithData = order.find((k) => data[k]);
        if (firstWithData) setSelectedSkill(firstWithData);
      }
    } catch (err: any) {
      setSummaryError(err?.message || "Network error");
      setSummary({});
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
    fetchSummary();
  }, []);

  const hasAnyScores = useMemo(() => {
    if (!stats) return false;

    const hasBands =
      stats.readingBand != null ||
      stats.listeningBand != null ||
      stats.writingBand != null ||
      stats.speakingBand != null;

    const hasSummary =
      summary.reading ||
      summary.listening ||
      summary.writing ||
      summary.speaking;

    return hasBands || !!hasSummary;
  }, [stats, summary]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-primary" />
        <span className="text-sm text-slate-500">Loading your scores...</span>
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
      <Card className="p-8 text-center space-y-3 border-slate-200 shadow-sm">
        <div className="flex justify-center">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">My CELTS Progress</h2>
        <p className="text-sm text-slate-500">
          No completed tests yet. Your scores will appear here.
        </p>
        <div className="flex gap-2 justify-center">
          <Button size="sm" variant="outline" onClick={fetchStats}>
            Refresh Scores
          </Button>
          <Button size="sm" variant="outline" onClick={fetchSummary}>
            Refresh Details
          </Button>
        </div>
      </Card>
    );
  }

  const overrideWriting = stats.overrideDetails?.writing;
  const overrideSpeaking = stats.overrideDetails?.speaking;

  // NEW: mapping skill → icon/label/band
  const skillCards: {
    key: SkillKey;
    label: string;
    icon: any;
    value: NullableNumber;
  }[] = [
    { key: "reading", label: "Reading", icon: BookOpen, value: stats.readingBand },
    { key: "listening", label: "Listening", icon: Headphones, value: stats.listeningBand },
    { key: "writing", label: "Writing", icon: Pen, value: stats.writingBand },
    { key: "speaking", label: "Speaking", icon: Mic, value: stats.speakingBand },
  ];

  const selectedSummary: SkillSubmissionSummary | undefined =
    selectedSkill ? summary[selectedSkill] : undefined;

  return (
    <>
      {/* Header */}
      <Card className="p-6 border-slate-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-slate-900">
                My CELTS Progress
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Latest Reading, Listening, Writing and Speaking band scores
            </p>
            {stats.batchName && (
              <p className="text-xs text-slate-500 mt-1">
                Batch: <span className="font-medium">{stats.batchName}</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Overall Band
            </p>
            <span
              className={`mt-2 inline-block px-5 py-1.5 rounded-full text-base font-semibold ${bandBadgeClass(
                stats.overallBand
              )}`}
            >
              {formatBand(stats.overallBand)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="space-y-1">
            <p className="text-s text-slate-500">
              Name: <span className="font-medium">{stats.name || "Student"}</span>
            </p>
            {stats.systemId && (
              <p className="text-s text-slate-500">
                ID: <span className="font-medium">{stats.systemId}</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Score Cards – interactive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {skillCards.map(({ key, label, icon: Icon, value }) => {
          const isActive = selectedSkill === key;
          const cardBand = value ?? summary[key]?.bandScore ?? null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedSkill(key)}
              className={`relative group text-left focus:outline-none ${
                isActive ? "ring-2 ring-primary ring-offset-2 rounded-xl" : ""
              }`}
            >
              <Card
                className={`w-full py-6 px-4 flex flex-col items-center justify-center text-center border-slate-200 shadow-sm rounded-xl transition-transform ${
                  isActive ? "bg-primary/5 scale-[1.02]" : "hover:scale-[1.01]"
                }`}
              >
                <Icon className="w-6 h-6 text-primary mb-2" />
                <p className="text-base font-medium text-slate-900">{label}</p>
                <span
                  className={`mt-2 text-3xl font-bold px-5 py-1.5 rounded-xl ${bandBadgeClass(
                    cardBand
                  )}`}
                >
                  {formatBand(cardBand)}
                </span>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Detailed stats for selected skill */}
      <div className="mt-6">
        {summaryLoading && (
          <div className="flex items-center text-sm text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading latest test details...</span>
          </div>
        )}

        {summaryError && (
          <p className="text-sm text-red-600 mb-2">
            {summaryError}
          </p>
        )}

        {selectedSkill && selectedSummary && (
          <Card className="p-5 border-slate-200 shadow-sm rounded-xl">
            {/* Header for the selected skill */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {selectedSummary.skill.charAt(0).toUpperCase() +
                    selectedSummary.skill.slice(1)}{" "}
                  – Latest Test Details
                </p>
                {selectedSummary.testTitle && (
                  <p className="text-sm text-slate-700 mt-1">
                    Test:{" "}
                    <span className="font-medium">{selectedSummary.testTitle}</span>
                  </p>
                )}
                {selectedSummary.createdAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Attempted on:{" "}
                    {new Date(selectedSummary.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wide">
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

            {/* Reading & Listening: full metrics */}
            {(selectedSkill === "reading" || selectedSkill === "listening") && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                  <p className="text-xs text-slate-500">Unattempted</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedSummary.unattemptedCount}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Marks Scored</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {selectedSummary.totalMarks} / {selectedSummary.maxMarks}
                  </p>
                </div>
              </div>
            )}

            {/* Writing & Speaking: only total / attempted / unattempted + examiner summary */}
            {(selectedSkill === "writing" || selectedSkill === "speaking") && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                </div>

                {/* Examiner Summary inside the same card */}
                {selectedSkill === "writing" && stats.writingExaminerSummary && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                      Writing – Examiner Summary
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {stats.writingExaminerSummary}
                    </p>
                  </div>
                )}

                {selectedSkill === "speaking" && stats.speakingExaminerSummary && (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                      Speaking – Examiner Summary
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {stats.speakingExaminerSummary}
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      {/* Override: Writing */}
      {overrideWriting && (
        <Card className="p-5 border-amber-300 bg-amber-50 rounded-xl shadow-sm mt-6">
          <p className="text-xs uppercase tracking-wide text-amber-800 mb-2">
            Writing Band Updated Manually
          </p>
          <p className="text-sm text-slate-800">
            Updated by{" "}
            <span className="font-semibold">
              {overrideWriting.facultyName || "Faculty"}
            </span>
            {overrideWriting.facultySystemId && (
              <span className="text-xs text-slate-600 ml-1">
                (ID: {overrideWriting.facultySystemId})
              </span>
            )}
          </p>
          {overrideWriting.overriddenAt && (
            <p className="text-xs text-slate-500 mt-1">
              On: {formatOverrideDate(overrideWriting.overriddenAt)}
            </p>
          )}
          <p className="text-sm mt-2">
            <span className="font-semibold">Old: </span>
            {overrideWriting.oldBandScore ?? "N/A"}{" "}
            <span className="ml-3 font-semibold">New: </span>
            {overrideWriting.newBandScore ?? "N/A"}
          </p>
          {overrideWriting.reason && (
            <p className="text-xs text-slate-600 mt-2">
              <span className="font-semibold">Reason:</span>{" "}
              {overrideWriting.reason}
            </p>
          )}
        </Card>
      )}

      {/* Override: Speaking */}
      {overrideSpeaking && (
        <Card className="p-5 border-amber-300 bg-amber-50 rounded-xl shadow-sm mt-4">
          <p className="text-xs uppercase tracking-wide text-amber-800 mb-2">
            Speaking Band Updated Manually
          </p>
          <p className="text-sm text-slate-800">
            Updated by{" "}
            <span className="font-semibold">
              {overrideSpeaking.facultyName || "Faculty"}
            </span>
            {overrideSpeaking.facultySystemId && (
              <span className="text-xs text-slate-600 ml-1">
                (ID: {overrideSpeaking.facultySystemId})
              </span>
            )}
          </p>
          {overrideSpeaking.overriddenAt && (
            <p className="text-xs text-slate-500 mt-1">
              On: {formatOverrideDate(overrideSpeaking.overriddenAt)}
            </p>
          )}
          <p className="text-sm mt-2">
            <span className="font-semibold">Old: </span>
            {overrideSpeaking.oldBandScore ?? "N/A"}{" "}
            <span className="ml-3 font-semibold">New: </span>
            {overrideSpeaking.newBandScore ?? "N/A"}
          </p>
          {overrideSpeaking.reason && (
            <p className="text-xs text-slate-600 mt-2">
              <span className="font-semibold">Reason:</span>{" "}
              {overrideSpeaking.reason}
            </p>
          )}
        </Card>
      )}

      {!hasAnyScores && (
        <Card className="p-5 border-slate-200 shadow-sm rounded-xl mt-6">
          <p className="text-sm text-slate-500">
            Your profile is ready, but no band scores have been added yet.
            Complete a test to see your progress here.
          </p>
        </Card>
      )}
    </>
  );
}
