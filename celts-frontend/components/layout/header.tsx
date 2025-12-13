"use client"

interface HeaderProps {
  userName?: string
}

export function Header({ userName = "User" }: HeaderProps) {
  return (
    <header
      className="
        w-full px-6 py-5 flex items-center justify-between
        bg-linear-to-r from-sky-300 to-sky-200
        text-black
        shadow-md
        border-b border-sky-700/20
      "
    >
      {/* LEFT SIDE (empty or can add logo later) */}
      <div></div>

      {/* RIGHT SIDE - Welcome text */}
      <h2 className="font-bold text-xl flex items-center gap-2">
        Welcome {userName}
      </h2>
    </header>
  )
}
