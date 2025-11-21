"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, Headphones, Mic, Pen, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

type TestType = "reading" | "listening" | "writing" | "speaking" | string;

type Option = { text: string };

type SpeakingMode = "audio" | "video" | "oral";

interface Question {
  _id?: string;
  questionType: "mcq" | "writing" | "speaking";
  prompt: string;
  options?: Option[];
  correctIndex?: number;

  writingType?: string;
  wordLimit?: number;

  speakingMode?: SpeakingMode;
  recordLimitSeconds?: number;

  marks?: number;
  explanation?: string;

  sectionId?: string | null;
}

interface ReadingSection {
  id: string;
  title?: string;
  passage: string;
}

interface ListeningSection {
  id: string;
  title?: string;
  audioUrl: string;
  listenLimit?: number;
}

interface TestSet {
  _id: string;
  title: string;
  description?: string;
  type: TestType;
  passage?: string;
  audioUrl?: string;
  listenLimit?: number;
  readingSections?: ReadingSection[];
  listeningSections?: ListeningSection[];
  timeLimitMinutes?: number;
  questions: Question[];
  createdAt?: string;
}

/** UI-only state for speaking questions */
type SpeakingUIState = {
  recording?: boolean;
  blobUrl?: string;        // preview URL
  error?: string;
  liveStream?: MediaStream;
};

type EvalItem =
  | {
      kind: "writing";
      questionId?: string;
      prompt: string;
      writingType?: string;
      wordLimit?: number;
      marks: number;
      studentAnswer: string;
    }
  | {
      kind: "speaking";
      questionId?: string;
      prompt: string;
      speakingMode?: SpeakingMode;
      marks: number;
      audioUrl?: string; // optional, not strictly used by backend now
    };

export default function TestRunnerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get("testId");

  const [test, setTest] = useState<TestSet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [speakingState, setSpeakingState] = useState<
    Record<string, SpeakingUIState>
  >({});

  // Keep raw blobs per question key so we can send them at submit time
  const speakingBlobsRef = useRef<Record<string, Blob>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  // fetch test
  useEffect(() => {
    if (testId) fetchTest(testId);
  }, [testId]);

  async function fetchTest(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet(`/student/tests/${id}`);
      if (!res.ok) {
        setError(res.error?.message || "Failed to load test");
        setLoading(false);
        return;
      }
      const t: TestSet = res.data;

      // normalize MCQ
      t.questions = t.questions.map((q) =>
        q.questionType === "mcq"
          ? {
              ...q,
              options:
                Array.isArray(q.options) && q.options.length
                  ? q.options
                  : [{ text: "" }, { text: "" }],
              correctIndex:
                typeof q.correctIndex === "number" ? q.correctIndex : 0,
              sectionId:
                typeof q.sectionId === "string"
                  ? q.sectionId
                  : q.sectionId ?? null,
            }
          : {
              ...q,
              sectionId:
                typeof q.sectionId === "string"
                  ? q.sectionId
                  : q.sectionId ?? null,
            }
      );

      setTest(t);
      setAnswers({});
      setSpeakingState({});
      speakingBlobsRef.current = {};
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  const qKey = (q: Question, index: number) => q._id || String(index);

  // SPEAKING RECORDING
  async function startRecording(key: string, mode: SpeakingMode) {
    try {
      const constraints =
        mode === "video"
          ? { audio: true, video: true }
          : { audio: true, video: false };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mediaChunksRef.current = [];

      if (mode === "video") {
        setSpeakingState((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            liveStream: stream,
          },
        }));
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, {
          type: mode === "video" ? "video/webm" : "audio/webm",
        });
        const url = URL.createObjectURL(blob);

        // store for preview
        setSpeakingState((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            recording: false,
            blobUrl: url,
            liveStream: undefined,
          },
        }));

        // keep note in answers (not used by backend but fine)
        setAnswers((prev) => ({
          ...prev,
          [key]: { blobUrl: url, mode },
        }));

        // store raw blob for submit
        speakingBlobsRef.current[key] = blob;

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
      };

      mr.start();

      setSpeakingState((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), recording: true, error: undefined },
      }));
    } catch (err: any) {
      setSpeakingState((prev) => ({
        ...prev,
        [key]: { recording: false, error: err.message },
      }));
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  // QUESTION RENDERING
  function renderQuestion(q: Question, index: number) {
    const key = qKey(q, index);
    const ans = answers[key];
    const speaking = speakingState[key];

    return (
      <Card key={key} className="p-4 mb-6">
        <p className="font-medium mb-2">{q.prompt}</p>

        {/* MCQ */}
        {q.questionType === "mcq" && (
          <div className="space-y-2">
            {q.options?.map((opt, i) => (
              <label
                key={i}
                className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={ans?.selectedIndex === i}
                  onChange={() =>
                    setAnswers((p) => ({
                      ...p,
                      [key]: { selectedIndex: i },
                    }))
                  }
                />
                <span>{opt.text}</span>
              </label>
            ))}
          </div>
        )}

        {/* WRITING */}
        {q.questionType === "writing" && (
          <textarea
            className="w-full min-h-36 border rounded p-2 text-sm"
            placeholder="Write your answer here..."
            value={ans?.text || ""}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [key]: { text: e.target.value } }))
            }
          />
        )}

        {/* SPEAKING */}
        {q.questionType === "speaking" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Mode: {q.speakingMode || "audio"}
            </p>

            {/* Record controls */}
            <div className="flex gap-2">
              {!speaking?.recording ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    startRecording(
                      key,
                      q.speakingMode === "video" ? "video" : "audio"
                    )
                  }
                >
                  Start Recording
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={stopRecording}
                >
                  Stop
                </Button>
              )}
            </div>

            {/* LIVE PREVIEW DURING VIDEO RECORDING */}
            {speaking?.recording && q.speakingMode === "video" && (
              <div className="mt-2">
                <video
                  ref={(el) => {
                    if (el && mediaStreamRef.current) {
                      // @ts-ignore
                      el.srcObject = mediaStreamRef.current;
                      el.onloadedmetadata = () => {
                        el
                          .play()
                          .catch((err) =>
                            console.warn("Video play interrupted:", err)
                          );
                      };
                    }
                  }}
                  className="w-full"
                  autoPlay
                  muted
                />
              </div>
            )}

            {/* SHOW RECORDED MEDIA AFTER STOP */}
            {speaking?.blobUrl && !speaking?.recording && (
              <div className="mt-2">
                {q.speakingMode === "video" ? (
                  <video src={speaking.blobUrl} controls className="w-full" />
                ) : (
                  <audio src={speaking.blobUrl} controls className="w-full" />
                )}
              </div>
            )}

            {speaking?.error && (
              <p className="text-red-600 text-sm">{speaking.error}</p>
            )}
          </div>
        )}
      </Card>
    );
  }

  // HELPERS FOR READING/LISTENING GROUPING

  function getReadingSections(test: TestSet): ReadingSection[] {
    if (Array.isArray(test.readingSections) && test.readingSections.length > 0) {
      return test.readingSections;
    }
    if (test.passage) {
      return [
        {
          id: "_legacy_reading_",
          title: "Passage 1",
          passage: test.passage,
        },
      ];
    }
    return [];
  }

  function getListeningSections(test: TestSet): ListeningSection[] {
    if (
      Array.isArray(test.listeningSections) &&
      test.listeningSections.length > 0
    ) {
      return test.listeningSections;
    }
    if (test.audioUrl) {
      return [
        {
          id: "_legacy_listening_",
          title: "Audio 1",
          audioUrl: test.audioUrl,
          listenLimit: test.listenLimit ?? 1,
        },
      ];
    }
    return [];
  }

  function questionsForSection(
    test: TestSet,
    sectionId: string,
    totalSections: number
  ): Question[] {
    return test.questions.filter((q) => {
      const qSec = q.sectionId;
      if (!qSec || qSec === null) {
        return totalSections === 1;
      }
      return qSec === sectionId;
    });
  }

  // BUILD EVALUATION PAYLOAD (mostly for writing; speaking part is optional)
  function buildEvaluationPayload(): EvalItem[] {
    if (!test) return [];
    const items: EvalItem[] = [];

    test.questions.forEach((q, idx) => {
      const key = qKey(q, idx);
      const ans = answers[key];

      if (q.questionType === "writing") {
        const textAns = ans?.text || "";
        items.push({
          kind: "writing",
          questionId: q._id ? String(q._id) : undefined,
          prompt: q.prompt,
          writingType: q.writingType,
          wordLimit: q.wordLimit,
          marks: q.marks || 0,
          studentAnswer: textAns,
        });
      }

      if (q.questionType === "speaking") {
        // We no longer rely on audioUrl here, backend uses the uploaded file.
        items.push({
          kind: "speaking",
          questionId: q._id ? String(q._id) : undefined,
          prompt: q.prompt,
          speakingMode: q.speakingMode,
          marks: q.marks || 0,
          audioUrl: undefined,
        });
      }
    });

    return items;
  }

  // SUBMIT
  async function handleSubmit() {
    if (!test) return;

    const ok = confirm(
      "Are you sure you want to submit? You cannot change your answers afterwards."
    );
    if (!ok) return;

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const skill = typeof test.type === "string" ? test.type : "reading";
      const evaluationPayload = buildEvaluationPayload();

      // SPECIAL CASE: SPEAKING -> multipart/form-data with media file
      if (skill === "speaking") {
        // Find first speaking question that has a recording
        const speakingQuestions = test.questions
          .map((q, idx) => ({ q, idx }))
          .filter((x) => x.q.questionType === "speaking");

        let speakingBlob: Blob | undefined;
        if (speakingQuestions.length > 0) {
          const main = speakingQuestions[0];
          const key = qKey(main.q, main.idx);
          speakingBlob = speakingBlobsRef.current[key];
        }

        if (!speakingBlob) {
          setSubmitMessage("Please record your speaking response before submitting.");
          setSubmitting(false);
          return;
        }

        const form = new FormData();
        form.append("media", speakingBlob, "speaking.webm");
        form.append("response", JSON.stringify(answers));
        form.append("evaluationPayload", JSON.stringify(evaluationPayload));

        const API = process.env.NEXT_PUBLIC_API_URL;
        const token = localStorage.getItem("celts_token");

        const resp = await fetch(
          `${API}/student/submit/${test._id}/${skill}`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
          }
        );

        const text = await resp.text();
        let body: any = {};
        try {
          body = JSON.parse(text);
        } catch {
          body = {};
        }

        if (!resp.ok) {
          setSubmitMessage(body?.message || "Submit failed");
          setSubmitting(false);
          return;
        }

        const submissionId =
          body?.submissionId || body?.summary?.submissionId || null;

        if (!submissionId) {
          console.warn("[TestRunner] No submissionId in response:", body);
          setSubmitMessage(
            "Submitted, but couldn't fetch result id. Please check My Scores."
          );
          setSubmitting(false);
          return;
        }

        setSubmitMessage("Submitted successfully! Redirecting to result...");
        router.push(`/student/test/testScore?submissionId=${submissionId}`);
        return;
      }

      // OTHER SKILLS -> normal JSON POST
      const res = await api.apiPost(
        `/student/submit/${test._id}/${skill}`,
        {
          response: answers,
          evaluationPayload,
        }
      );

      if (!res.ok) {
        setSubmitMessage(res.error?.message || "Submit failed");
        setSubmitting(false);
        return;
      }

      const body = res.data;
      const submissionId =
        body?.submissionId || body?.summary?.submissionId || null;

      if (!submissionId) {
        console.warn("[TestRunner] No submissionId in response:", body);
        setSubmitMessage(
          "Submitted, but couldn't fetch result id. Please check My Scores."
        );
        setSubmitting(false);
        return;
      }

      setSubmitMessage("Submitted successfully! Redirecting to result...");
      router.push(`/student/test/testScore?submissionId=${submissionId}`);
    } catch (err: any) {
      console.error("[TestRunner] submit error:", err);
      setSubmitMessage(err?.message || "Network Error");
      setSubmitting(false);
    }
  }

  if (!testId)
    return (
      <div className="w-screen h-screen p-4 md:p-6 overflow-auto bg-gray-50 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-5">
          <p className="text-red-600">No testId provided in URL.</p>
        </div>
      </div>
    );

  return (
    <div className="w-screen h-screen p-4 md:p-6 overflow-auto bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-5">
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading test...
            </div>
          )}

          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && test && (
            <>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    {test.type === "reading" ? (
                      <BookOpen className="w-5 h-5" />
                    ) : test.type === "listening" ? (
                      <Headphones className="w-5 h-5" />
                    ) : test.type === "writing" ? (
                      <Pen className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h1 className="text-xl font-semibold">{test.title}</h1>
                    {test.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {test.description}
                      </p>
                    )}
                    {typeof test.timeLimitMinutes === "number" &&
                      test.timeLimitMinutes > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Time limit: {test.timeLimitMinutes} minutes
                        </p>
                      )}
                  </div>
                </div>
              </Card>

              {/* READING TEST */}
              {test.type === "reading" && (
                <>
                  {getReadingSections(test).map((sec, idx, arr) => {
                    const sectionQuestions = questionsForSection(
                      test,
                      sec.id,
                      arr.length
                    );

                    return (
                      <div key={sec.id} className="space-y-3">
                        <Card className="p-4">
                          <h3 className="text-sm font-medium mb-1">
                            Passage {idx + 1}
                            {sec.title ? ` — ${sec.title}` : ""}
                          </h3>
                          <div className="border rounded p-3 bg-muted/30 max-h-64 overflow-auto text-sm whitespace-pre-wrap">
                            {sec.passage}
                          </div>
                        </Card>

                        {sectionQuestions.map((q, qIdx) =>
                          renderQuestion(q, qIdx)
                        )}
                      </div>
                    );
                  })}

                  {getReadingSections(test).length === 0 &&
                    test.questions.length > 0 && (
                      <>
                        {test.questions.map((q, idx) =>
                          renderQuestion(q, idx)
                        )}
                      </>
                    )}
                </>
              )}

              {/* LISTENING TEST */}
              {test.type === "listening" && (
                <>
                  {getListeningSections(test).map((sec, idx, arr) => {
                    const sectionQuestions = questionsForSection(
                      test,
                      sec.id,
                      arr.length
                    );

                    return (
                      <div key={sec.id} className="space-y-3">
                        <Card className="p-4">
                          <h3 className="text-sm font-medium mb-1">
                            Audio {idx + 1}
                            {sec.title ? ` — ${sec.title}` : ""}
                          </h3>
                          {sec.audioUrl ? (
                            <>
                              <audio
                                controls
                                src={sec.audioUrl}
                                className="w-full"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Play limit: {sec.listenLimit ?? 1} times.
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No audio configured.
                            </p>
                          )}
                        </Card>

                        {sectionQuestions.map((q, qIdx) =>
                          renderQuestion(q, qIdx)
                        )}
                      </div>
                    );
                  })}

                  {getListeningSections(test).length === 0 &&
                    test.questions.length > 0 && (
                      <>
                        {test.questions.map((q, idx) =>
                          renderQuestion(q, idx)
                        )}
                      </>
                    )}
                </>
              )}

              {/* WRITING / SPEAKING TESTS */}
              {(test.type === "writing" || test.type === "speaking") && (
                <>
                  {test.questions.map((q, idx) => renderQuestion(q, idx))}
                </>
              )}

              {/* SUBMIT */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  className="px-4 py-1"
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>

              {submitMessage && (
                <p className="text-center text-sm mt-2">{submitMessage}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
