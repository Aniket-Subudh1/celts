"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
//import { StorageInfo } from "./StorageInfo";

type Option = { text: string };

// ---------- MATCH / MCQ QUESTION TYPES ----------

type BaseChoiceQuestion = {
  kind: "mcq" | "match";
  prompt: string;
  marks?: number;
  explanation?: string;
};

type McqQuestion = BaseChoiceQuestion & {
  kind: "mcq";
  options: Option[];
  correctIndex: number;
};

type MatchQuestion = BaseChoiceQuestion & {
  kind: "match";
  leftItems: string[]; // a, b, c...
  rightItems: string[]; // i, ii, iii...
  options: Option[]; // combinations "a-i, b-iii, c-ii"
  correctIndex: number;
};

type ChoiceQuestion = McqQuestion | MatchQuestion;

// ---------- WRITING & SPEAKING TYPES ----------

type QuestionWriting = {
  questionType: "writing";
  prompt: string;
  writingType?: string;
  wordLimit?: number;
  charLimit?: number;
  marks?: number;
  explanation?: string;
  imageUrl?: string | null;
};

type QuestionSpeaking = {
  questionType: "speaking";
  prompt: string;
  speakingMode?: "audio" | "video" | "oral";
  recordLimitSeconds?: number;
  marks?: number;
  explanation?: string;
  imageUrl?: string | null;
};

type Question = QuestionWriting | QuestionSpeaking;

// ---------- BLOCK TYPES ----------

type ReadingBlock = {
  id: string;
  passage: string;
  questions: ChoiceQuestion[];
};

type ListeningBlock = {
  id: string;
  audioUrl: string;
  listenLimit?: number;
  questions: ChoiceQuestion[];
};

// Helpers
function createDefaultMcq(): McqQuestion {
  return {
    kind: "mcq",
    prompt: "",
    options: [{ text: "" }, { text: "" }],
    correctIndex: 0,
    marks: 1
  };
}

function createDefaultMatch(): MatchQuestion {
  return {
    kind: "match",
    prompt: "",
    leftItems: ["", "", ""], // a, b, c
    rightItems: ["", "", ""], // i, ii, iii
    options: [{ text: "" }, { text: "" }, { text: "" }], // 3 options to start
    correctIndex: 0,
    marks: 1
  };
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];

export default function TestCreateForm() {
  const [type, setType] = useState<"reading" | "listening" | "writing" | "speaking">("reading");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  const [readingBlocks, setReadingBlocks] = useState<ReadingBlock[]>([]);
  const [listeningBlocks, setListeningBlocks] = useState<ListeningBlock[]>([]);

  const [questions, setQuestions] = useState<Question[]>([
    {
      questionType: "writing",
      prompt: "",
      writingType: "story",
      wordLimit: 200,
      marks: 5,
      imageUrl: null
    }
  ]);

  // For image uploads per writing/speaking question (indexed by question index)
  const [questionImageFiles, setQuestionImageFiles] = useState<(File | null)[]>([null]);
  const [questionImageUploadState, setQuestionImageUploadState] = useState<
    { uploading: boolean; error?: string | null; successMessage?: string }[]
  >([{ uploading: false, error: null }]);

  const [listeningFiles, setListeningFiles] = useState<Record<string, File | null>>({});
  const [listeningUploadState, setListeningUploadState] = useState<
    Record<string, { uploading: boolean; error?: string | null; successMessage?: string }>
  >({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function resetQuestionImageStateForCount(count: number) {
    setQuestionImageFiles(Array.from({ length: count }, () => null));
    setQuestionImageUploadState(
      Array.from({ length: count }, () => ({ uploading: false, error: null }))
    );
  }

  // ---------- TYPE SWITCH RESET ----------

  function hardResetAfterTypeChange(newType: "reading" | "listening" | "writing" | "speaking") {
    setType(newType);
    setTitle("");
    setDescription("");
    setTimeLimitMinutes(0);
    setStartTime("");
    setEndTime("");
    setReadingBlocks([]);
    setListeningBlocks([]);
    setListeningFiles({});
    setListeningUploadState({});

    if (newType === "writing") {
      setQuestions([
        {
          questionType: "writing",
          prompt: "",
          writingType: "story",
          wordLimit: 200,
          marks: 5,
          imageUrl: null
        }
      ]);
      resetQuestionImageStateForCount(1);
    } else if (newType === "speaking") {
      setQuestions([
        {
          questionType: "speaking",
          prompt: "",
          speakingMode: "audio",
          recordLimitSeconds: 60,
          marks: 5,
          imageUrl: null
        }
      ]);
      resetQuestionImageStateForCount(1);
    } else {
      setQuestions([]);
      resetQuestionImageStateForCount(0);
    }
  }

  // ---------- READING BLOCKS ----------

  function addReadingBlock() {
    setReadingBlocks(prev => [
      ...prev,
      {
        id: `read-${Date.now()}-${prev.length}`,
        passage: "",
        questions: [createDefaultMcq()]
      }
    ]);
  }

  function updateReadingBlock(idx: number, patch: Partial<ReadingBlock>) {
    setReadingBlocks(prev => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeReadingBlock(idx: number) {
    if (!confirm("Remove this passage and all its questions?")) return;
    setReadingBlocks(prev => prev.filter((_, i) => i !== idx));
  }

  function addMcqToReadingBlock(blockIdx: number) {
    setReadingBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: [...b.questions, createDefaultMcq()] } : b
      )
    );
  }

  function addMatchToReadingBlock(blockIdx: number) {
    setReadingBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: [...b.questions, createDefaultMatch()] } : b
      )
    );
  }

  function updateQuestionInReadingBlock(blockIdx: number, qIdx: number, q: ChoiceQuestion) {
    setReadingBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, questions: b.questions.map((qq, j) => (j === qIdx ? q : qq)) }
          : b
      )
    );
  }

  function removeQuestionFromReadingBlock(blockIdx: number, qIdx: number) {
    setReadingBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: b.questions.filter((_, j) => j !== qIdx) } : b
      )
    );
  }

  // ---------- LISTENING BLOCKS ----------

  function addListeningBlock() {
    setListeningBlocks(prev => [
      ...prev,
      {
        id: `listen-${Date.now()}-${prev.length}`,
        audioUrl: "",
        listenLimit: 1,
        questions: [createDefaultMcq()]
      }
    ]);
  }

  function updateListeningBlock(idx: number, patch: Partial<ListeningBlock>) {
    setListeningBlocks(prev => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeListeningBlock(idx: number) {
    if (!confirm("Remove this audio and all associated questions?")) return;
    const blockId = listeningBlocks[idx]?.id;
    setListeningBlocks(prev => prev.filter((_, i) => i !== idx));
    if (blockId) {
      setListeningFiles(prev => {
        const c = { ...prev };
        delete c[blockId];
        return c;
      });
      setListeningUploadState(prev => {
        const c = { ...prev };
        delete c[blockId];
        return c;
      });
    }
  }

  function addMcqToListeningBlock(blockIdx: number) {
    setListeningBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: [...b.questions, createDefaultMcq()] } : b
      )
    );
  }

  function addMatchToListeningBlock(blockIdx: number) {
    setListeningBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: [...b.questions, createDefaultMatch()] } : b
      )
    );
  }

  function updateQuestionInListeningBlock(blockIdx: number, qIdx: number, q: ChoiceQuestion) {
    setListeningBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, questions: b.questions.map((qq, j) => (j === qIdx ? q : qq)) }
          : b
      )
    );
  }

  function removeQuestionFromListeningBlock(blockIdx: number, qIdx: number) {
    setListeningBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, questions: b.questions.filter((_, j) => j !== qIdx) } : b
      )
    );
  }

  // ---------- LISTENING AUDIO UPLOAD ----------

  function handleListeningFileSelected(blockId: string, file?: File) {
    setListeningFiles(prev => ({ ...prev, [blockId]: file || null }));
    setListeningUploadState(prev => ({ ...prev, [blockId]: { uploading: false, error: null } }));
  }

  async function uploadAudioFileForBlock(blockId: string) {
    const file = listeningFiles[blockId];
    if (!file) {
      setListeningUploadState(prev => ({
        ...prev,
        [blockId]: { uploading: false, error: "Choose a file first" }
      }));
      return;
    }

    setListeningUploadState(prev => ({
      ...prev,
      [blockId]: { uploading: true, error: null }
    }));

    try {
      const form = new FormData();
      form.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      const fullUrl = API_BASE + "/media/upload";

      const token = typeof window !== "undefined" ? localStorage.getItem("celts_token") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(fullUrl, {
        method: "POST",
        body: form,
        headers,
        credentials: "include"
      });

      const text = await resp.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!resp.ok) {
        setListeningUploadState(prev => ({
          ...prev,
          [blockId]: {
            uploading: false,
            error: parsed?.message || parsed?.error || `Upload failed (${resp.status})`
          }
        }));
        return;
      }

      const returnedUrl = parsed?.url || parsed?.audioUrl || parsed?.data?.url || null;
      if (!returnedUrl) {
        setListeningUploadState(prev => ({
          ...prev,
          [blockId]: {
            uploading: false,
            error: "Upload succeeded but no URL returned."
          }
        }));
        return;
      }

      setListeningBlocks(prev =>
        prev.map(b => (b.id === blockId ? { ...b, audioUrl: returnedUrl } : b))
      );

      const provider = parsed?.provider || "unknown";
      const successMessage =
        provider === "S3" ? "Uploaded to cloud storage" : "Uploaded to local storage";

      setListeningUploadState(prev => ({
        ...prev,
        [blockId]: {
          uploading: false,
          error: null,
          successMessage
        }
      }));

      setTimeout(() => {
        setListeningUploadState(prev => ({
          ...prev,
          [blockId]: { ...prev[blockId], successMessage: undefined }
        }));
      }, 3000);
    } catch (err: any) {
      setListeningUploadState(prev => ({
        ...prev,
        [blockId]: {
          uploading: false,
          error: err?.message || "Upload failed"
        }
      }));
    }
  }

  // ---------- QUESTION IMAGE UPLOAD (WRITING/SPEAKING) ----------

  function handleQuestionImageFileSelected(idx: number, file?: File) {
    setQuestionImageFiles(prev => {
      const next = [...prev];
      next[idx] = file || null;
      return next;
    });
    setQuestionImageUploadState(prev => {
      const next = [...prev];
      next[idx] = { uploading: false, error: null };
      return next;
    });
  }

  async function uploadImageForQuestion(idx: number) {
    const file = questionImageFiles[idx];
    if (!file) {
      setQuestionImageUploadState(prev => {
        const next = [...prev];
        next[idx] = { uploading: false, error: "Choose an image file first" };
        return next;
      });
      return;
    }

    setQuestionImageUploadState(prev => {
      const next = [...prev];
      next[idx] = { uploading: true, error: null };
      return next;
    });

    try {
      const form = new FormData();
      form.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      const fullUrl = API_BASE + "/media/upload";

      const token = typeof window !== "undefined" ? localStorage.getItem("celts_token") : null;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(fullUrl, {
        method: "POST",
        body: form,
        headers,
        credentials: "include"
      });

      const text = await resp.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!resp.ok) {
        setQuestionImageUploadState(prev => {
          const next = [...prev];
          next[idx] = {
            uploading: false,
            error: parsed?.message || parsed?.error || `Upload failed (${resp.status})`
          };
          return next;
        });
        return;
      }

      const returnedUrl = parsed?.url || parsed?.audioUrl || parsed?.data?.url || null;
      if (!returnedUrl) {
        setQuestionImageUploadState(prev => {
          const next = [...prev];
          next[idx] = {
            uploading: false,
            error: "Upload succeeded but no URL returned."
          };
          return next;
        });
        return;
      }

      setQuestions(prev =>
        prev.map((q, i) => {
          if (i !== idx) return q;
          if (q.questionType === "writing") {
            return { ...(q as QuestionWriting), imageUrl: returnedUrl };
          } else if (q.questionType === "speaking") {
            return { ...(q as QuestionSpeaking), imageUrl: returnedUrl };
          }
          return q;
        })
      );

      const provider = parsed?.provider || "unknown";
      const successMessage =
        provider === "S3" ? "Image uploaded to cloud storage" : "Image uploaded to local storage";

      setQuestionImageUploadState(prev => {
        const next = [...prev];
        next[idx] = { uploading: false, error: null, successMessage };
        return next;
      });

      setTimeout(() => {
        setQuestionImageUploadState(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], successMessage: undefined };
          return next;
        });
      }, 3000);
    } catch (err: any) {
      setQuestionImageUploadState(prev => {
        const next = [...prev];
        next[idx] = {
          uploading: false,
          error: err?.message || "Upload failed"
        };
        return next;
      });
    }
  }

  // ---------- WRITING/SPEAKING QUESTIONS ----------

  function updateQuestion(idx: number, q: Question) {
    setQuestions(prev => prev.map((p, i) => (i === idx ? q : p)));
  }

  function addQuestionOfType(qt: Question["questionType"]) {
    if (qt === "writing") {
      setQuestions(prev => [
        ...prev,
        {
          questionType: "writing",
          prompt: "",
          writingType: "story",
          wordLimit: 200,
          marks: 5,
          imageUrl: null
        }
      ]);
    } else {
      setQuestions(prev => [
        ...prev,
        {
          questionType: "speaking",
          prompt: "",
          speakingMode: "audio",
          recordLimitSeconds: 60,
          marks: 5,
          imageUrl: null
        }
      ]);
    }

    setQuestionImageFiles(prev => [...prev, null]);
    setQuestionImageUploadState(prev => [...prev, { uploading: false, error: null }]);
  }

  function removeQuestion(idx: number) {
    if (!confirm("Remove this question?")) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setQuestionImageFiles(prev => prev.filter((_, i) => i !== idx));
    setQuestionImageUploadState(prev => prev.filter((_, i) => i !== idx));
  }

  // ---------- SUBMIT ----------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const trimmedTitle = (title || "").trim();
    if (!trimmedTitle) {
      setMessage("Title is required.");
      return;
    }

    const payload: any = {
      title: trimmedTitle,
      description,
      type,
      timeLimitMinutes,
      startTime: startTime ? new Date(startTime).toISOString() : null,
      endTime: endTime ? new Date(endTime).toISOString() : null,
      published: false
    };

    // ===== READING =====
    if (type === "reading") {
      if (readingBlocks.length === 0) {
        setMessage("Add at least one passage.");
        return;
      }

      for (let bIdx = 0; bIdx < readingBlocks.length; bIdx++) {
        const block = readingBlocks[bIdx];
        if (!block.passage.trim()) {
          setMessage(`Passage ${bIdx + 1} is empty.`);
          return;
        }
        if (block.questions.length === 0) {
          setMessage(`Passage ${bIdx + 1} has no questions.`);
          return;
        }
        for (let qIdx = 0; qIdx < block.questions.length; qIdx++) {
          const q = block.questions[qIdx];
          if (!q.prompt.trim()) {
            setMessage(`Passage ${bIdx + 1} – Question ${qIdx + 1} missing prompt.`);
            return;
          }

          if (q.kind === "mcq") {
            const mcq = q as McqQuestion;
            if (mcq.options.length < 2) {
              setMessage(
                `Passage ${bIdx + 1} – Question ${qIdx + 1} (MCQ) must have at least 2 options.`
              );
              return;
            }
          } else {
            const mq = q as MatchQuestion;
            if (
              !mq.leftItems ||
              !mq.rightItems ||
              mq.leftItems.length < 2 ||
              mq.rightItems.length < 2 ||
              mq.leftItems.length !== mq.rightItems.length
            ) {
              setMessage(
                `Passage ${bIdx + 1} – Question ${qIdx + 1} (Match) must have equal left/right items (at least 2).`
              );
              return;
            }
            for (let i = 0; i < mq.leftItems.length; i++) {
              if (!mq.leftItems[i].trim()) {
                setMessage(
                  `Passage ${bIdx + 1} – Question ${qIdx + 1} (Match) left item ${
                    i + 1
                  } is empty.`
                );
                return;
              }
              if (!mq.rightItems[i].trim()) {
                setMessage(
                  `Passage ${bIdx + 1} – Question ${qIdx + 1} (Match) right item ${
                    i + 1
                  } is empty.`
                );
                return;
              }
            }
            if (mq.options.length < 3 || mq.options.length > 4) {
              setMessage(
                `Passage ${bIdx + 1} – Question ${qIdx + 1} (Match) must have 3–4 options.`
              );
              return;
            }
            if (
              mq.correctIndex == null ||
              mq.correctIndex < 0 ||
              mq.correctIndex >= mq.options.length
            ) {
              setMessage(
                `Passage ${bIdx + 1} – Question ${qIdx + 1} (Match) must have a valid correct option selected.`
              );
              return;
            }
          }
        }
      }

      const readingSections = readingBlocks.map((b, idx) => ({
        id: b.id,
        title: `Passage ${idx + 1}`,
        passage: b.passage
      }));

      const flatQuestions = readingBlocks.flatMap(b =>
        b.questions.map(q => {
          if (q.kind === "mcq") {
            const mcq = q as McqQuestion;
            return {
              questionType: "mcq",
              prompt: mcq.prompt,
              options: mcq.options.map(o => ({ text: o.text })),
              correctIndex: mcq.correctIndex,
              marks: mcq.marks || 1,
              explanation: mcq.explanation || "",
              sectionId: b.id
            };
          } else {
            const mq = q as MatchQuestion;
            return {
              questionType: "match",
              prompt: mq.prompt,
              leftItems: mq.leftItems,
              rightItems: mq.rightItems,
              options: mq.options.map(o => ({ text: o.text })),
              correctIndex: mq.correctIndex,
              marks: mq.marks || 1,
              explanation: mq.explanation || "",
              sectionId: b.id
            };
          }
        })
      );

      payload.readingSections = readingSections;
      payload.questions = flatQuestions;
    }

    // ===== LISTENING =====
    if (type === "listening") {
      if (listeningBlocks.length === 0) {
        setMessage("Add at least one audio block.");
        return;
      }

      for (let bIdx = 0; bIdx < listeningBlocks.length; bIdx++) {
        const block = listeningBlocks[bIdx];
        if (!block.audioUrl.trim()) {
          setMessage(`Audio ${bIdx + 1} URL is empty (upload file).`);
          return;
        }
        if (block.questions.length === 0) {
          setMessage(`Audio ${bIdx + 1} has no questions.`);
          return;
        }
        for (let qIdx = 0; qIdx < block.questions.length; qIdx++) {
          const q = block.questions[qIdx];
          if (!q.prompt.trim()) {
            setMessage(`Audio ${bIdx + 1} – Question ${qIdx + 1} missing prompt.`);
            return;
          }

          if (q.kind === "mcq") {
            const mcq = q as McqQuestion;
            if (mcq.options.length < 2) {
              setMessage(
                `Audio ${bIdx + 1} – Question ${qIdx + 1} (MCQ) must have at least 2 options.`
              );
              return;
            }
          } else {
            const mq = q as MatchQuestion;
            if (
              !mq.leftItems ||
              !mq.rightItems ||
              mq.leftItems.length < 2 ||
              mq.rightItems.length < 2 ||
              mq.leftItems.length !== mq.rightItems.length
            ) {
              setMessage(
                `Audio ${bIdx + 1} – Question ${qIdx + 1} (Match) must have equal left/right items (at least 2).`
              );
              return;
            }
            for (let i = 0; i < mq.leftItems.length; i++) {
              if (!mq.leftItems[i].trim()) {
                setMessage(
                  `Audio ${bIdx + 1} – Question ${qIdx + 1} (Match) left item ${
                    i + 1
                  } is empty.`
                );
                return;
              }
              if (!mq.rightItems[i].trim()) {
                setMessage(
                  `Audio ${bIdx + 1} – Question ${qIdx + 1} (Match) right item ${
                    i + 1
                  } is empty.`
                );
                return;
              }
            }
            if (mq.options.length < 3 || mq.options.length > 4) {
              setMessage(
                `Audio ${bIdx + 1} – Question ${qIdx + 1} (Match) must have 3–4 options.`
              );
              return;
            }
            if (
              mq.correctIndex == null ||
              mq.correctIndex < 0 ||
              mq.correctIndex >= mq.options.length
            ) {
              setMessage(
                `Audio ${bIdx + 1} – Question ${qIdx + 1} (Match) must have a valid correct option selected.`
              );
              return;
            }
          }
        }
      }

      const listeningSections = listeningBlocks.map((b, idx) => ({
        id: b.id,
        title: `Audio ${idx + 1}`,
        audioUrl: b.audioUrl,
        listenLimit: b.listenLimit ?? 1
      }));

      const flatQuestions = listeningBlocks.flatMap(b =>
        b.questions.map(q => {
          if (q.kind === "mcq") {
            const mcq = q as McqQuestion;
            return {
              questionType: "mcq",
              prompt: mcq.prompt,
              options: mcq.options.map(o => ({ text: o.text })),
              correctIndex: mcq.correctIndex,
              marks: mcq.marks || 1,
              explanation: mcq.explanation || "",
              sectionId: b.id
            };
          } else {
            const mq = q as MatchQuestion;
            return {
              questionType: "match",
              prompt: mq.prompt,
              leftItems: mq.leftItems,
              rightItems: mq.rightItems,
              options: mq.options.map(o => ({ text: o.text })),
              correctIndex: mq.correctIndex,
              marks: mq.marks || 1,
              explanation: mq.explanation || "",
              sectionId: b.id
            };
          }
        })
      );

      payload.listeningSections = listeningSections;
      payload.questions = flatQuestions;
    }

    // ===== WRITING / SPEAKING =====
    if (type === "writing" || type === "speaking") {
      if (questions.length === 0) {
        setMessage("Add at least one question.");
        return;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.prompt.trim()) {
          setMessage(`Question ${i + 1} missing prompt.`);
          return;
        }
      }

      payload.questions = questions.map(q => {
        if (q.questionType === "writing") {
          const w = q as QuestionWriting;
          return {
            questionType: "writing",
            prompt: w.prompt,
            writingType: w.writingType || "story",
            wordLimit: w.wordLimit,
            charLimit: w.charLimit,
            marks: w.marks || 5,
            explanation: w.explanation || "",
            imageUrl: w.imageUrl || null
          };
        } else {
          const s = q as QuestionSpeaking;
          return {
            questionType: "speaking",
            prompt: s.prompt,
            speakingMode: s.speakingMode || "audio",
            recordLimitSeconds: s.recordLimitSeconds,
            marks: s.marks || 5,
            explanation: s.explanation || "",
            imageUrl: s.imageUrl || null
          };
        }
      });
    }

    setLoading(true);

    try {
      const res = await api.apiPost("/teacher/tests", payload);
      setLoading(false);

      if (!res.ok) {
        setMessage(
          res.error?.message || res.data?.message || `Server responded ${res.status}`
        );
        return;
      }

      setMessage("Test created successfully");
      setType("reading");
      setTitle("");
      setDescription("");
      setReadingBlocks([]);
      setListeningBlocks([]);
      setListeningFiles({});
      setListeningUploadState({});
      setQuestions([
        {
          questionType: "writing",
          prompt: "",
          writingType: "story",
          wordLimit: 200,
          marks: 5,
          imageUrl: null
        }
      ]);
      resetQuestionImageStateForCount(1);
    } catch (err: any) {
      setLoading(false);
      setMessage(err?.message || "Network error");
    }
  }

  // ---------- EDITORS ----------

  function renderMcqEditor(
    q: McqQuestion,
    blockIdx: number,
    qIdx: number,
    onChange: (updated: McqQuestion) => void,
    onRemove: () => void
  ) {
    return (
      <div
        className="border border-slate-200 rounded-lg p-4 mb-4 bg-white shadow-sm"
        key={qIdx}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            MCQ
          </span>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Question prompt
          </label>
          <Input
            value={q.prompt}
            onChange={e => onChange({ ...q, prompt: e.target.value })}
            className="bg-slate-50"
          />
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Options (select the correct one)
          </label>

          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-3">
                <input
                  type="radio"
                  checked={q.correctIndex === oi}
                  onChange={() => onChange({ ...q, correctIndex: oi })}
                  className="h-4 w-4 text-indigo-600"
                />
                <Input
                  value={opt.text}
                  onChange={e => {
                    const newOpts = q.options.map((o, idx) =>
                      idx === oi ? { text: e.target.value } : o
                    );
                    onChange({ ...q, options: newOpts });
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={q.options.length <= 2}
                  onClick={() => {
                    const newOpts = q.options.filter((_, idx) => idx !== oi);
                    const newCorrectIndex = Math.min(
                      q.correctIndex,
                      newOpts.length - 1
                    );
                    onChange({
                      ...q,
                      options: newOpts,
                      correctIndex: newCorrectIndex
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}

            <div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  onChange({ ...q, options: [...q.options, { text: "" }] })
                }
              >
                Add option
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Marks
            </label>
            <Input
              type="number"
              value={q.marks ?? 1}
              onChange={e =>
                onChange({ ...q, marks: Number(e.target.value || 1) })
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Explanation (optional)
            </label>
            <Input
              value={q.explanation || ""}
              onChange={e =>
                onChange({ ...q, explanation: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            Remove question
          </Button>
        </div>
      </div>
    );
  }

  function renderMatchEditor(
    q: MatchQuestion,
    blockIdx: number,
    qIdx: number,
    onChange: (updated: MatchQuestion) => void,
    onRemove: () => void
  ) {
    const minItems = 2;
    const maxItems = 8;
    const minOptions = 3;
    const maxOptions = 4;

    return (
      <div
        className="border border-slate-200 rounded-lg p-4 mb-4 bg-white shadow-sm"
        key={qIdx}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Match the following
          </span>
          <span className="text-[10px] text-slate-500">
            Fill left (a,b,c,...) and right (i,ii,iii,...) and add 3–4 combination options.
          </span>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Question prompt
          </label>
          <Input
            value={q.prompt}
            onChange={e => onChange({ ...q, prompt: e.target.value })}
            className="bg-slate-50"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left side (keys a, b, c...) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">
                Left side (keys: a, b, c, ...)
              </span>
            </div>
            <div className="space-y-2">
              {q.leftItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="text-xs w-5 text-slate-500">
                    {String.fromCharCode(97 + idx)}.
                  </div>
                  <Input
                    value={item}
                    onChange={e => {
                      const leftItems = q.leftItems.map((v, i) =>
                        i === idx ? e.target.value : v
                      );
                      onChange({ ...q, leftItems });
                    }}
                    placeholder={`Left item ${idx + 1}`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={q.leftItems.length <= minItems}
                    onClick={() => {
                      const leftItems = q.leftItems.filter((_, i) => i !== idx);
                      const rightItems = q.rightItems.filter((_, i) => i !== idx);
                      onChange({ ...q, leftItems, rightItems });
                    }}
                  >
                    X
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                disabled={q.leftItems.length >= maxItems}
                onClick={() =>
                  onChange({
                    ...q,
                    leftItems: [...q.leftItems, ""],
                    rightItems: [...q.rightItems, ""]
                  })
                }
              >
                Add row
              </Button>
            </div>
          </div>

          {/* Right side (values i, ii, iii...) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700">
                Right side (values: i, ii, iii, ...)
              </span>
            </div>
            <div className="space-y-2">
              {q.rightItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="text-xs w-7 text-slate-500">
                    {ROMAN[idx] || `${idx + 1}`}.
                  </div>
                  <Input
                    value={item}
                    onChange={e => {
                      const rightItems = q.rightItems.map((v, i) =>
                        i === idx ? e.target.value : v
                      );
                      onChange({ ...q, rightItems });
                    }}
                    placeholder={`Right item ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Combination options */}
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-700 block mb-2">
            Options (3–4 combinations like &quot;a-i, b-iii, c-ii&quot;)
          </label>

          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-3">
                <input
                  type="radio"
                  className="h-4 w-4"
                  checked={q.correctIndex === oi}
                  onChange={() => onChange({ ...q, correctIndex: oi })}
                />
                <Input
                  value={opt.text}
                  onChange={e => {
                    const options = q.options.map((o, i) =>
                      i === oi ? { text: e.target.value } : o
                    );
                    onChange({ ...q, options });
                  }}
                  className="flex-1"
                  placeholder={`Combination ${oi + 1} (e.g. a-i, b-iii, c-ii)`}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={q.options.length <= minOptions}
                  onClick={() => {
                    const options = q.options.filter((_, i) => i !== oi);
                    const correctIndex =
                      q.correctIndex >= options.length ? 0 : q.correctIndex;
                    onChange({ ...q, options, correctIndex });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              disabled={q.options.length >= maxOptions}
              onClick={() =>
                onChange({
                  ...q,
                  options: [...q.options, { text: "" }]
                })
              }
            >
              Add option
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Marks
            </label>
            <Input
              type="number"
              value={q.marks ?? 1}
              onChange={e =>
                onChange({ ...q, marks: Number(e.target.value || 1) })
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-2">
              Explanation (optional)
            </label>
            <Input
              value={q.explanation || ""}
              onChange={e =>
                onChange({ ...q, explanation: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            Remove question
          </Button>
        </div>
      </div>
    );
  }

  // ---------- RENDER ----------

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Create Test</h1>
              <p className="mt-1 text-sm text-slate-500 max-w-2xl">
                Build tests with strict question-type control.
              </p>
            </div>
            {/* <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm font-medium text-slate-800">Draft</div>
              </div>
              <Button type="submit" disabled={loading} className="whitespace-nowrap">
                {loading ? "Saving..." : "Create Test"}
              </Button>
            </div> */}
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT SIDE */}
          <div className="lg:col-span-2 space-y-6">
            {/* GENERAL */}
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-medium text-slate-900 mb-4">General</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-700 block mb-2">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                {/* TYPE */}
                <div>
                  <label className="text-xs text-slate-700 block mb-2">Type</label>
                  <select
                    value={type}
                    onChange={e => hardResetAfterTypeChange(e.target.value as any)}
                    className="w-full p-2 border rounded-md bg-white"
                  >
                    <option value="reading">Reading</option>
                    <option value="listening">Listening</option>
                    <option value="writing">Writing</option>
                    <option value="speaking">Speaking</option>
                  </select>
                </div>

                {/* TIME LIMIT */}
                <div className="md:col-span-1">
                  <label className="text-xs text-slate-700 block mb-2">
                    Time limit (minutes)
                  </label>
                  <Input
                    type="number"
                    value={timeLimitMinutes}
                    onChange={e =>
                      setTimeLimitMinutes(Number(e.target.value || 0))
                    }
                  />
                </div>

                {/* START TIME */}
                <div className="md:col-span-1">
                  <label className="text-xs text-slate-700 block mb-2">
                    Start Time (optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>

                {/* END TIME */}
                <div className="md:col-span-1">
                  <label className="text-xs text-slate-700 block mb-2">
                    End Time (optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>

                {/* DESCRIPTION */}
                <div className="md:col-span-3">
                  <label className="text-xs text-slate-700 block mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-md h-24 text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            {/* READING BLOCKS */}
            {type === "reading" && (
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium text-slate-900">
                    Passages & Questions
                  </h3>
                  <Button type="button" onClick={addReadingBlock}>
                    Add Passage
                  </Button>
                </div>

                {readingBlocks.length === 0 && (
                  <div className="text-sm text-slate-500">
                    No passages yet. Click &quot;Add Passage&quot;.
                  </div>
                )}

                {readingBlocks.map((block, bIdx) => (
                  <section
                    key={block.id}
                    className="border border-slate-100 rounded-lg p-4 bg-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          Passage {bIdx + 1}
                        </div>
                        <div className="text-xs text-slate-500">
                          Provide the passage text below
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeReadingBlock(bIdx)}
                      >
                        Remove Passage
                      </Button>
                    </div>

                    <label className="text-xs text-slate-700 block mb-2">
                      Passage text
                    </label>
                    <textarea
                      value={block.passage}
                      onChange={e =>
                        updateReadingBlock(bIdx, { passage: e.target.value })
                      }
                      className="w-full p-3 border border-slate-200 rounded-md h-36 text-sm"
                    />

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-slate-800">
                          Questions for this passage
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addMcqToReadingBlock(bIdx)}
                          >
                            Add MCQ
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addMatchToReadingBlock(bIdx)}
                          >
                            Add Match
                          </Button>
                        </div>
                      </div>

                      {block.questions.map((q, qIdx) =>
                        q.kind === "mcq"
                          ? renderMcqEditor(
                              q as McqQuestion,
                              bIdx,
                              qIdx,
                              updated =>
                                updateQuestionInReadingBlock(
                                  bIdx,
                                  qIdx,
                                  updated
                                ),
                              () =>
                                removeQuestionFromReadingBlock(
                                  bIdx,
                                  qIdx
                                )
                            )
                          : renderMatchEditor(
                              q as MatchQuestion,
                              bIdx,
                              qIdx,
                              updated =>
                                updateQuestionInReadingBlock(
                                  bIdx,
                                  qIdx,
                                  updated
                                ),
                              () =>
                                removeQuestionFromReadingBlock(
                                  bIdx,
                                  qIdx
                                )
                            )
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* LISTENING BLOCKS */}
            {type === "listening" && (
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium text-slate-900">
                    Audios & Questions
                  </h3>
                <Button type="button" onClick={addListeningBlock}>
                    Add Audio
                  </Button>
                </div>

                {/* <StorageInfo /> */}

                {listeningBlocks.length === 0 && (
                  <div className="text-sm text-slate-500">
                    No audios yet. Click &quot;Add Audio&quot;.
                  </div>
                )}

                {listeningBlocks.map((block, bIdx) => {
                  const uploadState =
                    listeningUploadState[block.id] || {
                      uploading: false,
                      error: null
                    };
                  const selectedFile = listeningFiles[block.id] || null;

                  return (
                    <section
                      key={block.id}
                      className="border border-slate-100 rounded-lg p-4 bg-white"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            Audio {bIdx + 1}
                          </div>
                          <div className="text-xs text-slate-500">
                            Upload audio and add questions
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeListeningBlock(bIdx)}
                        >
                          Remove Audio
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-xs text-slate-700 block mb-2">
                            Audio URL (auto)
                          </label>
                          <Input
                            value={block.audioUrl}
                            readOnly
                            placeholder="Upload a file to set this URL"
                          />
                          {block.audioUrl && (
                            <audio
                              controls
                              src={block.audioUrl}
                              className="w-full mt-2"
                            />
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-700 block mb-2">
                            Listen limit
                          </label>
                          <Input
                            type="number"
                            value={block.listenLimit ?? ""}
                            onChange={e =>
                              updateListeningBlock(bIdx, {
                                listenLimit: e.target.value
                                  ? Number(e.target.value)
                                  : undefined
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="text-xs text-slate-700 block mb-2">
                          Upload audio
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="file"
                            accept="audio/*,video/*"
                            onChange={e =>
                              handleListeningFileSelected(
                                block.id,
                                e.target.files?.[0] || undefined
                              )
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={uploadState.uploading || !selectedFile}
                            onClick={() =>
                              uploadAudioFileForBlock(block.id)
                            }
                          >
                            {uploadState.uploading
                              ? "Uploading..."
                              : "Upload"}
                          </Button>
                          {selectedFile && (
                            <div className="text-sm text-slate-600">
                              {selectedFile.name}
                            </div>
                          )}
                        </div>
                        {uploadState.error && (
                          <div className="text-xs text-rose-600 mt-2">
                            {uploadState.error}
                          </div>
                        )}
                        {uploadState.successMessage && (
                          <div className="text-xs text-green-600 mt-2">
                            {uploadState.successMessage}
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-slate-800">
                            Questions for this audio
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => addMcqToListeningBlock(bIdx)}
                            >
                              Add MCQ
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => addMatchToListeningBlock(bIdx)}
                            >
                              Add Match
                            </Button>
                          </div>
                        </div>

                        {block.questions.map((q, qIdx) =>
                          q.kind === "mcq"
                            ? renderMcqEditor(
                                q as McqQuestion,
                                bIdx,
                                qIdx,
                                updated =>
                                  updateQuestionInListeningBlock(
                                    bIdx,
                                    qIdx,
                                    updated
                                  ),
                                () =>
                                  removeQuestionFromListeningBlock(
                                    bIdx,
                                    qIdx
                                  )
                              )
                            : renderMatchEditor(
                                q as MatchQuestion,
                                bIdx,
                                qIdx,
                                updated =>
                                  updateQuestionInListeningBlock(
                                    bIdx,
                                    qIdx,
                                    updated
                                  ),
                                () =>
                                  removeQuestionFromListeningBlock(
                                    bIdx,
                                    qIdx
                                  )
                              )
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {/* WRITING / SPEAKING */}
            {(type === "writing" || type === "speaking") && (
              <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium text-slate-900">Questions</h3>

                  <div className="flex gap-2">
                    {type === "writing" && (
                      <Button
                        type="button"
                        onClick={() => addQuestionOfType("writing")}
                      >
                        Add Writing
                      </Button>
                    )}
                    {type === "speaking" && (
                      <Button
                        type="button"
                        onClick={() => addQuestionOfType("speaking")}
                      >
                        Add Speaking
                      </Button>
                    )}
                  </div>
                </div>

                {questions.map((q, i) => {
                  const imgState =
                    questionImageUploadState[i] || {
                      uploading: false,
                      error: null
                    };
                  const selectedFile = questionImageFiles[i] || null;

                  return (
                    <div
                      key={i}
                      className="border border-slate-100 rounded-lg p-4 bg-white"
                    >
                      {/* Question header */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-700 block mb-2">
                            Question type
                          </label>
                          <select
                            disabled
                            value={q.questionType}
                            className="w-full p-2 border rounded-md bg-gray-100"
                          >
                            <option value={type}>{type}</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-slate-700 block mb-2">
                            Prompt
                          </label>
                          <Input
                            value={q.prompt}
                            onChange={e =>
                              updateQuestion(i, {
                                ...(q as any),
                                prompt: e.target.value
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Writing fields */}
                      {q.questionType === "writing" &&
                        (() => {
                          const wq = q as QuestionWriting;
                          return (
                            <>
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Writing type
                                  </label>
                                  <select
                                    value={wq.writingType}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...wq,
                                        writingType: e.target.value
                                      })
                                    }
                                    className="w-full p-2 border rounded-md"
                                  >
                                    <option value="story">Story</option>
                                    <option value="email">Email</option>
                                    <option value="letter">Letter</option>
                                    <option value="summary">Summary</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Word limit
                                  </label>
                                  <Input
                                    type="number"
                                    value={wq.wordLimit ?? ""}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...wq,
                                        wordLimit: e.target.value
                                          ? Number(e.target.value)
                                          : undefined
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Marks
                                  </label>
                                  <Input
                                    type="number"
                                    value={wq.marks ?? 5}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...wq,
                                        marks: Number(e.target.value || 1)
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Writing image upload */}
                              <div className="mt-4">
                                <label className="text-xs text-slate-700 block mb-2">
                                  Image (optional)
                                </label>
                                <Input
                                  value={wq.imageUrl || ""}
                                  onChange={e =>
                                    updateQuestion(i, {
                                      ...wq,
                                      imageUrl: e.target.value
                                    })
                                  }
                                  placeholder="Or paste an image URL"
                                />
                                {wq.imageUrl && (
                                  <img
                                    src={wq.imageUrl}
                                    alt="Writing prompt"
                                    className="mt-2 max-h-40 rounded-md border border-slate-200 object-contain"
                                  />
                                )}

                                <div className="mt-3 flex items-center gap-3">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e =>
                                      handleQuestionImageFileSelected(
                                        i,
                                        e.target.files?.[0] || undefined
                                      )
                                    }
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={imgState.uploading || !selectedFile}
                                    onClick={() => uploadImageForQuestion(i)}
                                  >
                                    {imgState.uploading
                                      ? "Uploading..."
                                      : "Upload image"}
                                  </Button>
                                  {selectedFile && (
                                    <span className="text-xs text-slate-600">
                                      {selectedFile.name}
                                    </span>
                                  )}
                                </div>
                                {imgState.error && (
                                  <div className="text-xs text-rose-600 mt-1">
                                    {imgState.error}
                                  </div>
                                )}
                                {imgState.successMessage && (
                                  <div className="text-xs text-green-600 mt-1">
                                    {imgState.successMessage}
                                  </div>
                                )}
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Students will see this image and then write according
                                  to the prompt.
                                </p>
                              </div>
                            </>
                          );
                        })()}

                      {/* Speaking fields */}
                      {q.questionType === "speaking" &&
                        (() => {
                          const sq = q as QuestionSpeaking;
                          return (
                            <>
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Speaking mode
                                  </label>
                                  <select
                                    value={sq.speakingMode}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...sq,
                                        speakingMode: e.target.value as any
                                      })
                                    }
                                    className="w-full p-2 border rounded-md"
                                  >
                                    <option value="audio">Record audio</option>
                                    <option value="video">Record video</option>
                                    <option value="oral">Oral (live)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Record limit (seconds)
                                  </label>
                                  <Input
                                    type="number"
                                    value={sq.recordLimitSeconds ?? 60}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...sq,
                                        recordLimitSeconds: Number(
                                          e.target.value || 0
                                        )
                                      })
                                    }
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-slate-700 block mb-2">
                                    Marks
                                  </label>
                                  <Input
                                    type="number"
                                    value={sq.marks ?? 5}
                                    onChange={e =>
                                      updateQuestion(i, {
                                        ...sq,
                                        marks: Number(e.target.value || 1)
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Speaking image upload */}
                              <div className="mt-4">
                                <label className="text-xs text-slate-700 block mb-2">
                                  Image (optional)
                                </label>
                                <Input
                                  value={sq.imageUrl || ""}
                                  onChange={e =>
                                    updateQuestion(i, {
                                      ...sq,
                                      imageUrl: e.target.value
                                    })
                                  }
                                  placeholder="Or paste an image URL"
                                />
                                {sq.imageUrl && (
                                  <img
                                    src={sq.imageUrl}
                                    alt="Speaking prompt"
                                    className="mt-2 max-h-40 rounded-md border border-slate-200 object-contain"
                                  />
                                )}

                                <div className="mt-3 flex items-center gap-3">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e =>
                                      handleQuestionImageFileSelected(
                                        i,
                                        e.target.files?.[0] || undefined
                                      )
                                    }
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={imgState.uploading || !selectedFile}
                                    onClick={() => uploadImageForQuestion(i)}
                                  >
                                    {imgState.uploading
                                      ? "Uploading..."
                                      : "Upload image"}
                                  </Button>
                                  {selectedFile && (
                                    <span className="text-xs text-slate-600">
                                      {selectedFile.name}
                                    </span>
                                  )}
                                </div>
                                {imgState.error && (
                                  <div className="text-xs text-rose-600 mt-1">
                                    {imgState.error}
                                  </div>
                                )}
                                {imgState.successMessage && (
                                  <div className="text-xs text-green-600 mt-1">
                                    {imgState.successMessage}
                                  </div>
                                )}
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Students will see this image and then speak based on
                                  the prompt.
                                </p>
                              </div>
                            </>
                          );
                        })()}

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                          Question #{i + 1}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeQuestion(i)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT SIDE */}
          <aside className="space-y-6">
            {/* Only Actions card (Summary & Tips removed) */}
            <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
              <div className="text-xs text-slate-500 mb-3">Actions</div>
              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Create Test"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => hardResetAfterTypeChange(type)}
                >
                  Reset
                </Button>
              </div>
              {message && (
                <div className="mt-3 text-sm text-rose-600">{message}</div>
              )}
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
