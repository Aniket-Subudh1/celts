"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { BookOpen, FileText, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { navItems } from "@/components/student/NavItems";

interface CriteriaBreakdown {
  task_response?: { score?: number; feedback?: string };
  cohesion_coherence?: { score?: number; feedback?: string };
  lexical_resource?: { score?: number; feedback?: string };
  grammatical_range_accuracy?: { score?: number; feedback?: string };
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
  transcription?: string;
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
  geminiWritingEvaluationSummary?: string | null;
  geminiSpeakingEvaluationSummary?: string | null;
  examinerSummary?: string | null;
  student?: {
    _id?: string;
    name?: string;
    email?: string;
    systemId?: string;
  };
  createdAt?: string;
}

function TestScoreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const submissionId = searchParams.get("submissionId");

  const [userName, setUserName] = useState("Student");
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("celts_user") : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "Student");
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!submissionId) {
      setError("No submission id provided.");
      return;
    }
    fetchSummary(submissionId);
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId || !summary) return;
    const isAsyncSkill =
      summary.skill === "writing" || summary.skill === "speaking";
    if (!isAsyncSkill) return;
    if (summary.status !== "pending") return;
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
      } catch {}
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
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName={userName}>
      <div className="min-h-screen flex justify-center bg-gray-50 py-12 px-4">
        <div className="w-full max-w-[1200px] space-y-10">
          <header
            className="rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(139,92,246,1) 50%, rgba(59,130,246,1) 100%)",
              boxShadow: "0 20px 50px rgba(63,63,188,0.18)",
            }}
          >
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm">Test Result</h1>
              <p className="mt-3 text-indigo-100 max-w-2xl text-sm md:text-base leading-relaxed">
                Detailed performance summary for this test. Metrics shown below are generated from your submission and automated evaluation.
              </p>
            </div>
            <div
              aria-hidden
              className="absolute -right-40 -top-24 w-[420px] h-[420px] rounded-full opacity-10 blur-3xl"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), rgba(139,92,246,0.0))",
              }}
            />
          </header>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">{summary?.testTitle || "Test result"}</h2>
                <p className="text-sm text-indigo-700">{summary ? `${skillLabel(summary.skill)} • ${statusLabel(summary.status)}` : "Loading..."}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => router.push("/student/test")}>Back to My Tests</Button>
                <Button size="sm" onClick={() => router.push("/student/scores")}>Go to Overall Scores</Button>
              </div>
            </div>

            {loading && (
              <div className="p-6 rounded-2xl bg-white/90 border border-slate-100 shadow-sm flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <div className="text-sm text-slate-600">Loading score...</div>
              </div>
            )}

            {error && (
              <div className="p-6 rounded-2xl bg-white/90 border border-rose-100 shadow-sm">
                <div className="text-sm text-rose-600">{error}</div>
              </div>
            )}

            {!loading && !error && !summary && (
              <div className="p-6 rounded-2xl bg-white/90 border border-slate-100 shadow-sm">
                <div className="text-sm text-slate-600">No submission found. Please go back to the tests page.</div>
              </div>
            )}

            {!loading && !error && summary && (
              <div className="space-y-6">
                <Card className="relative rounded-2xl p-6 bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13, 13, 50, 0.06)" }}>
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{skillLabel(summary.skill)} Test • {statusLabel(summary.status)}</p>
                      <h3 className="text-xl font-semibold text-slate-900">{summary.testTitle || "Untitled Test"}</h3>
                      {summary.createdAt && <p className="text-sm text-muted-foreground mt-2">Submitted at: <span className="font-medium">{new Date(summary.createdAt).toLocaleString()}</span></p>}
                    </div>

                    {summary.student && (
                      <div className="text-right text-sm">
                        <div className="font-semibold">{summary.student.name}</div>
                        {summary.student.systemId && <div className="text-muted-foreground">ID: {summary.student.systemId}</div>}
                        {summary.student.email && <div className="text-muted-foreground">{summary.student.email}</div>}
                      </div>
                    )}
                  </div>
                </Card>

                {isWritingOrSpeaking ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Total Questions</p>
                      <p className="text-2xl font-bold">{totalQ}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Attempted</p>
                      <p className="text-2xl font-bold">{attempted}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Unattempted</p>
                      <p className="text-2xl font-bold">{unattempted}</p>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Total Questions</p>
                      <p className="text-2xl font-bold">{totalQ}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Attempted</p>
                      <p className="text-2xl font-bold">{attempted}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Unattempted</p>
                      <p className="text-2xl font-bold">{unattempted}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Total Marks</p>
                      <p className="text-2xl font-bold">{summary.totalMarks}/{summary.maxMarks}</p>
                    </Card>
                  </div>
                )}

                {isWritingOrSpeaking ? (
                  <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                    <p className="text-xs text-muted-foreground mb-1">Band Score ({skillLabel(summary.skill)})</p>
                    <p className="text-2xl font-bold text-indigo-700">{bandText}</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Correct</p>
                      <p className="text-2xl font-bold text-green-600">{summary.correctCount}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Incorrect</p>
                      <p className="text-2xl font-bold text-red-600">{summary.incorrectCount}</p>
                    </Card>

                    <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                      <p className="text-xs text-muted-foreground mb-1">Band Score ({skillLabel(summary.skill)})</p>
                      <p className="text-2xl font-bold text-indigo-700">{bandText}</p>
                    </Card>
                  </div>
                )}

                {isWritingOrSpeaking && (examinerSummary || summary.geminiError) && (
                  <Card className="p-6 rounded-2xl bg-gradient-to-b from-white/80 to-white/90 border border-transparent" style={{ boxShadow: "inset -6px -6px 18px rgba(255,255,255,0.8), inset 6px 6px 18px rgba(0,0,0,0.03), 0 8px 30px rgba(13,13,50,0.06)" }}>
                    {examinerSummary && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-1">{isWriting ? "Writing Examiner Summary" : "Speaking Examiner Summary"}</p>
                        <p className="text-sm whitespace-pre-wrap">{examinerSummary}</p>
                      </div>
                    )}

                    {summary.geminiError && <div className="text-xs text-rose-600">AI evaluation note: {summary.geminiError}</div>}

                    {isSpeaking && speakingCriteria && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Criteria Breakdown</p>
                        <div className="grid grid-cols-2 gap-y-1 text-sm">
                          <div>Fluency: {speakingCriteria.fluency ?? "—"}</div>
                          <div>Coherence: {speakingCriteria.coherence ?? "—"}</div>
                          <div>Vocabulary: {speakingCriteria.vocabulary ?? "—"}</div>
                          <div>Grammar: {speakingCriteria.grammar ?? "—"}</div>
                          <div>Pronunciation: {speakingCriteria.pronunciation ?? "—"}</div>
                        </div>
                      </div>
                    )}

                    {isSpeaking && speakingTranscription && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-1">Transcription</p>
                        <p className="text-sm whitespace-pre-wrap">{speakingTranscription}</p>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function TestScorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-center">Loading...</div></div>}>
      <TestScoreContent />
    </Suspense>
  );
}
