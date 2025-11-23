"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertCircle,
    BarChart3,
    Filter,
    RefreshCcw,
    Search,
    Users,
    CalendarClock,
} from "lucide-react";
import api from "@/lib/api";

type NullableNumber = number | null | undefined;

type SkillType = "reading" | "listening" | "writing" | "speaking" | string;

interface OverrideAuditEntry {
    _id: string;

    batchId?: string | null;
    batchName?: string | null;

    studentId: string;
    studentName: string;
    studentSystemId: string;
    studentEmail?: string;

    skill: SkillType;
    oldBandScore: NullableNumber;
    newBandScore: NullableNumber;

    reason?: string;
    changedAt: string;
    submissionId?: string;

    facultyId: string;
    facultyName: string;
    facultySystemId?: string | null;
}

interface OverridesResponse {
    logs: OverrideAuditEntry[];
}

function formatBand(b: NullableNumber): string {
    if (b === null || b === undefined || Number.isNaN(b)) return "—";
    return Number(b).toFixed(1);
}

function bandBadgeClass(b: NullableNumber): string {
    if (b === null || b === undefined || Number.isNaN(b)) {
        return "bg-muted text-muted-foreground";
    }
    const val = Number(b);
    if (val >= 7.5) return "bg-emerald-100 text-emerald-800";
    if (val >= 6.5) return "bg-sky-100 text-sky-800";
    if (val >= 5.5) return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-800";
}

function formatDateTime(iso: string | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
}

function skillLabel(skill: SkillType) {
    switch (skill) {
        case "reading":
            return "Reading";
        case "listening":
            return "Listening";
        case "writing":
            return "Writing";
        case "speaking":
            return "Speaking";
        default:
            return skill;
    }
}

export function AuditLog() {
    const [logs, setLogs] = useState<OverrideAuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedBatchId, setSelectedBatchId] = useState<string | "all">("all");
    const [selectedSkill, setSelectedSkill] = useState<SkillType | "all">("all");
    const [searchTerm, setSearchTerm] = useState("");

    async function fetchLogs() {
        setLoading(true);
        setError(null);
        try {
            const res = await api.apiGet("/admin/audit/overrides");
            if (!res.ok) {
                setError(res.error?.message || "Failed to fetch override logs");
                setLogs([]);
                setLoading(false);
                return;
            }

            const data: OverridesResponse = res.data || { logs: [] };
            setLogs(Array.isArray(data.logs) ? data.logs : []);
        } catch (err: any) {
            console.error("[AuditLog] fetch error:", err);
            setError(err?.message || "Network error");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLogs();
    }, []);

    const batchOptions = useMemo(() => {
        const map = new Map<string, string>();
        logs.forEach((l) => {
            const id = l.batchId || "unassigned";
            const name = l.batchName || "Unassigned / No batch";
            if (!map.has(id)) map.set(id, name);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [logs]);

    const distinctFacultyCount = useMemo(() => {
        const set = new Set<string>();
        logs.forEach((l) => set.add(l.facultyId));
        return set.size;
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (selectedBatchId !== "all") {
                const id = log.batchId || "unassigned";
                if (id !== selectedBatchId) return false;
            }

            if (selectedSkill !== "all") {
                if (log.skill !== selectedSkill) return false;
            }

            if (searchTerm.trim()) {
                const t = searchTerm.toLowerCase();
                const haystack = [
                    log.studentName,
                    log.studentSystemId,
                    log.studentEmail || "",
                    log.facultyName,
                    log.facultySystemId || "",
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(t)) return false;
            }

            return true;
        });
    }, [logs, selectedBatchId, selectedSkill, searchTerm]);

    const groupedByBatch = useMemo(() => {
        type StudentGroup = {
            studentId: string;
            studentName: string;
            studentSystemId: string;
            studentEmail?: string;
            entries: OverrideAuditEntry[];
        };

        type BatchGroup = {
            batchId: string;
            batchName: string;
            students: StudentGroup[];
        };

        const batchMap = new Map<string, BatchGroup>();

        filteredLogs.forEach((log) => {
            const bId = log.batchId || "unassigned";
            const bName = log.batchName || "Unassigned / No batch";

            if (!batchMap.has(bId)) {
                batchMap.set(bId, {
                    batchId: bId,
                    batchName: bName,
                    students: [],
                });
            }

            const batchGroup = batchMap.get(bId)!;

            let studentGroup = batchGroup.students.find(
                (s) => s.studentId === log.studentId
            );
            if (!studentGroup) {
                studentGroup = {
                    studentId: log.studentId,
                    studentName: log.studentName,
                    studentSystemId: log.studentSystemId,
                    studentEmail: log.studentEmail,
                    entries: [],
                };
                batchGroup.students.push(studentGroup);
            }

            studentGroup.entries.push(log);
        });

        const result = Array.from(batchMap.values());
        result.sort((a, b) => a.batchName.localeCompare(b.batchName));

        result.forEach((batch) => {
            batch.students.sort((a, b) =>
                a.studentName.localeCompare(b.studentName)
            );
            batch.students.forEach((s) =>
                s.entries.sort(
                    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
                )
            );
        });

        return result;
    }, [filteredLogs]);

    return (
        <div className="space-y-6">
            {/* Header & summary */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Manual Score Overrides
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Monitor which faculty manually changed band scores, for which
                        students, and why.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCcw className="w-4 h-4 mr-1" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <Card className="p-3 flex items-center gap-2 border-red-300 bg-red-50">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                </Card>
            )}

            {/* Top stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total Overrides
                        </p>
                        <p className="text-2xl font-bold mt-1">{logs.length}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Across all skills and students.
                        </p>
                    </div>
                    <BarChart3 className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Distinct Faculties
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {distinctFacultyCount}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Who have manually edited scores.
                        </p>
                    </div>
                    <Users className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Batches With Overrides
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {batchOptions.length}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Based on current override logs.
                        </p>
                    </div>
                    <CalendarClock className="w-6 h-6 text-muted-foreground" />
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Filters</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    {/* Batch filter */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Batch</span>
                        <select
                            className="border rounded px-2 py-1 text-sm min-w-[180px]"
                            value={selectedBatchId}
                            onChange={(e) =>
                                setSelectedBatchId(
                                    (e.target.value || "all") as string | "all"
                                )
                            }
                        >
                            <option value="all">All batches</option>
                            {batchOptions.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Skill filter */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Skill</span>
                        <select
                            className="border rounded px-2 py-1 text-sm min-w-[150px]"
                            value={selectedSkill}
                            onChange={(e) =>
                                setSelectedSkill(
                                    (e.target.value || "all") as SkillType | "all"
                                )
                            }
                        >
                            <option value="all">All skills</option>
                            <option value="writing">Writing</option>
                            <option value="speaking">Speaking</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex-1">
                        <div className="relative max-w-sm">
                            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-8 h-8 text-sm"
                                placeholder="Search by student/faculty name, ID or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Grouped view: Batch -> Student -> Marks changes */}
            {groupedByBatch.length === 0 ? (
                <Card className="p-4">
                    <p className="text-sm text-muted-foreground">
                        No overrides found for the selected filters.
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {groupedByBatch.map((batch) => (
                        <Card key={batch.batchId} className="p-4 space-y-3">
                            {/* Batch header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-semibold">
                                        Batch: {batch.batchName}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {batch.students.length} student(s) with overrides
                                    </p>
                                </div>
                            </div>

                            {/* Students inside this batch */}
                            <div className="space-y-3 mt-2">
                                {batch.students.map((stu) => (
                                    <div
                                        key={stu.studentId}
                                        className="border rounded-md p-3 bg-muted/40"
                                    >
                                        {/* Student header */}
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 mb-2">
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {stu.studentName}{" "}
                                                    <span className="text-xs text-muted-foreground">
                                                        ({stu.studentSystemId})
                                                    </span>
                                                </p>
                                                {stu.studentEmail && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {stu.studentEmail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Override table for this student */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs md:text-sm">
                                                <thead>
                                                    <tr className="bg-background">
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            Skill
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            Old Band
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            New Band
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            Faculty
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            Reason
                                                        </th>
                                                        <th className="px-2 py-1 text-left font-semibold">
                                                            When
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {stu.entries.map((e) => (
                                                        <tr
                                                            key={e._id}
                                                            className="border-t border-muted/60"
                                                        >
                                                            <td className="px-2 py-1">
                                                                {skillLabel(e.skill)}
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-[11px] ${bandBadgeClass(
                                                                        e.oldBandScore
                                                                    )}`}
                                                                >
                                                                    {formatBand(e.oldBandScore)}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-[11px] ${bandBadgeClass(
                                                                        e.newBandScore
                                                                    )}`}
                                                                >
                                                                    {formatBand(e.newBandScore)}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">
                                                                        {e.facultyName}
                                                                    </span>
                                                                    {e.facultySystemId && (
                                                                        <span className="text-[11px] text-muted-foreground">
                                                                            ID: {e.facultySystemId}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1 max-w-xs">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {e.reason || "—"}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDateTime(e.changedAt)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
