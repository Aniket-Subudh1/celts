"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { navItems } from "@/components/student/NavItems";

interface CriteriaBreakdown {
  // Writing-style breakdown (objects)
  task_response?: { score?: number; feedback?: string };
  cohesion_coherence?: { score?: number; feedback?: string };
  lexical_resource?: { score?: number; feedback?: string };
  grammatical_range_accuracy?: { score?: number; feedback?: string };

  // Speaking-style breakdown (plain numbers)
  fluency?: number;
  coherence?: number;
  vocabulary?: number;
  grammar?: number;
  pronunciation?: number;
}

interface GeminiEval {
  band_score?: number;
  criteria_breakdown?: CriteriaBreakdown;
  examiner_summary?: string;
  transcription?: string; // for speaking (if you want to show it later)
}

interface SubmissionSummary {
  submissionId: string;
  testId?: string;
  testTitle?: string;
  skill?: string;
  status?: string;

  totalMarks: number;
  maxMarks: number;

  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;

  correctCount: number;
  incorrectCount: number;

  bandScore: number | null;

  geminiEvaluation?: GeminiEval | null;
  geminiError?: string | null;

  // ✅ NEW skill-specific summary fields from backend
  geminiWritingEvaluationSummary?: string | null;
  geminiSpeakingEvaluationSummary?: string | null;

  // ✅ Generic, skill-aware summary from backend (optional)
  examinerSummary?: string | null;

  student?: {
    _id?: string;
    name?: string;
    email?: string;
    systemId?: string;
  };
  createdAt?: string;
}

export default function TestScorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const submissionId = searchParams.get("submissionId");

  const [userName, setUserName] = useState("Student");
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("celts_user")
        : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "Student");
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!submissionId) {
      setError("No submission id provided.");
      return;
    }
    fetchSummary(submissionId);
  }, [submissionId]);

  // Auto-refresh for async-graded skills (writing/speaking) while status is pending
  useEffect(() => {
    if (!submissionId || !summary) return;

    const isAsyncSkill =
      summary.skill === "writing" || summary.skill === "speaking";

    if (!isAsyncSkill) return;
    if (summary.status !== "pending") return; // already graded or failed

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await api.apiGet(`/student/submissions/${submissionId}`);
        if (res.ok) {
          const data = res.data;
          setSummary(data);
          if (data.status !== "pending") {
            clearInterval(interval);
          }
        }
      } catch {
        // ignore transient errors while polling
      }

      if (attempts > 20) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [submissionId, summary]);

  async function fetchSummary(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet(`/student/submissions/${id}`);
      if (!res.ok) {
        setError(res.error?.message || "Failed to load test score");
        setSummary(null);
        setLoading(false);
        return;
      }
      setSummary(res.data);
    } catch (err: any) {
      setError(err?.message || "Network error");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function skillLabel(skill?: string) {
    switch (skill) {
      case "reading":
        return "Reading";
      case "listening":
        return "Listening";
      case "writing":
        return "Writing";
      case "speaking":
        return "Speaking";
      default:
        return skill || "Test";
    }
  }

  function statusLabel(status?: string) {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  const bandText =
    summary?.bandScore !== null && summary?.bandScore !== undefined
      ? `${summary.bandScore}/9`
      : "Not available";

  const attempted = summary?.attemptedCount ?? 0;
  const totalQ = summary?.totalQuestions ?? 0;
  const unattempted =
    summary?.unattemptedCount ?? Math.max(totalQ - attempted, 0);

  const isWriting = summary?.skill === "writing";
  const isSpeaking = summary?.skill === "speaking";
  const isWritingOrSpeaking = isWriting || isSpeaking;

  // ✅ Decide which summary to show on the UI
  const examinerSummary =
    summary?.examinerSummary ||
    (isWriting
      ? summary?.geminiWritingEvaluationSummary
      : isSpeaking
        ? summary?.geminiSpeakingEvaluationSummary
        : null) ||
    summary?.geminiEvaluation?.examiner_summary ||
    null;

  const speakingCriteria =
    isSpeaking && summary?.geminiEvaluation?.criteria_breakdown
      ? summary.geminiEvaluation.criteria_breakdown
      : undefined;

  const speakingTranscription =
    isSpeaking && summary?.geminiEvaluation?.transcription
      ? summary.geminiEvaluation.transcription
      : undefined;

  return (
    <DashboardLayout
      navItems={navItems}
      sidebarHeader="CELTS Student"
      userName={userName}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Test Result</h1>
            <p className="text-muted-foreground">
              Detailed performance for this{" "}
              {summary ? skillLabel(summary.skill) : "test"}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/student/test")}
          >
            Back to My Tests
          </Button>
        </div>

        {loading && <p>Loading score...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && !summary && (
          <p>No submission found. Please go back to the tests page.</p>
        )}

        {!loading && !error && summary && (
          <>
            <Card className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {skillLabel(summary.skill)} Test •{" "}
                    {statusLabel(summary.status)}
                  </p>
                  <h2 className="text-2xl font-semibold">
                    {summary.testTitle || "Untitled Test"}
                  </h2>
                  {summary.createdAt && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Submitted at:{" "}
                      {new Date(summary.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {summary.student && (
                  <div className="text-right text-sm">
                    <div className="font-semibold">
                      {summary.student.name}
                    </div>
                    {summary.student.systemId && (
                      <div className="text-muted-foreground">
                        ID: {summary.student.systemId}
                      </div>
                    )}
                    {summary.student.email && (
                      <div className="text-muted-foreground">
                        {summary.student.email}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Score breakdown */}
            {isWritingOrSpeaking ? (
              // For writing & speaking: show total Q, attempted, unattempted only
              <Card className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Questions
                  </p>
                  <p className="text-2xl font-bold">{totalQ}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Attempted
                  </p>
                  <p className="text-2xl font-bold">{attempted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Unattempted
                  </p>
                  <p className="text-2xl font-bold">{unattempted}</p>
                </div>
              </Card>
            ) : (
              // Reading & listening
              <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Questions
                  </p>
                  <p className="text-2xl font-bold">{totalQ}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Attempted
                  </p>
                  <p className="text-2xl font-bold">{attempted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Unattempted
                  </p>
                  <p className="text-2xl font-bold">{unattempted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Marks
                  </p>
                  <p className="text-2xl font-bold">
                    {summary.totalMarks}/{summary.maxMarks}
                  </p>
                </div>
              </Card>
            )}

            {/* Correct / incorrect / band */}
            {isWritingOrSpeaking ? (
              // For writing & speaking: only band score
              <Card className="p-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Band Score ({skillLabel(summary.skill)})
                  </p>
                  <p className="text-2xl font-bold text-primary">{bandText}</p>
                </div>
              </Card>
            ) : (
              // Reading & listening: keep correct/incorrect + band
              <Card className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Correct
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {summary.correctCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Incorrect
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {summary.incorrectCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Band Score ({skillLabel(summary.skill)})
                  </p>
                  <p className="text-2xl font-bold text-primary">{bandText}</p>
                </div>
              </Card>
            )}

            {/* AI evaluation details – writing & speaking */}
            {isWritingOrSpeaking && (examinerSummary || summary.geminiError) && (
              <Card className="p-4 space-y-4">
                {/* Examiner summary */}
                {examinerSummary && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {isWriting
                        ? "Writing Examiner Summary"
                        : "Speaking Examiner Summary"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {examinerSummary}
                    </p>
                  </div>
                )}

                {/* Any AI error note */}
                {summary.geminiError && (
                  <p className="text-xs text-red-600">
                    AI evaluation note: {summary.geminiError}
                  </p>
                )}

                {/* Optional: show criteria and transcription for speaking */}
                {isSpeaking && speakingCriteria && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">
                      Criteria Breakdown
                    </p>
                    <div className="grid grid-cols-2 gap-y-1 text-sm">
                      <div>
                        Fluency: {speakingCriteria.fluency ?? "—"}
                      </div>
                      <div>
                        Coherence: {speakingCriteria.coherence ?? "—"}
                      </div>
                      <div>
                        Vocabulary: {speakingCriteria.vocabulary ?? "—"}
                      </div>
                      <div>
                        Grammar: {speakingCriteria.grammar ?? "—"}
                      </div>
                      <div>
                        Pronunciation: {speakingCriteria.pronunciation ?? "—"}
                      </div>
                    </div>
                  </div>
                )}


                {isSpeaking && speakingTranscription && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Transcription
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {speakingTranscription}
                    </p>
                  </div>
                )}
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/student/test")}
              >
                Back to My Tests
              </Button>
              <Button size="sm" onClick={() => router.push("/student/scores")}>
                Go to Overall Scores
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
