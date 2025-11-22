"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText } from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { navItems } from "@/components/student/NavItems";

type TestType = "reading" | "listening" | "writing" | "speaking" | string;

interface StudentTest {
  _id: string;
  title: string;
  type: TestType;
  description?: string;
  scheduledDate?: string;
  timeLimitMinutes?: number;
  status?: "upcoming" | "in-progress" | "completed" | string;
}

export default function StudentTestsPage() {
  const [userName, setUserName] = useState<string>("Student");
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("celts_user")
        : null;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "Student");
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetchAssignedTests();
  }, []);

  async function fetchAssignedTests() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/student/tests");
      if (!res.ok) {
        setError(res.error?.message || "Failed to load tests");
        setTests([]);
        setLoading(false);
        return;
      }

      const arr = Array.isArray(res.data)
        ? res.data
        : res.data?.tests || [];

      setTests(arr || []);
    } catch (err: any) {
      setError(err?.message || "Network error");
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  function displayStatus(status?: string) {
    switch (status) {
      case "upcoming":
        return "Upcoming";
      case "in-progress":
        return "In Progress";
      case "completed":
        return "Completed";
      default:
        return "Assigned";
    }
  }

  function typeLabel(type?: TestType) {
    if (!type) return "Test";
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function statusColorClass(status?: string) {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "in-progress":
        return "bg-amber-100 text-amber-700";
      case "upcoming":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function iconForType(type?: string) {
    switch (type) {
      case "reading":
        return <BookOpen className="w-5 h-5 text-indigo-600" />;
      case "listening":
        return <FileText className="w-5 h-5 text-indigo-600" />;
      case "writing":
        return <FileText className="w-5 h-5 text-indigo-600" />;
      case "speaking":
        return <BookOpen className="w-5 h-5 text-indigo-600" />;
      default:
        return <FileText className="w-5 h-5 text-indigo-600" />;
    }
  }

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName={userName}
    >
      {/* Return Content */}
      <div className="space-y-10">
        {/* Aurora Header */}
        <div
          className="rounded-3xl p-10 text-white shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, #4F46E5 0%, #6366F1 40%, #8B5CF6 100%)",
          }}
        >
          <h1 className="text-4xl font-bold tracking-tight drop-shadow-sm">
            Your Assigned Tests
          </h1>
          <p className="text-indigo-100 text-sm mt-2 max-w-xl">
            Manage, attempt, and track all test activities assigned to you.
          </p>
        </div>

        {loading && (
          <div className="text-sm text-slate-600">Loading tests...</div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && !error && tests.length === 0 && (
          <p className="text-slate-500 text-sm">No tests assigned yet.</p>
        )}

        {/* Test Cards */}
        {!loading && !error && tests.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
            {tests.map((test) => {
              const id = test._id || (test as any).id;
              if (!id) return null;

              return (
                <Card
                  key={id}
                  className="
                    p-6 
                    flex flex-col justify-between 
                    rounded-2xl 
                    border border-slate-200 
                    bg-white 
                    shadow-lg
                    hover:shadow-2xl hover:-translate-y-1 
                    transition-all duration-300
                  "
                >
                  <div className="flex-1 space-y-4">
                    {/* Top Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {iconForType(test.type)}
                        <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
                          {test.title}
                        </h3>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${statusColorClass(
                          test.status
                        )}`}
                      >
                        {displayStatus(test.status)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      {typeLabel(test.type)} •{" "}
                      {test.timeLimitMinutes
                        ? `${test.timeLimitMinutes} min`
                        : "No time limit"}
                    </p>

                    {test.scheduledDate && (
                      <p className="text-xs text-slate-600">
                        Scheduled:{" "}
                        <span className="font-medium">
                          {test.scheduledDate}
                        </span>
                      </p>
                    )}

                    {test.description && (
                      <p className="text-xs text-slate-500 line-clamp-3">
                        {test.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row */}
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      Section:{" "}
                      <span className="font-medium text-slate-800">
                        {typeLabel(test.type)}
                      </span>
                    </span>

                    <Link
                      href={`/student/test/testRunner?testId=${encodeURIComponent(
                        id
                      )}`}
                    >
                      <Button
                        size="sm"
                        className="rounded-lg px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                      >
                        Start Test
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
