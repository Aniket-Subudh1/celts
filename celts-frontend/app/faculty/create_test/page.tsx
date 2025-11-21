
"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import TestCreateForm from "@/components/faculty/TestCreateForm";
import { navItems } from "@/components/faculty/NavItems";

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
                    <p className="text-muted-foreground">Develop Comprehensive English Skill Tests</p>
                </div>

                <div className="bg-white p-6 rounded shadow-sm">
                    <TestCreateForm />
                </div>
            </div>
        </DashboardLayout>
    );
}
