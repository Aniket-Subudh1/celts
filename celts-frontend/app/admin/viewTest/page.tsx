"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useEffect, useState } from "react"
import { navItems } from "@/components/admin/NavItems"
import { ViewTest } from "@/components/admin/ViewTest"


export default function AdminDashboard() {

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
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName= {userName} >
      <ViewTest />
    </DashboardLayout>
  )
}
