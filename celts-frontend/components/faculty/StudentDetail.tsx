"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Users,
  Layers,
  GraduationCap,
  FileSpreadsheet,
} from "lucide-react";
import api from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";

/* ===================== TYPES ===================== */

type NullableNumber = number | null | undefined;

interface FacultyStatsSummary {
  totalStudentsInBatches: number;
  totalStudentsWithAnyTest: number;
  totalBatches: number;
  overallAvgBand: NullableNumber;
}

interface FacultyBatchFromApi {
  _id: string;
  name: string;
  totalStudentsInBatch?: number;
  studentsWithAnyTest?: number;
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
}

interface Batch {
  id: string;
  name: string;
  totalStudentsInBatch: number;
  studentsWithAnyTest: number;
}

/* ===================== COMPONENT ===================== */

export function StudentDetail() {
  const pagination = usePagination({ initialLimit: 10 });

  const [summary, setSummary] = useState<FacultyStatsSummary | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function loadFacultyStats() {
    const res = await api.apiGet("/faculty/stats");
    if (!res.ok) return;

    const data = res.data || {};

    setSummary({
      totalStudentsInBatches: data.summary?.totalStudentsInBatches ?? 0,
      totalStudentsWithAnyTest: data.summary?.totalStudentsWithAnyTest ?? 0,
      totalBatches: data.summary?.totalBatches ?? 0,
      overallAvgBand: data.summary?.overallAvgBand ?? null,
    });

    const mappedBatches: Batch[] = (data.batches || []).map(
      (b: FacultyBatchFromApi) => ({
        id: b._id,
        name: b.name,
        totalStudentsInBatch: b.totalStudentsInBatch ?? 0,
        studentsWithAnyTest: b.studentsWithAnyTest ?? 0,
      })
    );

    setBatches(mappedBatches);
    if (!selectedBatchId && mappedBatches.length) {
      setSelectedBatchId(mappedBatches[0].id);
    }

    const mappedStudents: Student[] = (data.students || []).map(
      (s: StudentFromApi) => {
        const bands = [
          s.readingBand,
          s.listeningBand,
          s.writingBand,
          s.speakingBand,
        ];
        return {
          id: s.studentId || s._id,
          name: s.name,
          email: s.email,
          systemId: s.systemId,
          batchName: s.batchName,
          readingBand: s.readingBand ?? null,
          listeningBand: s.listeningBand ?? null,
          writingBand: s.writingBand ?? null,
          speakingBand: s.speakingBand ?? null,
          overallBand: s.overallBand ?? null,
          testsCompleted: bands.filter((b) => typeof b === "number").length,
        };
      }
    );

    setStudents(mappedStudents);
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
      if (selectedBatch && s.batchName !== selectedBatch.name) return false;
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(t) ||
        s.email?.toLowerCase().includes(t) ||
        s.systemId?.toLowerCase().includes(t)
      );
    });
  }, [students, selectedBatch, searchTerm]);

  function formatBand(b: NullableNumber) {
    if (b == null) return "Not attempted";
    return b.toFixed(1);
  }

  function downloadCSV() {
    const rows = [
      [
        "Name",
        "Email",
        "System ID",
        "Batch",
        "Reading",
        "Writing",
        "Listening",
        "Speaking",
        "Overall",
      ],
      ...filteredStudents.map((s) => [
        s.name,
        s.email || "",
        s.systemId || "",
        s.batchName || "",
        formatBand(s.readingBand),
        formatBand(s.writingBand),
        formatBand(s.listeningBand),
        formatBand(s.speakingBand),
        s.overallBand?.toFixed(1) ?? "",
      ]),
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
  pagination.reset();
}, [selectedBatchId, searchTerm]);


useEffect(() => {
  pagination.setTotal(filteredStudents.length);
}, [filteredStudents, pagination]);


const paginatedStudents = useMemo(() => {
  const start = (pagination.page - 1) * pagination.limit;
  const end = start + pagination.limit;
  return filteredStudents.slice(start, end);
}, [filteredStudents, pagination.page, pagination.limit]);


  return (
    <div className="space-y-6">
      {/* ================= KPI CARDS ================= */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Layers} label="Total Batches" value={summary.totalBatches} />
          <StatCard icon={Users} label="Total Students" value={summary.totalStudentsInBatches} />
          <StatCard icon={GraduationCap} label="Students with Tests" value={summary.totalStudentsWithAnyTest} />
          <StatCard
            icon={FileSpreadsheet}
            label="Avg Overall Band"
            value={summary.overallAvgBand?.toFixed(1) ?? "—"}
          />
        </div>
      )}

      {/* ================= SIMPLE BATCH SELECTOR ================= */}
      <div className="flex gap-3 overflow-x-auto pt-4 pb-2">
        {batches.map((b) => {
          const active = b.id === selectedBatchId;

          return (
            <button
              key={b.id}
              onClick={() => setSelectedBatchId(b.id)}
              className={`min-w-[200px] rounded-lg border px-3 py-3 text-left transition
                ${active
                  ? "border-primary bg-primary/5"
                  : "bg-white hover:bg-slate-50"}
              `}
            >
              <p className="text-m font-medium text-slate-900">
                {b.name}
              </p>
              {/* <p className="text-xs text-slate-500 mt-1">
                {b.studentsWithAnyTest} / {b.totalStudentsInBatch} attempted
              </p> */}
            </button>
          );
        })}
      </div>

      {/* ================= SEARCH + ACTIONS ================= */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={downloadCSV}>
          Download CSV
        </Button>
      </div>

      {/* ================= TABLE ================= */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Name",
                "Email",
                "System ID",
                "Batch",
                "Reading",
                "Writing",
                "Listening",
                "Speaking",
                "Overall",
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            { paginatedStudents.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">{s.systemId}</td>
                <td className="px-4 py-3">{s.batchName}</td>
                <td className="px-4 py-3 text-center">{formatBand(s.readingBand)}</td>
                <td className="px-4 py-3 text-center">{formatBand(s.writingBand)}</td>
                <td className="px-4 py-3 text-center">{formatBand(s.listeningBand)}</td>
                <td className="px-4 py-3 text-center">{formatBand(s.speakingBand)}</td>
                <td className="px-4 py-3 text-center">
                  {s.overallBand?.toFixed(1) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>





        <div className="flex flex-col px-3 md:flex-row md:items-center md:justify-between gap-3">

    {/* LEFT: Info */}
    <div className="text-sm text-muted-foreground">
      Page{" "}
      <span className="font-semibold text-foreground">
        {pagination.page}
      </span>{" "}
      of{" "}
      <span className="font-semibold text-foreground">
        {Math.max(Math.ceil(pagination.total / pagination.limit), 1)}
      </span>{" "}
      • Total students:{" "}
      <span className="font-semibold text-foreground">
        {pagination.total}
      </span>
    </div>

    {/* RIGHT: Controls */}
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!pagination.hasPrev}
        onClick={pagination.prevPage}
      >
        Previous
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!pagination.hasNext}
        onClick={pagination.nextPage}
      >
        Next
      </Button>
    </div>
  </div>




      </Card>
    </div>
  );
}

/* ===================== KPI CARD ===================== */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: any;
}) {
  return (
    <Card className="h-28 px-6 flex flex-row items-center gap-4">
      <Icon className="w-6 h-6 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
    </Card>
  );
}
