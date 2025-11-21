"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Clock } from "lucide-react";

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
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("celts_user") : null;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "Student");
      } catch {
        // ignore
      }
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

      const arr = Array.isArray(res.data) ? res.data : res.data?.tests || [];
      setTests(arr || []);
    } catch (err: any) {
      console.error("Error fetching student tests:", err);
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

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Tests</h1>
          <p className="text-muted-foreground">
            All tests assigned to you based on your batch.
          </p>
        </div>

        {loading && <p>Loading tests...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && tests.length === 0 && (
          <p>No tests assigned to you yet.</p>
        )}

        {!loading && !error && tests.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tests.map((test) => {
              const id = test._id || (test as any).id;
              if (!id) return null; // safety

              return (
                <Card
                  key={id}
                  className="p-4 flex flex-col justify-between min-h-[180px] rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-md font-semibold line-clamp-2">{test.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {typeLabel(test.type)} •{" "}
                          {test.timeLimitMinutes
                            ? `${test.timeLimitMinutes} min`
                            : "No time limit"}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 uppercase">
                        {displayStatus(test.status)}
                      </span>
                    </div>

                    {test.scheduledDate && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Date: {test.scheduledDate}
                      </p>
                    )}

                    {test.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 mt-1">
                        {test.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Section: <span className="font-medium">{typeLabel(test.type)}</span>
                    </span>
                    {/* Tile button -> go to full-screen test runner */}
                    <Link href={`/student/test/testRunner?testId=${encodeURIComponent(id)}`}>
                      <Button size="sm">
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
