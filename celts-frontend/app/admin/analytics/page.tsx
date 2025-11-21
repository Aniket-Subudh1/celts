"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { navItems } from "@/components/admin/NavItems"
import { useEffect, useState } from "react"
import { AdminAnalytics } from "@/components/admin/Analytics"

export default function AnalyticsPage() {
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
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName={userName}>
      <AdminAnalytics />
    </DashboardLayout>
  )
}
