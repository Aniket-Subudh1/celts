"use client"

import { FileText, Users, BarChart3, Settings } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { FacultyStats } from "@/components/faculty/faculty-stats"
import { TestManagement } from "@/components/faculty/test-management"
import { useEffect, useState } from "react"

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/create_test", label: "Create Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/view_test", label: "View Test", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
]

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

  const [currentTab, setCurrentTab] = useState<"overview" | "tests">("overview")

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Faculty Dashboard</h1>
          <p className="text-muted-foreground">Manage tests, students, and view scores</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button variant={currentTab === "overview" ? "default" : "outline"} onClick={() => setCurrentTab("overview")}>
            Overview
          </Button>
          <Button variant={currentTab === "tests" ? "default" : "outline"} onClick={() => setCurrentTab("tests")}>
            Test Management
          </Button>
        </div>

        {currentTab === "overview" && <FacultyStats />}
        {currentTab === "tests" && <TestManagement />}
      </div>
    </DashboardLayout>
  )
}
