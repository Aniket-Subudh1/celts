"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { navItems } from "@/components/faculty/NavItems";
import { ProctorLogsViewer } from "@/components/admin/ProctorLogsViewer";

export default function FacultyProctorLogsPage() {
  const searchParams = useSearchParams();
  const testId = searchParams.get("testId");
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
      {testId ? (
        <ProctorLogsViewer testId={testId} />
      ) : (
        <div className="text-center py-8 text-red-600">
          No test ID provided. Please select a test to view proctoring logs.
        </div>
      )}
    </DashboardLayout>
  );
}
