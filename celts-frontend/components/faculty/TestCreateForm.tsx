"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Option = { text: string };

type McqQuestion = {
  prompt: string;
  options: Option[];
  correctIndex: number;
  marks?: number;
  explanation?: string;
};

type QuestionWriting = {
  questionType: "writing";
  prompt: string;
  writingType?: string;
  wordLimit?: number;
  charLimit?: number;
  marks?: number;
  explanation?: string;
};

type QuestionSpeaking = {
  questionType: "speaking";
  prompt: string;
  speakingMode?: "audio" | "video" | "oral";
  recordLimitSeconds?: number;
  marks?: number;
  explanation?: string;
};

type Question = QuestionWriting | QuestionSpeaking;

type ReadingBlock = {
  id: string;
  passage: string;
  questions: McqQuestion[];
};

type ListeningBlock = {
  id: string;
  audioUrl: string;
  listenLimit?: number;
  questions: McqQuestion[];
};

export default function TestCreateForm() {
  const [type, setType] = useState<"reading" | "listening" | "writing" | "speaking">("reading");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0);

  const [readingBlocks, setReadingBlocks] = useState<ReadingBlock[]>([]);
  const [listeningBlocks, setListeningBlocks] = useState<ListeningBlock[]>([]);

  const [questions, setQuestions] = useState<Question[]>([
    {
      questionType: "writing",
      prompt: "",
      writingType: "story",
      wordLimit: 200,
      marks: 5,
    },
  ]);

  // per-listening-block file + upload state
  const [listeningFiles, setListeningFiles] = useState< Record<string, File | null> >({});
  const [listeningUploadState, setListeningUploadState] = useState< Record<string, { uploading: boolean; error?: string | null }> >({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --- Reading blocks ---
  function addReadingBlock() {
    setReadingBlocks((prev) => [
      ...prev,
      {
        id: `read-${Date.now()}-${prev.length}`,
        passage: "",
        questions: [
          {
            prompt: "",
            options: [{ text: "" }, { text: "" }],
            correctIndex: 0,
            marks: 1,
          },
        ],
      },
    ]);
  }

  function updateReadingBlock(idx: number, patch: Partial<ReadingBlock>) {
    setReadingBlocks((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
  }

  function removeReadingBlock(idx: number) {
    if (!confirm("Remove this passage and all its questions?")) return;
    setReadingBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function addMcqToReadingBlock(blockIdx: number) {
    setReadingBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: [
              ...b.questions,
              {
                prompt: "",
                options: [{ text: "" }, { text: "" }],
                correctIndex: 0,
                marks: 1,
              },
            ],
          }
          : b
      )
    );
  }

  function updateMcqInReadingBlock(
    blockIdx: number,
    qIdx: number,
    q: McqQuestion
  ) {
    setReadingBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: b.questions.map((qq, j) => (j === qIdx ? q : qq)),
          }
          : b
      )
    );
  }

  function removeMcqFromReadingBlock(blockIdx: number, qIdx: number) {
    setReadingBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: b.questions.filter((_, j) => j !== qIdx),
          }
          : b
      )
    );
  }

  // --- Listening blocks ---
  function addListeningBlock() {
    setListeningBlocks((prev) => [
      ...prev,
      {
        id: `listen-${Date.now()}-${prev.length}`,
        audioUrl: "",
        listenLimit: 1,
        questions: [
          {
            prompt: "",
            options: [{ text: "" }, { text: "" }],
            correctIndex: 0,
            marks: 1,
          },
        ],
      },
    ]);
  }

  function updateListeningBlock(idx: number, patch: Partial<ListeningBlock>) {
    setListeningBlocks((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
  }

  function removeListeningBlock(idx: number) {
    if (!confirm("Remove this audio and all associated questions?")) return;
    const blockId = listeningBlocks[idx]?.id;
    setListeningBlocks((prev) => prev.filter((_, i) => i !== idx));
    if (blockId) {
      setListeningFiles((prev) => {
        const copy = { ...prev };
        delete copy[blockId];
        return copy;
      });
      setListeningUploadState((prev) => {
        const copy = { ...prev };
        delete copy[blockId];
        return copy;
      });
    }
  }

  function addMcqToListeningBlock(blockIdx: number) {
    setListeningBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: [
              ...b.questions,
              {
                prompt: "",
                options: [{ text: "" }, { text: "" }],
                correctIndex: 0,
                marks: 1,
              },
            ],
          }
          : b
      )
    );
  }

  function updateMcqInListeningBlock(
    blockIdx: number,
    qIdx: number,
    q: McqQuestion
  ) {
    setListeningBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: b.questions.map((qq, j) => (j === qIdx ? q : qq)),
          }
          : b
      )
    );
  }

  function removeMcqFromListeningBlock(blockIdx: number, qIdx: number) {
    setListeningBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
            ...b,
            questions: b.questions.filter((_, j) => j !== qIdx),
          }
          : b
      )
    );
  }

  // Per-block file selection
  function handleListeningFileSelected(blockId: string, file?: File) {
    setListeningFiles((prev) => ({
      ...prev,
      [blockId]: file || null,
    }));
    setListeningUploadState((prev) => ({
      ...prev,
      [blockId]: { uploading: false, error: null },
    }));
  }

  // Upload audio for a specific block and set its audioUrl
  async function uploadAudioFileForBlock(blockId: string) {
    const file = listeningFiles[blockId];
    if (!file) {
      setListeningUploadState((prev) => ({
        ...prev,
        [blockId]: {
          uploading: false,
          error: "Choose a file first",
        },
      }));
      return;
    }

    setListeningUploadState((prev) => ({
      ...prev,
      [blockId]: { uploading: true, error: null },
    }));

    try {
      const form = new FormData();
      form.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      const fullUrl = API_BASE + "/media/upload";

      const token = typeof window !== "undefined"  ? localStorage.getItem("celts_token") : null;

      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch(fullUrl, {
        method: "POST",
        body: form,
        headers,
        credentials: "include",
      });

      const text = await resp.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!resp.ok) {
        const errMsg = parsed?.message ||  parsed?.error ||  `Upload failed (${resp.status})`;
        setListeningUploadState((prev) => ({
          ...prev,
          [blockId]: { uploading: false, error: errMsg },
        }));
        return;
      }

      const returnedUrl =
        parsed?.url || parsed?.audioUrl || parsed?.data?.url || null;

      if (!returnedUrl) {
        setListeningUploadState((prev) => ({
          ...prev,
          [blockId]: {
            uploading: false,
            error: "Upload succeeded but no URL returned.",
          },
        }));
        return;
      }

      // Save into that block
      setListeningBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId ? { ...b, audioUrl: returnedUrl } : b
        )
      );

      setListeningUploadState((prev) => ({
        ...prev,
        [blockId]: { uploading: false, error: null },
      }));
    } catch (err: any) {
      setListeningUploadState((prev) => ({
        ...prev,
        [blockId]: {
          uploading: false,
          error: err?.message || "Upload failed",
        },
      }));
    }
  }

  // --- Writing/Speaking ---
  function updateQuestion(idx: number, q: Question) {
    setQuestions((prev) => prev.map((p, i) => (i === idx ? q : p)));
  }

  function addQuestionOfType(qt: Question["questionType"]) {
    if (qt === "writing") {
      setQuestions((prev) => [
        ...prev,
        {
          questionType: "writing",
          prompt: "",
          writingType: "story",
          wordLimit: 200,
          marks: 5,
        },
      ]);
    } else {
      setQuestions((prev) => [
        ...prev,
        {
          questionType: "speaking",
          prompt: "",
          speakingMode: "audio",
          recordLimitSeconds: 60,
          marks: 5,
        },
      ]);
    }
  }

  function removeQuestion(idx: number) {
    if (!confirm("Remove this question?")) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  // --- Test type change ---
  function handleTypeChange( newType: "reading" | "listening" | "writing" | "speaking") {
    setType(newType);

    if (newType === "reading" && readingBlocks.length === 0) {
      addReadingBlock();
    }
    if (newType === "listening" && listeningBlocks.length === 0) {
      addListeningBlock();
    }
    if (
      (newType === "writing" || newType === "speaking") &&
      questions.length === 0
    ) {
      setQuestions([
        {
          questionType: "writing",
          prompt: "",
          writingType: "story",
          wordLimit: 200,
          marks: 5,
        },
      ]);
    }
  }

  // ---- SUBMIT ----
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
      published: false,
    };

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
            setMessage(
              `Passage ${bIdx + 1} – Question ${qIdx + 1} missing prompt.`
            );
            return;
          }
          if (q.options.length < 2) {
            setMessage(
              `Passage ${bIdx + 1} – Question ${qIdx + 1} must have at least 2 options.`
            );
            return;
          }
        }
      }

      const readingSections = readingBlocks.map((b, idx) => ({
        id: b.id,
        title: `Passage ${idx + 1}`,
        passage: b.passage,
      }));

      const flatQuestions = readingBlocks.flatMap((b) =>
        b.questions.map((q) => ({
          questionType: "mcq",
          prompt: q.prompt,
          options: q.options.map((o) => ({ text: o.text })),
          correctIndex: q.correctIndex,
          marks: q.marks || 1,
          explanation: q.explanation || "",
          sectionId: b.id,
        }))
      );

      payload.readingSections = readingSections;
      payload.questions = flatQuestions;
    }

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
            setMessage(
              `Audio ${bIdx + 1} – Question ${qIdx + 1} missing prompt.`
            );
            return;
          }
          if (q.options.length < 2) {
            setMessage(
              `Audio ${bIdx + 1} – Question ${qIdx + 1} must have at least 2 options.`
            );
            return;
          }
        }
      }

      const listeningSections = listeningBlocks.map((b, idx) => ({
        id: b.id,
        title: `Audio ${idx + 1}`,
        audioUrl: b.audioUrl,
        listenLimit: b.listenLimit ?? 1,
      }));

      const flatQuestions = listeningBlocks.flatMap((b) =>
        b.questions.map((q) => ({
          questionType: "mcq",
          prompt: q.prompt,
          options: q.options.map((o) => ({ text: o.text })),
          correctIndex: q.correctIndex,
          marks: q.marks || 1,
          explanation: q.explanation || "",
          sectionId: b.id,
        }))
      );

      payload.listeningSections = listeningSections;
      payload.questions = flatQuestions;
    }

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

      payload.questions = questions.map((q) => {
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
          res.error?.message ||
          res.data?.message ||
          `Server responded ${res.status}`
        );
        return;
      }

      setMessage("Test created successfully");

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
        },
      ]);
    } catch (err: any) {
      setLoading(false);
      setMessage(err?.message || "Network error");
      console.error(err);
    }
  }

  // MCQ editor reusable UI
  function renderMcqEditor(
    q: McqQuestion,
    blockIdx: number,
    qIdx: number,
    onChange: (updated: McqQuestion) => void,
    onRemove: () => void
  ) {
    return (
      <div className="border rounded p-2 mb-3" key={qIdx}>
        <div>
          <label className="text-xs block mb-1">Question prompt</label>
          <Input
            value={q.prompt}
            onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          />
        </div>

        <div className="mt-2">
          <label className="text-xs block mb-1">
            Options (select the correct one)
          </label>

          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={q.correctIndex === oi}
                  onChange={() => onChange({ ...q, correctIndex: oi })}
                />
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const newOpts = q.options.map((o, idx) =>
                      idx === oi ? { text: e.target.value } : o
                    );
                    onChange({ ...q, options: newOpts });
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={q.options.length <= 2}
                  onClick={() => {
                    const newOpts = q.options.filter((_, idx) => idx !== oi);
                    onChange({
                      ...q,
                      options: newOpts,
                      correctIndex: Math.min(
                        q.correctIndex,
                        newOpts.length - 1
                      ),
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              onClick={() =>
                onChange({
                  ...q,
                  options: [...q.options, { text: "" }],
                })
              }
            >
              Add option
            </Button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs block mb-1">Marks</label>
            <Input
              type="number"
              value={q.marks ?? 1}
              onChange={(e) =>
                onChange({
                  ...q,
                  marks: Number(e.target.value || 1),
                })
              }
            />
          </div>

          <div>
            <label className="text-xs block mb-1">Explanation (optional)</label>
            <Input
              value={q.explanation || ""}
              onChange={(e) =>
                onChange({
                  ...q,
                  explanation: e.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            Remove question
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="w-full p-2 border rounded"
          >
            <option value="reading">Reading</option>
            <option value="listening">Listening</option>
            <option value="writing">Writing</option>
            <option value="speaking">Speaking</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Time limit (minutes)</label>
          <Input
            type="number"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Reading Blocks */}
      {type === "reading" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Passages + MCQs</h3>
            <Button type="button" size="sm" onClick={addReadingBlock}>
              Add Passage
            </Button>
          </div>

          {readingBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No passages added yet. Click "Add Passage".
            </p>
          )}

          {readingBlocks.map((block, bIdx) => (
            <div key={block.id} className="border rounded p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold">
                  Passage {bIdx + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => removeReadingBlock(bIdx)}
                >
                  Remove Passage
                </Button>
              </div>

              <div>
                <label className="block text-xs mb-1">Passage text</label>
                <textarea
                  value={block.passage}
                  onChange={(e) =>
                    updateReadingBlock(bIdx, { passage: e.target.value })
                  }
                  className="w-full p-2 border rounded h-32 text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold">
                    MCQs for Passage {bIdx + 1}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => addMcqToReadingBlock(bIdx)}
                  >
                    Add MCQ
                  </Button>
                </div>

                {block.questions.map((q, qIdx) =>
                  renderMcqEditor(
                    q,
                    bIdx,
                    qIdx,
                    (updated) =>
                      updateMcqInReadingBlock(bIdx, qIdx, updated),
                    () => removeMcqFromReadingBlock(bIdx, qIdx)
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listening Blocks (with per-block audio upload) */}
      {type === "listening" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Audios + MCQs</h3>
            <Button type="button" size="sm" onClick={addListeningBlock}>
              Add Audio
            </Button>
          </div>

          {listeningBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No audios added yet. Click "Add Audio".
            </p>
          )}

          {listeningBlocks.map((block, bIdx) => {
            const uploadState = listeningUploadState[block.id] || {
              uploading: false,
              error: null,
            };
            const selectedFile = listeningFiles[block.id] || null;

            return (
              <div key={block.id} className="border rounded p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">
                    Audio {bIdx + 1}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeListeningBlock(bIdx)}
                  >
                    Remove Audio
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs mb-1">
                      Audio URL (set automatically after upload)
                    </label>
                    <Input
                      value={block.audioUrl}
                      readOnly
                      placeholder="Upload a file below to set this URL"
                    />
                    {block.audioUrl && (
                      <audio
                        controls
                        src={block.audioUrl}
                        className="w-full mt-1"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs mb-1">
                      Listen limit (optional)
                    </label>
                    <Input
                      type="number"
                      value={block.listenLimit ?? ""}
                      onChange={(e) =>
                        updateListeningBlock(bIdx, {
                          listenLimit: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs mb-1">
                    Upload audio for this block (local file)
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        handleListeningFileSelected(block.id, f || undefined);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={uploadState.uploading || !selectedFile}
                      onClick={() => uploadAudioFileForBlock(block.id)}
                    >
                      {uploadState.uploading ? "Uploading..." : "Upload"}
                    </Button>
                    {selectedFile && (
                      <span className="text-xs text-muted-foreground">
                        {selectedFile.name}
                      </span>
                    )}
                  </div>
                  {uploadState.error && (
                    <p className="text-xs text-red-600">{uploadState.error}</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold">
                      MCQs for Audio {bIdx + 1}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addMcqToListeningBlock(bIdx)}
                    >
                      Add MCQ
                    </Button>
                  </div>

                  {block.questions.map((q, qIdx) =>
                    renderMcqEditor(
                      q,
                      bIdx,
                      qIdx,
                      (updated) =>
                        updateMcqInListeningBlock(bIdx, qIdx, updated),
                      () => removeMcqFromListeningBlock(bIdx, qIdx)
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Writing & Speaking */}
      {(type === "writing" || type === "speaking") && (
        <div>
          <h3 className="font-semibold mb-2">Questions</h3>

          {questions.map((q, i) => (
            <div key={i} className="p-3 border rounded mb-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm block mb-1">Question type</label>
                  <select
                    value={q.questionType}
                    onChange={(e) => {
                      const qt = e.target.value as Question["questionType"];
                      if (qt === "writing") {
                        updateQuestion(i, {
                          questionType: "writing",
                          prompt: "",
                          writingType: "story",
                          wordLimit: 200,
                          marks: 5,
                        });
                      } else {
                        updateQuestion(i, {
                          questionType: "speaking",
                          prompt: "",
                          speakingMode: "audio",
                          recordLimitSeconds: 60,
                          marks: 5,
                        });
                      }
                    }}
                    className="w-full p-2 border rounded"
                  >
                    <option value="writing">Writing</option>
                    <option value="speaking">Speaking</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm block mb-1">Prompt</label>
                  <Input
                    value={q.prompt}
                    onChange={(e) =>
                      updateQuestion(i, {
                        ...(q as any),
                        prompt: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {q.questionType === "writing" && (() => {
                const wq = q as QuestionWriting;
                return (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm block mb-1">Writing type</label>
                      <select
                        value={wq.writingType}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...wq,
                            writingType: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="story">Story</option>
                        <option value="email">Email</option>
                        <option value="letter">Letter</option>
                        <option value="summary">Summary</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm block mb-1">
                        Word limit (optional)
                      </label>
                      <Input
                        type="number"
                        value={wq.wordLimit ?? ""}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...wq,
                            wordLimit: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm block mb-1">Marks</label>
                      <Input
                        type="number"
                        value={wq.marks ?? 5}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...wq,
                            marks: Number(e.target.value || 1),
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })()}

              {q.questionType === "speaking" && (() => {
                const sq = q as QuestionSpeaking;
                return (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm block mb-1">
                        Speaking mode
                      </label>
                      <select
                        value={sq.speakingMode}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...sq,
                            speakingMode: e.target.value as any,
                          })
                        }
                        className="w-full p-2 border rounded"
                      >
                        <option value="audio">Record audio</option>
                        <option value="video">Record video</option>
                        <option value="oral">Oral (live)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm block mb-1">
                        Record limit (seconds)
                      </label>
                      <Input
                        type="number"
                        value={sq.recordLimitSeconds ?? 60}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...sq,
                            recordLimitSeconds: Number(
                              e.target.value || 0
                            ),
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm block mb-1">Marks</label>
                      <Input
                        type="number"
                        value={sq.marks ?? 5}
                        onChange={(e) =>
                          updateQuestion(i, {
                            ...sq,
                            marks: Number(e.target.value || 1),
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Question #{i + 1} — {q.questionType.toUpperCase()}
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
          ))}

          <div className="flex gap-2">
            <Button type="button" onClick={() => addQuestionOfType("writing")}>
              Add Writing
            </Button>
            <Button type="button" onClick={() => addQuestionOfType("speaking")}>
              Add Speaking
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create Test"}
        </Button>
        {message && <div className="text-sm">{message}</div>}
      </div>
    </form>
  );
}
