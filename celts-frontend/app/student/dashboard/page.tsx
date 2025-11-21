"use client"

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StudDashboard } from "@/components/student/StudDashboard";
import { navItems } from "@/components/student/NavItems";

export default function StudentDashboard() {
  const [userName, setUserName] = useState("Student");
    useEffect(() => {
      const stored = typeof window !== "undefined"
        ? localStorage.getItem("celts_user")
        : null;
  
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUserName(parsed.name || "Student");
        } catch {
          /* ignore */
        }
      }
    }, []);


  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName={userName}>
      <StudDashboard />
    </DashboardLayout>
  )
}
