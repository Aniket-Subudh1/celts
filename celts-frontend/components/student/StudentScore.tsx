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
        <h2 className="text-lg font-semibold">My IELTS Progress</h2>
        <p className="text-sm text-slate-500">
          No completed tests yet. Your scores will appear here.
        </p>
        <Button size="sm" variant="outline" onClick={fetchStats}>
          Refresh
        </Button>
      </Card>
    );
  }

  const overrideWriting = stats.overrideDetails?.writing;
  const overrideSpeaking = stats.overrideDetails?.speaking;

  return (
    <>
      {/* Header */}
      <Card className="p-6 border-slate-200 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-slate-900">
                My IELTS Progress
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

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[
          { label: "Reading", value: stats.readingBand, icon: BookOpen },
          { label: "Listening", value: stats.listeningBand, icon: Headphones },
          { label: "Writing", value: stats.writingBand, icon: Pen },
          { label: "Speaking", value: stats.speakingBand, icon: Mic },
        ].map((item, i) => (
          <Card
            key={i}
            className="py-6 px-4 flex flex-col items-center justify-center text-center border-slate-200 shadow-sm rounded-xl"
          >
            <item.icon className="w-6 h-6 text-primary mb-2" />
            <p className="text-base font-medium text-slate-900">{item.label}</p>
            <span
              className={`mt-2 text-3xl font-bold px-5 py-1.5 rounded-xl ${bandBadgeClass(
                item.value
              )}`}
            >
              {formatBand(item.value)}
            </span>
          </Card>
        ))}
      </div>

      {/* Writing Summary */}
      {stats.writingExaminerSummary && (
        <Card className="p-5 border-slate-200 shadow-sm rounded-xl mt-6">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Writing – Examiner Summary
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {stats.writingExaminerSummary}
          </p>
        </Card>
      )}

      {/* Speaking Summary */}
      {stats.speakingExaminerSummary && (
        <Card className="p-5 border-slate-200 shadow-sm rounded-xl mt-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Speaking – Examiner Summary
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {stats.speakingExaminerSummary}
          </p>
        </Card>
      )}

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
