"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import api from "@/lib/api";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/admin/NavItems";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ================= TYPES ================= */

type TestSet = {
    _id: string;
    title: string;
    type: "reading" | "listening" | "writing" | "speaking";
    assignedBatches?: AssignedBatch[];
};

type AssignedBatch = {
    _id: string;
    name: string;
};

type Batch = {
    _id: string;
    name: string;
};

type SubmissionRow = {
    _id: string;
    student: {
        _id: string;
        name: string;
        systemId?: string;
    };
    status: "pending" | "graded" | "failed";
    totalMarks: number;
    maxMarks: number;
    bandScore: number | null;
    correctCount?: number;
    incorrectCount?: number;
    unattemptedCount?: number;
};

/* ================= PAGE ================= */

export default function ScoreCardPage() {
    const router = useRouter();

    const [adminName, setAdminName] = useState("Admin");

    const [tests, setTests] = useState<TestSet[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);

    const [selectedTest, setSelectedTest] = useState<TestSet | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

    const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
    const [loading, setLoading] = useState(false);

    /* ================= INIT ================= */

    useEffect(() => {
        // 🔹 Get admin name from localStorage
        if (typeof window !== "undefined") {
            const name =
                localStorage.getItem("celts_user_name") ||
                localStorage.getItem("userName") ||
                "Admin";
            setAdminName(name);
        }

        fetchTests();
        fetchBatches();
    }, []);

    async function fetchTests() {
        const res = await api.apiGet("/admin/testSet");
        if (res.ok) setTests(res.data || []);
    }

    async function fetchBatches() {
        const res = await api.apiGet("/admin/batches");
        if (res.ok) setBatches(res.data || []);
    }

    /* ================= FETCH SUBMISSIONS ================= */

    async function fetchSubmissions(test: TestSet, batch: Batch) {
        setLoading(true);
        setSubmissions([]);

        const res = await api.apiGet(
            `/admin/testSet/${test._id}/batch/${batch._id}/submissions`
        );

        if (res.ok) {
            setSubmissions(res.data || []);
        } else {
            alert("Failed to fetch submissions");
        }

        setLoading(false);
    }

    /* ================= CSV EXPORT ================= */

    function exportCSV() {
        if (!selectedTest || submissions.length === 0) return;

        const autoGradable =
            selectedTest.type === "reading" ||
            selectedTest.type === "listening";

        const headers = autoGradable
            ? [
                "Student Name",
                "System ID",
                "Marks",
                "Band",
                "Correct",
                "Incorrect",
                "Unattempted",
            ]
            : ["Student Name", "System ID", "Marks", "Band", "Status"];

        const rows = submissions.map((s) =>
            autoGradable
                ? [
                    s.student.name,
                    s.student.systemId || "",
                    `${s.totalMarks}/${s.maxMarks}`,
                    s.bandScore ?? "",
                    s.correctCount ?? 0,
                    s.incorrectCount ?? 0,
                    s.unattemptedCount ?? 0,
                ]
                : [
                    s.student.name,
                    s.student.systemId || "",
                    `${s.totalMarks}/${s.maxMarks}`,
                    s.bandScore ?? "",
                    s.status,
                ]
        );

        const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedTest.title}-${selectedTest.type}-scores.csv`;
        a.click();
    }

    const testType = selectedTest?.type;


    /* ================= RENDER ================= */

    return (
        <DashboardLayout navItems={navItems} sidebarHeader={`Welcome, ${adminName}`}>
            <div className="space-y-6">
                {/* HEADER */}
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => router.back()}>
                        ← Back
                    </Button>
                    <h1 className="text-3xl font-bold">Score Card</h1>
                </div>

                {/* TESTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tests.map((t) => (
                        <Card
                            key={t._id}
                            className={`p-4 cursor-pointer ${selectedTest?._id === t._id
                                    ? "border-black"
                                    : "hover:bg-muted"
                                }`}
                            onClick={() => {
                                setSelectedTest(t);
                                setSelectedBatch(null);
                                setSubmissions([]);
                            }}
                        >
                            <div className="font-semibold">{t.title}</div>
                            <div className="text-sm capitalize text-muted-foreground">
                                {t.type}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* BATCHES */}
                {selectedTest && (
                    <div>
                        <h2 className="font-semibold mb-2">Batches</h2>

                        <div className="flex flex-wrap gap-2">
                            {(selectedTest.assignedBatches || []).map((batch) => (
                                <Button
                                    key={batch._id}
                                    variant={
                                        selectedBatch?._id === batch._id
                                            ? "default"
                                            : "outline"
                                    }
                                    onClick={() => {
                                        setSelectedBatch(batch);
                                        fetchSubmissions(selectedTest, batch);
                                    }}
                                >
                                    {batch.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}


                {/* SUBMISSIONS */}
                {selectedBatch && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold">
                                Students – {selectedBatch.name}
                            </h2>
                            <Button onClick={exportCSV}>Export CSV</Button>
                        </div>

                        {loading ? (
                            <div>Loading...</div>
                        ) : submissions.length === 0 ? (
                            <div className="text-muted-foreground">
                                No submissions found
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="p-2 text-left">Student</th>
                                            <th className="p-2">Band</th>

                                            {(testType === "reading" ||
                                                testType === "listening") && (
                                                    <>
                                                        <th className="p-2">Correct</th>
                                                        <th className="p-2">Incorrect</th>
                                                        <th className="p-2">Unattempted</th>
                                                    </>
                                                )}

                                            {(testType === "writing" ||
                                                testType === "speaking") && (
                                                    <th className="p-2">Status</th>
                                                )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {submissions.map((s) => (
                                            <tr key={s._id} className="border-t">
                                                <td className="p-2">
                                                    {s.student.name}
                                                    <div className="text-xs text-muted-foreground">
                                                        {s.student.systemId}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">
                                                    {s.bandScore ?? "-"}
                                                </td>

                                                {(testType === "reading" ||
                                                    testType === "listening") && (
                                                        <>
                                                            <td className="p-2 text-center">
                                                                {s.correctCount ?? 0}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                {s.incorrectCount ?? 0}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                {s.unattemptedCount ?? 0}
                                                            </td>
                                                        </>
                                                    )}

                                                {(testType === "writing" ||
                                                    testType === "speaking") && (
                                                        <td className="p-2 text-center capitalize">
                                                            {s.status}
                                                        </td>
                                                    )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
