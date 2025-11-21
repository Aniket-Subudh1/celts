"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/student/NavItems";
import { StudentScore } from "@/components/student/StudentScore";
import { useEffect, useState } from "react";

export default function StudentScorePage() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("celts_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "");
      } catch {
      }
    }
  }, []);

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <StudentScore />
    </DashboardLayout>
  );
}
