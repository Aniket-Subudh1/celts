// app/faculty/view_test/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import api from "@/lib/api";
import { Trash2, Layers, Eye, BarChart3, FileText, Settings, Users } from "lucide-react";

type Option = { text: string };
type Question = {
  prompt: string;
  options?: Option[]; // optional for writing/speaking
  correctIndex?: number;
  marks?: number;
  explanation?: string;
  _id?: string;
  questionType?: "mcq" | "writing" | "speaking";
  // writing-specific
  wordLimit?: number;
  // speaking-specific
  speakingMode?: "audio" | "video" | "oral";
  recordLimitSeconds?: number;
};

type TestSet = {
  _id: string;
  title: string;
  type: "reading" | "listening" | "writing" | "speaking";
  description?: string;
  passage?: string;
  audioUrl?: string;
  listenLimit?: number;
  timeLimitMinutes?: number;
  assignedBatches?: string[]; // array of batch ids
  questions: Question[];
  createdAt?: string;
};

type Batch = { _id: string; name: string };

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/create_test", label: "Create Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/view_test", label: "View Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
];

export default function ViewTestPage() {
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem("celts_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "");
      } catch (err) {
        console.error("Error parsing user from storage:", err);
      }
    }
  }, []);

  const [tests, setTests] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // batches for assign dialog
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assigningTest, setAssigningTest] = useState<TestSet | null>(null);
  const [assignSelected, setAssignSelected] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  // question view / edit dialog
  const [viewingTest, setViewingTest] = useState<TestSet | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([]);
  const [questionsSaving, setQuestionsSaving] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchBatches();
  }, []);

  async function fetchTests() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/teacher/tests?mine=true");
      if (!res.ok) {
        console.error("[fetchTests] error:", res);
        setError(res.error?.message || "Failed to fetch tests");
        setTests([]);
        return;
      }
      setTests(res.data || []);
    } catch (err: any) {
      console.error("[fetchTests] exception:", err);
      setError(err.message || "Network error");
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBatches() {
    try {
      // prefer faculty-specific endpoint, fall back to admin list
      let res = await api.apiGet("/faculty/batches");
      if (!res.ok) res = await api.apiGet("/admin/batches");
      if (!res.ok) {
        console.warn("[fetchBatches] both endpoints failed", res);
        setBatches([]);
        return;
      }
      const raw = res.data;
      const normalized: { _id: string; name: string }[] = (Array.isArray(raw) ? raw : []).map((r: any, i: number) => {
        if (!r) return { _id: String(i), name: String(r) };
        if (typeof r === "string") return { _id: String(i), name: r };
        if (r._id && (r.name || r.title)) return { _id: r._id, name: r.name || r.title };
        if (r._id && r.name) return { _id: r._id, name: r.name };
        if (r.name && typeof r.name === "string") return { _id: r._id || String(i), name: r.name };
        return { _id: r._id || r.id || String(i), name: r.name || r.title || JSON.stringify(r).slice(0, 40) };
      });
      setBatches(normalized);
    } catch (err: any) {
      console.error("[Batches] fetch error:", err);
      setBatches([]);
    }
  }

  // ---------- Assign dialog actions ----------
  const openAssignDialog = (t: TestSet) => {
    setAssigningTest(t);
    setAssignSelected(null);
  };

  const handleAssignToBatch = async () => {
    if (!assigningTest || !assignSelected) return;
    setAssignLoading(true);
    try {
      // Add selected batch id to assignedBatches (dedupe)
      const newAssigned = Array.from(new Set([...(assigningTest.assignedBatches || []), assignSelected]));

      console.log("[Assign] sending update for test", assigningTest._id, "assignedBatches=", newAssigned);

      const res = await api.apiPut(`/teacher/tests/${assigningTest._id}`, { assignedBatches: newAssigned });

      setAssignLoading(false);

      if (!res.ok) {
        console.error("[Assign] server returned error:", res);
        alert(res.error?.message || res.data?.message || `Failed to assign (status ${res.status})`);
        return;
      }

      // success — server may return { message, test } or the test object directly
      const updatedTest = res.data?.test || res.data;
      console.log("[Assign] success, server returned:", updatedTest);

      setTests((prev) => prev.map((p) => (p._id === assigningTest._id ? (updatedTest || { ...p, assignedBatches: newAssigned }) : p)));
      setAssigningTest(null);
    } catch (err: any) {
      setAssignLoading(false);
      console.error("[Assign] exception:", err);
      alert(err?.message || "Network error while assigning");
    }
  };

  const handleRemoveBatchFromTest = async (test: TestSet, batchId: string) => {
    if (!confirm("Remove this batch assignment?")) return;
    try {
      const newAssigned = (test.assignedBatches || []).filter((b) => b !== batchId);
      const res = await api.apiPut(`/teacher/tests/${test._id}`, { assignedBatches: newAssigned });
      if (!res.ok) {
        console.error("[removeBatch] server error:", res);
        alert(res.error?.message || "Failed to update assignment");
        return;
      }
      const updatedTest = res.data?.test || res.data;
      setTests((prev) => prev.map((p) => (p._id === test._id ? (updatedTest || { ...p, assignedBatches: newAssigned }) : p)));
    } catch (err: any) {
      console.error("[removeBatch] exception:", err);
      alert(err.message || "Network error");
    }
  };

  // ---------- View / Edit Questions ----------
  const openQuestionsDialog = async (t: TestSet) => {
    try {
      // fetch full test from server (to include passage / audioUrl / full questions)
      const res = await api.apiGet(`/teacher/tests/${t._id}`);
      if (!res.ok) {
        console.error("[openQuestionsDialog] failed to fetch test:", res);
        alert(res.error?.message || "Failed to fetch test details");
        return;
      }

      const fullTest: TestSet = res.data;

      // Defensive normalization of questions so UI shows options reliably
      const normalizedQuestions: Question[] = Array.isArray(fullTest.questions)
        ? fullTest.questions.map((qAny: any) => {
            const q: any = { ...(qAny || {}) };

            // If questionType missing, infer MCQ when options are present or fallback to 'mcq'
            if (!q.questionType) {
              if (Array.isArray(q.options) && q.options.length > 0) q.questionType = "mcq";
              else q.questionType = "mcq"; // fallback for backward compatibility
            }

            // For MCQ ensure options array and correctIndex
            if (q.questionType === "mcq") {
              q.options = Array.isArray(q.options) && q.options.length > 0 ? q.options : [{ text: "" }, { text: "" }];
              q.correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
            } else {
              // not an mcq: remove options to avoid UI confusion
              if (!Array.isArray(q.options)) q.options = undefined;
            }

            q.marks = typeof q.marks === "number" ? q.marks : 1;
            // ensure prompt exists
            q.prompt = q.prompt ?? "";

            return q as Question;
          })
        : [];

      // Attach normalized questions back to test copy
      const safeTest: TestSet = {
        ...fullTest,
        questions: normalizedQuestions,
      };

      setViewingTest(safeTest);
      // Deep copy for edit buffer
      setEditedQuestions(JSON.parse(JSON.stringify(normalizedQuestions || [])));
    } catch (err: any) {
      console.error("[openQuestionsDialog] exception:", err);
      alert(err?.message || "Network error while loading test");
    }
  };

  const handleQuestionChange = (idx: number, q: Question) => {
    setEditedQuestions((prev) => prev.map((p, i) => (i === idx ? q : p)));
  };

  const addQuestion = () => {
    setEditedQuestions((prev) => [
      ...prev,
      {
        questionType: "mcq",
        prompt: "",
        options: [{ text: "" }, { text: "" }],
        correctIndex: 0,
        marks: 1,
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (!confirm("Remove this question?")) return;
    setEditedQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: [...(q.options || []), { text: "" }] } : q))
    );
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = (q.options || []).filter((_, oi) => oi !== optIdx);
        const newCorrect = Math.min(q.correctIndex ?? 0, Math.max(0, newOpts.length - 1));
        return { ...q, options: newOpts, correctIndex: newCorrect };
      })
    );
  };

  /**
   * Save edited questions (and editable test-level fields) to server.
   * Builds a normalized payload and logs server response for debugging.
   */
  const saveQuestions = async () => {
    if (!viewingTest) return;
    setQuestionsSaving(true);

    try {
      // client-side validation
      for (let i = 0; i < editedQuestions.length; i++) {
        const q = editedQuestions[i];
        if (!q.prompt || q.prompt.trim() === "") {
          alert(`Question ${i + 1} missing prompt`);
          setQuestionsSaving(false);
          return;
        }
        if (q.questionType === "mcq") {
          if (!q.options || q.options.length < 2) {
            alert(`Question ${i + 1} needs at least 2 options`);
            setQuestionsSaving(false);
            return;
          }
          if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
            alert(`Question ${i + 1} has invalid correct answer`);
            setQuestionsSaving(false);
            return;
          }
        }
      }

      // Build sanitized questions array for server
      const sanitizedQuestions = editedQuestions.map((q) => {
        const base: any = {
          prompt: q.prompt ?? "",
          marks: typeof q.marks === "number" ? q.marks : 1,
          questionType: q.questionType || "mcq",
          explanation: q.explanation || "",
        };

        if (base.questionType === "mcq") {
          base.options = Array.isArray(q.options) ? q.options.map((o) => ({ text: o.text || "" })) : [{ text: "" }, { text: "" }];
          base.correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
        } else if (base.questionType === "writing") {
          base.wordLimit = typeof q.wordLimit === "number" ? q.wordLimit : undefined;
        } else if (base.questionType === "speaking") {
          base.speakingMode = q.speakingMode || "audio";
          base.recordLimitSeconds = typeof q.recordLimitSeconds === "number" ? q.recordLimitSeconds : undefined;
        }

        if (q._id) base._id = q._id;
        return base;
      });

      // Build update payload - include editable top-level fields from viewingTest
      const payload: any = {
        questions: sanitizedQuestions,
      };

      if (typeof viewingTest.title === "string") payload.title = viewingTest.title;
      if (typeof viewingTest.description === "string") payload.description = viewingTest.description;
      if (typeof viewingTest.passage === "string") payload.passage = viewingTest.passage;
      if (typeof viewingTest.audioUrl === "string") payload.audioUrl = viewingTest.audioUrl;
      if (typeof viewingTest.timeLimitMinutes !== "undefined") payload.timeLimitMinutes = viewingTest.timeLimitMinutes;
      if (typeof viewingTest.listenLimit !== "undefined") payload.listenLimit = viewingTest.listenLimit;

      console.log("[saveQuestions] sending payload:", payload);

      const res = await api.apiPut(`/teacher/tests/${viewingTest._id}`, payload);

      setQuestionsSaving(false);

      if (!res.ok) {
        // show server error details where possible
        console.error("[saveQuestions] server error:", res);
        const serverMsg = res.error?.message || res.data?.message || `Server responded ${res.status}`;
        alert(serverMsg);
        return;
      }

      const updatedTest = res.data?.test || res.data;

      // Update local tests list: prefer server-updated object if returned, otherwise apply our local edits
      setTests((prev) =>
        prev.map((t) =>
          t._id === viewingTest._id
            ? updatedTest || {
                ...t,
                questions: sanitizedQuestions,
                title: viewingTest.title,
                description: viewingTest.description,
                passage: viewingTest.passage,
                audioUrl: viewingTest.audioUrl,
                timeLimitMinutes: viewingTest.timeLimitMinutes,
              }
            : t
        )
      );

      setViewingTest(null);
      setEditedQuestions([]);
    } catch (err: any) {
      setQuestionsSaving(false);
      console.error("[saveQuestions] exception:", err);
      alert(err?.message || "Network error while saving test");
    }
  };

  // ---------- Delete test ----------
  const handleDeleteTest = async (id: string) => {
    if (!confirm("Delete this test permanently?")) return;
    try {
      const res = await api.apiDelete(`/teacher/tests/${id}`);
      if (!res.ok) {
        console.error("[deleteTest] server error:", res);
        alert(res.error?.message || "Failed to delete test");
        return;
      }
      setTests((prev) => prev.filter((t) => t._id !== id));
    } catch (err: any) {
      console.error("[deleteTest] exception:", err);
      alert(err.message || "Network error");
    }
  };

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Tests</h1>
          <p className="text-muted-foreground">View, assign, edit questions, or delete tests you created.</p>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Assigned To</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Questions</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    No tests created yet.
                  </td>
                </tr>
              ) : (
                tests.map((test) => (
                  <tr key={test._id} className="border-b hover:bg-muted/30">
                    <td className="px-6 py-4 text-sm font-medium">{test.title}</td>
                    <td className="px-6 py-4 text-sm">{test.type}</td>
                    <td className="px-6 py-4 text-sm">
                      {test.assignedBatches && test.assignedBatches.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {test.assignedBatches.map((bid) => {
                            const b = batches.find((x) => x._id === bid);
                            return (
                              <span key={bid} className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs">
                                {b ? b.name : bid}
                                <button className="ml-2 text-xs" onClick={() => handleRemoveBatchFromTest(test, bid)}>
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">{test.questions?.length ?? 0}</td>
                    <td className="px-6 py-4 text-sm flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openQuestionsDialog(test)}>
                        <Eye className="w-4 h-4" /> View Questions
                      </Button>
                      <Button size="sm" onClick={() => openAssignDialog(test)}>
                        <Layers className="w-4 h-4" /> Assign
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteTest(test._id)}>
                        <Trash2 className="w-4 h-4" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* ASSIGN DIALOG */}
        <Dialog open={!!assigningTest} onOpenChange={() => setAssigningTest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Test to Batch</DialogTitle>
            </DialogHeader>

            <div className="py-2 space-y-3">
              <div>
                <label className="text-sm block mb-1">Select Batch</label>
                <select className="w-full p-2 border rounded" value={assignSelected ?? ""} onChange={(e) => setAssignSelected(e.target.value || null)}>
                  <option value="">-- Select batch --</option>
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <small className="text-muted-foreground">
                  Selected test: <strong>{assigningTest?.title}</strong>
                </small>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssigningTest(null)}>
                Cancel
              </Button>
              <Button disabled={assignLoading || !assignSelected} onClick={handleAssignToBatch}>
                {assignLoading ? "Assigning..." : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QUESTIONS DIALOG */}
        <Dialog open={!!viewingTest} onOpenChange={() => setViewingTest(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Test Details — {viewingTest?.title}</DialogTitle>
            </DialogHeader>

            <div className="py-2 space-y-3 max-h-[70vh] overflow-auto">
              {viewingTest && (
                <div className="p-3 border rounded bg-gray-50 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="text-sm block mb-1">Title</label>
                      <Input value={viewingTest.title || ""} onChange={(e) => setViewingTest((s) => (s ? { ...s, title: e.target.value } : s))} />
                      <label className="text-sm block mt-2 mb-1">Description (optional)</label>
                      <textarea value={viewingTest.description || ""} onChange={(e) => setViewingTest((s) => (s ? { ...s, description: e.target.value } : s))} className="w-full p-2 border rounded" />
                      <div className="mt-2 text-xs">
                        <span className="inline-block px-2 py-1 rounded bg-secondary text-secondary-foreground mr-2 capitalize">{viewingTest.type}</span>
                        {viewingTest.timeLimitMinutes ? <span className="text-sm ml-2">Time limit: {viewingTest.timeLimitMinutes} min</span> : null}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{viewingTest.createdAt ? new Date(viewingTest.createdAt).toLocaleString() : null}</div>
                  </div>

                  {/* Reading passage editable */}
                  {viewingTest.type === "reading" && (
                    <>
                      <label className="text-sm block mb-1">Passage</label>
                      <textarea value={viewingTest.passage || ""} onChange={(e) => setViewingTest((s) => (s ? { ...s, passage: e.target.value } : s))} className="w-full p-2 border rounded h-48" />
                    </>
                  )}

                  {/* Listening audio editable */}
                  {viewingTest.type === "listening" && (
                    <>
                      <label className="text-sm block mb-1">Audio URL</label>
                      <Input value={viewingTest.audioUrl || ""} onChange={(e) => setViewingTest((s) => (s ? { ...s, audioUrl: e.target.value } : s))} />
                      <div className="mt-2 text-sm">Listen limit: {viewingTest.listenLimit ?? 1}</div>
                      {viewingTest.audioUrl ? <audio controls src={viewingTest.audioUrl} className="w-full mt-2" /> : null}
                    </>
                  )}

                  {viewingTest.type === "writing" && <div className="mt-4 text-sm">This is a writing test. Questions will ask students to write (story, email, letter, etc.).</div>}
                  {viewingTest.type === "speaking" && <div className="mt-4 text-sm">This is a speaking test. Questions may ask students to record audio or video responses.</div>}

                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">Assigned batches</div>
                    {viewingTest.assignedBatches && viewingTest.assignedBatches.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {viewingTest.assignedBatches.map((bid) => {
                          const b = batches.find((x) => x._id === bid);
                          return (
                            <span key={bid} className="px-2 py-1 rounded bg-muted text-xs">
                              {b ? b.name : bid}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Not assigned</div>
                    )}
                  </div>
                </div>
              )}

              {/* Editable questions list */}
              <div>
                <h4 className="font-semibold mb-2">Questions ({editedQuestions.length})</h4>
                {editedQuestions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No questions.</div>
                ) : (
                  editedQuestions.map((q, qi) => (
                    <div key={q._id ?? qi} className="p-3 border rounded mb-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm mb-1">Type</label>
                          <select
                            value={q.questionType || "mcq"}
                            onChange={(e) => {
                              const qt = e.target.value as Question["questionType"];
                              if (qt === "mcq") handleQuestionChange(qi, { ...q, questionType: "mcq", options: q.options && q.options.length ? q.options : [{ text: "" }, { text: "" }], correctIndex: q.correctIndex ?? 0 });
                              if (qt === "writing") handleQuestionChange(qi, { ...q, questionType: "writing", options: undefined });
                              if (qt === "speaking") handleQuestionChange(qi, { ...q, questionType: "speaking", options: undefined });
                            }}
                            className="w-full p-2 border rounded"
                          >
                            <option value="mcq">MCQ</option>
                            <option value="writing">Writing</option>
                            <option value="speaking">Speaking</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm mb-1">Prompt</label>
                          <Input value={q.prompt} onChange={(e) => handleQuestionChange(qi, { ...q, prompt: e.target.value })} />
                        </div>
                      </div>

                      {/* MCQ UI */}
                      {q.questionType === "mcq" && (
                        <div className="mt-3">
                          <label className="block text-sm mb-1">Options (select correct)</label>
                          <div className="space-y-2">
                            {(q.options || []).map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input type="radio" name={`correct-${qi}`} checked={(q.correctIndex ?? 0) === oi} onChange={() => handleQuestionChange(qi, { ...q, correctIndex: oi })} />
                                <Input
                                  value={opt.text}
                                  onChange={(e) => {
                                    const newOpts = (q.options || []).map((o, idx) => (idx === oi ? { text: e.target.value } : o));
                                    handleQuestionChange(qi, { ...q, options: newOpts });
                                  }}
                                />
                                <Button size="sm" variant="outline" onClick={() => removeOption(qi, oi)}>
                                  Remove
                                </Button>
                              </div>
                            ))}
                            <div className="mt-2">
                              <Button size="sm" onClick={() => addOption(qi)}>
                                Add option
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Writing UI */}
                      {q.questionType === "writing" && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm block mb-1">Word limit (optional)</label>
                            <Input type="number" value={q.wordLimit ?? ""} onChange={(e) => handleQuestionChange(qi, { ...q, wordLimit: e.target.value ? Number(e.target.value) : undefined })} />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Marks</label>
                            <Input type="number" value={q.marks ?? 5} onChange={(e) => handleQuestionChange(qi, { ...q, marks: Number(e.target.value || 1) })} />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Explanation (optional)</label>
                            <Input value={q.explanation ?? ""} onChange={(e) => handleQuestionChange(qi, { ...q, explanation: e.target.value })} />
                          </div>
                        </div>
                      )}

                      {/* Speaking UI */}
                      {q.questionType === "speaking" && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm block mb-1">Mode</label>
                            <select value={q.speakingMode || "audio"} onChange={(e) => handleQuestionChange(qi, { ...q, speakingMode: e.target.value as any })} className="w-full p-2 border rounded">
                              <option value="audio">Record audio</option>
                              <option value="video">Record video</option>
                              <option value="oral">Oral (live)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Record limit (seconds)</label>
                            <Input type="number" value={q.recordLimitSeconds ?? 60} onChange={(e) => handleQuestionChange(qi, { ...q, recordLimitSeconds: Number(e.target.value || 0) })} />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Marks</label>
                            <Input type="number" value={q.marks ?? 5} onChange={(e) => handleQuestionChange(qi, { ...q, marks: Number(e.target.value || 1) })} />
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">Question #{qi + 1}</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="destructive" onClick={() => removeQuestion(qi)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div>
                  <Button onClick={addQuestion}>Add question</Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setViewingTest(null); setEditedQuestions([]); }}>
                Cancel
              </Button>
              <Button disabled={questionsSaving} onClick={saveQuestions}>
                {questionsSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
