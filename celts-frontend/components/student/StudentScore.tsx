"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  BarChart3,
  BookOpen,
  Headphones,
  Pen,
  Mic,
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";

/* ===================== TYPES ===================== */

type NullableNumber = number | null | undefined;
type SkillKey = "reading" | "listening" | "writing" | "speaking";

interface OverrideInfo {
  skill: SkillKey;
  oldBandScore: NullableNumber;
  newBandScore: NullableNumber;
  reason?: string;
  overriddenAt?: string | null;
}

interface OverrideDetails {
  reading?: OverrideInfo;
  listening?: OverrideInfo;
  writing?: OverrideInfo;
  speaking?: OverrideInfo;
}

interface StudentStatsDoc {
  name?: string;
  systemId?: string;
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

interface SkillSubmissionSummary {
  skill: SkillKey;
  testTitle?: string | null;
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

type SubmissionSummaryResponse = Partial<
  Record<SkillKey, SkillSubmissionSummary>
>;

/* ===================== HELPERS ===================== */

function formatBand(b: NullableNumber) {
  if (b == null || Number.isNaN(b)) return "Not attempted";
  return Number(b).toFixed(1);
}

function bandBadgeClass(b: NullableNumber) {
  if (b == null || Number.isNaN(b)) return "bg-slate-100 text-slate-500";
  if (b >= 7.5) return "bg-emerald-100 text-emerald-700";
  if (b >= 6.5) return "bg-sky-100 text-sky-700";
  if (b >= 5.5) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

/* ===================== COMPONENT ===================== */

export function StudentScore() {
  const [stats, setStats] = useState<StudentStatsDoc | null>(null);
  const [summary, setSummary] = useState<SubmissionSummaryResponse>({});
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillKey | null>(null);

  async function fetchStats() {
    setLoading(true);
    const res = await api.apiGet("/student/stats");
    if (res.ok) setStats(res.data ?? null);
    setLoading(false);
  }

  async function fetchSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    const res = await api.apiGet("/student/submissions/summary");
    if (res.ok) setSummary(res.data ?? {});
    else setSummaryError(res.error?.message || "Failed to load details");
    setSummaryLoading(false);
  }

  useEffect(() => {
    fetchStats();
    fetchSummary();
  }, []);

  const skillCards = [
    { key: "reading", label: "Reading", icon: BookOpen, band: stats?.readingBand },
    { key: "listening", label: "Listening", icon: Headphones, band: stats?.listeningBand },
    { key: "writing", label: "Writing", icon: Pen, band: stats?.writingBand },
    { key: "speaking", label: "Speaking", icon: Mic, band: stats?.speakingBand },
  ] as const;

  const selectedSummary = selectedSkill ? summary[selectedSkill] : undefined;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading your scores...
      </div>
    );
  }

  if (!stats) return null;

  const colorMap: Record<SkillKey, string> = {
    listening: "bg-blue-500",
    reading: "bg-indigo-500",
    writing: "bg-orange-500",
    speaking: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      {/* ================= CELTS PROGRESS ================= */}
      <Card className="p-6 rounded-xl">
        <div className="flex justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">My CELTS Progress</h2>
            </div>
            <p className="text-sm text-slate-500">
              Latest Reading, Listening, Writing and Speaking band scores
            </p>
            {stats.batchName && (
              <p className="text-xs text-slate-500 mt-1">
                Batch: <span className="text-slate-700">{stats.batchName}</span>
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Overall Band</p>
            <div
              className={`mt-2 w-24 h-24 flex items-center justify-center rounded-lg text-2xl font-medium ${bandBadgeClass(
                stats.overallBand
              )}`}
            >
              {formatBand(stats.overallBand)}
            </div>
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-500">
          Name: <span className="text-slate-700">{stats.name || "Student"}</span>
          {stats.systemId && (
            <span className="ml-4">
              ID: <span className="text-slate-700">{stats.systemId}</span>
            </span>
          )}
        </div>
      </Card>

      {/* ================= SKILL CARDS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {skillCards.map(({ key, label, icon: Icon, band }) => {
          const active = selectedSkill === key;
          const displayBand = band ?? summary[key]?.bandScore ?? null;

          return (
            <button
              key={key}
              onClick={() => setSelectedSkill(active ? null : key)}
              className="text-left"
            >
              <div className="rounded-xl overflow-hidden border bg-white">
                <div
                  className={`h-34 flex flex-col items-center justify-center text-white ${colorMap[key]}`}
                >
                  <Icon className="w-8 h-8 mb-3" />
                  <p className="text-l uppercase">{label}</p>
                </div>

                <div className="p-6 text-center">
                  <span
                    className={`inline-flex items-center justify-center
                      min-w-[5.5rem] h-12 px-8
                      text-m font-medium rounded-md whitespace-nowrap
                      ${bandBadgeClass(displayBand)}
                    `}
                  >
                    {formatBand(displayBand)}
                  </span>

                  <ChevronDown
                    className={`w-4 h-4 mx-auto mt-4 text-slate-400 transition-transform ${
                      active ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ================= DETAILS ================= */}
      {selectedSkill && (
        <div className="mt-6">
          {summaryLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading latest test details...
            </div>
          )}

          {!summaryLoading && !selectedSummary && (
            <Card className="p-5 border-dashed bg-slate-50 text-center text-sm text-slate-500">
              No data available for this test. Test not given yet.
            </Card>
          )}

          {selectedSummary && (
            <Card className="p-5 rounded-xl">
              <p className="text-xs uppercase text-slate-500 mb-2">
                {selectedSkill} – Latest Test Details
              </p>

              {selectedSummary.testTitle && (
                <p className="text-sm mb-1">
                  Test: <span className="text-slate-700">{selectedSummary.testTitle}</span>
                </p>
              )}

              {selectedSummary.createdAt && (
                <p className="text-xs text-slate-500 mb-3">
                  Attempted on: {new Date(selectedSummary.createdAt).toLocaleString()}
                </p>
              )}

              {(selectedSkill === "reading" || selectedSkill === "listening") && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>Total: {selectedSummary.totalQuestions}</div>
                  <div>Attempted: {selectedSummary.attemptedCount}</div>
                  <div className="text-emerald-700">
                    Correct: {selectedSummary.correctCount}
                  </div>
                  <div className="text-rose-700">
                    Incorrect: {selectedSummary.incorrectCount}
                  </div>
                </div>
              )}

              {(selectedSkill === "writing" || selectedSkill === "speaking") && (
                <>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Total: {selectedSummary.totalQuestions}</div>
                    <div>Attempted: {selectedSummary.attemptedCount}</div>
                    <div>Unattempted: {selectedSummary.unattemptedCount}</div>
                  </div>

                  {selectedSkill === "writing" &&
                    stats.writingExaminerSummary && (
                      <div className="mt-4 border-t pt-3 text-sm whitespace-pre-wrap">
                        {stats.writingExaminerSummary}
                      </div>
                    )}

                  {selectedSkill === "speaking" &&
                    stats.speakingExaminerSummary && (
                      <div className="mt-4 border-t pt-3 text-sm whitespace-pre-wrap">
                        {stats.speakingExaminerSummary}
                      </div>
                    )}
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
