"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StudentDetail } from "@/components/faculty/StudentDetail";
import { navItems } from "@/components/faculty/NavItems";

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
      <StudentDetail />
    </DashboardLayout>
  );
}
