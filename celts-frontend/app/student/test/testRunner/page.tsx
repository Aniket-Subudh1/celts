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

type SpeakingUIState = {
  recording?: boolean;
  blobUrl?: string;
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
    audioUrl?: string;
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

  const [speakingState, setSpeakingState] = useState<Record<string, SpeakingUIState>>({});
  const speakingBlobsRef = useRef<Record<string, Blob>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flatQuestions, setFlatQuestions] = useState<{ q: Question; idx: number }[]>([]);

  useEffect(() => {
    if (testId) fetchTest(testId);
    // cleanup on unmount
    return () => {
      stopAnyRecording();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [testId]);

  useEffect(() => {
    if (test) {
      const flat: { q: Question; idx: number }[] = test.questions.map((q, idx) => ({ q, idx }));
      setFlatQuestions(flat);
      setCurrentIndex(0);
    } else {
      setFlatQuestions([]);
      setCurrentIndex(0);
    }
  }, [test]);

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

      t.questions = t.questions.map((q) =>
        q.questionType === "mcq"
          ? {
            ...q,
            options: Array.isArray(q.options) && q.options.length ? q.options : [{ text: "" }, { text: "" }],
            correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
            sectionId: typeof q.sectionId === "string" ? q.sectionId : q.sectionId ?? null,
          }
          : {
            ...q,
            sectionId: typeof q.sectionId === "string" ? q.sectionId : q.sectionId ?? null,
          }
      );

      setTest(t);
      setAnswers({});
      setSpeakingState({});
      speakingBlobsRef.current = {};
      setSubmitMessage(null);
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  const qKey = (q: Question, index: number) => q._id || String(index);

  async function startRecording(key: string, mode: SpeakingMode) {
  try {
    stopAnyRecording();

    const constraints =
      mode === "video"
        ? { video: { width: 1280, height: 720, facingMode: "user" }, audio: true }
        : { audio: true };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaStreamRef.current = stream;

    // WAIT until video element is fully mounted
    setSpeakingState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), recording: true, liveStream: stream },
    }));

    setTimeout(() => {
      const video = liveVideoRef.current;
      if (video) {
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        try {
          video.srcObject = stream;
        } catch {
          (video as any).srcObject = stream;
        }

        video.onloadedmetadata = () => {
          video.play().catch(() => {});
        };
      }
    }, 150); // <<< KEY FIX (delay allows DOM to mount)

    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mediaChunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) mediaChunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const blob = new Blob(mediaChunksRef.current, {
        type: mode === "video" ? "video/webm" : "audio/webm",
      });

      const url = URL.createObjectURL(blob);
      speakingBlobsRef.current[key] = blob;

      setSpeakingState((prev) => ({
        ...prev,
        [key]: { recording: false, blobUrl: url },
      }));

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }

      if (liveVideoRef.current) {
        try {
          liveVideoRef.current.srcObject = null;
          liveVideoRef.current.pause();
        } catch {}
      }
    };

    mr.start();
  } catch (err: any) {
    setSpeakingState((prev) => ({
      ...prev,
      [key]: { recording: false, error: err.message },
    }));
  }
}



  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }

  function stopAnyRecording() {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      //
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      try {
        liveVideoRef.current.srcObject = null;
      } catch { }
    }
    mediaChunksRef.current = [];
    mediaRecorderRef.current = null;
  }

  function toggleMcqSelection(key: string, optionIndex: number) {
    setAnswers((prev) => {
      const current = prev?.[key]?.selectedIndex;
      const next = current === optionIndex ? null : optionIndex;
      return { ...prev, [key]: { ...prev[key], selectedIndex: next } };
    });
  }

  function getReadingSections(test: TestSet): ReadingSection[] {
    if (Array.isArray(test.readingSections) && test.readingSections.length > 0) {
      return test.readingSections;
    }
    if (test.passage) {
      return [{ id: "_legacy_reading_", title: "Passage 1", passage: test.passage }];
    }
    return [];
  }

  function getListeningSections(test: TestSet): ListeningSection[] {
    if (Array.isArray(test.listeningSections) && test.listeningSections.length > 0) {
      return test.listeningSections;
    }
    if (test.audioUrl) {
      return [{ id: "_legacy_listening_", title: "Audio 1", audioUrl: test.audioUrl, listenLimit: test.listenLimit ?? 1 }];
    }
    return [];
  }

  function findSectionForQuestion(q: Question) {
    if (!test) return {};
    if (test.type === "reading") {
      const secs = getReadingSections(test);
      if (q.sectionId) {
        const s = secs.find((x) => x.id === q.sectionId);
        if (s) return { passage: s };
      }
      if (secs.length === 1) return { passage: secs[0] };
      return { passage: secs[0] || undefined };
    }
    if (test.type === "listening") {
      const secs = getListeningSections(test);
      if (q.sectionId) {
        const s = secs.find((x) => x.id === q.sectionId);
        if (s) return { audio: s };
      }
      if (secs.length === 1) return { audio: secs[0] };
      return { audio: secs[0] || undefined };
    }
    return {};
  }

  function renderLeftForCurrent(q: Question) {
    if (!test) return null;
    if (test.type === "reading") {
      const sec = findSectionForQuestion(q).passage;
      if (sec) {
        return (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-indigo-700">Passage</h3>
              <div className="text-sm text-slate-500 mt-1">{sec.title || "Passage"}</div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-indigo-50 rounded-md text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">
              {sec.passage}
            </div>
          </div>
        );
      }
      return null;
    }
    if (test.type === "listening") {
      const sec = findSectionForQuestion(q).audio;
      if (sec) {
        return (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-indigo-700">Audio</h3>
              <div className="text-sm text-slate-500 mt-1">{sec.title || "Audio"}</div>
            </div>
            <div className="flex-1 p-6 bg-indigo-50 rounded-md">
              {sec.audioUrl ? (
                <>
                  <audio controls src={sec.audioUrl} className="w-full" />
                  <p className="text-sm text-slate-500 mt-3">Play limit: {sec.listenLimit ?? 1} times</p>
                </>
              ) : (
                <div className="text-lg text-slate-600">No audio configured.</div>
              )}
            </div>
          </div>
        );
      }
      return null;
    }
    if (test.type === "writing" || test.type === "speaking") {
      return (
        <div className="h-full flex flex-col">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-indigo-700">Prompt</h3>
          </div>
          <div className="flex-1 p-6 bg-indigo-50 rounded-md text-lg text-slate-800 leading-relaxed whitespace-pre-wrap">{q.prompt}</div>
        </div>
      );
    }
    return null;
  }

  function renderRightForCurrent(q: Question, index: number) {
    const key = qKey(q, index);
    const ans = answers[key];
    const speaking = speakingState[key];

    if (q.questionType === "mcq") {
      return (
        <div>
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-slate-800">Question</h3>
            <p className="text-lg text-slate-700 mt-2">{q.prompt}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {q.options?.map((opt, i) => {
              const selected = ans?.selectedIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleMcqSelection(key, i)}
                  className={`w-full flex items-center gap-4 p-4 rounded-full transition-shadow text-left text-base leading-snug
                    ${selected ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg" : "bg-white border border-slate-200 text-slate-800 hover:shadow-sm"}
                  `}
                >
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 ${selected ? "bg-white/95" : "bg-slate-300"}`}></div>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          <div className="text-sm text-slate-500 mt-3">Click again to deselect an option.</div>
        </div>
      );
    }

    if (q.questionType === "writing") {
      return (
        <div>
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Write your answer</h3>
          </div>
          <textarea
            className="w-full min-h-[420px] border border-slate-200 rounded-md p-5 text-lg leading-relaxed resize-vertical"
            placeholder="Type your response here..."
            value={ans?.text || ""}
            onChange={(e) => setAnswers((p) => ({ ...p, [key]: { text: e.target.value } }))}
          />
        </div>
      );
    }

    if (q.questionType === "speaking") {
      return (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Record your response</h3>
              <p className="text-sm text-slate-500 mt-1">Mode: {q.speakingMode || "audio"}</p>
            </div>
            <div className="text-sm text-slate-600">Time: {q.recordLimitSeconds ?? "-"}s</div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-3">
              {!speaking?.recording ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => startRecording(key, q.speakingMode === "video" ? "video" : "audio")}
                  className="rounded-md bg-indigo-600 text-white px-4 py-2"
                >
                  Start Recording
                </Button>
              ) : (
                <Button type="button" size="sm" variant="destructive" onClick={stopRecording} className="px-4 py-2">
                  Stop
                </Button>
              )}

              <div className="text-sm text-slate-600">
                {speaking?.recording ? "Recording..." : speaking?.blobUrl ? "Recorded — preview below" : "No recording yet"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {speaking?.recording && q.speakingMode === "video" && (
              <div className="bg-black rounded-xl overflow-hidden border border-slate-300 mt-4">
                <video
                  ref={liveVideoRef}
                  className="w-full h-[520px] object-cover rounded-xl"
                  playsInline
                  muted
                  autoPlay
                />
              </div>
            )}

            {!speaking?.recording && speaking?.blobUrl && q.speakingMode === "video" && (
              <div className="bg-black rounded-md overflow-hidden">
                <video src={speaking.blobUrl} controls className="w-full h-64 object-contain" />
              </div>
            )}

            {!speaking?.recording && speaking?.blobUrl && q.speakingMode !== "video" && (
              <audio src={speaking.blobUrl} controls className="w-full" />
            )}

            {speaking?.error && <p className="text-sm text-red-600 mt-2">{speaking.error}</p>}
          </div>
        </div>
      );
    }

    return null;
  }

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

  async function handleSubmit() {
    if (!test) return;

    const ok = confirm("Are you sure you want to submit? You cannot change your answers afterwards.");
    if (!ok) return;

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const skill = typeof test.type === "string" ? test.type : "reading";
      const evaluationPayload = buildEvaluationPayload();

      if (skill === "speaking") {
        const speakingQuestions = test.questions.map((q, idx) => ({ q, idx })).filter((x) => x.q.questionType === "speaking");

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

        const resp = await fetch(`${API}/student/submit/${test._id}/${skill}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });

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

        const submissionId = body?.submissionId || body?.summary?.submissionId || null;

        if (!submissionId) {
          setSubmitMessage("Submitted, but couldn't fetch result id. Please check My Scores.");
          setSubmitting(false);
          return;
        }

        setSubmitMessage("Submitted successfully! Redirecting to result...");
        router.push(`/student/test/testScore?submissionId=${submissionId}`);
        return;
      }

      const res = await api.apiPost(`/student/submit/${test._id}/${skill}`, {
        response: answers,
        evaluationPayload,
      });

      if (!res.ok) {
        setSubmitMessage(res.error?.message || "Submit failed");
        setSubmitting(false);
        return;
      }

      const body = res.data;
      const submissionId = body?.submissionId || body?.summary?.submissionId || null;

      if (!submissionId) {
        setSubmitMessage("Submitted, but couldn't fetch result id. Please check My Scores.");
        setSubmitting(false);
        return;
      }

      setSubmitMessage("Submitted successfully! Redirecting to result...");
      router.push(`/student/test/testScore?submissionId=${submissionId}`);
    } catch (err: any) {
      setSubmitMessage(err?.message || "Network Error");
      setSubmitting(false);
    }
  }

  function goNext() {
    stopAnyRecording();
    if (currentIndex < flatQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      window.scrollTo({ top: 0 });
    }
  }

  function goPrev() {
    stopAnyRecording();
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      window.scrollTo({ top: 0 });
    }
  }

  if (!testId)
    return (
      <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
        <div className="max-w-[1200px] w-full bg-white rounded-xl shadow-md border p-8 text-center">
          <div className="text-red-600 text-lg">No testId provided in URL.</div>
        </div>
      </div>
    );

  return (
    <div className="w-screen min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-white flex items-center justify-center p-8">
      <div className="max-w-[1200px] w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" style={{ minHeight: "80vh" }}>
        <div className="flex h-full">
          <div className="w-2/5 min-w-[420px] border-r border-slate-100 p-6">
            <div className="h-full sticky top-6 flex flex-col">
              <div className="mb-5">
                <div className="rounded-md p-4" style={{ background: "linear-gradient(180deg, rgba(239,246,255,1) 0%, rgba(245,243,255,1) 100%)" }}>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-md">
                      {test?.type === "reading" ? <BookOpen className="w-6 h-6 text-indigo-700" /> : test?.type === "listening" ? <Headphones className="w-6 h-6 text-indigo-700" /> : test?.type === "writing" ? <Pen className="w-6 h-6 text-indigo-700" /> : <Mic className="w-6 h-6 text-indigo-700" />}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Test</div>
                      <div className="text-lg font-semibold text-slate-800">{test?.title || "Test"}</div>
                      {typeof test?.timeLimitMinutes === "number" && test?.timeLimitMinutes > 0 && <div className="text-sm text-slate-500 mt-1">Time limit: {test?.timeLimitMinutes} minutes</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {loading && (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                )}

                {error && <div className="text-red-600">{error}</div>}

                {!loading && !error && test && flatQuestions.length > 0 && (
                  <div className="space-y-6">
                    {renderLeftForCurrent(flatQuestions[currentIndex].q)}
                  </div>
                )}

                {!loading && !error && test && flatQuestions.length === 0 && <div className="text-slate-600">No content available.</div>}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">Question {flatQuestions.length ? `${currentIndex + 1} / ${flatQuestions.length}` : "0 / 0"}</div>
                  <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-indigo-500" style={{ width: `${flatQuestions.length ? ((currentIndex + 1) / flatQuestions.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-3/5 p-8 overflow-auto">
            <div className="max-w-[760px] mx-auto">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500">Question</div>
                    <div className="text-2xl font-semibold text-slate-800 mt-2">
                      {flatQuestions[currentIndex]?.q?.questionType === "writing" || flatQuestions[currentIndex]?.q?.questionType === "speaking"
                        ? `Task ${currentIndex + 1}`
                        : `Q${currentIndex + 1}`}
                    </div>
                  </div>

                  <div className="text-sm text-slate-600">
                    Marks <div className="font-medium text-slate-700">{flatQuestions[currentIndex]?.q?.marks ?? "-"}</div>
                  </div>
                </div>
              </div>

              <div>
                {!loading && !error && test && flatQuestions.length > 0 && (
                  <Card className="p-6 rounded-md shadow-sm border border-slate-100">
                    {renderRightForCurrent(flatQuestions[currentIndex].q, flatQuestions[currentIndex].idx)}
                  </Card>
                )}

                {!loading && !error && test && flatQuestions.length === 0 && <div className="text-slate-600">No questions available.</div>}
              </div>

              <div className="mt-6 sticky bottom-6 bg-transparent pt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Button type="button" size="sm" onClick={goPrev} disabled={currentIndex === 0} className="mr-3 rounded-md bg-white border border-slate-200 px-4 py-2">
                      Previous
                    </Button>
                    <Button type="button" size="sm" onClick={goNext} disabled={currentIndex >= flatQuestions.length - 1} className="rounded-md bg-indigo-600 text-white px-4 py-2">
                      Next
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-600">{submitMessage ? submitMessage : "Ready to submit when finished"}</div>
                    <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting} className="rounded-md bg-indigo-700 text-white px-4 py-2">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
