"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { User } from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface SidebarProps {
  items: NavItem[]
  header: string
}

export function Sidebar({ items, header }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("celts_user")
    router.push("/auth/login")
  }

  return (
    <aside
      className={cn(
        "h-screen flex flex-col",
        "w-45 min-w-[88px]",
        "bg-linear-to-b from-sky-300 to-sky-200",
        "text-black shadow-xl",
        "overflow-hidden"
      )}
    >
      {/* Logo area */}
      <div className="shrink-0 px-8 py-4 border-b border-white/10 flex items-center justify-center">
        <img
          src="/cutm_logo_transparent.png"
          alt="Logo"
          className="h-40 w-auto drop-shadow"
        />
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-2 py-2 flex flex-col items-center space-y-3 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "w-full flex flex-col items-center gap-2 px-2 py-3 rounded-2xl transition-all text-center select-none",
                isActive
                  ? "bg-white/95 text-sky-800 shadow-md ring-1 ring-black/60"
                  : "text-black/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shadow-sm",
                  isActive ? "bg-white" : "bg-black/10"
                )}
              >
                <span className={cn(isActive ? "text-sky-700" : "text-white")}>
                  {item.icon}
                </span>
              </span>

              <span className="text-xs font-medium leading-none truncate w-full">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Simple Logout Button */}
      <div className="px-4 py-6 border-t border-white/10 w-full">
        <button
          onClick={handleLogout}
          className="
            w-full bg-white text-black font-semibold
            py-2 rounded-lg shadow-sm
            hover:bg-white/80 transition
          "
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
