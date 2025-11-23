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
  attemptStatus?: "attempted" | "in-progress" | null;
  evaluationStatus?: "under_evaluation" | "evaluated" | "evaluation_failed" | null;
  attemptInfo?: {
    status: string;
    attemptNumber: number;
    isRetryAllowed: boolean;
    completedAt?: string;
    startedAt?: string;
  } | null;
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

  // Refresh data when page becomes visible (user returns from other pages)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page is now visible, refresh test data
        fetchAssignedTests();
      }
    };

    const handleFocus = () => {
      // Window gained focus, refresh test data
      fetchAssignedTests();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
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

  function displayStatus(status?: string, attemptStatus?: string | null, evaluationStatus?: string | null) {
    // Handle evaluation status for attempted tests
    if (attemptStatus === "attempted") {
      if (evaluationStatus === "under_evaluation") {
        return "Under Evaluation";
      }
      if (evaluationStatus === "evaluated") {
        return "Completed";
      }
      if (evaluationStatus === "evaluation_failed") {
        return "Evaluation Failed";
      }
      return "Completed";
    }
    if (attemptStatus === "in-progress") {
      return "In Progress";
    }
    
    // Fall back to general status
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

  function statusColorClass(status?: string, attemptStatus?: string | null, evaluationStatus?: string | null) {
    // Handle evaluation status for attempted tests
    if (attemptStatus === "attempted") {
      if (evaluationStatus === "under_evaluation") {
        return "bg-amber-100 text-amber-700";
      }
      if (evaluationStatus === "evaluated") {
        return "bg-green-100 text-green-700";
      }
      if (evaluationStatus === "evaluation_failed") {
        return "bg-red-100 text-red-700";
      }
      return "bg-green-100 text-green-700";
    }
    if (attemptStatus === "in-progress") {
      return "bg-amber-100 text-amber-700";
    }
    
    // Fall back to general status
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

  function getCurrentStatus(test: StudentTest): "upcoming" | "in-progress" | "completed" {
    // If no scheduled date, use backend status or default to in-progress
    if (!test.scheduledDate) {
      return test.status === "completed" ? "completed" : "in-progress";
    }
    
    const now = new Date();
    const startTime = new Date(test.scheduledDate);
    
    // Check if test has ended (this would need endTime from backend, for now assume not ended)
    // In a full implementation, you'd check test.endTime here
    
    // If current time is before start time
    if (now < startTime) {
      return "upcoming";
    }
    
    // If we're past the start time and test is marked completed
    if (test.status === "completed") {
      return "completed";
    }
    
    // Otherwise, test is available/in-progress
    return "in-progress";
  }

  function canStartTest(test: StudentTest): boolean {
    const currentStatus = getCurrentStatus(test);
    
    // Can't start if test is under evaluation
    if (test.evaluationStatus === "under_evaluation" || test.evaluationStatus === "evaluation_failed") {
      return false;
    }
    
    // Can't start if already attempted (unless retry is allowed)
    if (test.attemptStatus === "attempted" && !test.attemptInfo?.isRetryAllowed) {
      // But allow "View Results" for evaluated tests
      if (test.evaluationStatus === "evaluated") {
        return true; // Allow viewing results
      }
      return false;
    }
    
    // Can't start completed tests unless they have retry permission
    if (currentStatus === "completed" && test.attemptStatus === "attempted" && !test.attemptInfo?.isRetryAllowed) {
      if (test.evaluationStatus === "evaluated") {
        return true; // Allow viewing results
      }
      return false;
    }
    
    // If no scheduled date, test is always available
    if (!test.scheduledDate) return true;
    
    const now = new Date();
    const startTime = new Date(test.scheduledDate);
    
    // Allow access 10 minutes before scheduled time
    const tenMinBefore = new Date(startTime.getTime() - 10 * 60 * 1000);
    
    // Test is available if current time is after (startTime - 10 min)
    return now >= tenMinBefore;
  }

  function getButtonText(test: StudentTest): string {
    const currentStatus = getCurrentStatus(test);
    
    // First check evaluation status for attempted tests (highest priority)
    if (test.attemptStatus === "attempted") {
      if (test.evaluationStatus === "under_evaluation") {
        return "Under Evaluation";
      }
      if (test.evaluationStatus === "evaluated") {
        if (test.attemptInfo?.isRetryAllowed) {
          return "View Results";
        } else {
          return "Completed";
        }
      }
      if (test.evaluationStatus === "evaluation_failed") {
        return "Evaluation Failed";
      }
      
      // Default for attempted tests without evaluation info
      if (test.attemptInfo?.isRetryAllowed) {
        return "Retry Test";
      } else {
        return "Under Evaluation"; // Assume still being processed if no evaluation status
      }
    }
    
    // Handle ongoing attempts (only if not attempted)
    if (test.attemptStatus === "in-progress") {
      return "Continue Test";
    }
    
    // Check if test is completed (after attempt status checks)
    if (currentStatus === "completed" || test.status === "completed") {
      return "Completed";
    }
    
    if (!canStartTest(test)) {
      const startTime = test.scheduledDate ? new Date(test.scheduledDate) : null;
      if (startTime) {
        const tenMinBefore = new Date(startTime.getTime() - 10 * 60 * 1000);
        const now = new Date();
        if (now < tenMinBefore) {
          const minutesUntil = Math.ceil((tenMinBefore.getTime() - now.getTime()) / (1000 * 60));
          if (minutesUntil > 60) {
            const hoursUntil = Math.ceil(minutesUntil / 60);
            return `Starts in ${hoursUntil}h`;
          }
          return `Starts in ${minutesUntil}m`;
        }
      }
      return "Not Available";
    }
    return "Start Test";
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
          className="rounded-2xl md:rounded-3xl p-6 md:p-10 text-white shadow-xl"
          style={{
            background:
              "linear-gradient(135deg, #4F46E5 0%, #6366F1 40%, #8B5CF6 100%)",
          }}
        >
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight drop-shadow-sm">
            Your Assigned Tests
          </h1>
          <p className="text-indigo-100 text-xs md:text-sm mt-2 max-w-xl">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {tests.map((test) => {
              const id = test._id || (test as any).id;
              if (!id) return null;

              return (
                <Card
                  key={id}
                  className="
                    p-4 md:p-6 
                    flex flex-col justify-between 
                    rounded-xl md:rounded-2xl 
                    border border-slate-200 
                    bg-white 
                    shadow-lg
                    hover:shadow-2xl hover:-translate-y-1 
                    transition-all duration-300
                    min-h-[240px]
                  "
                >
                  <div className="flex-1 space-y-3">
                    {/* Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-0.5">
                          {iconForType(test.type)}
                        </div>
                        <h3 className="text-base md:text-lg font-semibold text-slate-900 break-words leading-tight">
                          {test.title}
                        </h3>
                      </div>

                      <span
                        className={`flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${statusColorClass(
                          getCurrentStatus(test),
                          test.attemptStatus,
                          test.evaluationStatus
                        )}`}
                      >
                        {displayStatus(getCurrentStatus(test), test.attemptStatus, test.evaluationStatus)}
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
                          {new Date(test.scheduledDate).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </p>
                    )}

                    {test.description && (
                      <p className="text-xs text-slate-500 line-clamp-3">
                        {test.description}
                      </p>
                    )}

                    {test.attemptStatus === "attempted" && test.attemptInfo && (
                      <div className={`text-xs rounded-lg p-2 ${
                        test.evaluationStatus === "under_evaluation" 
                          ? "text-amber-600 bg-amber-50"
                          : test.evaluationStatus === "evaluated"
                          ? "text-green-600 bg-green-50"
                          : test.evaluationStatus === "evaluation_failed"
                          ? "text-red-600 bg-red-50"
                          : "text-orange-600 bg-orange-50"
                      }`}>
                        <p className="font-medium">Attempt #{test.attemptInfo.attemptNumber}</p>
                        {test.attemptInfo.completedAt && (
                          <p>
                            Completed: {new Date(test.attemptInfo.completedAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                        {test.evaluationStatus === "under_evaluation" && (
                          <p className="font-medium">⏳ Evaluation in progress</p>
                        )}
                        {test.evaluationStatus === "evaluated" && (
                          <p className="font-medium">✅ Results available</p>
                        )}
                        {test.evaluationStatus === "evaluation_failed" && (
                          <p className="font-medium">❌ Evaluation failed</p>
                        )}
                        {test.attemptInfo.isRetryAllowed && (
                          <p className="text-green-600 font-medium">🔄 Retry allowed</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row */}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-600">
                      Section:{" "}
                      <span className="font-medium text-slate-800">
                        {typeLabel(test.type)}
                      </span>
                    </span>

                    {/* Button Logic */}
                    {(() => {
                      const buttonText = getButtonText(test);
                      const canStart = canStartTest(test);
                      
                      // Handle "Under Evaluation" state
                      if (test.evaluationStatus === "under_evaluation") {
                        return (
                          <div className="w-full sm:w-auto">
                            <Button
                              size="sm"
                              disabled
                              className="w-full sm:w-auto rounded-lg px-4 py-2 bg-amber-100 text-amber-700 shadow-md cursor-not-allowed text-xs md:text-sm"
                            >
                              Under Evaluation
                            </Button>
                          </div>
                        );
                      }
                      
                      // Handle "Evaluation Failed" state
                      if (test.evaluationStatus === "evaluation_failed") {
                        return (
                          <div className="w-full sm:w-auto">
                            <Button
                              size="sm"
                              disabled
                              className="w-full sm:w-auto rounded-lg px-4 py-2 bg-red-100 text-red-700 shadow-md cursor-not-allowed text-xs md:text-sm"
                            >
                              Evaluation Failed
                            </Button>
                          </div>
                        );
                      }
                      
                      // Handle "View Results" for evaluated tests
                      if (test.evaluationStatus === "evaluated" && test.attemptStatus === "attempted") {
                        // Find the latest submission ID to link to results
                        // For now, redirect to dashboard where they can find their results
                        return (
                          <Link
                            href="/student/dashboard"
                            className="w-full sm:w-auto"
                          >
                            <Button
                              size="sm"
                              className="w-full sm:w-auto rounded-lg px-4 py-2 bg-green-600 hover:bg-green-700 text-white shadow-md text-xs md:text-sm"
                            >
                              View Results
                            </Button>
                          </Link>
                        );
                      }
                      
                      // Handle startable tests
                      if (canStart) {
                        return (
                          <Link
                            href={`/student/test/instructions?testId=${encodeURIComponent(id)}`}
                            className="w-full sm:w-auto"
                          >
                            <Button
                              size="sm"
                              className="w-full sm:w-auto rounded-lg px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md text-xs md:text-sm"
                            >
                              {buttonText}
                            </Button>
                          </Link>
                        );
                      }
                      
                      // Handle completed tests (not startable)
                      if (test.attemptStatus === "attempted" && !test.attemptInfo?.isRetryAllowed) {
                        return (
                          <div className="w-full sm:w-auto">
                            <Button
                              size="sm"
                              disabled
                              className="w-full sm:w-auto rounded-lg px-4 py-2 bg-green-100 text-green-700 shadow-md cursor-not-allowed text-xs md:text-sm"
                            >
                              Completed
                            </Button>
                          </div>
                        );
                      }
                      
                      // Default disabled state
                      return (
                        <Button
                          size="sm"
                          disabled
                          className="w-full sm:w-auto rounded-lg px-4 py-2 bg-slate-300 text-slate-600 shadow-md cursor-not-allowed text-xs md:text-sm"
                        >
                          {buttonText}
                        </Button>
                      );
                    })()}
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
