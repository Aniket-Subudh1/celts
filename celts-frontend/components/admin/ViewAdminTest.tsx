"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { Trash2, Layers, Eye, Shield } from "lucide-react";

type Option = { text: string };

type Question = {
  _id?: string;
  prompt: string;
  options?: Option[];
  correctIndex?: number;
  marks?: number;
  explanation?: string;

  questionType?: "mcq" | "writing" | "speaking" | "match";

  // reading / listening
  sectionId?: string | null;

  // writing
  wordLimit?: number;

  // speaking
  speakingMode?: "audio" | "video" | "oral";
  recordLimitSeconds?: number;

  // match the following
  leftItems?: string[];
  rightItems?: string[];

  // image prompt (writing + speaking)
  imageUrl?: string | null;
};

type ReadingSection = {
  id: string;
  title?: string;
  passage: string;
};

type ListeningSection = {
  id: string;
  title?: string;
  audioUrl: string;
  listenLimit?: number;
};

type TestSet = {
  _id: string;
  title: string;
  type: "reading" | "listening" | "writing" | "speaking";
  description?: string;
  passage?: string;
  audioUrl?: string;
  listenLimit?: number;
  readingSections?: ReadingSection[];
  listeningSections?: ListeningSection[];

  timeLimitMinutes?: number;
  assignedBatches?: string[];
  questions: Question[];
  createdAt?: string;
};

type Batch = { _id: string; name: string };

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];

export function ViewAdminTest() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [assigningTest, setAssigningTest] = useState<TestSet | null>(null);
  const [assignSelected, setAssignSelected] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState("");

  const [assignLoading, setAssignLoading] = useState(false);

  const [removeBatchTest, setRemoveBatchTest] = useState<TestSet | null>(null);
  const [removeSelected, setRemoveSelected] = useState<string[]>([]);
  const [removeSearch, setRemoveSearch] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);


  const [viewingTest, setViewingTest] = useState<TestSet | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([]);
  const [questionsSaving, setQuestionsSaving] = useState(false);

  // image upload state per question in the dialog
  const [questionImageFiles, setQuestionImageFiles] = useState<(File | null)[]>([]);
  const [questionImageUploadState, setQuestionImageUploadState] = useState<
    { uploading: boolean; error?: string | null; successMessage?: string }[]
  >([]);

  useEffect(() => {
    fetchTests();
    fetchBatches();
  }, []);

  async function fetchTests() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/admin/testSet");
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
      let res = await api.apiGet("/admin/batches?all=true");
      if (!res.ok) {
        console.warn("[fetchBatches] endpoints failed", res);
        setBatches([]);
        return;
      }
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
      const normalized: Batch[] = (Array.isArray(raw) ? raw : []).map(
        (r: any, i: number) => {
          if (!r) return { _id: String(i), name: String(r) };
          if (typeof r === "string") return { _id: String(i), name: r };
          if (r._id && (r.name || r.title)) return { _id: r._id, name: r.name || r.title };
          if (r._id && r.name) return { _id: r._id, name: r.name };
          if (r.name && typeof r.name === "string") return { _id: r._id || String(i), name: r.name };

          return {
            _id: r._id || r.id || String(i),
            name: r.name || r.title || JSON.stringify(r).slice(0, 40),
          };
        }
      );
      setBatches(normalized);
    } catch (err: any) {
      console.error("[Batches] fetch error:", err);
      setBatches([]);
    }
  }

  const openAssignDialog = (t: TestSet) => {
    setAssigningTest(t);
    setAssignSelected([]);
    setBatchSearch("");
  };

  const handleAssignToBatch = async () => {
    if (!assigningTest || !assignSelected) return;
    setAssignLoading(true);
    try {
      const newAssigned = Array.from(
        new Set([...(assigningTest.assignedBatches || []), assignSelected])
      );

      console.log("[Assign] update test", assigningTest._id, newAssigned);

      const res = await api.apiPatch(`/admin/testSet/${assigningTest._id}/assign-batches`, { batchIds: assignSelected });

      setAssignLoading(false);

      if (!res.ok) {
        console.error("[Assign] server error:", res);
        alert(
          res.error?.message ||
          res.data?.message ||
          `Failed to assign (status ${res.status})`
        );
        return;
      }

      const updatedTest: TestSet = res.data?.test || res.data;

      setTests((prev) =>
        prev.map((p) =>
          p._id === assigningTest._id
            ? updatedTest || { ...p, assignedBatches: newAssigned }
            : p
        )
      );
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
      const newAssigned = (test.assignedBatches || []).filter(
        (b) => b !== batchId
      );
      const res = await api.apiPatch(`/admin/testSet/${test._id}/assign-batches`, { batchIds: [batchId], mode: "remove", });

      if (!res.ok) {
        console.error("[removeBatch] server error:", res);
        alert(res.error?.message || "Failed to update assignment");
        return;
      }
      const updatedTest: TestSet = res.data?.test || res.data;
      setTests((prev) =>
        prev.map((p) =>
          p._id === test._id
            ? updatedTest || { ...p, assignedBatches: newAssigned }
            : p
        )
      );
    } catch (err: any) {
      console.error("[removeBatch] exception:", err);
      alert(err.message || "Network error");
    }
  };

  // ---------- View / Edit Questions ----------

  const openQuestionsDialog = async (t: TestSet) => {
    try {
      const res = await api.apiGet(`/admin/testSet/${t._id}`);
      if (!res.ok) {
        console.error("[openQuestionsDialog] failed:", res);
        alert(res.error?.message || "Failed to fetch test details");
        return;
      }

      const fullTest: TestSet = res.data;

      const normalizedQuestions: Question[] = Array.isArray(fullTest.questions)
        ? fullTest.questions.map((qAny: any) => {
          const q: any = { ...(qAny || {}) };

          // Ensure a questionType
          if (!q.questionType) {
            if (Array.isArray(q.options) && q.options.length > 0)
              q.questionType = "mcq";
            else q.questionType = "mcq";
          }

          // Normalize MCQ
          if (q.questionType === "mcq") {
            q.options =
              Array.isArray(q.options) && q.options.length > 0
                ? q.options
                : [{ text: "" }, { text: "" }];
            q.correctIndex =
              typeof q.correctIndex === "number" ? q.correctIndex : 0;
          }

          // Normalize MATCH
          if (q.questionType === "match") {
            // Ensure left/right arrays with same length
            let left = Array.isArray(q.leftItems) ? q.leftItems : ["", ""];
            let right = Array.isArray(q.rightItems) ? q.rightItems : ["", ""];

            const minLen = Math.max(2, Math.min(left.length || 0, right.length || 0));
            left = left.slice(0, minLen);
            right = right.slice(0, minLen);
            while (left.length < minLen) left.push("");
            while (right.length < minLen) right.push("");

            q.leftItems = left;
            q.rightItems = right;

            // 3–4 options
            if (!Array.isArray(q.options) || q.options.length < 3) {
              q.options = [{ text: "" }, { text: "" }, { text: "" }];
            }
            if (q.options.length > 4) {
              q.options = q.options.slice(0, 4);
            }

            if (
              typeof q.correctIndex !== "number" ||
              q.correctIndex < 0 ||
              q.correctIndex >= q.options.length
            ) {
              q.correctIndex = 0;
            }
          }

          q.marks = typeof q.marks === "number" ? q.marks : 1;
          q.prompt = q.prompt ?? "";
          q.sectionId = q.sectionId ?? null;
          q.imageUrl = q.imageUrl ?? null;

          return q as Question;
        })
        : [];

      const safeTest: TestSet = {
        ...fullTest,
        questions: normalizedQuestions,
        readingSections: fullTest.readingSections || [],
        listeningSections: fullTest.listeningSections || [],
      };

      setViewingTest(safeTest);
      setEditedQuestions(JSON.parse(JSON.stringify(normalizedQuestions || [])));
      setQuestionImageFiles(
        Array.from({ length: normalizedQuestions.length }, () => null)
      );
      setQuestionImageUploadState(
        Array.from({ length: normalizedQuestions.length }, () => ({
          uploading: false,
          error: null,
        }))
      );
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
        sectionId: null,
      },
    ]);
    setQuestionImageFiles((prev) => [...prev, null]);
    setQuestionImageUploadState((prev) => [
      ...prev,
      { uploading: false, error: null },
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (!confirm("Remove this question?")) return;
    setEditedQuestions((prev) => prev.filter((_, i) => i !== idx));
    setQuestionImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setQuestionImageUploadState((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: [...(q.options || []), { text: "" }] }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = (q.options || []).filter((_, oi) => oi !== optIdx);
        const newCorrect = Math.min(
          q.correctIndex ?? 0,
          Math.max(0, newOpts.length - 1)
        );
        return { ...q, options: newOpts, correctIndex: newCorrect };
      })
    );
  };

  // ---------- Image upload handlers ----------

  function handleQuestionImageFileSelected(idx: number, file?: File) {
    setQuestionImageFiles((prev) => {
      const next = [...prev];
      next[idx] = file || null;
      return next;
    });
    setQuestionImageUploadState((prev) => {
      const next = [...prev];
      next[idx] = { uploading: false, error: null };
      return next;
    });
  }

  async function uploadImageForQuestion(idx: number) {
    const file = questionImageFiles[idx];
    if (!file) {
      setQuestionImageUploadState((prev) => {
        const next = [...prev];
        next[idx] = { uploading: false, error: "Choose an image file first" };
        return next;
      });
      return;
    }

    setQuestionImageUploadState((prev) => {
      const next = [...prev];
      next[idx] = { uploading: true, error: null };
      return next;
    });

    try {
      const form = new FormData();
      form.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL;
      const fullUrl = API_BASE + "/media/upload";

      const token =
        typeof window !== "undefined" ? localStorage.getItem("celts_token") : null;
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
        setQuestionImageUploadState((prev) => {
          const next = [...prev];
          next[idx] = {
            uploading: false,
            error: parsed?.message || parsed?.error || `Upload failed (${resp.status})`,
          };
          return next;
        });
        return;
      }

      const returnedUrl = parsed?.url || parsed?.audioUrl || parsed?.data?.url || null;
      if (!returnedUrl) {
        setQuestionImageUploadState((prev) => {
          const next = [...prev];
          next[idx] = {
            uploading: false,
            error: "Upload succeeded but no URL returned.",
          };
          return next;
        });
        return;
      }

      // Attach URL to the question
      setEditedQuestions((prev) =>
        prev.map((q, i) =>
          i === idx ? { ...q, imageUrl: returnedUrl } : q
        )
      );

      const provider = parsed?.provider || "unknown";
      const successMessage =
        provider === "S3"
          ? "Image uploaded to cloud storage"
          : "Image uploaded to local storage";

      setQuestionImageUploadState((prev) => {
        const next = [...prev];
        next[idx] = { uploading: false, error: null, successMessage };
        return next;
      });

      setTimeout(() => {
        setQuestionImageUploadState((prev) => {
          const next = [...prev];
          next[idx] = { ...next[idx], successMessage: undefined };
          return next;
        });
      }, 3000);
    } catch (err: any) {
      setQuestionImageUploadState((prev) => {
        const next = [...prev];
        next[idx] = {
          uploading: false,
          error: err?.message || "Upload failed",
        };
        return next;
      });
    }
  }

  // ---------- Save test + questions ----------

  const saveQuestions = async () => {
    if (!viewingTest) return;
    setQuestionsSaving(true);

    try {
      // validations
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
          if (
            typeof q.correctIndex !== "number" ||
            q.correctIndex < 0 ||
            q.correctIndex >= q.options.length
          ) {
            alert(`Question ${i + 1} has invalid correct answer`);
            setQuestionsSaving(false);
            return;
          }
        }
        if (q.questionType === "match") {
          const left = q.leftItems || [];
          const right = q.rightItems || [];
          if (
            left.length < 2 ||
            right.length < 2 ||
            left.length !== right.length
          ) {
            alert(
              `Question ${i + 1} (Match) must have equal left/right items (at least 2).`
            );
            setQuestionsSaving(false);
            return;
          }
          for (let j = 0; j < left.length; j++) {
            if (!left[j] || !left[j].trim()) {
              alert(
                `Question ${i + 1} (Match) left item ${j + 1} is empty.`
              );
              setQuestionsSaving(false);
              return;
            }
            if (!right[j] || !right[j].trim()) {
              alert(
                `Question ${i + 1} (Match) right item ${j + 1} is empty.`
              );
              setQuestionsSaving(false);
              return;
            }
          }
          const opts = q.options || [];
          if (opts.length < 3 || opts.length > 4) {
            alert(
              `Question ${i + 1} (Match) must have 3–4 options.`
            );
            setQuestionsSaving(false);
            return;
          }
          if (
            typeof q.correctIndex !== "number" ||
            q.correctIndex < 0 ||
            q.correctIndex >= opts.length
          ) {
            alert(
              `Question ${i + 1} (Match) must have a valid correct option selected.`
            );
            setQuestionsSaving(false);
            return;
          }
        }
      }

      const sanitizedQuestions = editedQuestions.map((q) => {
        const base: any = {
          prompt: q.prompt ?? "",
          marks: typeof q.marks === "number" ? q.marks : 1,
          questionType: q.questionType || "mcq",
          explanation: q.explanation || "",
          sectionId: q.sectionId || null,
        };

        if (base.questionType === "mcq") {
          base.options = Array.isArray(q.options)
            ? q.options.map((o) => ({ text: o.text || "" }))
            : [{ text: "" }, { text: "" }];
          base.correctIndex =
            typeof q.correctIndex === "number" ? q.correctIndex : 0;
        } else if (base.questionType === "writing") {
          base.wordLimit =
            typeof q.wordLimit === "number" ? q.wordLimit : undefined;
          base.imageUrl = q.imageUrl || null;
        } else if (base.questionType === "speaking") {
          base.speakingMode = q.speakingMode || "audio";
          base.recordLimitSeconds =
            typeof q.recordLimitSeconds === "number"
              ? q.recordLimitSeconds
              : undefined;
          base.imageUrl = q.imageUrl || null;
        } else if (base.questionType === "match") {
          base.leftItems = Array.isArray(q.leftItems) ? q.leftItems : [];
          base.rightItems = Array.isArray(q.rightItems) ? q.rightItems : [];
          base.options = Array.isArray(q.options)
            ? q.options.map((o) => ({ text: o.text || "" }))
            : [];
          base.correctIndex =
            typeof q.correctIndex === "number" ? q.correctIndex : 0;
        }

        if (q._id) base._id = q._id;
        return base;
      });

      const payload: any = {
        questions: sanitizedQuestions,
      };

      if (typeof viewingTest.title === "string")
        payload.title = viewingTest.title;
      if (typeof viewingTest.description === "string")
        payload.description = viewingTest.description;
      if (typeof viewingTest.passage === "string")
        payload.passage = viewingTest.passage;
      if (typeof viewingTest.audioUrl === "string")
        payload.audioUrl = viewingTest.audioUrl;
      if (typeof viewingTest.timeLimitMinutes !== "undefined")
        payload.timeLimitMinutes = viewingTest.timeLimitMinutes;
      if (typeof viewingTest.listenLimit !== "undefined")
        payload.listenLimit = viewingTest.listenLimit;

      if (Array.isArray(viewingTest.readingSections))
        payload.readingSections = viewingTest.readingSections;
      if (Array.isArray(viewingTest.listeningSections))
        payload.listeningSections = viewingTest.listeningSections;

      console.log("[saveQuestions] payload:", payload);

      const res = await api.apiPut(`/admin/testSet/${viewingTest._id}`, payload);

      setQuestionsSaving(false);

      if (!res.ok) {
        console.error("[saveQuestions] server error:", res);
        const serverMsg =
          res.error?.message ||
          res.data?.message ||
          `Server responded ${res.status}`;
        alert(serverMsg);
        return;
      }

      const updatedTest: TestSet = res.data?.test || res.data;

      setTests((prev) =>
        prev.map((t) =>
          t._id === viewingTest._id
            ? updatedTest || {
              ...t,
              questions: sanitizedQuestions,
              title: viewingTest.title,
              description: viewingTest.description,
            }
            : t
        )
      );

      setViewingTest(null);
      setEditedQuestions([]);
      setQuestionImageFiles([]);
      setQuestionImageUploadState([]);
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
      const res = await api.apiDelete(`/admin/testSet/${id}`);
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

  // Helpers to get section lists for dropdown
  const getSectionOptions = (test: TestSet | null) => {
    if (!test) return [];
    if (test.type === "reading") {
      return (test.readingSections || []).map((s) => ({
        id: s.id,
        label: s.title || s.id,
      }));
    }
    if (test.type === "listening") {
      return (test.listeningSections || []).map((s) => ({
        id: s.id,
        label: s.title || s.id,
      }));
    }
    return [];
  };

  const sectionOptions = getSectionOptions(viewingTest);

  const filteredBatches = batches.filter((b) =>
    b.name.toLowerCase().includes(batchSearch.toLowerCase())
  );


  const assignedBatchIds: string[] = Array.isArray(
    removeBatchTest?.assignedBatches
  )
    ? removeBatchTest!.assignedBatches.map((b: any) =>
      typeof b === "string" ? b : b._id
    )
    : [];
  const assignedBatchList = batches.filter((b) =>
    assignedBatchIds.includes(b._id)
  );
  const filteredRemoveBatches = assignedBatchList.filter((b) =>
    b.name.toLowerCase().includes(removeSearch.toLowerCase())
  );


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Your Tests</h1>
        <p className="text-muted-foreground">
          View, assign, edit questions, or delete tests you created.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Title
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Type
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Questions
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Actions
              </th>
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
                  <td className="px-6 py-4 text-sm font-medium">
                    {test.title}
                  </td>
                  <td className="px-6 py-4 text-sm">{test.type}</td>
                  <td className="px-6 py-4 text-sm">
                    {test.assignedBatches && test.assignedBatches.length > 0 ? (
                      <button
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        onClick={() => {
                          setRemoveBatchTest(test);
                          setRemoveSelected([]);
                          setRemoveSearch("");
                        }}
                      >
                        {test.assignedBatches.length} batches
                        <span className="text-xs">▼</span>
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not assigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {test.questions?.length ?? 0}
                  </td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openQuestionsDialog(test)}
                    >
                      <Eye className="w-4 h-4" /> View Questions
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/admin/proctorLogs?testId=${test._id}`
                        )
                      }
                    >
                      <Shield className="w-4 h-4" /> Proctor Logs
                    </Button>
                    <Button size="sm" onClick={() => openAssignDialog(test)}>
                      <Layers className="w-4 h-4" /> Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteTest(test._id)}
                    >
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
      <Dialog
        open={!!assigningTest}
        onOpenChange={() => {
          setAssigningTest(null);
          setAssignSelected([]);
          setBatchSearch("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Test to Batches</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Search */}
            <div>
              <label className="text-sm block mb-1">Search batches</label>
              <Input
                placeholder="Type to search..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />
            </div>

            {/* Select all / clear */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAssignSelected(filteredBatches.map((b) => b._id))
                }
              >
                Select All
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setAssignSelected([])}
              >
                Clear All
              </Button>
            </div>

            {/* Batch list */}
            <div className="max-h-60 overflow-auto border rounded p-2 space-y-2">
              {filteredBatches.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No batches found
                </div>
              ) : (
                filteredBatches.map((b) => (
                  <label
                    key={b._id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assignSelected.includes(b._id)}
                      onChange={(e) => {
                        setAssignSelected((prev) =>
                          e.target.checked
                            ? [...prev, b._id]
                            : prev.filter((id) => id !== b._id)
                        );
                      }}
                    />
                    {b.name}
                  </label>
                ))
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Selected batches: {assignSelected.length}
            </div>

            <div>
              <small className="text-muted-foreground">
                Selected test: <strong>{assigningTest?.title}</strong>
              </small>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssigningTest(null);
                setAssignSelected([]);
                setBatchSearch("");
              }}
            >
              Cancel
            </Button>

            <Button
              disabled={assignLoading || assignSelected.length === 0}
              onClick={handleAssignToBatch}
            >
              {assignLoading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeBatchTest}
        onOpenChange={() => {
          setRemoveBatchTest(null);
          setRemoveSelected([]);
          setRemoveSearch("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove Batches ({removeBatchTest?.title})
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <Input
            placeholder="Search assigned batches..."
            value={removeSearch}
            onChange={(e) => setRemoveSearch(e.target.value)}
          />

          {/* Select all / clear */}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setRemoveSelected(filteredRemoveBatches.map((b) => b._id))
              }
            >
              Select All
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setRemoveSelected([])}
            >
              Clear All
            </Button>
          </div>

          {/* Batch list */}
          <div className="mt-3 max-h-60 overflow-auto border rounded p-2 space-y-2">
            {filteredRemoveBatches.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No assigned batches
              </div>
            ) : (
              filteredRemoveBatches.map((b) => (
                <label
                  key={b._id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={removeSelected.includes(b._id)}
                    onChange={(e) => {
                      setRemoveSelected((prev) =>
                        e.target.checked
                          ? [...prev, b._id]
                          : prev.filter((id) => id !== b._id)
                      );
                    }}
                  />
                  {b.name}
                </label>
              ))
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Selected: {removeSelected.length}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveBatchTest(null)}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              disabled={removeLoading || removeSelected.length === 0}
              onClick={async () => {
                if (!removeBatchTest) return;

                if (
                  !confirm(
                    `Remove ${removeSelected.length} batch(es) from this test?`
                  )
                )
                  return;

                setRemoveLoading(true);

                await api.apiPatch(
                  `/admin/testSet/${removeBatchTest._id}/assign-batches`,
                  {
                    batchIds: removeSelected,
                    mode: "remove",
                  }
                );

                await fetchTests();

                setRemoveLoading(false);
                setRemoveBatchTest(null);
                setRemoveSelected([]);
              }}
            >
              {removeLoading ? "Removing..." : "Remove Selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* QUESTIONS DIALOG */}
      <Dialog open={!!viewingTest} onOpenChange={() => setViewingTest(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Test Details — {viewingTest?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3 max-h-[70vh] overflow-auto">
            {viewingTest && (
              <div className="p-3 border rounded bg-gray-50 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-sm block mb-1">Title</label>
                    <Input
                      value={viewingTest.title || ""}
                      onChange={(e) =>
                        setViewingTest((s) =>
                          s ? { ...s, title: e.target.value } : s
                        )
                      }
                    />
                    <label className="text-sm block mt-2 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={viewingTest.description || ""}
                      onChange={(e) =>
                        setViewingTest((s) =>
                          s ? { ...s, description: e.target.value } : s
                        )
                      }
                      className="w-full p-2 border rounded"
                    />
                    <div className="mt-2 text-xs">
                      <span className="inline-block px-2 py-1 rounded bg-secondary text-secondary-foreground mr-2 capitalize">
                        {viewingTest.type}
                      </span>
                      {viewingTest.timeLimitMinutes ? (
                        <span className="text-sm ml-2">
                          Time limit: {viewingTest.timeLimitMinutes} min
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {viewingTest.createdAt
                      ? new Date(
                        viewingTest.createdAt
                      ).toLocaleString()
                      : null}
                  </div>
                </div>

                {/* READING */}
                {viewingTest.type === "reading" && (
                  <div className="space-y-3 mt-3">
                    {(viewingTest.readingSections ||
                      []).length > 0 ? (
                      <>
                        <h4 className="text-sm font-semibold">
                          Passages
                        </h4>
                        {viewingTest.readingSections!.map(
                          (sec, idx) => (
                            <div
                              key={sec.id}
                              className="border rounded p-2 space-y-2"
                            >
                              <div className="flex gap-2 items-center">
                                <span className="text-xs font-semibold">
                                  Passage {idx + 1}
                                </span>
                                <Input
                                  className="text-xs"
                                  placeholder="Title (optional)"
                                  value={sec.title || ""}
                                  onChange={(e) =>
                                    setViewingTest((s) => {
                                      if (!s) return s;
                                      const next =
                                        [...(s.readingSections || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        title: e.target.value,
                                      };
                                      return {
                                        ...s,
                                        readingSections: next,
                                      };
                                    })
                                  }
                                />
                              </div>
                              <textarea
                                className="w-full p-2 border rounded text-sm h-32"
                                value={sec.passage}
                                onChange={(e) =>
                                  setViewingTest((s) => {
                                    if (!s) return s;
                                    const next =
                                      [...(s.readingSections || [])];
                                    next[idx] = {
                                      ...next[idx],
                                      passage: e.target.value,
                                    };
                                    return {
                                      ...s,
                                      readingSections: next,
                                    };
                                  })
                                }
                              />
                            </div>
                          )
                        )}
                      </>
                    ) : (
                      <>
                        <label className="text-sm block mb-1">
                          Passage
                        </label>
                        <textarea
                          value={viewingTest.passage || ""}
                          onChange={(e) =>
                            setViewingTest((s) =>
                              s
                                ? { ...s, passage: e.target.value }
                                : s
                            )
                          }
                          className="w-full p-2 border rounded h-48"
                        />
                      </>
                    )}
                  </div>
                )}

                {/* LISTENING */}
                {viewingTest.type === "listening" && (
                  <div className="space-y-3 mt-3">
                    {(viewingTest.listeningSections ||
                      []).length > 0 ? (
                      <>
                        <h4 className="text-sm font-semibold">
                          Audios
                        </h4>
                        {viewingTest.listeningSections!.map(
                          (sec, idx) => (
                            <div
                              key={sec.id}
                              className="border rounded p-2 space-y-2"
                            >
                              <div className="flex gap-2 items-center">
                                <span className="text-xs font-semibold">
                                  Audio {idx + 1}
                                </span>
                                <Input
                                  className="text-xs"
                                  placeholder="Title (optional)"
                                  value={sec.title || ""}
                                  onChange={(e) =>
                                    setViewingTest((s) => {
                                      if (!s) return s;
                                      const next =
                                        [...(s.listeningSections || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        title: e.target.value,
                                      };
                                      return {
                                        ...s,
                                        listeningSections: next,
                                      };
                                    })
                                  }
                                />
                              </div>
                              <Input
                                placeholder="Audio URL"
                                value={sec.audioUrl}
                                onChange={(e) =>
                                  setViewingTest((s) => {
                                    if (!s) return s;
                                    const next =
                                      [...(s.listeningSections || [])];
                                    next[idx] = {
                                      ...next[idx],
                                      audioUrl: e.target.value,
                                    };
                                    return {
                                      ...s,
                                      listeningSections: next,
                                    };
                                  })
                                }
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-xs">
                                  Listen limit:
                                </span>
                                <Input
                                  type="number"
                                  className="w-24 h-8 text-xs"
                                  value={sec.listenLimit ?? 1}
                                  onChange={(e) =>
                                    setViewingTest((s) => {
                                      if (!s) return s;
                                      const next =
                                        [...(s.listeningSections || [])];
                                      next[idx] = {
                                        ...next[idx],
                                        listenLimit: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      };
                                      return {
                                        ...s,
                                        listeningSections: next,
                                      };
                                    })
                                  }
                                />
                              </div>
                              {sec.audioUrl && (
                                <audio
                                  controls
                                  src={sec.audioUrl}
                                  className="w-full mt-1"
                                />
                              )}
                            </div>
                          )
                        )}
                      </>
                    ) : (
                      <>
                        <label className="text-sm block mb-1">
                          Audio URL
                        </label>
                        <Input
                          value={viewingTest.audioUrl || ""}
                          onChange={(e) =>
                            setViewingTest((s) =>
                              s
                                ? { ...s, audioUrl: e.target.value }
                                : s
                            )
                          }
                        />
                        <div className="mt-2 text-sm">
                          Listen limit: {viewingTest.listenLimit ?? 1}
                        </div>
                        {viewingTest.audioUrl ? (
                          <audio
                            controls
                            src={viewingTest.audioUrl}
                            className="w-full mt-2"
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                {viewingTest.type === "writing" && (
                  <div className="mt-4 text-sm">
                    This is a writing test.
                  </div>
                )}
                {viewingTest.type === "speaking" && (
                  <div className="mt-4 text-sm">
                    This is a speaking test.
                  </div>
                )}

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    Assigned batches
                  </div>
                  {viewingTest.assignedBatches &&
                    viewingTest.assignedBatches.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {viewingTest.assignedBatches.map((bid) => {
                        const b = batches.find((x) => x._id === bid);
                        return (
                          <span
                            key={bid}
                            className="px-2 py-1 rounded bg-muted text-xs"
                          >
                            {b ? b.name : bid}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Not assigned
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editable questions list */}
            <div>
              <h4 className="font-semibold mb-2">
                Questions ({editedQuestions.length})
              </h4>
              {editedQuestions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No questions.
                </div>
              ) : (
                editedQuestions.map((q, qi) => {
                  const imgState =
                    questionImageUploadState[qi] || {
                      uploading: false,
                      error: null,
                    };
                  const selectedFile = questionImageFiles[qi] || null;

                  return (
                    <div key={q._id ?? qi} className="p-3 border rounded mb-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm mb-1">
                            Type
                          </label>
                          <select
                            value={q.questionType || "mcq"}
                            onChange={(e) => {
                              const qt =
                                e.target.value as Question["questionType"];
                              if (qt === "mcq") {
                                handleQuestionChange(qi, {
                                  ...q,
                                  questionType: "mcq",
                                  options:
                                    q.options && q.options.length
                                      ? q.options
                                      : [{ text: "" }, { text: "" }],
                                  correctIndex: q.correctIndex ?? 0,
                                  leftItems: undefined,
                                  rightItems: undefined,
                                });
                              } else if (qt === "writing") {
                                handleQuestionChange(qi, {
                                  ...q,
                                  questionType: "writing",
                                  options: undefined,
                                  correctIndex: undefined,
                                  leftItems: undefined,
                                  rightItems: undefined,
                                });
                              } else if (qt === "speaking") {
                                handleQuestionChange(qi, {
                                  ...q,
                                  questionType: "speaking",
                                  options: undefined,
                                  correctIndex: undefined,
                                  leftItems: undefined,
                                  rightItems: undefined,
                                });
                              } else if (qt === "match") {
                                handleQuestionChange(qi, {
                                  ...q,
                                  questionType: "match",
                                  leftItems: q.leftItems && q.leftItems.length
                                    ? q.leftItems
                                    : ["", "", ""],
                                  rightItems: q.rightItems && q.rightItems.length
                                    ? q.rightItems
                                    : ["", "", ""],
                                  options:
                                    q.options && q.options.length >= 3
                                      ? q.options.slice(0, 4)
                                      : [{ text: "" }, { text: "" }, { text: "" }],
                                  correctIndex:
                                    typeof q.correctIndex === "number"
                                      ? q.correctIndex
                                      : 0,
                                });
                              }
                            }}
                            className="w-full p-2 border rounded"
                          >
                            <option value="mcq">MCQ</option>
                            <option value="match">Match</option>
                            <option value="writing">Writing</option>
                            <option value="speaking">Speaking</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm mb-1">
                            Prompt
                          </label>
                          <Input
                            value={q.prompt}
                            onChange={(e) =>
                              handleQuestionChange(qi, {
                                ...q,
                                prompt: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      {/* Section selector for reading/listening MCQ & MATCH */}
                      {viewingTest &&
                        (viewingTest.type === "reading" ||
                          viewingTest.type === "listening") &&
                        (q.questionType === "mcq" ||
                          q.questionType === "match") &&
                        sectionOptions.length > 0 && (
                          <div className="mt-2">
                            <label className="text-xs block mb-1">
                              Section (passage / audio)
                            </label>
                            <select
                              className="w-full p-2 border rounded text-xs"
                              value={q.sectionId || ""}
                              onChange={(e) =>
                                handleQuestionChange(qi, {
                                  ...q,
                                  sectionId: e.target.value || null,
                                })
                              }
                            >
                              <option value="">
                                — No section (not recommended) —
                              </option>
                              {sectionOptions.map((sec) => (
                                <option key={sec.id} value={sec.id}>
                                  {sec.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                      {/* MCQ UI */}
                      {q.questionType === "mcq" && (
                        <div className="mt-3">
                          <label className="block text-sm mb-1">
                            Options (select correct)
                          </label>
                          <div className="space-y-2">
                            {(q.options || []).map((opt, oi) => (
                              <div
                                key={oi}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="radio"
                                  name={`correct-${qi}`}
                                  checked={(q.correctIndex ?? 0) === oi}
                                  onChange={() =>
                                    handleQuestionChange(qi, {
                                      ...q,
                                      correctIndex: oi,
                                    })
                                  }
                                />
                                <Input
                                  value={opt.text}
                                  onChange={(e) => {
                                    const newOpts = (q.options || []).map(
                                      (o, idx) =>
                                        idx === oi
                                          ? { text: e.target.value }
                                          : o
                                    );
                                    handleQuestionChange(qi, {
                                      ...q,
                                      options: newOpts,
                                    });
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeOption(qi, oi)}
                                >
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

                      {/* MATCH UI */}
                      {q.questionType === "match" && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left items */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">
                                  Left side (keys: a, b, c, ...)
                                </span>
                              </div>
                              <div className="space-y-2">
                                {(q.leftItems || []).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="text-xs w-5 text-slate-500">
                                      {String.fromCharCode(97 + idx)}.
                                    </div>
                                    <Input
                                      value={item}
                                      onChange={(e) => {
                                        const left = [...(q.leftItems || [])];
                                        left[idx] = e.target.value;
                                        const right = [...(q.rightItems || [])];
                                        // ensure same length
                                        if (right.length < left.length) {
                                          right.push("");
                                        }
                                        handleQuestionChange(qi, {
                                          ...q,
                                          leftItems: left,
                                          rightItems: right,
                                        });
                                      }}
                                      placeholder={`Left item ${idx + 1}`}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const left = [...(q.leftItems || [])];
                                        const right = [...(q.rightItems || [])];
                                        if (left.length <= 2) return;
                                        left.splice(idx, 1);
                                        right.splice(idx, 1);
                                        handleQuestionChange(qi, {
                                          ...q,
                                          leftItems: left,
                                          rightItems: right,
                                        });
                                      }}
                                    >
                                      X
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    const left = [...(q.leftItems || [])];
                                    const right = [...(q.rightItems || [])];
                                    if (left.length >= 8) return;
                                    left.push("");
                                    right.push("");
                                    handleQuestionChange(qi, {
                                      ...q,
                                      leftItems: left,
                                      rightItems: right,
                                    });
                                  }}
                                >
                                  Add row
                                </Button>
                              </div>
                            </div>

                            {/* Right items */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium">
                                  Right side (values: i, ii, iii, ...)
                                </span>
                              </div>
                              <div className="space-y-2">
                                {(q.rightItems || []).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="text-xs w-7 text-slate-500">
                                      {ROMAN[idx] || `${idx + 1}`}.
                                    </div>
                                    <Input
                                      value={item}
                                      onChange={(e) => {
                                        const right = [...(q.rightItems || [])];
                                        right[idx] = e.target.value;
                                        handleQuestionChange(qi, {
                                          ...q,
                                          rightItems: right,
                                        });
                                      }}
                                      placeholder={`Right item ${idx + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Match options */}
                          <div>
                            <label className="text-xs font-medium block mb-1">
                              Options (3–4 combinations like &quot;a-i, b-iii, c-ii&quot;)
                            </label>
                            <div className="space-y-2">
                              {(q.options || []).map((opt, oi) => (
                                <div
                                  key={oi}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="radio"
                                    name={`correct-match-${qi}`}
                                    checked={(q.correctIndex ?? 0) === oi}
                                    onChange={() =>
                                      handleQuestionChange(qi, {
                                        ...q,
                                        correctIndex: oi,
                                      })
                                    }
                                  />
                                  <Input
                                    value={opt.text}
                                    onChange={(e) => {
                                      const opts = [...(q.options || [])];
                                      opts[oi] = { text: e.target.value };
                                      handleQuestionChange(qi, {
                                        ...q,
                                        options: opts,
                                      });
                                    }}
                                    placeholder={`Combination ${oi + 1} (e.g. a-i, b-iii, c-ii)`}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const opts = [...(q.options || [])];
                                      if (opts.length <= 3) return;
                                      opts.splice(oi, 1);
                                      let correct = q.correctIndex ?? 0;
                                      if (correct >= opts.length) {
                                        correct = 0;
                                      }
                                      handleQuestionChange(qi, {
                                        ...q,
                                        options: opts,
                                        correctIndex: correct,
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              <Button
                                size="sm"
                                onClick={() => {
                                  const opts = [...(q.options || [])];
                                  if (opts.length >= 4) return;
                                  opts.push({ text: "" });
                                  handleQuestionChange(qi, {
                                    ...q,
                                    options: opts,
                                  });
                                }}
                              >
                                Add option
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs block mb-1">
                                Marks
                              </label>
                              <Input
                                type="number"
                                value={q.marks ?? 1}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    marks: Number(e.target.value || 1),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-xs block mb-1">
                                Explanation (optional)
                              </label>
                              <Input
                                value={q.explanation ?? ""}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    explanation: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Writing UI */}
                      {q.questionType === "writing" && (
                        <>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-sm block mb-1">
                                Word limit (optional)
                              </label>
                              <Input
                                type="number"
                                value={q.wordLimit ?? ""}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    wordLimit: e.target.value
                                      ? Number(e.target.value)
                                      : undefined,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">
                                Marks
                              </label>
                              <Input
                                type="number"
                                value={q.marks ?? 5}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    marks: Number(e.target.value || 1),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">
                                Explanation (optional)
                              </label>
                              <Input
                                value={q.explanation ?? ""}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    explanation: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* Writing image section */}
                          <div className="mt-3">
                            <label className="text-xs block mb-1">
                              Image (optional)
                            </label>
                            <Input
                              value={q.imageUrl || ""}
                              onChange={(e) =>
                                handleQuestionChange(qi, {
                                  ...q,
                                  imageUrl: e.target.value,
                                })
                              }
                              placeholder="Or paste an image URL"
                            />
                            {q.imageUrl && (
                              <img
                                src={q.imageUrl}
                                alt="Writing prompt"
                                className="mt-2 max-h-40 rounded-md border border-slate-200 object-contain"
                              />
                            )}
                            <div className="mt-2 flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleQuestionImageFileSelected(
                                    qi,
                                    e.target.files?.[0] || undefined
                                  )
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={imgState.uploading || !selectedFile}
                                onClick={() => uploadImageForQuestion(qi)}
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
                          </div>
                        </>
                      )}

                      {/* Speaking UI */}
                      {q.questionType === "speaking" && (
                        <>
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-sm block mb-1">
                                Mode
                              </label>
                              <select
                                value={q.speakingMode || "audio"}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    speakingMode: e.target.value as any,
                                  })
                                }
                                className="w-full p-2 border rounded"
                              >
                                <option value="audio">
                                  Record audio
                                </option>
                                <option value="video">
                                  Record video
                                </option>
                                <option value="oral">Oral (live)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm block mb-1">
                                Record limit (seconds)
                              </label>
                              <Input
                                type="number"
                                value={q.recordLimitSeconds ?? 60}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    recordLimitSeconds: Number(
                                      e.target.value || 0
                                    ),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">
                                Marks
                              </label>
                              <Input
                                type="number"
                                value={q.marks ?? 5}
                                onChange={(e) =>
                                  handleQuestionChange(qi, {
                                    ...q,
                                    marks: Number(e.target.value || 1),
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* Speaking image section */}
                          <div className="mt-3">
                            <label className="text-xs block mb-1">
                              Image (optional)
                            </label>
                            <Input
                              value={q.imageUrl || ""}
                              onChange={(e) =>
                                handleQuestionChange(qi, {
                                  ...q,
                                  imageUrl: e.target.value,
                                })
                              }
                              placeholder="Or paste an image URL"
                            />
                            {q.imageUrl && (
                              <img
                                src={q.imageUrl}
                                alt="Speaking prompt"
                                className="mt-2 max-h-40 rounded-md border border-slate-200 object-contain"
                              />
                            )}
                            <div className="mt-2 flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleQuestionImageFileSelected(
                                    qi,
                                    e.target.files?.[0] || undefined
                                  )
                                }
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={imgState.uploading || !selectedFile}
                                onClick={() => uploadImageForQuestion(qi)}
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
                          </div>
                        </>
                      )}

                      <div className="mt-3 flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          Question #{qi + 1}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeQuestion(qi)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div>
                <Button onClick={addQuestion}>Add question</Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewingTest(null);
                setEditedQuestions([]);
                setQuestionImageFiles([]);
                setQuestionImageUploadState([]);
              }}
            >
              Cancel
            </Button>
            <Button disabled={questionsSaving} onClick={saveQuestions}>
              {questionsSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
