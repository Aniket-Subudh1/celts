import { Clock, BookOpen, FileText } from "lucide-react"

export const navItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: <BookOpen className="w-5 h-5" /> },
  { href: "/student/test", label: "My Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/student/scores", label: "My Scores", icon: <Clock className="w-5 h-5" /> },
]