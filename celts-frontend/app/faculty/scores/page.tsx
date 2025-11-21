"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useState, useEffect } from "react"
import { FacultyStats } from "@/components/faculty/FacultyStats"
import { navItems } from "@/components/faculty/NavItems"



export default function ScoreManagementPage() {
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
      <FacultyStats/>
    </DashboardLayout>
  )
}
