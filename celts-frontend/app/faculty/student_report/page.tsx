"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/faculty/NavItems";
import { StudentReport } from "@/components/faculty/StudentReport";

export default function StudentPage() {
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const stored = localStorage.getItem("celts_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "");
      } catch { }
    }
  }, []);

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <StudentReport />
    </DashboardLayout>
  );
}