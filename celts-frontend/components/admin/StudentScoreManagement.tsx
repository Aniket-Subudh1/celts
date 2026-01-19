"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Layers,
    Loader2,
    Search,
    Download,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import api from "@/lib/api";
import { usePagination } from "@/hooks/usePagination";
import {
    buildPaginationQuery,
    getTotalPages,
} from "@/utils/pagination";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";


type NullableNumber = number | null | undefined;

interface BatchRow {
    _id: string;
    name: string;
    totalStudentsInBatch: number;
    studentsWithAnyTest?: number;
}

interface StudentRow {
    _id: string;
    name: string;
    email: string;
    systemId: string;
    batchName?: string | null;

    overallBand?: NullableNumber;
    readingBand?: NullableNumber;
    listeningBand?: NullableNumber;
    writingBand?: NullableNumber;
    speakingBand?: NullableNumber;
    writingExaminerSummary?: string | null;
    speakingExaminerSummary?: string | null;
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
}

interface ApiResponse {
    batches?: BatchRow[];
    students?: StudentRow[];
    batchPagination: PaginationMeta;
    studentPagination: PaginationMeta;
}

function formatBand(b: NullableNumber) {
    if (b == null || Number.isNaN(b)) return "—";
    return Number(b).toFixed(1);
}

function downloadCSV(filename: string, rows: any[]) {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(","),
        ...rows.map((r) =>
            headers.map((h) => `"${String(r[h] ?? "")}"`).join(",")
        ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

export function StudentScoreManagement() {
    /* Pagination */
    const batchPagination = usePagination({ initialLimit: 10 });
    const studentPagination = usePagination({ initialLimit: 10 });

    const batchTotalPages = getTotalPages(
        batchPagination.total,
        batchPagination.limit
    );
    const studentTotalPages = getTotalPages(
        studentPagination.total,
        studentPagination.limit
    );

    /* State */
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [batches, setBatches] = useState<BatchRow[]>([]);
    const [batchSearch, setBatchSearch] = useState("");
    const [students, setStudents] = useState<StudentRow[]>([]);

    const [selectedBatch, setSelectedBatch] = useState<BatchRow | null>(null);
    const [studentSearch, setStudentSearch] = useState("");
    const [summaryStudent, setSummaryStudent] = useState<StudentRow | null>(null);

    const [showPurgeDialog, setShowPurgeDialog] = useState(false);
    const [purging, setPurging] = useState(false);
    const [purgeResult, setPurgeResult] = useState<{
        total: number;
        deleted: number;
    } | null>(null);

    async function fetchBatches() {
        setLoadingBatches(true);
        try {
            const query = buildPaginationQuery(1, 1, {
                batchPage: batchPagination.page,
                batchLimit: batchPagination.limit,
                search: batchSearch || undefined,
            });

            const res = await api.apiGet(`/admin/student-score?${query}`);
            if (!res.ok) throw new Error(res.error?.message);

            const data: ApiResponse = res.data;

            setBatches(data.batches || []);
            batchPagination.setTotal(data.batchPagination.total || 0);
        } finally {
            setLoadingBatches(false);
        }
    }

    async function fetchStudents(batch: BatchRow) {
        setSelectedBatch(batch);
        setLoadingStudents(true);

        try {
            const query = buildPaginationQuery(
                studentPagination.page,
                studentPagination.limit,
                {
                    batchId: batch._id,
                    search: studentSearch || undefined,
                }
            );

            const res = await api.apiGet(`/admin/student-score?${query}`);
            if (!res.ok) throw new Error(res.error?.message);

            const data: ApiResponse = res.data;

            setStudents(data.students || []);
            studentPagination.setTotal(data.studentPagination.total || 0);
        } finally {
            setLoadingStudents(false);
        }
    }

    useEffect(() => {
        fetchBatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchPagination.page]);

    useEffect(() => {
        if (selectedBatch) {
            fetchStudents(selectedBatch);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentPagination.page, studentSearch]);

    // EXPORT STUDENTS CSV
    function exportStudents() {
        if (!selectedBatch) return;

        const rows = students.map((s) => ({
            Batch: selectedBatch.name,
            Name: s.name,
            Email: s.email,
            SystemId: s.systemId,
            Overall: formatBand(s.overallBand),
            Reading: formatBand(s.readingBand),
            Listening: formatBand(s.listeningBand),
            Writing: formatBand(s.writingBand),
            Speaking: formatBand(s.speakingBand),
            WritingSummary: s.writingExaminerSummary || "",
            SpeakingSummary: s.speakingExaminerSummary || "",
        }));

        downloadCSV(
            `student_scores_${selectedBatch.name.replace(/\s+/g, "_")}.csv`,
            rows
        );
    }


    // Delete Student Stats 
    async function purgeStudentStats() {
        setPurging(true);
        setPurgeResult(null);

        try {
            const res = await api.apiDelete("/studentStats/admin/purge");
            if (!res.ok) throw new Error(res.error?.message);

            setPurgeResult({
                total: res.data.total,
                deleted: res.data.deleted,
            });

            // Refresh UI after deletion
            setBatches([]);
            setStudents([]);
            setSelectedBatch(null);
            batchPagination.reset();
            studentPagination.reset();
            fetchBatches();
        } finally {
            setPurging(false);
        }
    }


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Student Score Management</h1>

                <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowPurgeDialog(true)}
                >
                    Delete All Student Stats
                </Button>
            </div>

            {/* BATCH TABLE  */}
            <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Batches
                    </h2>
                </div>


                {loadingBatches ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading batches…
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="px-3 py-2 text-left">Batch</th>
                                <th className="px-3 py-2 text-center">Students</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map((b) => (
                                <tr key={b._id} className="border-b">
                                    <td className="px-3 py-2 font-medium">{b.name}</td>
                                    <td className="px-3 py-2 text-center">
                                        {b.totalStudentsInBatch}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                studentPagination.reset();
                                                fetchStudents(b);
                                            }}
                                        >
                                            View Report
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Batch Pagination Footer */}
                <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">
                        Page{" "}
                        <span className="font-semibold">{batchPagination.page}</span>{" "}
                        of{" "}
                        <span className="font-semibold">{batchTotalPages}</span>{" "}
                        • Total batches:{" "}
                        <span className="font-semibold">{batchPagination.total}</span>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!batchPagination.hasPrev}
                            onClick={batchPagination.prevPage}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!batchPagination.hasNext}
                            onClick={batchPagination.nextPage}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* STUDENT TABLE */}
            {selectedBatch && (
                <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold">
                            Students — {selectedBatch.name}
                        </h2>

                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={exportStudents}>
                                <Download className="w-4 h-4 mr-1" />
                                CSV
                            </Button>
                        </div>
                    </div>

                    {loadingStudents ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading students…
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-3 py-2">Student</th>
                                    <th>Batch Name</th>
                                    <th>System ID</th>
                                    <th>Overall</th>
                                    <th>R</th>
                                    <th>L</th>
                                    <th>W</th>
                                    <th>S</th>
                                    <th className="text-center">Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s._id} className="border-b">
                                        <td className="px-3 py-2">
                                            <div className="font-medium">{s.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {s.email}
                                            </div>
                                        </td>
                                        <td className="text-xs">{s.batchName || "—"}</td>
                                        <td className="text-xs">{s.systemId}</td>
                                        <td>{formatBand(s.overallBand)}</td>
                                        <td>{formatBand(s.readingBand)}</td>
                                        <td>{formatBand(s.listeningBand)}</td>
                                        <td>{formatBand(s.writingBand)}</td>
                                        <td>{formatBand(s.speakingBand)}</td>
                                        <td className="text-center">
                                            {(s.writingExaminerSummary || s.speakingExaminerSummary) ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSummaryStudent(s)}
                                                >
                                                    View
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Student Pagination Footer */}
                    <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-muted-foreground">
                            Page{" "}
                            <span className="font-semibold">{studentPagination.page}</span>{" "}
                            of{" "}
                            <span className="font-semibold">{studentTotalPages}</span>{" "}
                            • Total students:{" "}
                            <span className="font-semibold">
                                {studentPagination.total}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!studentPagination.hasPrev}
                                onClick={studentPagination.prevPage}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!studentPagination.hasNext}
                                onClick={studentPagination.nextPage}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {summaryStudent && (
                <Dialog open={true} onOpenChange={() => setSummaryStudent(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                Examiner Summary — {summaryStudent.name}
                            </DialogTitle>
                        </DialogHeader>

                        {summaryStudent.writingExaminerSummary && (
                            <div className="mt-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                    Writing
                                </p>
                                <p className="text-sm whitespace-pre-wrap">
                                    {summaryStudent.writingExaminerSummary}
                                </p>
                            </div>
                        )}

                        {summaryStudent.speakingExaminerSummary && (
                            <div className="mt-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                    Speaking
                                </p>
                                <p className="text-sm whitespace-pre-wrap">
                                    {summaryStudent.speakingExaminerSummary}
                                </p>
                            </div>
                        )}

                        {!summaryStudent.writingExaminerSummary &&
                            !summaryStudent.speakingExaminerSummary && (
                                <p className="text-sm text-muted-foreground">
                                    No examiner summary available.
                                </p>
                            )}
                    </DialogContent>
                </Dialog>
            )}

            {showPurgeDialog && (
                <Dialog open={true} onOpenChange={setShowPurgeDialog}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-red-600">
                                Delete ALL Student Stats?
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3 text-sm">
                            <p>
                                This action will permanently delete <strong>all student
                                    statistics</strong> from the system.
                            </p>

                            <p className="text-red-600 font-medium">
                                This cannot be undone.
                            </p>

                            {purgeResult && (
                                <div className="rounded-md bg-muted p-2 text-center">
                                    <strong>
                                        {purgeResult.deleted}/{purgeResult.total}
                                    </strong>{" "}
                                    records deleted
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                disabled={purging}
                                onClick={() => setShowPurgeDialog(false)}
                            >
                                Cancel
                            </Button>

                            <Button
                                variant="destructive"
                                disabled={purging}
                                onClick={purgeStudentStats}
                            >
                                {purging && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                Delete All
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
