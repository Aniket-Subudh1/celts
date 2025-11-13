"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userName?: string
}

export function Header({ userName = "User" }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    // Optionally clear localStorage or cookies here
    localStorage.removeItem("celts_user");
    router.push("/auth/login"); // redirect to auth page
  };

  return (
    <header className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between relative">
        {/* Left side: Welcome */}
        <div>
          <span className="text-xl font-semibold">Welcome {userName}</span>
        </div>

        {/* Right side: User icon and dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-2 rounded-full hover:bg-muted"
          >
            <User className="w-6 h-6" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-card border border-border rounded shadow-md z-10">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-muted"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
