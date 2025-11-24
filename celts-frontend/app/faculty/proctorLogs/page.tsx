"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { navItems } from "@/components/faculty/NavItems";
import { ProctorLogsViewer } from "@/components/admin/ProctorLogsViewer";

function ProctorLogsContent() {
  const searchParams = useSearchParams();
  const testId = searchParams.get("testId");

  return (
    <>
      {testId ? (
        <ProctorLogsViewer testId={testId} />
      ) : (
        <div className="text-center py-8 text-red-600">
          No test ID provided. Please select a test to view proctoring logs.
        </div>
      )}
    </>
  );
}

export default function FacultyProctorLogsPage() {
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const storedUser = localStorage.getItem("celts_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserName(parsed.name || "");
      } catch (err) {
        console.error("Error parsing user from storage:", err);
      }
    }
  }, []);

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="Faculty Portal" userName={userName}>
      <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
        <ProctorLogsContent />
      </Suspense>
    </DashboardLayout>
  );
}
