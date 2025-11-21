"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ViewTestForm } from "@/components/faculty/ViewTestForm";
import { navItems } from "@/components/faculty/NavItems";

export default function ViewTestPage() {
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
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <ViewTestForm />
    </DashboardLayout>
  );
}
