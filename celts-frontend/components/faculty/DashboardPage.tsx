"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    BarChart3,
    Users,
    Layers,
    Activity,
    RefreshCcw,
    AlertCircle,
} from "lucide-react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
} from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

type NullableNumber = number | null | undefined;

interface StatsSummary {
    totalStudentsInBatches: number;
    totalStudentsWithAnyTest: number;
    totalBatches: number;
    overallAvgBand: NullableNumber;
    readingAvg: NullableNumber;
    listeningAvg: NullableNumber;
    writingAvg: NullableNumber;
    speakingAvg: NullableNumber;
}

interface BatchStats {
    _id: string;
    name: string;
    totalStudentsInBatch: number;
    studentsWithAnyTest: number;
    studentsWithReading: number;
    studentsWithListening: number;
    studentsWithWriting: number;
    studentsWithSpeaking: number;
    averageBand: NullableNumber;
    readingBand: NullableNumber;
    listeningBand: NullableNumber;
    writingBand: NullableNumber;
    speakingBand: NullableNumber;
}

interface StudentStatsRow {
    _id: string;
    studentId?: string;
    name: string;
    email: string;
    systemId: string;
    batchName?: string | null;

    readingBand: NullableNumber;
    listeningBand: NullableNumber;
    writingBand: NullableNumber;
    speakingBand: NullableNumber;
    overallBand: NullableNumber;
}

interface FacultyStatsResponse {
    summary?: Partial<StatsSummary>;
    batches?: BatchStats[];
    students?: StudentStatsRow[];
}

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#6366f1"];

function formatBand(b: NullableNumber): string {
    if (b === null || b === undefined || Number.isNaN(b)) return "—";
    const num = Number(b);
    return num.toFixed(1);
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

export default function FacultyDashboardPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<StatsSummary>({
        totalStudentsInBatches: 0,
        totalStudentsWithAnyTest: 0,
        totalBatches: 0,
        overallAvgBand: null,
        readingAvg: null,
        listeningAvg: null,
        writingAvg: null,
        speakingAvg: null,
    });

    const [batches, setBatches] = useState<BatchStats[]>([]);
    const [students, setStudents] = useState<StudentStatsRow[]>([]);

    const [selectedBatchId, setSelectedBatchId] = useState<string | "all">("all");
    const [searchTerm, setSearchTerm] = useState("");

    async function fetchStats() {
        setLoading(true);
        setError(null);
        try {
            const res = await api.apiGet("/faculty/stats");
            if (!res.ok) {
                setError(res.error?.message || "Failed to load stats");
                setLoading(false);
                return;
            }

            const data: FacultyStatsResponse = res.data || {};

            const s = data.summary || {};
            setSummary({
                totalStudentsInBatches: s.totalStudentsInBatches ?? 0,
                totalStudentsWithAnyTest: s.totalStudentsWithAnyTest ?? 0,
                totalBatches: s.totalBatches ?? (data.batches?.length || 0),
                overallAvgBand: s.overallAvgBand ?? null,
                readingAvg: s.readingAvg ?? null,
                listeningAvg: s.listeningAvg ?? null,
                writingAvg: s.writingAvg ?? null,
                speakingAvg: s.speakingAvg ?? null,
            });

            setBatches(Array.isArray(data.batches) ? data.batches : []);
            setStudents(Array.isArray(data.students) ? data.students : []);
        } catch (err: any) {
            setError(err?.message || "Network error");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchStats();
    }, []);


    // Bar chart: per batch – total students vs attempted any test
    const batchAttemptChartData = useMemo(() =>
        batches.map((b) => ({
            name: b.name,
            total: b.totalStudentsInBatch,
            attempted: b.studentsWithAnyTest,
        })),
        [batches]
    );

    // Bar chart: per batch average band
    const batchBandChartData = useMemo(() =>
        batches.map((b) => ({
            name: b.name,
            overall: b.averageBand ?? 0,
            reading: b.readingBand ?? 0,
            listening: b.listeningBand ?? 0,
            writing: b.writingBand ?? 0,
            speaking: b.speakingBand ?? 0,
        })),
        [batches]
    );

    // Pie chart: distribution of students by skill attempt (how many have at least 1 band in each skill)
    const skillAttemptPieData = useMemo(() => {
        if (!students.length) return [];

        let reading = 0,
            listening = 0,
            writing = 0,
            speaking = 0;

        students.forEach((s) => {
            if (typeof s.readingBand === "number") reading += 1;
            if (typeof s.listeningBand === "number") listening += 1;
            if (typeof s.writingBand === "number") writing += 1;
            if (typeof s.speakingBand === "number") speaking += 1;
        });

        return [
            { name: "Reading", value: reading },
            { name: "Listening", value: listening },
            { name: "Writing", value: writing },
            { name: "Speaking", value: speaking },
        ].filter((d) => d.value > 0);
    }, [students]);

    // Top performers table
    const topStudents = useMemo(() => {
        return [...students]
            .filter((s) => typeof s.overallBand === "number")
            .sort(
                (a, b) => (Number(b.overallBand) || 0) - (Number(a.overallBand) || 0)
            )
            .slice(0, 5);
    }, [students]);

    // Filtered students table
    const filteredStudents = useMemo(() => {
        return students.filter((s) => {
            if (selectedBatchId !== "all") {
                const batch = batches.find((b) => b._id === selectedBatchId);
                if (batch && s.batchName && s.batchName !== batch.name) {
                    return false;
                }
            }

            if (!searchTerm.trim()) return true;
            const t = searchTerm.toLowerCase();
            return (
                s.name.toLowerCase().includes(t) ||
                s.systemId.toLowerCase().includes(t) ||
                s.email.toLowerCase().includes(t)
            );
        });
    }, [students, batches, selectedBatchId, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-primary" />
                        Faculty Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Live overview of your batches, student bands, and test participation.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                    disabled={loading}
                >
                    <RefreshCcw className="w-4 h-4 mr-1" />
                    {loading ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {error && (
                <Card className="p-3 flex items-center gap-2 border-red-300 bg-red-50">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                </Card>
            )}

            {/* Top summary metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total students in batches */}
                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Students in your batches
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {summary.totalStudentsInBatches ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across {summary.totalBatches ?? 0} batch
                            {(summary.totalBatches || 0) === 1 ? "" : "es"}
                        </p>
                    </div>
                    <Users className="w-7 h-7 text-muted-foreground" />
                </Card>

                {/* Students who attempted any test */}
                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Students with test attempts
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {summary.totalStudentsWithAnyTest ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.totalStudentsInBatches
                                ? Math.round(
                                    ((summary.totalStudentsWithAnyTest || 0) /
                                        summary.totalStudentsInBatches) *
                                    100
                                ) + "% participation"
                                : "No students yet"}
                        </p>
                    </div>
                    <Activity className="w-7 h-7 text-muted-foreground" />
                </Card>

                {/* Overall band */}
                <Card className="p-4 flex flex-col justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Overall Avg Band
                        </p>
                        <div className="mt-2 inline-flex items-center">
                            <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${bandBadgeClass(
                                    summary.overallAvgBand
                                )}`}
                            >
                                {formatBand(summary.overallAvgBand)}
                            </span>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                        Based on students who attempted any skill.
                    </div>
                </Card>

                {/* Per skill band */}
                <Card className="p-4 text-xs space-y-2">
                    <p className="uppercase tracking-wide text-muted-foreground">
                        Per-skill Averages
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        <span
                            className={`px-2 py-0.5 rounded-full ${bandBadgeClass(
                                summary.readingAvg
                            )}`}
                        >
                            R: {formatBand(summary.readingAvg)}
                        </span>
                        <span
                            className={`px-2 py-0.5 rounded-full ${bandBadgeClass(
                                summary.listeningAvg
                            )}`}
                        >
                            L: {formatBand(summary.listeningAvg)}
                        </span>
                        <span
                            className={`px-2 py-0.5 rounded-full ${bandBadgeClass(
                                summary.writingAvg
                            )}`}
                        >
                            W: {formatBand(summary.writingAvg)}
                        </span>
                        <span
                            className={`px-2 py-0.5 rounded-full ${bandBadgeClass(
                                summary.speakingAvg
                            )}`}
                        >
                            S: {formatBand(summary.speakingAvg)}
                        </span>
                    </div>
                </Card>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bar: total vs attempted per batch */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold">
                                Batch participation overview
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Total students vs. those who have attempted any test.
                            </p>
                        </div>
                        <Layers className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {batchAttemptChartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No batch data available yet.
                        </p>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={batchAttemptChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="total" name="Total students" />
                                    <Bar dataKey="attempted" name="Attempted test" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>

                {/* Bar: average band per batch (overall + per skill) */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold">Batch band comparison</h2>
                            <p className="text-xs text-muted-foreground">
                                Average band scores by batch and skill.
                            </p>
                        </div>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {batchBandChartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No band data available yet.
                        </p>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={batchBandChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                    <YAxis domain={[0, 9]} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="overall" name="Overall" />
                                    <Bar dataKey="reading" name="R" />
                                    <Bar dataKey="listening" name="L" />
                                    <Bar dataKey="writing" name="W" />
                                    <Bar dataKey="speaking" name="S" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>
            </div>

            {/* Second charts row: pie + top students */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie: skill attempt distribution */}
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-sm font-semibold">
                                Skill attempt distribution
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                How many students have bands for each skill.
                            </p>
                        </div>
                    </div>
                    {skillAttemptPieData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No skill attempts recorded yet.
                        </p>
                    ) : (
                        <div className="h-64 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={skillAttemptPieData}
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {skillAttemptPieData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </Card>

                {/* Top students */}
                <Card className="p-4">
                    <h2 className="text-sm font-semibold mb-3">Top students</h2>
                    {topStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No student bands to display yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {topStudents.map((s, i) => (
                                <div
                                    key={s._id}
                                    className="flex items-center justify-between border rounded px-3 py-2 bg-muted/40"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                #{i + 1}
                                            </span>
                                            <span className="font-medium text-sm">{s.name}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {s.batchName || "No batch"} • ID: {s.systemId}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bandBadgeClass(
                                                s.overallBand
                                            )}`}
                                        >
                                            {formatBand(s.overallBand)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
