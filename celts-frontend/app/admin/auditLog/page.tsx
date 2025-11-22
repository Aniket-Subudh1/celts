"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/admin/NavItems";
import { AuditLog } from "@/components/admin/AuditLog";
import { useEffect, useState } from "react";

export default function AuditPage() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("celts_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserName(parsed.name || "");
      } catch {}
    }
  }, []);

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName={userName} >
      <AuditLog />
    </DashboardLayout>
  );
}
