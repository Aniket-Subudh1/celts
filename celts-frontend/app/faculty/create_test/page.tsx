
"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import TestCreateForm from "@/components/faculty/TestCreateForm";
import { BarChart3, FileText, Users, Settings } from "lucide-react";

const navItems = [
    { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
    { href: "/faculty/create_test", label: "Create Test", icon: <FileText className="w-5 h-5" /> },
    { href: "/faculty/view_test", label: "View Test", icon: <FileText className="w-5 h-5" /> },
    { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
    { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
];

export default function TestManagementPage() {
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
                <div>
                    <h1 className="text-3xl font-bold mb-2">Create Test</h1>
                    <p className="text-muted-foreground">Add Reading or Listening tests for your students.</p>
                </div>

                <div className="bg-white p-6 rounded shadow-sm">
                    <TestCreateForm />
                </div>
            </div>
        </DashboardLayout>
    );
}
