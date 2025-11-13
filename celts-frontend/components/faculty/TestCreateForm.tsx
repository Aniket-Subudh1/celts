"use client";

import React, { useState, useRef } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * TestCreateForm with listening file upload + preview.
 *
 * Notes:
 *  - Upload endpoint used: POST ${API_BASE}/media/upload
 *    (we construct full URL from environment variable like lib/api does).
 *  - Expects JSON response containing uploaded file URL at one of:
 *      resJson.url || resJson.audioUrl || resJson.data?.url
 *  - Attaches Authorization: Bearer <token from localStorage 'celts_token'>
 */

type Option = { text: string };
type QuestionMCQ = { questionType: "mcq"; prompt: string; options: Option[]; correctIndex: number; marks?: number; explanation?: string; };
type QuestionWriting = { questionType: "writing"; prompt: string; writingType?: string; wordLimit?: number; charLimit?: number; marks?: number; explanation?: string; };
type QuestionSpeaking = { questionType: "speaking"; prompt: string; speakingMode?: "audio" | "video" | "oral"; recordLimitSeconds?: number; marks?: number; explanation?: string; };
type Question = QuestionMCQ | QuestionWriting | QuestionSpeaking;




export default function TestCreateForm() {
    const [type, setType] = useState<"reading" | "listening" | "writing" | "speaking">("reading");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [passage, setPassage] = useState("");
    const [audioUrl, setAudioUrl] = useState("");          // manual URL input
    const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null); // URL returned from upload
    const [listenLimit, setListenLimit] = useState<number>(1);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(0);

    // file upload state
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

    // default initial question
    const [questions, setQuestions] = useState<Question[]>([
        { questionType: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctIndex: 0, marks: 1 }
    ]);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // helpers for questions
    function updateQuestion(idx: number, q: Question) {
        setQuestions(prev => prev.map((p, i) => i === idx ? q : p));
    }
    function addQuestionOfType(qt: Question["questionType"]) {
        if (qt === "mcq") {
            setQuestions(prev => [...prev, { questionType: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctIndex: 0, marks: 1 }]);
        } else if (qt === "writing") {
            setQuestions(prev => [...prev, { questionType: "writing", prompt: "", writingType: "story", wordLimit: 200, marks: 5 }]);
        } else {
            setQuestions(prev => [...prev, { questionType: "speaking", prompt: "", speakingMode: "audio", recordLimitSeconds: 60, marks: 5 }]);
        }
    }
    function removeQuestion(idx: number) {
        if (!confirm("Remove this question?")) return;
        setQuestions(prev => prev.filter((_, i) => i !== idx));
    }

    // mcq option helpers
    function addOption(qIdx: number) {
        setQuestions(prev => prev.map((q, i) => i === qIdx && q.questionType === "mcq" ? ({ ...q, options: [...q.options, { text: "" }] }) : q));
    }
    function removeOption(qIdx: number, optIdx: number) {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx || q.questionType !== "mcq") return q;
            const mcq = q;
            const newOpts = mcq.options.filter((_, oi) => oi !== optIdx);
            const newCorrect = Math.min(mcq.correctIndex, Math.max(0, newOpts.length - 1));
            return { ...mcq, options: newOpts, correctIndex: newCorrect };
        }));
    }

    // ---------- Audio file selection & preview ----------
    function handleAudioFileSelected(f?: File) {
        setUploadError(null);
        setUploadedAudioUrl(null);
        setAudioFile(f || null);

        // create local preview URL for audio element
        if (f) {
            const url = URL.createObjectURL(f);
            setLocalPreviewUrl(url);
            // autoplay preview muted? we won't autoplay; user clicks play
        } else {
            if (localPreviewUrl) {
                URL.revokeObjectURL(localPreviewUrl);
            }
            setLocalPreviewUrl(null);
        }
    }

    // Upload file to backend (multipart/form-data)
    // Replace your current uploadAudioFile() with this function
    async function uploadAudioFile() {
        if (!audioFile) {
            setUploadError("Choose a file first");
            return;
        }

        setUploading(true);
        setUploadError(null);
        setUploadProgress(null);

        try {
            const form = new FormData();
            form.append("file", audioFile);

            // compute same API_BASE used by lib/api.ts (for debug)
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
            const uploadPath = "/media/upload";
            const fullUrl = API_BASE + uploadPath;

            console.log("[uploadAudioFile] starting upload", {
                fileName: audioFile.name,
                fileSize: audioFile.size,
                fileType: audioFile.type,
                fullUrl
            });

            // Build headers including token if present (do not set Content-Type so browser will set boundary)
            const token = typeof window !== "undefined" ? localStorage.getItem("celts_token") : null;
            const headers: any = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            // Use fetch directly so we can inspect raw response text when non-JSON returned
            const resp = await fetch(fullUrl, {
                method: "POST",
                body: form,
                headers,
                credentials: "include"
            });

            const status = resp.status;
            const statusText = resp.statusText;
            let text = "";
            try {
                text = await resp.text();
            } catch (e: unknown) {
                if (e instanceof Error) {
                    text = `<failed to read body: ${e.message}>`;
                } else {
                    text = `<failed to read body: unknown error>`;
                }
            }


            console.log("[uploadAudioFile] response status:", status, statusText);
            console.log("[uploadAudioFile] raw response text:", text);

            let parsed = null;
            try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }

            if (!resp.ok) {
                // more helpful message
                const errMsg = (parsed && (parsed.message || parsed.error)) || `Upload failed with status ${status}`;
                setUploadError(errMsg);
                console.error("[uploadAudioFile] Upload failed details:", {
                    url: fullUrl,
                    status,
                    statusText,
                    parsed,
                    text
                });
                setUploading(false);
                return;
            }

            // success path: parse returned URL
            const returnedUrl = (parsed && (parsed.url || parsed.audioUrl)) || null;
            if (!returnedUrl) {
                // sometimes server returns nested structure or plain text
                // try some fallback extraction heuristics:
                const fallback = parsed || text;
                console.warn("[uploadAudioFile] upload succeeded but no url found in response. parsed/fallback:", fallback);
                setUploadError("Upload succeeded but server didn't return a file URL (check server response). See console for raw response.");
                setUploading(false);
                return;
            }

            setUploadedAudioUrl(returnedUrl);
            setAudioUrl(returnedUrl);
            setMessage("Upload successful. Preview below.");
            console.log("[uploadAudioFile] uploaded url:", returnedUrl);
        } catch (err: any) {
            console.error("[uploadAudioFile] exception", err);
            setUploadError(err?.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    }


    // ---------- Submit the test ----------
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);

        // trim title and re-set so UI reflects it
        const trimmedTitle = (title || "").trim();
        if (!trimmedTitle) {
            setMessage("Title is required.");
            return;
        }

        // ensure test type is valid
        const allowedTypes = new Set(["reading", "listening", "writing", "speaking"]);
        if (!type || !allowedTypes.has(type)) {
            setMessage("Select a valid test type.");
            return;
        }

        // For listening, ensure audio is present (either uploaded or manual)
        if (type === "listening" && !(audioUrl.trim() || uploadedAudioUrl)) {
            setMessage("Provide an audio URL or upload a file for listening tests.");
            return;
        }

        // Validate questions (same as before)
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.prompt || !q.prompt.trim()) {
                setMessage(`Question ${i + 1} missing prompt`);
                return;
            }
            if (q.questionType === "mcq") {
                const mq = q as QuestionMCQ;
                if (!mq.options || mq.options.length < 2) {
                    setMessage(`Question ${i + 1} needs at least 2 options`);
                    return;
                }
                if (mq.correctIndex < 0 || mq.correctIndex >= mq.options.length) {
                    setMessage(`Question ${i + 1} has invalid correct option`);
                    return;
                }
            }
        }

        // Build payload (title enforced)
        const payload: any = {
            title: trimmedTitle,
            description,
            type,
            timeLimitMinutes,
            questions: questions.map(q => {
                if (q.questionType === "mcq") {
                    const mq = q as QuestionMCQ;
                    return {
                        questionType: "mcq",
                        prompt: mq.prompt,
                        options: mq.options.map(o => ({ text: o.text })),
                        correctIndex: mq.correctIndex,
                        marks: mq.marks || 1,
                        explanation: mq.explanation || ""
                    };
                } else if (q.questionType === "writing") {
                    const w = q as QuestionWriting;
                    return {
                        questionType: "writing",
                        prompt: w.prompt,
                        writingType: w.writingType || "story",
                        wordLimit: w.wordLimit,
                        charLimit: w.charLimit,
                        marks: w.marks || 5,
                        explanation: w.explanation || ""
                    };
                } else {
                    const s = q as QuestionSpeaking;
                    return {
                        questionType: "speaking",
                        prompt: s.prompt,
                        speakingMode: s.speakingMode || "audio",
                        recordLimitSeconds: s.recordLimitSeconds,
                        marks: s.marks || 5,
                        explanation: s.explanation || ""
                    };
                }
            }),
            published: false
        };

        if (type === "reading") payload.passage = passage;
        if (type === "listening") {
            payload.audioUrl = uploadedAudioUrl || audioUrl;
            payload.listenLimit = listenLimit;
        }

        // debug log before sending — inspect this in browser console / network
        console.log("[TestCreate] Sending payload:", JSON.stringify(payload, null, 2));

        setLoading(true);
        try {
            const res = await api.apiPost("/teacher/tests", payload);
            setLoading(false);
            if (!res.ok) {
                // show server error message if present
                const serverMsg = res.error?.message || res.data?.message || `Server responded ${res.status}`;
                setMessage(serverMsg);
                console.error("[TestCreate] Server error response:", res);
                return;
            }
            setMessage("Test created successfully");
            // reset form (same as before)
            setTitle("");
            setDescription("");
            setPassage("");
            setAudioUrl("");
            setUploadedAudioUrl(null);
            setAudioFile(null);
            setQuestions([{ questionType: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctIndex: 0, marks: 1 }]);
        } catch (err: any) {
            setLoading(false);
            setMessage(err?.message || "Network error");
            console.error("[TestCreate] Exception:", err);
        }
    }

    // small helper: show effective audio src for preview
    const effectiveAudioSrc = uploadedAudioUrl || audioUrl || localPreviewUrl || null;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="block text-sm mb-1">Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm mb-1">Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full p-2 border rounded">
                        <option value="reading">Reading</option>
                        <option value="listening">Listening</option>
                        <option value="writing">Writing</option>
                        <option value="speaking">Speaking</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm mb-1">Time limit (minutes)</label>
                    <Input type="number" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(Number(e.target.value || 0))} />
                </div>
                {type === "listening" && (
                    <div>
                        <label className="block text-sm mb-1">Listen limit</label>
                        <Input type="number" value={listenLimit} onChange={(e) => setListenLimit(Number(e.target.value || 1))} />
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-2 border rounded" />
            </div>

            {type === "reading" && (
                <div>
                    <label className="block text-sm mb-1">Passage</label>
                    <textarea value={passage} onChange={(e) => setPassage(e.target.value)} className="w-full p-2 border rounded h-44" />
                </div>
            )}

            {type === "listening" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manual URL input */}
                    <div>
                        <label className="block text-sm mb-1">Audio URL (optional if uploading)</label>
                        <Input value={audioUrl} onChange={(e) => { setAudioUrl(e.target.value); setUploadedAudioUrl(null); }} placeholder="https://..." />
                        <div className="text-xs text-muted-foreground mt-1">Or upload a local audio file below and preview it before creating the test.</div>
                    </div>

                    {/* File upload and preview UI */}
                    <div className="space-y-2">
                        <label className="block text-sm mb-1">Upload audio file (mp3 / wav / m4a)</label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    handleAudioFileSelected(f || undefined);
                                }}
                                className="block"
                            />
                            <Button type="button" onClick={() => { uploadAudioFile(); }} disabled={!audioFile || uploading}>
                                {uploading ? "Uploading..." : "Upload"}
                            </Button>
                            {uploadProgress !== null && <div className="text-sm">{uploadProgress}%</div>}
                        </div>
                        {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}
                        {uploadedAudioUrl && <div className="text-sm text-green-700">Uploaded: {uploadedAudioUrl}</div>}

                        {/* Preview player */}
                        {effectiveAudioSrc ? (
                            <div className="mt-2">
                                <label className="block text-sm mb-1">Preview</label>
                                <audio ref={audioPlayerRef} controls src={effectiveAudioSrc} className="w-full" />
                                <div className="text-xs text-muted-foreground mt-1">This preview plays the selected/uploaded audio. Use it to verify before creating the test.</div>
                            </div>
                        ) : (
                            <div className="text-sm text-muted-foreground mt-1">No audio selected yet.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Questions */}
            <div>
                <h3 className="font-semibold mb-2">Questions</h3>
                {questions.map((q, i) => (
                    <div key={i} className="p-3 border rounded mb-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="text-sm block mb-1">Question type</label>
                                <select value={q.questionType} onChange={(e) => {
                                    const qt = e.target.value as Question["questionType"];
                                    if (qt === "mcq") updateQuestion(i, { questionType: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctIndex: 0, marks: 1 });
                                    if (qt === "writing") updateQuestion(i, { questionType: "writing", prompt: "", writingType: "story", wordLimit: 200, marks: 5 });
                                    if (qt === "speaking") updateQuestion(i, { questionType: "speaking", prompt: "", speakingMode: "audio", recordLimitSeconds: 60, marks: 5 });
                                }} className="w-full p-2 border rounded">
                                    <option value="mcq">MCQ</option>
                                    <option value="writing">Writing</option>
                                    <option value="speaking">Speaking</option>
                                </select>
                            </div>

                            <div className="col-span-2">
                                <label className="text-sm block mb-1">Prompt</label>
                                <Input value={q.prompt} onChange={(e) => updateQuestion(i, { ...(q as any), prompt: e.target.value })} />
                            </div>
                        </div>

                        {/* MCQ UI */}
                        {q.questionType === "mcq" && (() => {
                            const mq = q as QuestionMCQ;
                            return (
                                <div className="mt-3">
                                    <label className="block text-sm mb-1">Options (select correct)</label>
                                    <div className="space-y-2">
                                        {mq.options.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <input type="radio" name={`correct-${i}`} checked={mq.correctIndex === oi} onChange={() => updateQuestion(i, { ...mq, correctIndex: oi })} />
                                                <Input value={opt.text} onChange={(e) => {
                                                    const newOpts = mq.options.map((o, idx) => idx === oi ? { text: e.target.value } : o);
                                                    updateQuestion(i, { ...mq, options: newOpts });
                                                }} />
                                                <Button size="sm" variant="outline" onClick={() => removeOption(i, oi)}>Remove</Button>
                                            </div>
                                        ))}
                                        <div className="mt-2 flex gap-2">
                                            <Button size="sm" onClick={() => addOption(i)}>Add option</Button>
                                        </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-sm block mb-1">Marks</label>
                                            <Input type="number" value={mq.marks ?? 1} onChange={(e) => updateQuestion(i, { ...mq, marks: Number(e.target.value || 1) })} />
                                        </div>
                                        <div>
                                            <label className="text-sm block mb-1">Explanation (optional)</label>
                                            <Input value={mq.explanation || ""} onChange={(e) => updateQuestion(i, { ...mq, explanation: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Writing UI */}
                        {q.questionType === "writing" && (() => {
                            const wq = q as QuestionWriting;
                            return (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-sm block mb-1">Writing type</label>
                                        <select value={wq.writingType} onChange={(e) => updateQuestion(i, { ...wq, writingType: e.target.value })} className="w-full p-2 border rounded">
                                            <option value="story">Story</option>
                                            <option value="email">Email</option>
                                            <option value="letter">Letter</option>
                                            <option value="summary">Summary</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm block mb-1">Word limit (optional)</label>
                                        <Input type="number" value={wq.wordLimit ?? ""} onChange={(e) => updateQuestion(i, { ...wq, wordLimit: e.target.value ? Number(e.target.value) : undefined })} />
                                    </div>
                                    <div>
                                        <label className="text-sm block mb-1">Marks</label>
                                        <Input type="number" value={wq.marks ?? 5} onChange={(e) => updateQuestion(i, { ...wq, marks: Number(e.target.value || 1) })} />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Speaking UI */}
                        {q.questionType === "speaking" && (() => {
                            const sq = q as QuestionSpeaking;
                            return (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-sm block mb-1">Speaking mode</label>
                                        <select value={sq.speakingMode} onChange={(e) => updateQuestion(i, { ...sq, speakingMode: e.target.value as any })} className="w-full p-2 border rounded">
                                            <option value="audio">Record audio</option>
                                            <option value="video">Record video</option>
                                            <option value="oral">Oral (live)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm block mb-1">Record limit (seconds)</label>
                                        <Input type="number" value={sq.recordLimitSeconds ?? 60} onChange={(e) => updateQuestion(i, { ...sq, recordLimitSeconds: Number(e.target.value || 0) })} />
                                    </div>
                                    <div>
                                        <label className="text-sm block mb-1">Marks</label>
                                        <Input type="number" value={sq.marks ?? 5} onChange={(e) => updateQuestion(i, { ...sq, marks: Number(e.target.value || 1) })} />
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="mt-3 flex justify-between items-center">
                            <div className="text-sm text-muted-foreground">Question #{i + 1} — {q.questionType.toUpperCase()}</div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => removeQuestion(i)}>Remove</Button>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="flex gap-2">
                    <Button type="button" onClick={() => addQuestionOfType("mcq")}>Add MCQ</Button>
                    <Button type="button" onClick={() => addQuestionOfType("writing")}>Add Writing</Button>
                    <Button type="button" onClick={() => addQuestionOfType("speaking")}>Add Speaking</Button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Create Test"}</Button>
                {message && <div className="text-sm">{message}</div>}
            </div>
        </form>
    );
}
