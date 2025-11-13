"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileText, Users, Settings } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/create_test", label: "Create Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/view_test", label: "View Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
];

type SubmissionSummary = {
  submissionId?: string;
  testId?: string | null;
  testTitle?: string | null;
  testType?: string | null; // reading|writing|listening|speaking
  score?: number | null;
  bandScore?: number | null;
  createdAt?: string | null;
};

interface Student {
  id: string;
  name: string;
  email?: string;
  systemId?: string;
  testsCompleted: number;
  averageScore: number;
  // enriched fields:
  submissions?: SubmissionSummary[];
  perTypeLatest?: {
    reading?: SubmissionSummary | null;
    writing?: SubmissionSummary | null;
    listening?: SubmissionSummary | null;
    speaking?: SubmissionSummary | null;
  };
  bandScore?: number | null;
}

interface Batch {
  id: string;
  name: string;
  students: Student[];
}

export default function StudentManagementPage() {
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

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFacultyBatches();
  }, []);

  async function loadFacultyBatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/faculty/batches");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load batches");
        setBatches([]);
        setLoading(false);
        return;
      }

      const batchesData: Batch[] = (res.data || []).map((b: any) => ({
        id: b._id,
        name: b.name,
        students: (Array.isArray(b.students) ? b.students : []).map((s: any) => ({
          id: s._id,
          name: s.name || "Unknown",
          email: s.email || "",
          systemId: s.systemId || "",
          testsCompleted: 0,
          averageScore: 0,
          submissions: [],
          perTypeLatest: { reading: null, writing: null, listening: null, speaking: null },
          bandScore: null,
        })),
      }));

      setBatches(batchesData);
      if (batchesData.length > 0) setSelectedBatchId(batchesData[0].id);

      // Enrich each batch in background
      for (const batch of batchesData) {
        if (batch.students && batch.students.length > 0) {
          enrichStudentsWithScores(batch.id, batch.students).catch((e) => {
            console.error("Error enriching students for batch", batch.id, e);
          });
        }
      }
    } catch (err: any) {
      console.error("Error loading faculty batches:", err);
      setError(err?.message || "Network error loading data");
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }

  // Try to fetch submissions for a student. Adjust endpoint if your server differs.
  async function fetchSubmissionsForStudent(studentId: string) {
    try {
      const res = await api.apiGet(`/submissions?student=${studentId}`);
      if (!res.ok) {
        // fallback attempt (faculty-specific path)
        const fallback = await api.apiGet(`/faculty/students/${studentId}/submissions`);
        if (!fallback.ok) {
          console.warn("Submissions endpoints failed for student", studentId, res, fallback);
          return [];
        }
        return fallback.data || [];
      }
      return res.data || [];
    } catch (err) {
      console.error("fetchSubmissionsForStudent error:", err);
      return [];
    }
  }

  // Normalize submissions and compute latest per type + final band
  async function enrichStudentsWithScores(batchId: string, students: Student[]) {
    setEnriching(true);
    try {
      const promises = students.map(async (st) => {
        try {
          const subsRaw = await fetchSubmissionsForStudent(st.id);
          const subs: SubmissionSummary[] = (Array.isArray(subsRaw) ? subsRaw : []).map((x: any) => {
            // Determine test object and type robustly
            const testObj = x.testSet || x.test || x.testId || x.test_set || x.test_set_id || null;
            let testTitle = (x.testTitle || x.testName || x.title) ?? null;
            let testId = null;
            let testType = (x.type || x.testType || x.questionType) ?? null;

            if (testObj) {
              if (typeof testObj === "string") {
                testId = testObj;
              } else if (typeof testObj === "object") {
                testId = testObj._id || testObj.id || null;
                testTitle = testTitle || testObj.title || testObj.name || null;
                testType = testType || testObj.type || testObj.testType || null;
              }
            }

            return {
              submissionId: x._id || x.id || null,
              testId,
              testTitle,
              testType: testType ? String(testType).toLowerCase() : null,
              score: (typeof x.score === "number" ? x.score : (typeof x.marks === "number" ? x.marks : (typeof x.marksObtained === "number" ? x.marksObtained : null))),
              bandScore: (typeof x.bandScore === "number" ? x.bandScore : (typeof x.band === "number" ? x.band : null)),
              createdAt: x.createdAt || x.submittedAt || null,
            } as SubmissionSummary;
          });

          // For each type, pick the latest submission (by createdAt) — if createdAt missing, pick the last in array
          const types = ["reading", "writing", "listening", "speaking"];
          const perTypeLatest: any = { reading: null, writing: null, listening: null, speaking: null };
          for (const t of types) {
            const ofType = subs.filter(s => (s.testType || "").toLowerCase() === t);
            if (ofType.length > 0) {
              // sort by createdAt desc (fall back to array order)
              ofType.sort((a, b) => {
                const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                return tb - ta;
              });
              perTypeLatest[t] = ofType[0];
            } else {
              perTypeLatest[t] = null;
            }
          }

          // compute final band: average of numeric bandScore values; if none, null
          const bands = subs.map(s => s.bandScore).filter(b => typeof b === "number");
          const bandScore = bands.length ? (bands.reduce((a: number, b: number) => a + b, 0) / bands.length) : null;

          const testsCompleted = subs.length;
          const avgScore = subs.length ? subs.reduce((a: number, b: any) => a + (b.score || 0), 0) / subs.length : 0;

          return {
            ...st,
            submissions: subs,
            perTypeLatest,
            bandScore,
            testsCompleted,
            averageScore: avgScore,
          } as Student;
        } catch (err) {
          console.error("Error enriching student", st.id, err);
          return st;
        }
      });

      const results = await Promise.all(promises);

      setBatches(prev => prev.map(b => (b.id === batchId ? { ...b, students: results } : b)));
    } finally {
      setEnriching(false);
    }
  }

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const filteredStudents = (selectedBatch?.students || []).filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.systemId || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStudents = filteredStudents.length;
  const avgTests = totalStudents ? (filteredStudents.reduce((sum, s) => sum + (s.testsCompleted || 0), 0) / totalStudents) : 0;
  const classAvgScore = totalStudents ? (filteredStudents.reduce((sum, s) => sum + (s.averageScore || 0), 0) / totalStudents) : 0;

  function downloadCSV() {
    const rows: string[][] = [];
    rows.push([
      "Name",
      "Email",
      "System ID",
      "Reading (score)",
      "Writing (score)",
      "Listening (score)",
      "Speaking (score)",
      "Band Score",
      "Tests Completed",
      "Average Score"
    ]);

    for (const s of filteredStudents) {
      const r = s.perTypeLatest?.reading?.score ?? "Not attempted";
      const w = s.perTypeLatest?.writing?.score ?? "Not attempted";
      const l = s.perTypeLatest?.listening?.score ?? "Not attempted";
      const sp = s.perTypeLatest?.speaking?.score ?? "Not attempted";
      rows.push([
        s.name || "",
        s.email || "",
        s.systemId || "",
        String(r),
        String(w),
        String(l),
        String(sp),
        s.bandScore != null ? String(Number(s.bandScore).toFixed(2)) : "",
        String(s.testsCompleted || 0),
        String(typeof s.averageScore === "number" ? s.averageScore.toFixed(2) : s.averageScore || "")
      ]);
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_batch_${selectedBatch?.name || "all"}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Student Management</h1>
          <p className="text-muted-foreground">Select a batch to view its students and per-test performance</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {loading ? <p>Loading batches...</p> :
            batches.length === 0 ? <p>No batches assigned.</p> :
              batches.map(b => (
                <Button key={b.id} variant={b.id === selectedBatchId ? "default" : "outline"} size="sm" onClick={() => {
                  setSelectedBatchId(b.id);
                  // lazy-enrich on demand
                  const batch = batches.find(x => x.id === b.id);
                  if (batch && batch.students && batch.students.length > 0) {
                    // if students not enriched (simple heuristic: submissions empty), enrich
                    if (!batch.students[0].submissions || batch.students[0].submissions.length === 0) {
                      enrichStudentsWithScores(b.id, batch.students).catch(console.error);
                    }
                  }
                }}>{b.name}</Button>
              ))
          }
        </div>

        <div className="flex items-center gap-4 mb-4">
          <Input placeholder="Search students by name, email or systemId..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1" />
          <Button onClick={() => loadFacultyBatches()}>Refresh</Button>
          <Button onClick={downloadCSV} variant="outline">Download CSV</Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">System ID</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Reading</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Writing</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Listening</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Speaking</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Band Score</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Tests Completed</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-6 text-center">Loading students...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center">No students in this batch.</td></tr>
                ) : (
                  filteredStudents.map(st => {
                    const r = st.perTypeLatest?.reading;
                    const w = st.perTypeLatest?.writing;
                    const l = st.perTypeLatest?.listening;
                    const sp = st.perTypeLatest?.speaking;
                    return (
                      <tr key={st.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-6 py-4 text-sm font-medium">{st.name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{st.email || "—"}</td>
                        <td className="px-6 py-4 text-sm">{st.systemId || "—"}</td>

                        <td className="px-6 py-4 text-center text-sm">{r ? (r.score != null ? String(r.score) : "Submitted") : "Not attempted"}</td>
                        <td className="px-6 py-4 text-center text-sm">{w ? (w.score != null ? String(w.score) : "Submitted") : "Not attempted"}</td>
                        <td className="px-6 py-4 text-center text-sm">{l ? (l.score != null ? String(l.score) : "Submitted") : "Not attempted"}</td>
                        <td className="px-6 py-4 text-center text-sm">{sp ? (sp.score != null ? String(sp.score) : "Submitted") : "Not attempted"}</td>

                        <td className="px-6 py-4 text-center text-sm">{st.bandScore != null ? Number(st.bandScore).toFixed(2) : "—"}</td>
                        <td className="px-6 py-4 text-center text-sm">{st.testsCompleted}</td>
                        <td className="px-6 py-4 text-center text-sm">{(st.averageScore || 0).toFixed(1)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedBatch && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Total Students</p>
              <p className="text-3xl font-bold">{totalStudents}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Avg Tests Completed</p>
              <p className="text-3xl font-bold">{avgTests.toFixed(1)}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-1">Batch Average Score</p>
              <p className="text-3xl font-bold">{classAvgScore.toFixed(1)}/9</p>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
