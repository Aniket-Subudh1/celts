"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useEffect, useState } from "react"
import DashboardPage from "@/components/faculty/DashboardPage"
import { navItems } from "@/components/faculty/NavItems"


export default function FacultyDashboard() {
  const [userName, setUserName] = useState<string>("")
    useEffect(() => {
      const storedUser = localStorage.getItem("celts_user")
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser)
          setUserName(parsed.name || "")
        } catch (err) {
          console.error("Error parsing user from storage:", err)
        }
      }
    }, [])


  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <div className="space-y-6">
        <DashboardPage />
      </div>
    </DashboardLayout>
  )
}
