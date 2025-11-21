// components/admin/Analytics.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    BarChart3,
    Users,
    UserCog,
    BookOpen,
    FileText,
    RefreshCcw,
    AlertCircle,
    Search,
} from "lucide-react";
import api from "@/lib/api";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";

type AdminAnalyticsResponse = {
    totalUsers: number;
    totalTests: number;
    totalSubmissions: number;
    avgOverallBandScore?: number | null;
    completionRate?: string;
};

type AdminUser = {
    _id: string;
    name: string;
    email: string;
    role: "admin" | "faculty" | "student" | string;
    systemId?: string;
    students?: string[]; // only present for faculty in some data
    assignedFaculty?: string; // only present for students
    createdAt?: string;
};

type RoleCounts = {
    admin: number;
    faculty: number;
    student: number;
};

type StudentBandStat = {
    student?: string; // ObjectId
    studentId?: string;
    systemId?: string;
    overallBand?: number | null;
};

const ROLE_COLORS: Record<string, string> = {
    student: "#4f46e5",
    faculty: "#f97316",
    admin: "#22c55e",
};

function formatBand(b?: number | null) {
    if (b == null || Number.isNaN(b)) return "—";
    return Number(b).toFixed(1);
}

export function AdminAnalytics() {
    const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(
        null
    );
    const [faculty, setFaculty] = useState<AdminUser[]>([]);
    const [students, setStudents] = useState<AdminUser[]>([]);
    const [admins, setAdmins] = useState<AdminUser[]>([]);

    // map: studentId/systemId -> overallBand
    const [studentBandMap, setStudentBandMap] = useState<
        Record<string, number | null>
    >({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [studentSearch, setStudentSearch] = useState("");
    const [facultySearch, setFacultySearch] = useState("");

    // ---------- Fetch analytics + users + student band stats ----------
    async function fetchAnalytics() {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, facRes, studRes, adminRes, bandRes] = await Promise.all([
                api.apiGet("/admin/analytics"),
                api.apiGet("/admin/users?role=faculty"),
                api.apiGet("/admin/users?role=student"),
                api.apiGet("/admin/users?role=admin"),
                // expects an admin endpoint that returns an array of StudentStats-like docs
                // e.g. GET /api/studentStats/admin/all
                api.apiGet("/studentStats/admin/all"),
            ]);

            if (!statsRes.ok) {
                throw new Error(statsRes.error?.message || "Failed to load analytics");
            }

            setAnalytics(statsRes.data || null);
            setFaculty(Array.isArray(facRes.data) ? facRes.data : []);
            setStudents(Array.isArray(studRes.data) ? studRes.data : []);
            setAdmins(Array.isArray(adminRes.data) ? adminRes.data : []);

            // Build band map (studentId/systemId -> overallBand)
            if (bandRes.ok && Array.isArray(bandRes.data)) {
                const map: Record<string, number | null> = {};
                (bandRes.data as StudentBandStat[]).forEach((st: any) => {
                    const overall =
                        typeof st.overallBand === "number" ? st.overallBand : null;

                    const idFromField =
                        typeof st.student === "string" ? st.student : undefined;
                    const idFromStudentId =
                        typeof st.studentId === "string" ? st.studentId : undefined;
                    const sysId =
                        typeof st.systemId === "string" ? st.systemId : undefined;

                    if (idFromField) map[idFromField] = overall;
                    if (idFromStudentId) map[idFromStudentId] = overall;
                    if (sysId) map[sysId] = overall;
                });
                setStudentBandMap(map);
            } else {
                setStudentBandMap({});
            }
        } catch (err: any) {
            console.error("[AdminAnalytics] fetch error:", err);
            setError(err?.message || "Network error fetching analytics");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAnalytics();
    }, []);

    // ---------- Derived metrics ----------
    const roleCounts: RoleCounts = useMemo(() => {
        return {
            admin: admins.length,
            faculty: faculty.length,
            student: students.length,
        };
    }, [admins.length, faculty.length, students.length]);

    const totalUsersFromRoles =
        roleCounts.admin + roleCounts.faculty + roleCounts.student;

    const rolePieData = [
        { name: "Students", value: roleCounts.student, key: "student" },
        { name: "Faculty", value: roleCounts.faculty, key: "faculty" },
        { name: "Admins", value: roleCounts.admin, key: "admin" },
    ].filter((d) => d.value > 0);

    const testsVsSubmissionsData = [
        {
            name: "Counts",
            Tests: analytics?.totalTests ?? 0,
            Submissions: analytics?.totalSubmissions ?? 0,
        },
    ];

    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        const t = studentSearch.toLowerCase();
        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(t) ||
                (s.email || "").toLowerCase().includes(t) ||
                (s.systemId || "").toLowerCase().includes(t)
        );
    }, [students, studentSearch]);

    const filteredFaculty = useMemo(() => {
        if (!facultySearch.trim()) return faculty;
        const t = facultySearch.toLowerCase();
        return faculty.filter(
            (f) =>
                f.name.toLowerCase().includes(t) ||
                (f.email || "").toLowerCase().includes(t) ||
                (f.systemId || "").toLowerCase().includes(t)
        );
    }, [faculty, facultySearch]);

    // ---------- Compute student counts per faculty ----------
    const facultyStudentCounts = useMemo(() => {
        // Map: facultyId -> Set of studentIds
        const map = new Map<string, Set<string>>();

        // 1) from student.assignedFaculty
        students.forEach((s) => {
            const facId = (s as any).assignedFaculty;
            if (!facId) return;
            const key = String(facId);
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(String(s._id));
        });

        // 2) from faculty.students[] (bidirectional link)
        faculty.forEach((f) => {
            const key = String(f._id);
            if (!map.has(key)) map.set(key, new Set());
            const set = map.get(key)!;
            if (Array.isArray(f.students)) {
                f.students.forEach((sid) => {
                    if (!sid) return;
                    set.add(String(sid));
                });
            }
        });

        const counts: Record<string, number> = {};
        map.forEach((set, key) => {
            counts[key] = set.size;
        });

        return counts;
    }, [students, faculty]);

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-primary" />
                        Admin Analytics
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Overview of platform usage across faculty and students.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAnalytics}
                    disabled={loading}
                >
                    <RefreshCcw className="w-4 h-4 mr-1" />
                    {loading ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {/* ERROR BANNER */}
            {error && (
                <Card className="p-3 flex items-center gap-2 border-red-300 bg-red-50">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                </Card>
            )}

            {/* TOP KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total Users
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {analytics?.totalUsers ?? totalUsersFromRoles ?? 0}
                        </p>
                    </div>
                    <Users className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Students
                        </p>
                        <p className="text-2xl font-bold mt-1">{roleCounts.student}</p>
                    </div>
                    <UserCog className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Faculty
                        </p>
                        <p className="text-2xl font-bold mt-1">{roleCounts.faculty}</p>
                    </div>
                    <UserCog className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex flex-col justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Avg Band (All Submissions)
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {formatBand(analytics?.avgOverallBandScore ?? null)}
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Completion: {analytics?.completionRate || "—"}
                    </p>
                </Card>
            </div>

            {/* SECONDARY KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total Tests
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {analytics?.totalTests ?? 0}
                        </p>
                    </div>
                    <FileText className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Total Submissions
                        </p>
                        <p className="text-2xl font-bold mt-1">
                            {analytics?.totalSubmissions ?? 0}
                        </p>
                    </div>
                    <BookOpen className="w-6 h-6 text-muted-foreground" />
                </Card>

                <Card className="p-4 flex flex-col">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Role Distribution
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Students: <span className="font-semibold">{roleCounts.student}</span>
                        , Faculty:{" "}
                        <span className="font-semibold">{roleCounts.faculty}</span>, Admins:{" "}
                        <span className="font-semibold">{roleCounts.admin}</span>
                    </p>
                </Card>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* User roles pie chart */}
                <Card className="p-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        User Role Breakdown
                    </p>
                    {rolePieData.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No user role data available.
                        </p>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={rolePieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        label
                                    >
                                        {rolePieData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={ROLE_COLORS[entry.key] || "#8884d8"}
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

                {/* Tests vs submissions bar chart */}
                <Card className="p-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Tests vs Submissions
                    </p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={testsVsSubmissionsData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Tests" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                <Bar
                                    dataKey="Submissions"
                                    fill="#22c55e"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* FACULTY & STUDENT QUICK VIEW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Faculty quick view */}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold flex items-center gap-2">
                            <UserCog className="w-4 h-4" />
                            Faculty (quick view)
                        </p>
                        <div className="relative w-48">
                            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-7 h-8 text-xs"
                                placeholder="Search faculty..."
                                value={facultySearch}
                                onChange={(e) => setFacultySearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredFaculty.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No faculty match the filter.
                        </p>
                    ) : (
                        <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-xs">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold"> Name </th>
                                        <th className="px-3 py-2 text-left font-semibold"> System ID </th>
                                        <th className="px-3 py-2 text-left font-semibold"> Email </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFaculty.slice(0, 20).map((f) => {
                                        const count =
                                            facultyStudentCounts[f._id] ??
                                            (Array.isArray(f.students) ? f.students.length : 0);

                                        return (
                                            <tr key={f._id} className="border-b last:border-0 hover:bg-muted/40" >
                                                <td className="px-3 py-2">{f.name}</td>
                                                <td className="px-3 py-2 text-[11px]">
                                                    {f.systemId || "—"}
                                                </td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                                    {f.email}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredFaculty.length > 20 && (
                                <p className="text-[11px] text-muted-foreground mt-2">
                                    Showing first 20 of {filteredFaculty.length} faculty. Refine
                                    search to narrow down.
                                </p>
                            )}
                        </div>
                    )}
                </Card>

                {/* Students quick view (with Band Score column) */}
                <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Students (quick view)
                        </p>
                        <div className="relative w-48">
                            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-7 h-8 text-xs"
                                placeholder="Search by name / email / ID"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            No students match the filter.
                        </p>
                    ) : (
                        <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-xs">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            Name
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            Email
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            System ID
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                            Band Score
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.slice(0, 20).map((s) => {
                                        // Try matching by _id or systemId with band map
                                        const bandFromId =
                                            studentBandMap[s._id] ??
                                            (s.systemId ? studentBandMap[s.systemId] : null);
                                        const bandVal =
                                            typeof bandFromId === "number" ? bandFromId : null;

                                        return (
                                            <tr
                                                key={s._id}
                                                className="border-b last:border-0 hover:bg-muted/40"
                                            >
                                                <td className="px-3 py-2">{s.name}</td>
                                                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                                    {s.email}
                                                </td>
                                                <td className="px-3 py-2 text-[11px]">
                                                    {s.systemId || "—"}
                                                </td>
                                                <td className="px-3 py-2 text-right text-[11px]">
                                                    {formatBand(bandVal)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredStudents.length > 20 && (
                                <p className="text-[11px] text-muted-foreground mt-2">
                                    Showing first 20 of {filteredStudents.length} students. Refine
                                    search to narrow down.
                                </p>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

