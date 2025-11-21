"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

type NullableNumber = number | null | undefined;

interface FacultyStatsSummary {
  totalStudentsInBatches: number;
  totalStudentsWithAnyTest: number;
  totalBatches: number;
  overallAvgBand: NullableNumber;
  readingAvg: NullableNumber;
  listeningAvg: NullableNumber;
  writingAvg: NullableNumber;
  speakingAvg: NullableNumber;
}

interface FacultyBatchFromApi {
  _id: string;
  name: string;
  totalStudentsInBatch?: number;
  studentsWithAnyTest?: number;
  studentsWithReading?: number;
  studentsWithListening?: number;
  studentsWithWriting?: number;
  studentsWithSpeaking?: number;
  averageBand?: NullableNumber;
  readingBand?: NullableNumber;
  listeningBand?: NullableNumber;
  writingBand?: NullableNumber;
  speakingBand?: NullableNumber;
}

interface StudentFromApi {
  _id: string;
  studentId?: string;
  name: string;
  email: string;
  systemId: string;
  batchName?: string | null;
  readingBand?: NullableNumber;
  listeningBand?: NullableNumber;
  writingBand?: NullableNumber;
  speakingBand?: NullableNumber;
  overallBand?: NullableNumber;
}

interface Student {
  id: string;
  name: string;
  email?: string;
  systemId?: string;
  batchName?: string | null;

  readingBand: NullableNumber;
  listeningBand: NullableNumber;
  writingBand: NullableNumber;
  speakingBand: NullableNumber;
  overallBand: NullableNumber;

  testsCompleted: number;
  averageScore: number;
}

interface Batch {
  id: string;
  name: string;
  totalStudentsInBatch: number;
  studentsWithAnyTest: number;
  studentsWithReading: number;
  studentsWithListening: number;
  studentsWithWriting: number;
  studentsWithSpeaking: number;
}

export function StudentDetail() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<FacultyStatsSummary | null>(null);

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------- Fetch stats from /faculty/stats --------
  async function loadFacultyStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/faculty/stats");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load stats");
        setBatches([]);
        setStudents([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      const data = res.data || {};
      const apiSummary: FacultyStatsSummary = {
        totalStudentsInBatches: data.summary?.totalStudentsInBatches ?? 0,
        totalStudentsWithAnyTest: data.summary?.totalStudentsWithAnyTest ?? 0,
        totalBatches: data.summary?.totalBatches ?? (data.batches?.length || 0),
        overallAvgBand: data.summary?.overallAvgBand ?? null,
        readingAvg: data.summary?.readingAvg ?? null,
        listeningAvg: data.summary?.listeningAvg ?? null,
        writingAvg: data.summary?.writingAvg ?? null,
        speakingAvg: data.summary?.speakingAvg ?? null,
      };
      setSummary(apiSummary);

      const apiBatches: FacultyBatchFromApi[] = Array.isArray(data.batches)
        ? data.batches
        : [];

      const mappedBatches: Batch[] = apiBatches.map((b) => ({
        id: b._id,
        name: b.name,
        totalStudentsInBatch: b.totalStudentsInBatch ?? 0,
        studentsWithAnyTest: b.studentsWithAnyTest ?? 0,
        studentsWithReading: b.studentsWithReading ?? 0,
        studentsWithListening: b.studentsWithListening ?? 0,
        studentsWithWriting: b.studentsWithWriting ?? 0,
        studentsWithSpeaking: b.studentsWithSpeaking ?? 0,
      }));
      setBatches(mappedBatches);

      const apiStudents: StudentFromApi[] = Array.isArray(data.students)
        ? data.students
        : [];

      const mappedStudents: Student[] = apiStudents.map((s) => {
        const reading = typeof s.readingBand === "number" ? s.readingBand : null;
        const listening = typeof s.listeningBand === "number" ? s.listeningBand : null;
        const writing = typeof s.writingBand === "number" ? s.writingBand : null;
        const speaking = typeof s.speakingBand === "number" ? s.speakingBand : null;
        const overall = typeof s.overallBand === "number" ? s.overallBand : null;

        const testsCompleted = [reading, listening, writing, speaking].filter(
          (v) => typeof v === "number" && !Number.isNaN(v)
        ).length;

        return {
          id: s.studentId || s._id,
          name: s.name || "Unknown",
          email: s.email || "",
          systemId: s.systemId || "",
          batchName: s.batchName || null,
          readingBand: reading,
          listeningBand: listening,
          writingBand: writing,
          speakingBand: speaking,
          overallBand: overall,
          testsCompleted,
          averageScore: overall ?? 0,
        };
      });

      setStudents(mappedStudents);

      if (mappedBatches.length > 0 && !selectedBatchId) {
        setSelectedBatchId(mappedBatches[0].id);
      }
    } catch (err: any) {
      console.error("Error loading faculty stats:", err);
      setError(err?.message || "Network error loading data");
      setBatches([]);
      setStudents([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFacultyStats();
  }, []);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedBatch) {
        if (s.batchName !== selectedBatch.name) return false;
      }

      if (!searchTerm.trim()) return true;
      const t = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(t) ||
        (s.email || "").toLowerCase().includes(t) ||
        (s.systemId || "").toLowerCase().includes(t)
      );
    });
  }, [students, selectedBatch, searchTerm]);

  const totalStudents = filteredStudents.length;

  const classAvgScore = totalStudents
    ? filteredStudents.reduce((sum, s) => sum + (s.overallBand || 0), 0) /
    totalStudents
    : 0;

  function formatBand(b: NullableNumber): string {
    if (b == null || Number.isNaN(b)) return "Not attempted";
    return Number(b).toFixed(1);
  }

  function downloadCSV() {
    const rows: string[][] = [];
    rows.push([
      "Name",
      "Email",
      "System ID",
      "Batch",
      "Reading Band",
      "Writing Band",
      "Listening Band",
      "Speaking Band",
      "Overall Band",
      "Tests Completed",
    ]);

    for (const s of filteredStudents) {
      rows.push([
        s.name || "",
        s.email || "",
        s.systemId || "",
        s.batchName || "",
        s.readingBand != null ? String(s.readingBand) : "Not attempted",
        s.writingBand != null ? String(s.writingBand) : "Not attempted",
        s.listeningBand != null ? String(s.listeningBand) : "Not attempted",
        s.speakingBand != null ? String(s.speakingBand) : "Not attempted",
        s.overallBand != null ? String(s.overallBand) : "",
        String(s.testsCompleted || 0),
      ]);
    }

    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${selectedBatch?.name || "all"}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Student Management</h1>
        <p className="text-muted-foreground">
          Select a batch to view its students and IELTS band performance.
        </p>
      </div>

      {/* Batch buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {loading && batches.length === 0 ? (
          <p>Loading batches...</p>
        ) : batches.length === 0 ? (
          <p>No batches assigned.</p>
        ) : (
          batches.map((b) => (
            <Button
              key={b.id}
              variant={b.id === selectedBatchId ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedBatchId(b.id)}
            >
              {b.name}
            </Button>
          ))
        )}
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <Input
          placeholder="Search students by name, email or systemId..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <Button onClick={loadFacultyStats} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button onClick={downloadCSV} variant="outline">
          Download CSV
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Students table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  System ID
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Batch
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Reading
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Writing
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Listening
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Speaking
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Overall Band
                </th>
                <th className="px-6 py-3 text-center text-sm font-semibold">
                  Tests Completed
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center">
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center">
                    No students for this filter.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr
                    key={st.id}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 text-sm font-medium">
                      {st.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {st.email || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {st.systemId || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {st.batchName || "—"}
                    </td>

                    <td className="px-6 py-4 text-center text-sm">
                      {formatBand(st.readingBand)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {formatBand(st.writingBand)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {formatBand(st.listeningBand)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {formatBand(st.speakingBand)}
                    </td>

                    <td className="px-6 py-4 text-center text-sm">
                      {st.overallBand != null
                        ? st.overallBand.toFixed(1)
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      {st.testsCompleted}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Small batch summary cards */}
      {selectedBatch && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">
              Total Students (batch)
            </p>
            <p className="text-3xl font-bold">
              {selectedBatch.totalStudentsInBatch}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">
              Students with any test
            </p>
            <p className="text-3xl font-bold">
              {selectedBatch.studentsWithAnyTest}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">
              Avg Overall Band (filtered)
            </p>
            <p className="text-3xl font-bold">
              {classAvgScore ? classAvgScore.toFixed(1) : "—"}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
