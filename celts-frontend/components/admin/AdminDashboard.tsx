"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { BarChart, Users, School, FileText, TrendingUp } from "lucide-react";
import { navItems } from "./NavItems";

const iconMap: any = {
  BarChart,
  Users,
  School,
  FileText,
  TrendingUp,
};

export function AdminDashboardPage() {
  // Filter out the Dashboard card
  const filteredNavItems = navItems.filter((item) => item.label !== "Dashboard");

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Navigate through the system controls and manage everything in one place.
        </p>
      </div>

      {/* Grid of Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNavItems.map((item, index) => {
          const Icon = iconMap[item.icon?.type?.name] || BarChart;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.4 }}
            >
              <Link href={item.href}>
                <Card className="group relative overflow-hidden cursor-pointer rounded-2xl border border-border hover:border-primary transition-all shadow-sm hover:shadow-md">
                  {/* Gradient Background Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-all" />

                  <CardContent className="p-6 flex items-start space-x-4 relative z-10">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                        {item.label}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {getDescription(item.label)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Description generator for each card
function getDescription(label: string) {
  switch (label) {
    case "User Management":
      return "Manage users, roles & accounts.";
    case "Batch Management":
      return "View & configure student batches.";
    case "Permissions":
      return "Control access levels and privileges.";
    case "Analytics":
      return "Insights into users, tests & performance.";
    default:
      return "Open module.";
  }
}
